/**
 * One live phone call.
 *
 * States:
 *   GREETING -> LISTENING <-> THINKING -> SPEAKING -> LISTENING ... -> ENDED
 *
 * The two things that make this feel like a person rather than an IVR:
 *
 *  1. Sentence pipelining. The LLM streams, and each finished sentence goes to
 *     TTS immediately instead of waiting for the whole reply.
 *
 *  2. Barge-in. When the caller talks over us we must stop within ~100 ms. The
 *     critical piece is the carrier's `clear` event: audio we already sent is
 *     sitting in Telnyx's buffer, and without `clear` the caller keeps hearing
 *     us talk for seconds after they interrupted. Cancelling our own side is
 *     not enough.
 *
 *  3. Realtime pacing. Audio leaves for the carrier at the speed it is heard,
 *     not the speed the synthesiser produces it (see src/paced.ts). Everything
 *     above depends on it. Without pacing the whole reply is handed over in a
 *     fraction of its own length, the state machine finishes the turn while the
 *     caller is still on the first sentence, and there is no SPEAKING state
 *     left for barge-in to interrupt.
 *
 * Transcript honesty: we store only what the caller actually HEARD, which is
 * real playback time from the paced writer rather than how much we handed over.
 * Storing the model's full reply when it was cut off after six words produces
 * the classic "as I mentioned..." failure on the next turn.
 */
import type { WebSocket } from "ws";
import { config } from "./config.js";
import { estimateSpeechMs, heardSentences } from "./audio.js";
import { PacedWriter } from "./paced.js";
import { SttStream } from "./stt.js";
import { makeTtsProvider, type TtsStream, type Semaphore } from "./tts/index.js";
import { streamTurn, warmTurnPath } from "./llm.js";
import { isOptOut } from "./outbound.js";
import { pickProducts } from "./catalog.js";
import * as db from "./supabase.js";
import type { VoiceSettings } from "./supabase.js";

type State = "GREETING" | "LISTENING" | "THINKING" | "SPEAKING" | "ENDED";

/**
 * Longest we will keep listening to one uninterrupted stretch before replying.
 *
 * Turn taking normally ends on Deepgram's UtteranceEnd. This is the ceiling for
 * when that never comes, which a noisy line can cause indefinitely: transcript
 * keeps arriving, the caller is never quiet for a full second, and the
 * assistant would listen forever without ever answering.
 */
const MAX_PENDING_MS = 6000;

/**
 * Words that mean "I am listening", not "stop talking".
 *
 * Used to decide whether speech over the top of a reply is an interruption.
 * Deliberately only the listener noises: anything with content in it, even one
 * content word among these, is treated as the caller wanting the floor.
 */
const BACKCHANNEL_WORDS = new Set([
  "yeah", "yea", "yes", "yep", "yup", "ok", "okay", "k", "right", "sure",
  "mm", "mmm", "mhm", "mmhmm", "hmm", "hm", "uh", "huh", "uhhuh", "ah", "oh",
  "alright", "cool", "nice", "great", "good", "fine", "perfect", "gotcha",
  "got", "it", "i", "see", "thanks", "thank", "you", "and", "so", "well",
]);

/**
 * Said while the model is still thinking, so the caller hears a person taking a
 * beat rather than a dead line.
 *
 * SHORT on purpose. These were whole phrases like "Sure, let me check that for
 * you" back when first token took two and a half seconds and there was that
 * much hole to bridge. There is now well under a second to cover, and a stock
 * sentence in front of an answer that was already coming is not less waiting,
 * it is more talking. One word buys the beat and gets out of the way.
 *
 * Each works as the opening of a longer utterance, because the model's sentence
 * follows immediately behind it with no gap. Rotated at random, never twice in
 * a row: the same word every turn is its own kind of robotic.
 *
 * Ends in a full stop, which is load bearing rather than punctuation taste.
 * Aura buffers Speak text server side and synthesizes at sentence boundaries,
 * so "Sure," produced no audio at all on its own: it sat in the vendor's buffer
 * until the model's first real sentence completed the clause, which is exactly
 * the moment the filler existed to cover. A whole utterance is spoken as soon
 * as it arrives.
 */
// "Of course." is stiff read aloud and "Mm." reads as disengaged, so neither
// survives. The rest are what people actually say while thinking.
const FILLERS = ["Sure.", "Okay.", "Right.", "Got it."];

interface Init {
  ws: WebSocket;
  /** Telnyx stream_id from the start event. Not needed on outbound messages. */
  streamId: string;
  /** TeXML CallSid, which is what every webhook and status callback carries. */
  callSid: string;
  businessId: string;
  callId: string;
  sessionId: string;
  settings: VoiceSettings;
  direction: "inbound" | "outbound";
  ttsSemaphore: Semaphore;
  remainingSeconds: number;
  /** The other party, used for opt-out. */
  peerE164: string;
  /** Outbound calls open with their own greeting and why we are calling. */
  openingLine?: string;
  /** What this outbound call is about, from the queued job or the default. */
  script?: string;
}


