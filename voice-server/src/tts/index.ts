/**
 * Text to speech, behind an interface.
 *
 * WHY AN INTERFACE: the original plan specified Fish Audio, which turned out to
 * gate usable concurrency behind a $1,000 prepay. Swapping vendors should be a
 * config change, not a rewrite, and the spike needs to measure candidates head
 * to head rather than trusting anyone's published latency number.
 *
 * The contract is deliberately narrow: give me sentences, call me back with
 * 8 kHz mu-law bytes, and let me cancel instantly. Cancellation is not optional
 * because barge-in depends on it.
 */

export interface TtsStream {
  /** Queue a sentence. Providers synthesize as text arrives. */
  push(text: string): void;
  /** No more text for this turn; resolve once the tail audio has been emitted. */
  end(): Promise<void>;
  /** Barge-in. Stop immediately and emit nothing further. */
  cancel(): void;
}

export interface TtsProvider {
  readonly name: string;
  /**
   * @param onAudio  receives 8 kHz mu-law chunks, already in phone format
   * @param onFirstByte  fired once, for the latency budget
   */
  open(opts: {
    voice: string;
    onAudio: (mulaw: Buffer) => void;
    onFirstByte?: () => void;
    onError?: (err: Error) => void;
  }): Promise<TtsStream>;
}

import { DeepgramTts } from "./deepgram.js";
import { GoogleTts } from "./google.js";

export function makeTtsProvider(name: string): TtsProvider {
  switch (name) {
    case "google":   return new GoogleTts();
    case "deepgram":
    default:         return new DeepgramTts();
  }
}

/**
 * Global concurrency limiter.
 *
 * Every TTS vendor has a ceiling. Exceeding it produces failed or garbled
 * synthesis on live calls, which is worse than politely routing the caller to
 * voicemail. Acquire before answering, release when the call ends.
 */
export class Semaphore {
  private active = 0;
  private waiting: Array<() => void> = [];
  constructor(private readonly max: number) {}

  tryAcquire(): boolean {
    if (this.active >= this.max) return false;
    this.active++;
    return true;
  }

  release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.waiting.shift();
    if (next) { this.active++; next(); }
  }

  get inUse(): number { return this.active; }
  get capacity(): number { return this.max; }
}
