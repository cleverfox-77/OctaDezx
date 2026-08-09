/**
 * Audio framing for carrier media streams.
 *
 * Telnyx carries PCMU, which is 8 kHz mu-law, one byte per sample, in 20 ms
 * frames. That is exactly 160 bytes per frame.
 *
 * Both ends of our pipeline speak that format natively:
 *   - Deepgram STT accepts `encoding=mulaw&sample_rate=8000` on the input side
 *   - Deepgram Aura TTS emits `encoding=mulaw&sample_rate=8000` on the output side
 *
 * So there is no resampling and no codec work anywhere in the hot path, which
 * removes both the CPU cost and the 30 to 80 ms a decode+resample step would
 * have added to every turn. The mu-law lookup tables below are kept only for
 * fallback providers that cannot emit mu-law (see tts/google.ts).
 */

export const SAMPLE_RATE = 8000;
export const FRAME_BYTES = 160;          // 20 ms of 8 kHz mu-law
export const FRAME_MS = 20;

/** Split a mu-law buffer into exact 20 ms frames, returning any remainder. */
export function toFrames(buf: Buffer): { frames: Buffer[]; rest: Buffer } {
  const frames: Buffer[] = [];
  let offset = 0;
  while (buf.length - offset >= FRAME_BYTES) {
    frames.push(buf.subarray(offset, offset + FRAME_BYTES));
    offset += FRAME_BYTES;
  }
  return { frames, rest: buf.subarray(offset) };
}

const MULAW_BIAS = 0x84;
const MULAW_CLIP = 32635;

/** Linear PCM s16 -> mu-law. Only needed for TTS providers that cannot emit mu-law. */
export function pcm16ToMulaw(pcm: Buffer): Buffer {
  const out = Buffer.allocUnsafe(pcm.length / 2);
  for (let i = 0, j = 0; i < pcm.length; i += 2, j++) {
    let sample = pcm.readInt16LE(i);
    const sign = (sample >> 8) & 0x80;
    if (sign !== 0) sample = -sample;
    if (sample > MULAW_CLIP) sample = MULAW_CLIP;
    sample += MULAW_BIAS;

    let exponent = 7;
    for (let mask = 0x4000; (sample & mask) === 0 && exponent > 0; exponent--, mask >>= 1);
    const mantissa = (sample >> (exponent + 3)) & 0x0f;
    out[j] = ~(sign | (exponent << 4) | mantissa) & 0xff;
  }
  return out;
}

/**
 * Cheap linear resampler, used only by fallback TTS providers whose output
 * sample rate is not 8 kHz. Nearest-neighbour is acceptable here because the
 * destination is a narrowband phone line that discards everything above ~3.4 kHz.
 */
export function resamplePcm16(pcm: Buffer, fromRate: number, toRate = SAMPLE_RATE): Buffer {
  if (fromRate === toRate) return pcm;
  const inSamples = pcm.length / 2;
  const outSamples = Math.floor((inSamples * toRate) / fromRate);
  const out = Buffer.allocUnsafe(outSamples * 2);
  for (let i = 0; i < outSamples; i++) {
    const src = Math.min(Math.floor((i * fromRate) / toRate), inSamples - 1);
    out.writeInt16LE(pcm.readInt16LE(src * 2), i * 2);
  }
  return out;
}

/** Silence, for comfort noise and for padding a partial frame. */
export const MULAW_SILENCE = 0xff;
export function silenceFrame(): Buffer {
  return Buffer.alloc(FRAME_BYTES, MULAW_SILENCE);
}

// ------------------------------------------------------- what the caller heard

/**
 * Conversational speech, in milliseconds per character.
 *
 * Aura returns one undifferentiated stream of audio with no marker saying which
 * sentence a given frame belongs to, so there is no exact way to attribute
 * bytes to sentences. Counting characters is: speaking rate is near enough
 * constant that 14 characters a second holds across ordinary replies, and this
 * only ever has to decide which sentences a caller got through before they
 * interrupted.
 *
 * The alternative that was here counted bytes onto `spokenPlan[last]`, the most
 * recently PUSHED sentence rather than the one being synthesized. Sentences are
 * handed to Aura several ahead of the audio coming back, so on any reply longer
 * than one sentence essentially all the audio landed on the final sentence and
 * the earlier ones looked like they took no time at all.
 */
const MS_PER_CHAR = 72;

/** Onset and breath, so a two word fragment does not look instantaneous. */
const MIN_UTTERANCE_MS = 200;

/**
 * Slack before a sentence counts as heard.
 *
 * The estimate above is approximate and the carrier adds its own delay on top
 * of ours, so the boundary is deliberately pushed in the direction of crediting
 * LESS. Dropping a sentence the caller did hear costs a little repetition;
 * storing one they did not is what produces "as I mentioned..." about something
 * never said, which is the failure this whole accounting exists to prevent.
 */
export const HEARD_MARGIN_MS = 150;

export function estimateSpeechMs(text: string): number {
  const chars = text.trim().length;
  if (!chars) return 0;
  return Math.max(MIN_UTTERANCE_MS, Math.round(chars * MS_PER_CHAR));
}

/**
 * The leading run of a planned reply that the caller actually got.
 *
 * `heardMs` is real playback time from the paced writer. Pass Infinity for a
 * reply that ran to completion, where by definition all of it was heard.
 */
export function heardSentences(
  plan: { text: string; ms: number }[],
  heardMs: number,
): string[] {
  const heard: string[] = [];
  let acc = 0;
  for (const s of plan) {
    acc += s.ms;
    if (acc + HEARD_MARGIN_MS > heardMs) break;
    heard.push(s.text);
  }
  return heard;
}