export class CallSession {
  private state: State = "GREETING";
  private readonly startedAt = Date.now();

  private stt: SttStream | null = null;
  private tts: TtsStream | null = null;
  private llmAbort: AbortController | null = null;

  /**
   * Text of the current agent turn, per sentence, with how long each takes to
   * say. Paired with how much of the turn has actually played, it is what makes
   * an interrupted transcript honest instead of a record of our intentions.
   */
  private spokenPlan: { text: string; ms: number }[] = [];
  private speakStartedAt = 0;

  /**
   * The only thing that writes audio to the carrier. Constructed per call so
   * its per-turn counters and its timer die with the session.
   */
  private readonly paced: PacedWriter;

  private history: { role: "user" | "assistant"; content: string }[] = [];
  private pendingUserText = "";
  private noInputTimer: NodeJS.Timeout | null = null;
  private ctxReady: Promise<db.TurnContext | null> | null = null;
  /** Backstop for a missing UtteranceEnd. See armTurnFallback. */
  private turnFallback: NodeJS.Timeout | null = null;
  /** When the current pending utterance started, for the hard cap above. */
  private pendingSince = 0;
  private heartbeat: NodeJS.Timeout | null = null;
  private lastUsageAt = Date.now();
  private wrapUp = false;
  private ended = false;
  private ttsSlotHeld = false;
  /**
   * Increments on every stretch of speech. A turn that started while an earlier
   * one was still finishing must not have its state undone when that earlier
   * one returns: the greeting completing used to reset the caller straight back
   * to LISTENING underneath a reply that was already being generated.
   */
  private turnSeq = 0;
  /**
   * Whether the speech we are holding is a finished utterance.
   *
   * Deepgram's end-of-speech signal is ignored at the time when it lands while
   * we are talking or thinking, because a turn is already under way. It still
   * has to be remembered, or drainPending cannot tell a whole question the
   * caller finished during our reply from the first half of one they are still
   * saying, and would answer both.
   */
  private pendingClosed = false;
  /** Last time the request path was warmed, so interims cannot spam it. */
  private lastWarmedAt = 0;

  constructor(private readonly init: Init) {
    this.paced = new PacedWriter(
      // Telnyx identifies the stream by the socket, so outbound media carries
      // no stream id. Sending one is not merely redundant, it is a different
      // message shape from the one the bidirectional handler expects.
      (frame) => this.send({ event: "media", media: { payload: frame.toString("base64") } }),
      config.pacing.leadMs,
    );
  }

  // ---------------------------------------------------------------- lifecycle

  async start(): Promise<void> {
    this.init.ttsSemaphore.tryAcquire() && (this.ttsSlotHeld = true);

    // Started here and not awaited: it resolves while the greeting is playing,
    // so by the caller's first question it is already in hand and costs the
    // turn nothing. Doing it per turn inside the edge function was costing a
    // full second of silence every time.
    this.ctxReady = db.loadTurnContext(this.init.businessId)
      .then((ctx) => {
        // Counts, because a context that silently arrives without its catalog
        // produces an assistant that is confidently wrong rather than one that
        // is visibly broken, and nothing else in the logs would show it.
        const b = ctx.business as any;
        console.log(
          `[call ${this.init.callSid}] context name=${b?.name ? "y" : "n"} ` +
          `products=${b?.products?.length ?? 0} kb=${ctx.knowledge.length}`,
        );
        return ctx;
      })
      .catch((err) => {
        console.error(`[call ${this.init.callSid}] context load failed:`, (err as Error).message);
        return null;
      });

    this.stt = new SttStream({
      onInterim: (t) => this.onInterim(t),
      onFinal: (t) => this.onFinal(t),
      onSpeechFinal: () => {
        console.log(`[call ${this.init.callSid}] stt speech final state=${this.state}`);
        this.onUtteranceEnd();
      },
      onUtteranceEnd: () => {
        // Logged at the boundary so "the carrier never told us the caller
        // stopped" is distinguishable from "it told us and we ignored it".
        console.log(`[call ${this.init.callSid}] stt utterance end state=${this.state}`);
        this.onUtteranceEnd();
      },
      // The earliest possible notice that a turn is coming, and free.
      onSpeechStarted: () => this.warmTurnPath(),
      onError: (e) => console.error(`[call ${this.init.callSid}] stt:`, e.message),
    });
    // Opened alongside the STT connect rather than after it. These are two
    // independent WebSocket handshakes to the same vendor, and running them
    // back to back put a whole extra round trip between the caller being
    // connected and hearing anything. SttStream buffers inbound audio while its
    // own socket opens, which is the case this ordering was guarding against.
    const greetingTts = this.openTts();

    try {
      await this.stt.connect();
    } catch (err) {
      console.error(`[call ${this.init.callSid}] stt connect failed:`, err);
      await greetingTts.then((s) => s?.cancel()).catch(() => {});
      await this.hangup("failed", "stt_unavailable");
      return;
    }

    this.heartbeat = setInterval(() => this.tickUsage(), config.limits.usageHeartbeatMs);
    await this.speak(
      [this.init.openingLine || this.init.settings.greeting],
      { greeting: true, pre: greetingTts },
    );
  }

