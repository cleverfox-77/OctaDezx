/**
 * Bridge to the AI brain.
 *
 * Calls the `ai-voice-turn` Supabase function, which streams Gemini tokens back
 * as SSE. We re-assemble those into SENTENCES and hand each one to TTS the
 * moment it is complete.
 *
 * That sentence-level pipelining is the single most important latency trick
 * here: waiting for the whole reply before speaking would add 1 to 2 seconds of
 * silence to every turn, which is exactly what makes DIY voice agents feel
 * broken. Speaking the first sentence while the model is still writing the
 * second hides almost all of it.
 */
import { config } from "./config.js";

export interface TurnRequest {
  businessId: string;
  sessionId: string;
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  /** Nudges the model to wrap up when the minute allowance is nearly gone. */
  wrapUp?: boolean;
  /** Answering a call or making one. The assistant behaves differently. */
  direction?: "inbound" | "outbound";
  /** What this outbound call is about, as written by the owner. */
  script?: string;
  /** The other party, so a booking or order taken on the call has a contact. */
  callerE164?: string;
  /**
   * Business facts and knowledge, loaded once per call by the media server.
   * Measured at 836 to 1226 ms when the edge function fetched it per turn.
   */
  context?: {
    business: Record<string, unknown> | null;
    knowledge: { title: string; content: string }[];
    settings?: Record<string, unknown> | null;
  };
}

export interface TurnCallbacks {
  /** A complete sentence, ready to speak. */
  onSentence: (sentence: string) => void;
  /** Fired once, when the model produces its first token. */
  onFirstToken?: () => void;
  /** Server-side timing split for the turn, so latency is diagnosable here. */
  onMeta?: (meta: Record<string, unknown>) => void;
  onDone: (full: string, meta: { escalate: boolean; reason: string | null }) => void;
  onError?: (err: Error) => void;
}

