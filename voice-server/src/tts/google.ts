/**
 * Google Cloud TTS fallback.
 *
 * Kept as a second option because it is REST rather than streaming, has a
 * standing monthly free tier, and uses a Google account that already exists for
 * Gemini. It is the safety net if Deepgram has an outage or prices change.
 *
 * Tradeoff, stated plainly: this is request/response per sentence, so first
 * byte is slower than a streaming socket. It also returns LINEAR16 at a rate we
 * have to downsample to 8 kHz and convert to mu-law ourselves. Acceptable for a
 * fallback, not the thing to launch on.
 */
import { config } from "../config.js";
import { pcm16ToMulaw, resamplePcm16 } from "../audio.js";
import type { TtsProvider, TtsStream } from "./index.js";

const ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";
const NATIVE_RATE = 24000;

export class GoogleTts implements TtsProvider {
  readonly name = "google";

  async open(opts: {
    voice: string;
    onAudio: (mulaw: Buffer) => void;
    onFirstByte?: () => void;
    onError?: (err: Error) => void;
  }): Promise<TtsStream> {
    const key = config.tts.googleApiKey;
    if (!key) throw new Error("GOOGLE_TTS_API_KEY is not set");

    let cancelled = false;
    let firstByteSent = false;
    // Sentences must play in order even though each is its own HTTP request.
    let chain: Promise<void> = Promise.resolve();

    const synth = async (text: string) => {
      if (cancelled) return;
      const languageCode = opts.voice.split("-").slice(0, 2).join("-") || "en-US";
      const res = await fetch(`${ENDPOINT}?key=${key}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: { name: opts.voice, languageCode },
          audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: NATIVE_RATE },
        }),
      });
      if (cancelled) return;
      if (!res.ok) {
        opts.onError?.(new Error(`google tts ${res.status}: ${await res.text().catch(() => "")}`));
        return;
      }
      const json = (await res.json()) as { audioContent?: string };
      if (cancelled || !json.audioContent) return;

      const pcm = Buffer.from(json.audioContent, "base64");
      const mulaw = pcm16ToMulaw(resamplePcm16(pcm, NATIVE_RATE));
      if (!firstByteSent) { firstByteSent = true; opts.onFirstByte?.(); }
      opts.onAudio(mulaw);
    };

    return {
      push(text: string) {
        const t = text.trim();
        if (!t || cancelled) return;
        chain = chain.then(() => synth(t)).catch((e) => opts.onError?.(e as Error));
      },
      async end() { await chain; },
      cancel() { cancelled = true; },
    };
  }
}