  /** One inbound 20 ms mu-law (PCMU) frame from the carrier. */
  onMedia(payloadB64: string): void {
    if (this.ended) return;
    this.stt?.send(Buffer.from(payloadB64, "base64"));
  }

  async onStop(): Promise<void> {
    await this.hangup("completed", "caller_hangup");
  }

  // ------------------------------------------------------------------- speech

  /** Words we have handed to the synthesiser recently, for echo detection. */
  private recentlySpoken: { words: string[]; at: number }[] = [];

  private static words(text: string): string[] {
    return text.toLowerCase().replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean);
  }

  private noteSpoken(text: string): void {
    const words = CallSession.words(text);
    if (!words.length) return;
    this.recentlySpoken.push({ words, at: Date.now() });
    const cutoff = Date.now() - 15_000;
    this.recentlySpoken = this.recentlySpoken.filter((s) => s.at >= cutoff);
  }

  /**
   * How much of `text` is something we just said, as an ordered subsequence.
   *
   * On an international PSTN leg, especially to a handset on speakerphone, our
   * own audio comes back up the line. Acoustic echo at 300ms+ sits well outside
   * the tail length of the network echo cancellers in the path, so it arrives
   * as ordinary inbound audio, Deepgram transcribes it, and the agent hears
   * itself talking and stops to listen. The carrier cannot help us here: this
   * is genuine inbound audio from the far end, correctly tagged as such.
   *
   * Content matching is the check that works regardless of cause, and it is
   * what Deepgram themselves recommend for this. The score is logged either
   * way, so it doubles as the diagnosis.
   */
  private echoOverlap(text: string): number {
    const want = CallSession.words(text);
    if (!want.length) return 0;
    let best = 0;
    for (const said of this.recentlySpoken) {
      let from = 0, hit = 0;
      for (const w of want) {
        const at = said.words.indexOf(w, from);
        if (at >= 0) { hit++; from = at + 1; }
      }
      best = Math.max(best, hit / want.length);
    }
    return best;
  }

  /**
   * Hold the connection and the isolate open while the caller is talking.
   *
   * Throttled rather than fired on every interim: interims arrive several times
   * a second and one every couple of seconds is enough to keep a four second
   * idle timeout from expiring underneath a long question.
   */
  private warmTurnPath(): void {
    if (this.ended) return;
    const now = Date.now();
    if (now - this.lastWarmedAt < 2500) return;
    this.lastWarmedAt = now;
    warmTurnPath();
  }

  private onInterim(text: string): void {
    // Before the SPEAKING guard below, because the caller talking over a reply
    // is still a turn about to happen and still wants a warm path.
    this.warmTurnPath();
    if (this.state !== "SPEAKING") return;
    // Nothing audible has left the building yet, so there is nothing for the
    // caller to be interrupting. Set on the first real audio byte rather than
    // when text is handed to the synthesiser, because a filler ending in a
    // comma buys no audio at all until the reply completes the clause.
    if (!this.speakStartedAt) return;

    // Guard window: our own audio leaks back into the line, and a cough should
    // not cut the agent off. Require real words, and ignore the opening moments.
    const guard = this.state === "SPEAKING" && this.spokenPlan.length && this.isGreeting
      ? config.bargeIn.greetingGuardMs
      : config.bargeIn.guardMsAfterSpeechStart;
    if (Date.now() - this.speakStartedAt < guard) return;

    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length < config.bargeIn.minWords) return;

    // "yeah", "mm hmm", "okay right" are listening noises, not interruptions.
    // Somebody who says one of those while you are speaking wants you to KEEP
    // going, and stopping dead in the middle of a word is the most robotic
    // thing the agent can do. Only a word that is not a backchannel counts as
    // wanting the floor.
    if (words.every((w) => BACKCHANNEL_WORDS.has(w.toLowerCase().replace(/[^a-z']/g, "")))) return;

    const overlap = this.echoOverlap(text);
    const ms = Date.now() - this.speakStartedAt;
    if (overlap >= config.bargeIn.echoOverlap) {
      console.log(`[call ${this.init.callSid}] ignored echo ${words.length}w overlap=${overlap.toFixed(2)}`);
      return;
    }

    console.log(
      `[call ${this.init.callSid}] barge-in ${words.length}w after ${ms}ms overlap=${overlap.toFixed(2)}`,
    );
    this.bargeIn();
  }

  private onFinal(text: string): void {
    if (this.ended) return;
    // Suppressed here as well as in barge-in. Without this, our own echoed
    // words accumulate into pendingUserText and get sent to the model as the
    // caller's next message, so the agent ends up answering itself.
    //
    // A HIGHER bar than barge-in uses, because the two mistakes are not equally
    // bad. Declining to interrupt a caller who quotes us costs nothing: we
    // simply finish the sentence. Discarding their words costs them the turn.
    // Measured, "open until six, really?" scores 0.75 against our own "we are
    // open from nine until six", so 0.6 here would have eaten a real question.
    const overlap = this.echoOverlap(text);
    if (overlap >= Math.max(0.85, config.bargeIn.echoOverlap)) {
      console.log(`[call ${this.init.callSid}] dropped echoed final ${text.length}ch overlap=${overlap.toFixed(2)}`);
      return;
    }
    if (!this.pendingUserText) this.pendingSince = Date.now();
    this.pendingUserText = `${this.pendingUserText} ${text}`.trim();
    // More words means they have not finished, whatever an earlier signal said.
    // Deepgram sends the transcript and speech_final on the same message, in
    // that order, so a genuinely closed utterance re-closes immediately below.
    this.pendingClosed = false;
    // Content stays out of the logs; length and state are enough to tell a
    // silent caller from one we heard but never answered.
    console.log(`[call ${this.init.callSid}] stt final ${text.length}ch state=${this.state}`);
    this.resetNoInput();

    // A noisy line can keep producing transcript without ever going quiet
    // enough to end an utterance, and a fallback that restarts on every final
    // would never fire either. Past this point, answer with what we have rather
    // than listening indefinitely.
    if (Date.now() - this.pendingSince >= MAX_PENDING_MS) {
      console.warn(`[call ${this.init.callSid}] held ${MAX_PENDING_MS}ms of speech, answering now`);
      this.onUtteranceEnd();
      return;
    }
    this.armTurnFallback();
  }

  /**
   * Answer from the last final if UtteranceEnd never lands.
   *
   * UtteranceEnd is the better signal and stays the primary one, but making it
   * the ONLY way a turn can start means a caller talks, is transcribed, and is
   * never replied to, for the whole call. That is not a degraded conversation,
   * it is no conversation, and it is exactly what happened. The timer is
   * slightly longer than Deepgram's own window so the real event wins whenever
   * it does arrive.
   */
  /**
   * Answer what we are holding, now that the agent has stopped talking.
   *
   * Speech that arrived mid-reply is deliberately not acted on at the time, so
   * without this it would sit until the caller happened to say something else,
   * or the no-input timer gave up on them.
   */
  private drainPending(): void {
    if (this.ended || this.state !== "LISTENING") return;
    if (!this.pendingUserText.trim()) return;
    // Only answer something they actually finished saying. A caller who starts
    // a question over the end of a reply is usually still mid-sentence when we
    // stop, and answering the first half of it is worse than the pause. The
    // fallback timer is the backstop for a signal that never comes.
    if (!this.pendingClosed) { this.armTurnFallback(); return; }
    this.onUtteranceEnd();
  }

  private armTurnFallback(): void {
    if (this.turnFallback) clearTimeout(this.turnFallback);
    this.turnFallback = setTimeout(() => {
      this.turnFallback = null;
      if (this.ended) return;
      console.warn(`[call ${this.init.callSid}] no end-of-speech signal, answering from last final`);
      this.onUtteranceEnd();
    // Deliberately behind BOTH real signals. See config.deepgram.turnFallbackMs.
    }, config.deepgram.turnFallbackMs);
  }

  private onUtteranceEnd(): void {
    if (this.turnFallback) { clearTimeout(this.turnFallback); this.turnFallback = null; }
    if (this.ended) return;

    // Never start a turn on top of one already being spoken or generated.
    //
    // Starting one bumps turnSeq, and the reply in flight then stops pushing
    // sentences mid-thought: the caller hears the agent cut itself off partway
    // through a word. Interrupting a reply is barge-in's job, and barge-in has
    // already moved the state to LISTENING by the time it wants a new turn. So
    // reaching here while SPEAKING means barge-in deliberately declined, and
    // the right thing is to finish the sentence and answer afterwards.
    //
    // The text is kept AND marked finished, so drainPending can tell it apart
    // from half of a sentence still being said and answer it as soon as the
    // reply lands.
    if (this.state === "THINKING" || this.state === "SPEAKING") {
      if (this.pendingUserText.trim()) this.pendingClosed = true;
      return;
    }

    const text = this.pendingUserText.trim();
    if (!text) return;
    this.pendingUserText = "";
    this.pendingClosed = false;
    console.log(`[call ${this.init.callSid}] turn start ${text.length}ch state=${this.state}`);

    // Checked here rather than in the prompt: honouring an opt-out cannot be
    // left to whether the model felt like cooperating on this particular turn.
    if (isOptOut(text)) { void this.optOut(text); return; }

    void this.respondTo(text);
  }

  /**
   * The caller asked not to be called again. Stop talking, record it, confirm
   * in one sentence, hang up. No LLM turn, because there is nothing to decide.
   */
  private async optOut(text: string): Promise<void> {
    if (this.ended) return;
    this.clearNoInput();
    this.llmAbort?.abort();
    this.tts?.cancel();
    this.tts = null;
    this.send({ event: "clear" });
    this.paced.clear();
    this.spokenPlan = [];
    this.state = "LISTENING";

    await db.appendTurn(this.init.sessionId, "customer", text, {
      kind: "voice_turn", opt_out: true, call_id: this.init.callId,
    });

    if (this.init.peerE164) {
      const res = await db.dncAdd(this.init.businessId, this.init.peerE164);
      await db.appendTurn(this.init.sessionId, "system",
        `Added ${this.init.peerE164} to the do-not-call list` +
        (res?.cancelled_jobs ? ` and cancelled ${res.cancelled_jobs} queued call(s).` : "."),
        { kind: "opt_out", call_id: this.init.callId });
    }

    // Still states the removal explicitly: that sentence is the compliance
    // evidence in the transcript, so it stays even though it costs words.
    await this.speak(["Understood, I've taken you off our list. Sorry to have bothered you."]);
    await this.hangup("completed", "opt_out");
  }

  // -------------------------------------------------------------- barge-in

  private isGreeting = true;

  private bargeIn(): void {
    if (this.state !== "SPEAKING") return;

    // 1. Flush the carrier's buffer. Everything else is pointless without this.
    //    Order matters: commitSpokenSoFar below reads how much has played, so
    //    the writer is cleared only after that reading is taken.
    this.send({ event: "clear" });

    // 2. Stop generating and stop synthesizing.
    this.llmAbort?.abort();
    this.tts?.cancel();
    this.tts = null;

    // 3. Record only what was actually heard, then drop the unheard tail.
    this.commitSpokenSoFar(true);
    this.paced.clear();
    this.state = "LISTENING";
    this.resetNoInput();
  }

  /**
   * Work out how much of the planned speech the caller really heard, and
   * persist exactly that.
   *
   * The measure is what PLAYED, not what we handed to the carrier. Before
   * pacing those were the same number, because every frame was written at
   * synthesis speed, so an interrupted reply was written down in full while the
   * caller had heard perhaps a third of it. playedMs() is derived from the wall
   * clock, so it describes what actually left the earpiece.
   */
  private commitSpokenSoFar(interrupted: boolean): void {
    if (!this.spokenPlan.length) return;

    // Uninterrupted turns are only committed once the writer has drained, so
    // everything planned really was heard and there is nothing to work out.
    const heard = interrupted
      ? heardSentences(this.spokenPlan, this.paced.playedMs())
      : this.spokenPlan.map((s) => s.text);

    const text = heard.join(" ").trim();
    this.spokenPlan = [];
    if (!text) return;

    const content = interrupted ? `${text} [interrupted by caller]` : text;
    this.history.push({ role: "assistant", content: text });
    void db.appendTurn(this.init.sessionId, "ai", content, {
      kind: "voice_turn", interrupted, call_id: this.init.callId,
    });
  }

  // --------------------------------------------------------------- responding

  private async respondTo(userText: string): Promise<void> {
    this.state = "THINKING";
    this.clearNoInput();
    // They are clearly still on the line, so the next quiet moment gets its own
    // "are you still there" rather than ending the call. Without this reset a
    // single pause early on turned every later pause into a hangup.
    this.reprompted = false;

    this.history.push({ role: "user", content: userText });
    void db.appendTurn(this.init.sessionId, "customer", userText, {
      kind: "voice_turn", call_id: this.init.callId,
    });

    this.llmAbort = new AbortController();
    const signal = this.llmAbort.signal;
    const turn = ++this.turnSeq;

    // Open the voice socket alongside the model request instead of after the
    // first sentence arrives. The open costs a round trip either way, and
    // paying for it once the model is already talking puts that time straight
    // into the gap the caller hears.
    const ttsReady = this.openTts();

    let stream: TtsStream | null = null;
    let started = false;
    // Tracked separately from `started` because a filler counts as speech for
    // barge-in and state, but "Sure," on its own is not an answer to anything.
    let spokeReply = false;
    const t0 = Date.now();

    // Sentences go through one ordered queue that onDone waits on.
    //
    // They used to be handed to a floating promise, so onDone could finish the
    // turn before the first sentence had even reached the synthesiser: the
    // stream was never flushed, no audio was produced, and spokenPlan was still
    // empty when commitSpokenSoFar ran. The reply was generated, then silently
    // discarded, with no error anywhere to show for it.
    let queue: Promise<void> = Promise.resolve();
    const enqueue = (fn: () => Promise<void>) => {
      queue = queue.then(fn).catch((err) => {
        console.error(`[call ${this.init.callSid}] speak queue:`, (err as Error).message);
      });
    };

    const pushSentence = async (sentence: string): Promise<void> => {
      stream ??= await ttsReady;
      if (!stream || signal.aborted || this.ended || turn !== this.turnSeq) return;

      // SPEAKING is entered on the first sentence actually handed over, not
      // when the socket opens, so the barge-in guard window starts from when
      // the caller could first hear something.
      if (!started) {
        started = true;
        this.tts = stream;
        this.state = "SPEAKING";
        this.paced.beginTurn();
        // Zero means "nothing audible yet". onFirstByte fills it in.
        this.speakStartedAt = 0;
        this.isGreeting = false;
      }
      this.spokenPlan.push({ text: sentence, ms: estimateSpeechMs(sentence) });
      this.noteSpoken(sentence);
      stream.push(sentence);
    };

    // The model takes roughly two and a half seconds to reach its first word.
    // Silence that long on a phone call does not read as thinking, it reads as
    // a dropped line, and the caller talks over the answer just as it starts.
    // So the caller gets a short acknowledgement first, through the same voice
    // socket the reply will use, which means the answer follows immediately
    // behind it with no second connection to pay for.
    //
    // Cancelled the moment a real sentence is ready, so a fast turn never says
    // it at all.
    const fillerTimer = setTimeout(() => {
      if (started || signal.aborted || this.ended || turn !== this.turnSeq) return;
      enqueue(() => pushSentence(this.pickFiller()));
    }, config.limits.fillerAfterMs);

    await streamTurn(
      {
        businessId: this.init.businessId,
        sessionId: this.init.sessionId,
        message: userText,
        history: this.history.slice(-10),
        wrapUp: this.wrapUp,
        direction: this.init.direction,
        script: this.init.script,
        callerE164: this.init.peerE164,
        // Prefetched during the greeting, plus the settings row this session
        // already holds. Resolved long before now in practice, and null only if
        // that fetch failed, in which case the edge function loads it the slow
        // way rather than the turn failing.
        //
        // The catalog is narrowed to this turn's question here rather than sent
        // whole: it is already in memory, so ranking is free, and sending an
        // arbitrary slice of a large catalog is what made the assistant deny
        // stocking things the business sells.
        context: await this.ctxReady?.then((c) => {
          if (!c?.business) return undefined;
          const all = ((c.business as any).products ?? []) as any[];
          return {
            business: {
              ...c.business,
              products: pickProducts(all, userText),
              products_total: all.length,
            },
            knowledge: c.knowledge,
            settings: this.init.settings as unknown as Record<string, unknown>,
          };
        }),
      },
      {
        onFirstToken: () => console.log(`[call ${this.init.callSid}] llm first token ${Date.now() - t0}ms`),
        onMeta: (m) => console.log(`[call ${this.init.callSid}] turn meta ${JSON.stringify(m)}`),
        onSentence: (sentence) => {
          clearTimeout(fillerTimer);
          spokeReply = true;
          enqueue(() => pushSentence(sentence));
        },
        onDone: async (_full, meta) => {
          clearTimeout(fillerTimer);
          // Every sentence must be in the synthesiser before it is flushed.
          await queue;
          // turnSeq, not just aborted/ended. pushSentence and speak both check
          // it; this did not, and it is the one that sets state back to
          // LISTENING. A speak() from onTurnFailure, tickUsage or onNoInput
          // advances turnSeq WITHOUT aborting this turn's signal, so a late
          // onDone would drop the caller back to LISTENING underneath a reply
          // that was mid-word, and pushAudio then discarded the rest of it.
          if (signal.aborted || this.ended || turn !== this.turnSeq) return;

          if (stream) await stream.end();
          // Stay in SPEAKING until the caller has actually HEARD the reply, not
          // merely until we finished handing it over. This is the whole point of
          // pacing: barge-in only works while we are in SPEAKING, and the
          // silence timer must not start under a reply still being played.
          await this.paced.drained();
          // A barge-in during that wait already committed the turn and moved
          // on. It does not bump turnSeq, so leaving SPEAKING is the tell.
          if (this.ended || turn !== this.turnSeq || this.state !== "SPEAKING") return;
          this.commitSpokenSoFar(false);
          this.state = "LISTENING";
          this.resetNoInput();

          if (spokeReply) this.turnFailures = 0;   // a good turn clears the streak
          if (meta.escalate) await this.escalate(meta.reason);
          // Anything they said over the top of that reply is still waiting.
          this.drainPending();
        },
        onError: async (err) => {
          console.error(`[call ${this.init.callSid}] llm:`, err.message);
          await this.onTurnFailure(userText);
        },
      },
      signal,
    );

    // A turn that said nothing leaves a socket opened for a reply nobody will
    // hear, so close it either way.
    //
    // Then decide whether the silence was correct. Barge-in ends a turn with
    // nothing spoken on purpose. A turn that ran to completion and produced no
    // audio is a failure, and staying quiet through it means the caller waits
    // out the no-input timer and gets "Are you still there?" as the answer to
    // their question. Whatever went wrong upstream, say something. onError
    // speaks for itself and bumps turnSeq, so it never reaches here.
    if (!spokeReply && turn === this.turnSeq) {
      // Only ours to close if nothing was ever pushed through it. A filler
      // means onDone already flushed and ended this stream.
      if (!started) {
        const unused = await ttsReady.catch(() => null);
        if (unused) await unused.end().catch(() => {});
      }

      if (!signal.aborted && !this.ended) {
        console.warn(`[call ${this.init.callSid}] turn produced no audio`);
        await this.onTurnFailure(userText);
      }
    }
  }

  private async openTts(): Promise<TtsStream | null> {
    if (!this.ttsSlotHeld && !this.init.ttsSemaphore.tryAcquire()) {
      console.warn(`[call ${this.init.callSid}] TTS at capacity`);
      return null;
    }
    this.ttsSlotHeld = true;
    try {
      const provider = makeTtsProvider(this.init.settings.tts_provider || config.tts.provider);
      return await provider.open({
        voice: this.init.settings.tts_voice || config.tts.voice,
        onFirstByte: () => {
          // The barge-in guard measures from here, so it measures from the
          // moment the caller could first hear anything.
          if (!this.speakStartedAt) this.speakStartedAt = Date.now();
          console.log(`[call ${this.init.callSid}] tts first byte`);
        },
        onAudio: (mulaw) => this.pushAudio(mulaw),
        onError: (e) => console.error(`[call ${this.init.callSid}] tts:`, e.message),
      });
    } catch (err) {
      console.error(`[call ${this.init.callSid}] tts open failed:`, err);
      return null;
    }
  }

  /** Speak fixed text with no LLM involved (greeting, apologies, wrap-up). */
  private async speak(
    sentences: string[],
    opts: { greeting?: boolean; pre?: Promise<TtsStream | null> } = {},
  ): Promise<void> {
    const turn = ++this.turnSeq;
    // Awaited BEFORE the fallback, because `pre` is a promise that resolves to
    // null when the eager open failed. `opts.pre ?? this.openTts()` tested the
    // promise object, which is never nullish, so a transient failure at call
    // setup went straight to hangup instead of simply opening another socket.
    const stream = (await opts.pre) ?? (await this.openTts());
    if (!stream) { await this.hangup("failed", "tts_unavailable"); return; }

    this.tts = stream;
    this.state = "SPEAKING";
    this.paced.beginTurn();
    this.speakStartedAt = 0;
    this.isGreeting = !!opts.greeting;

    for (const s of sentences) {
      this.spokenPlan.push({ text: s, ms: estimateSpeechMs(s) });
      this.noteSpoken(s);
      stream.push(s);
    }
    await stream.end();

    // If the caller spoke over this and a reply is already under way, that turn
    // owns the state. Falling through here would drop them back to LISTENING
    // and restart the silence timer under a reply still being spoken.
    if (this.ended || turn !== this.turnSeq) return;

    // As in the streaming path: the turn is not over until it has been heard,
    // and a barge-in while we waited means this turn no longer owns the line.
    await this.paced.drained();
    if (this.ended || turn !== this.turnSeq || this.state !== "SPEAKING") return;

    this.commitSpokenSoFar(false);
    this.state = "LISTENING";
    this.resetNoInput();
    this.drainPending();
  }

  /** TTS audio -> the paced writer -> the carrier, at the speed of speech. */
  private pushAudio(mulaw: Buffer): void {
    if (this.ended || this.state !== "SPEAKING") return;
    // Framing, the 20 ms clock and the heard-so-far counters all live in the
    // writer now. This used to write every frame the moment it arrived, which
    // is why the turn was over here while the caller was still listening.
    this.paced.push(mulaw);
  }

  // ------------------------------------------------------------------- limits

  private async tickUsage(): Promise<void> {
    if (this.ended) return;

    const elapsed = Math.floor((Date.now() - this.startedAt) / 1000);
    if (elapsed >= Math.min(config.limits.maxCallSeconds, this.init.settings.max_call_seconds)) {
      // "Maximum call length" is system vocabulary. No receptionist owns that
      // sentence, and the caller cannot do anything with the information.
      await this.speak(["I'll have to let you go there. Thanks for calling."]);
      await this.hangup("completed", "max_duration");
      return;
    }

    const delta = Math.floor((Date.now() - this.lastUsageAt) / 1000);
    this.lastUsageAt = Date.now();
    const usage = await db.recordUsage(this.init.businessId, this.init.callId, delta);
    if (!usage) return;

    // Wind down gracefully rather than guillotining mid-sentence.
    if (usage.hard_cutoff) {
      // NEVER name the reason here. This fires when the BUSINESS has exhausted
      // its OctaDezx minute allowance, and the person on the line is the
      // business's own customer. "We have run out of call time" tells a Merrell
      // shopper about Merrell's SaaS billing, which is both baffling to them
      // and embarrassing for the business paying us. They just hear a normal
      // goodbye; the owner gets the real reason by email and in the dashboard.
      await this.speak(["Sorry, I have to go. Do give us a call back."]);
      await this.hangup("completed", "over_limit", "over_limit");
    } else if (usage.soft_warning && !this.wrapUp) {
      this.wrapUp = true;   // the next LLM turn is told to conclude
    }
  }

  private resetNoInput(): void {
    this.clearNoInput();
    this.noInputTimer = setTimeout(() => void this.onNoInput(), config.limits.noInputMs);
  }
  private clearNoInput(): void {
    if (this.noInputTimer) { clearTimeout(this.noInputTimer); this.noInputTimer = null; }
  }
  private reprompted = false;

  private async onNoInput(): Promise<void> {
    if (this.ended || this.state !== "LISTENING") return;
    if (!this.reprompted) {
      this.reprompted = true;
      await this.speak(["Are you still there?"]);
      return;
    }
    await this.speak(["I'll let you go. Thanks for calling."]);
    await this.hangup("completed", "no_input");
  }

  /**
   * Per session, not per process. As a module-level counter the "never twice in
   * a row" guarantee was shared across every concurrent call, so it held for
   * the server as a whole and not for the one caller who can actually hear it.
   */
  private lastFiller = -1;
  private pickFiller(): string {
    let i = Math.floor(Math.random() * FILLERS.length);
    if (i === this.lastFiller) i = (i + 1) % FILLERS.length;
    this.lastFiller = i;
    return FILLERS[i];
  }

  private turnFailures = 0;

  /**
   * Our end broke. Not our hearing.
   *
   * Both paths that reach here used to say some version of "sorry, could you
   * say that again?", which is a lie about where the fault is: an upstream
   * error or an empty generation cannot be fixed by the caller repeating
   * themselves, and they spend a whole turn finding that out. Absorb it once
   * and retry silently instead.
   *
   * Twice in a row is a fault that is not clearing, and apologising in a loop
   * until the silence timer gives up on them is the worst possible ending. Hand
   * to a human at that point.
   */
  private async onTurnFailure(userText: string): Promise<void> {
    this.turnFailures += 1;
    if (this.turnFailures >= 2) {
      await this.speak(["Sorry, I'm having trouble on my end. I'll get someone to call you back."]);
      await this.escalate("voice pipeline failed twice in a row");
      return;
    }
    await this.speak(["Bear with me one second."]);
    // Actually retry, which this claimed to do and did not.
    //
    // onUtteranceEnd consumed pendingUserText before the turn started, so
    // without re-issuing it the caller's question is simply gone: they heard
    // "bear with me", then fifteen seconds of nothing, then "are you still
    // there?". That silence is what the owner has been calling buffering. The
    // failure count above bounds the recursion at one retry.
    if (!this.ended) await this.respondTo(userText);
  }

  private async escalate(reason: string | null): Promise<void> {
    await db.appendTurn(this.init.sessionId, "system",
      `Escalated to a human: ${reason ?? "customer asked"}`,
      { kind: "escalation", call_id: this.init.callId });
    // Transfer and voicemail fall-through are driven by the TeXML layer via the
    // status callback; here we mark intent and stop the AI talking.
    await this.hangup("completed", "escalated", "escalated_to_human");
  }

  // -------------------------------------------------------------------- close

  async hangup(status = "completed", cause = "", disposition = "ai_handled"): Promise<void> {
    if (this.ended) return;
    this.ended = true;
    this.state = "ENDED";

    this.clearNoInput();
    if (this.turnFallback) { clearTimeout(this.turnFallback); this.turnFallback = null; }
    if (this.heartbeat) clearInterval(this.heartbeat);
    // Kills the 20 ms pump and releases anything parked on drained(). Without
    // this a call that ends mid-reply leaves a turn awaiting playback that can
    // never finish, which holds the whole session object alive behind it.
    this.paced.stop();
    this.llmAbort?.abort();
    this.tts?.cancel();
    this.stt?.close();
    if (this.ttsSlotHeld) { this.init.ttsSemaphore.release(); this.ttsSlotHeld = false; }

    const seconds = Math.floor((Date.now() - this.startedAt) / 1000);
    const delta = Math.max(0, Math.floor((Date.now() - this.lastUsageAt) / 1000));
    if (delta > 0) await db.recordUsage(this.init.businessId, this.init.callId, delta);
    await db.callEnd({
      callId: this.init.callId, status, disposition,
      durationSeconds: seconds, hangupCause: cause,
    });

    try { this.init.ws.close(); } catch { /* already closed */ }
    console.log(`[call ${this.init.callSid}] ended after ${seconds}s (${cause})`);
  }

  private send(obj: unknown): void {
    try {
      if (this.init.ws.readyState === 1) this.init.ws.send(JSON.stringify(obj));
    } catch { /* socket gone; hangup will follow */ }
  }
}