/** Speakable boundary, or a long enough clause that waiting would be audible. */
export function splitSentences(buffer: string): { ready: string[]; rest: string } {
  const ready: string[] = [];
  let rest = buffer;

  const BOUNDARY = /[.!?…]["')\]]?\s/;
  // Same terminators, anchored at the end, and never straight after a digit.
  const SENTENCE_AT_END = /(?<![0-9])[.!?…]["')\]]?$/;
  // A period that belongs to an abbreviation is not the end of a sentence, and
  // at the end of a buffer there is no following word to tell them apart.
  //
  // This matters because splitSentences runs once per streamed delta, so the
  // buffer ends wherever the network happened to cut the chunk. Without this,
  // "We open at nine a." + "m. and close at six." was spoken as three separate
  // utterances, each with sentence-final intonation and a synthesis gap. The
  // single-letter case is the important one: it covers a.m., p.m., initials and
  // any other intra-token period, which the old whitespace-requiring boundary
  // could never fire on at all.
  const ABBREVIATION_AT_END =
    /(?:\b(?:[A-Za-z]|[ap]\.?m|Mr|Mrs|Ms|Dr|Prof|St|Rd|Ave|Ltd|Inc|Co|No|vs|etc|approx|dept|est)\.)["')\]]?$/i;
  for (;;) {
    const m = rest.match(BOUNDARY);
    if (!m || m.index === undefined) break;
    const cut = m.index + m[0].length;
    const piece = rest.slice(0, cut).trim();
    if (piece) ready.push(piece);
    rest = rest.slice(cut);
  }

  // A sentence that ENDS the buffer has no character after its full stop, so
  // the boundary above (which requires trailing whitespace) never matches it.
  //
  // That is the common case, not an edge case: the prompt asks for one short
  // sentence, so most replies are a single sentence with nothing after the
  // period. Those were waiting for the tail flush at the end of this function,
  // which only runs once the whole HTTP response closes: full generation, plus
  // Gemini's final chunk, plus teardown propagating back from the edge
  // function. Several hundred milliseconds of silence at the end of every short
  // answer, for a sentence that was complete the moment it arrived.
  //
  // The digit lookbehind is what keeps "It costs 19." from being spoken as a
  // sentence while "99 and ships free" is still coming.
  const tail = rest.trimEnd();
  if (SENTENCE_AT_END.test(tail) && !ABBREVIATION_AT_END.test(tail) && rest.trim().length >= 12) {
    ready.push(rest.trim());
    return { ready, rest: "" };
  }

  // No terminator yet but the clause is long: speak at a comma rather than let
  // the caller sit in silence waiting for a full stop.
  if (rest.length > 90) {
    const comma = rest.lastIndexOf(", ");
    if (comma > 40) {
      ready.push(rest.slice(0, comma + 1).trim());
      rest = rest.slice(comma + 1);
    }
  }
  return { ready, rest };
}

const TURN_URL = `${config.supabase.url}/functions/v1/ai-voice-turn`;

/**
 * Get the path to the brain ready, before there is anything to send down it.
 *
 * Two things go cold between turns and both are paid for in the caller's
 * silence. Node's fetch pools connections but drops an idle one after four
 * seconds, and the gap from one turn's request to the next is the whole of the
 * agent speaking plus the caller thinking plus the caller talking, which is
 * comfortably longer than that. A dropped pool entry means the next turn opens
 * TCP and TLS again before the request can even start: three round trips to
 * Supabase, roughly 280 ms, in front of every answer. Separately the edge
 * function's isolate is torn down when idle, and a cold start is more silence
 * on top.
 *
 * OPTIONS is the right shape for this. The function answers it without auth and
 * without touching the database, so it is the cheapest thing that both holds
 * the socket open and keeps the isolate resident. Fired when Deepgram says the
 * caller has begun speaking, which is one to four seconds before we will have
 * anything to ask.
 *
 * Deliberately silent on failure. This is preparation, not work: if it does not
 * land, the turn is exactly as slow as it used to be and nothing else changes.
 */
export function warmTurnPath(): void {
  void fetch(TURN_URL, { method: "OPTIONS", signal: AbortSignal.timeout(3000) })
    // The body has to be read for the connection to go back in the pool, which
    // is the entire point of doing this.
    .then((res) => res.text())
    .catch(() => { /* warming only, never a reason to disturb the call */ });
}

export async function streamTurn(
  req: TurnRequest,
  cb: TurnCallbacks,
  signal: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(TURN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${config.supabase.voiceServerSecret}`,
      },
      body: JSON.stringify(req),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;   // barge-in, expected
    cb.onError?.(err as Error);
    return;
  }

  if (!res.ok || !res.body) {
    cb.onError?.(new Error(`ai-voice-turn ${res.status}: ${await res.text().catch(() => "")}`));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sse = "";        // raw SSE not yet split into events
  let sentenceBuf = "";
  let full = "";
  let firstToken = false;
  let escalate = false;
  let reason: string | null = null;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal.aborted) return;

      sse += decoder.decode(value, { stream: true });
      // Tolerant of CRLF blank lines even though our own function emits LF.
      // The Gemini side of this pipeline was silently dead for days because a
      // parser assumed the exact delimiter a server happened to not use.
      const events = sse.split(/\r?\n\r?\n/);
      sse = events.pop() ?? "";

      for (const evt of events) {
        const line = evt.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;

        let parsed: any;
        try { parsed = JSON.parse(payload); } catch { continue; }

        if (parsed.meta) cb.onMeta?.(parsed.meta);
        if (parsed.escalate) { escalate = true; reason = parsed.reason ?? null; }
        const delta: string = parsed.delta ?? "";
        if (!delta) continue;

        if (!firstToken) { firstToken = true; cb.onFirstToken?.(); }
        full += delta;
        sentenceBuf += delta;

        const { ready, rest } = splitSentences(sentenceBuf);
        sentenceBuf = rest;
        for (const s of ready) { if (signal.aborted) return; cb.onSentence(s); }
      }
    }

    // Whatever is left with no terminator still needs saying.
    const tail = sentenceBuf.trim();
    if (tail && !signal.aborted) cb.onSentence(tail);
    if (!signal.aborted) cb.onDone(full.trim(), { escalate, reason });
  } catch (err) {
    if ((err as Error).name !== "AbortError") cb.onError?.(err as Error);
  }
}
