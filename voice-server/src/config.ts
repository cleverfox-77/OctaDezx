/**
 * Environment for the voice media server.
 *
 * Everything secret lives in Fly secrets (`fly secrets set KEY=value`), never in
 * the image and never in the repo.
 */

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`[config] missing required env ${name}`);
  return v;
}

function opt(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const config = {
  port: Number(opt("PORT", "8080")),

  // Public origin of THIS server, used to build the media stream URL.
  publicUrl: opt("PUBLIC_URL", "").replace(/\/$/, ""),

  supabase: {
    url: need("SUPABASE_URL").replace(/\/$/, ""),
    serviceKey: need("SUPABASE_SERVICE_ROLE_KEY"),
    // Shared secret the ai-voice-turn function checks, so only this server can
    // reach it even though it runs with verify_jwt = false.
    voiceServerSecret: need("VOICE_SERVER_SECRET"),
  },

  telnyx: {
    // Verification only, so this is a public key rather than a credential:
    // this process cannot place calls and does not need an API key to run.
    // Skipping the check would let anyone drive calls through this server.
    publicKey: opt("TELNYX_PUBLIC_KEY", ""),
    validateSignatures: opt("TELNYX_VALIDATE_SIGNATURES", "true") === "true",
  },

  deepgram: {
    apiKey: need("DEEPGRAM_API_KEY"),
    sttModel: opt("DEEPGRAM_STT_MODEL", "nova-3"),
    // How long Deepgram waits on silence before finalising a transcript. This is
    // the single largest tunable in the latency budget.
    /**
     * Silence before Deepgram calls the turn over, via speech_final. This IS
     * the turn taking speed knob: it decides how long the caller waits after
     * their last word before anything at all happens.
     *
     * 400 is a compromise. Lower answers into the pauses people leave in the
     * middle of a thought, which sounds like being interrupted. Higher is the
     * dead air we are trying to remove.
     */
    endpointingMs: Number(opt("DEEPGRAM_ENDPOINTING_MS", "400")),
    /**
     * Floored at 1000 because Deepgram REJECTS the whole WebSocket with a bare
     * HTTP 400 below that, and a call whose transcription socket never opens is
     * a call that fails on the caller's handset with nothing said. UtteranceEnd
     * is computed from interim results, which arrive about once a second, so a
     * smaller number could not mean anything anyway.
     *
     * This is not the knob for faster turn taking. `endpointing` is, and unlike
     * this one it is free to go below a second. Clamped rather than validated
     * so a stray env var degrades speed instead of taking calls down.
     */
    utteranceEndMs: Math.max(1000, Number(opt("DEEPGRAM_UTTERANCE_END_MS", "1000"))),
    /**
     * Last resort turn trigger, for when BOTH of Deepgram's end-of-speech
     * signals fail to arrive.
     *
     * Must stay clearly behind both of them. When it sat at utteranceEndMs+400
     * it beat callers who were still mid-sentence: it opened a turn, the real
     * speech_final opened a second one a moment later, and the second one cut
     * the first off in the middle of a word. Ordering is asserted in the tests.
     */
    turnFallbackMs: Number(opt("TURN_FALLBACK_MS", "2500")),
  },

  tts: {
    // "deepgram" (default) or "google". See src/tts/index.ts.
    provider: opt("TTS_PROVIDER", "deepgram"),
    voice: opt("TTS_VOICE", "aura-2-thalia-en"),
    googleApiKey: process.env.GOOGLE_TTS_API_KEY || "",
    googleVoice: opt("GOOGLE_TTS_VOICE", "en-US-Neural2-F"),
  },

  limits: {
    // Hard ceilings so a stuck call cannot bill forever. A one hour zombie call
    // costs real money on every leg of the stack.
    maxCallSeconds: Number(opt("MAX_CALL_SECONDS", "900")),
    maxTurnMs: Number(opt("MAX_TURN_MS", "25000")),
    /**
     * Silence from the caller before asking whether they are still there.
     *
     * 15 seconds, not the 7 it was. Seven is shorter than the pause someone
     * takes to find a card, read a size off a box, or think about a date, and
     * being asked "are you still there?" while you are plainly doing something
     * is the interruption people hate most about automated calls. A person on
     * the line would just wait.
     */
    noInputMs: Number(opt("NO_INPUT_MS", "15000")),
    /**
     * How long the caller may hear nothing before we acknowledge them.
     *
     * Only for turns that are genuinely slow. At 600ms it fired on every single
     * turn including ones the model answered in under a second, so callers got
     * a stock phrase in front of an answer that was already ready: more talking,
     * not less waiting. First token now runs 1000 to 1600ms, so this sits above
     * the fast ones and catches only the rest.
     */
    fillerAfterMs: Number(opt("FILLER_AFTER_MS", "1200")),
    // Platform-wide concurrent TTS ceiling. Any vendor has one; failing soft to
    // voicemail is far better than garbled audio on every live call.
    maxConcurrentTts: Number(opt("MAX_CONCURRENT_TTS", "40")),
    usageHeartbeatMs: Number(opt("USAGE_HEARTBEAT_MS", "30000")),
  },

  pacing: {
    /**
     * How far ahead of realtime the carrier is allowed to run, in milliseconds.
     *
     * Frames go out at the rate they are heard (see src/paced.ts), but the
     * first few of every run are written back to back so Telnyx has a cushion
     * against jitter on the leg between us and them. It costs nothing: the
     * cushion is built out of audio that was going to be sent anyway, so the
     * first byte still leaves the moment the synthesiser produces it.
     *
     * 60 ms is three frames. Larger buys more jitter tolerance and gives the
     * same amount back as a delay on barge-in, since it is audio already handed
     * over that `clear` then has to throw away. Clamped rather than validated:
     * below one frame there is no pacing left to do, and a large value would
     * quietly reintroduce the very problem this exists to fix.
     */
    leadMs: Math.min(400, Math.max(20, Number(opt("PACING_LEAD_MS", "60")))),
  },

  // Do not let our own outgoing audio retrigger barge-in.
  bargeIn: {
    guardMsAfterSpeechStart: Number(opt("BARGE_GUARD_MS", "400")),
    greetingGuardMs: Number(opt("BARGE_GREETING_GUARD_MS", "1500")),
    // 3 rather than 2: at two words a simple "okay yeah" from a caller who was
    // only agreeing cut the reply off in the middle of a word. Interims arrive
    // fast enough that a real interruption still lands quickly.
    minWords: Number(opt("BARGE_MIN_WORDS", "3")),
    /**
     * How much of an utterance must match something we just said before it is
     * treated as our own audio coming back rather than the caller talking.
     *
     * Matched as an ordered subsequence over a 15 second window, so a caller
     * quoting a couple of our words back stays well under it. Raising minWords
     * is the wrong lever for echo: echo produces MORE words, not fewer.
     */
    echoOverlap: Number(opt("BARGE_ECHO_OVERLAP", "0.6")),
  },
};

export type Config = typeof config;
