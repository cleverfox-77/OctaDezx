/**
 * Realtime frame pacing for the carrier's media socket.
 *
 * Deepgram Aura synthesises several times faster than speech, and Telnyx
 * accepts everything we write the instant we write it. Writing frames as fast
 * as they are produced therefore does NOT make the caller hear the reply any
 * sooner. It only moves the reply into the carrier's playout buffer, where we
 * can no longer see it, and the state machine then runs seconds ahead of the
 * call. A reply the caller is still listening to is, to us, already finished.
 * That single fact is what killed barge-in for most of every turn, what let
 * `clear` throw away audio while the transcript credited it as heard, and what
 * started the fifteen second silence timer under a reply still being spoken.
 *
 * So frames leave here at the rate they are heard: one 20 ms frame per 20 ms of
 * wall clock. The first frames are deliberately NOT delayed, because time to
 * the first audible byte is the thing this whole pipeline exists to protect. A
 * small lead is written back to back at the start of each run so the carrier
 * has something in hand against network jitter, and pacing only takes over once
 * that lead exists.
 *
 * The scheduler is deadline driven rather than a fixed interval. setInterval at
 * 20 ms turns every late tick into permanent drift, and Node coalesces short
 * timers, so a long reply would end up measurably behind the clock and the
 * carrier would underrun. Here every frame carries the wall time at which it
 * finishes playing, and each wake-up is computed from that time, so a late
 * timer is corrected on the next pump instead of compounding.
 */
import { FRAME_MS, toFrames } from "./audio.js";

/** Injected so the scheduler can be tested against a fake clock, without sleeping. */
export interface PacedClock {
  now(): number;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
}

export const realClock: PacedClock = {
  now: () => Date.now(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export class PacedWriter {
  private queue: Buffer[] = [];
  /** Audio short of a whole frame, held until the next chunk completes it. */
  private remainder: Buffer = Buffer.alloc(0);
  /**
   * Wall clock time at which the last frame we wrote stops playing.
   *
   * This is the whole model: frames play back to back at 20 ms each, starting
   * when they are written. Everything else here is derived from it, including
   * how far ahead of the caller we are and how much they have actually heard.
   */
  private playoutEndsAt = 0;
  private timer: unknown = null;
  private written = 0;
  private stopped = false;
  private waiters: Array<() => void> = [];

  constructor(
    private readonly send: (frame: Buffer) => void,
    private readonly leadMs: number,
    private readonly clock: PacedClock = realClock,
  ) {}

  /** Queue mu-law audio. Whole frames go out now; a partial frame waits. */
  push(mulaw: Buffer): void {
    if (this.stopped || !mulaw.length) return;
    const combined = this.remainder.length ? Buffer.concat([this.remainder, mulaw]) : mulaw;
    const { frames, rest } = toFrames(combined);
    this.remainder = Buffer.from(rest);
    if (!frames.length) return;
    for (const f of frames) this.queue.push(f);
    this.pump();
  }

  /**
   * Start of a new agent turn.
   *
   * The heard-so-far arithmetic is per turn, and the counters used to run for
   * the whole call: after the first reply, `framesSent` was large enough that
   * every later barge-in credited the entire planned answer as heard.
   *
   * The remainder goes too. It is under 20 ms of the previous reply's tail,
   * which nobody can hear, and keeping it would splice those bytes onto the
   * front of this turn.
   */
  beginTurn(): void {
    this.written = 0;
    this.remainder = Buffer.alloc(0);
  }

  /**
   * Barge-in. Drop everything not yet written; the carrier is being told to
   * throw away what it already has.
   */
  clear(): void {
    this.queue = [];
    this.remainder = Buffer.alloc(0);
    this.playoutEndsAt = 0;
    this.cancelTimer();
    this.settle();
  }

  /** Call teardown. Nothing further is written and no timer is left running. */
  stop(): void {
    this.stopped = true;
    this.clear();
  }

  /** Frames handed to the carrier this turn, whether or not they have played. */
  get framesWritten(): number {
    return this.written;
  }

  /** Milliseconds of this turn's audio the caller has actually heard by now. */
  playedMs(): number {
    const ahead = Math.max(0, this.playoutEndsAt - this.clock.now());
    const played = this.written - Math.ceil(ahead / FRAME_MS);
    return Math.max(0, played) * FRAME_MS;
  }

  /** Audio accepted but not yet heard, which is what a hangup would cut off. */
  pendingMs(): number {
    const ahead = Math.max(0, this.playoutEndsAt - this.clock.now());
    return this.queue.length * FRAME_MS + ahead;
  }

  /**
   * Resolves once everything queued has been written AND has finished playing.
   *
   * This is what keeps the turn in SPEAKING for as long as the caller is
   * listening. Barge-in and hangup both resolve it early, on purpose: after
   * either of those nothing more is going to be heard, so there is nothing
   * left to wait for.
   */
  drained(): Promise<void> {
    if (this.stopped || this.isSettled()) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.waiters.push(resolve);
      if (this.timer === null) this.pump();
    });
  }

  private isSettled(): boolean {
    return !this.queue.length && this.playoutEndsAt <= this.clock.now();
  }

  private settle(): void {
    if (!this.isSettled()) return;
    const waiting = this.waiters;
    this.waiters = [];
    for (const w of waiting) w();
  }

  private cancelTimer(): void {
    if (this.timer === null) return;
    this.clock.clearTimer(this.timer);
    this.timer = null;
  }

  /**
   * Write every frame that is due, then schedule the next wake-up.
   *
   * The loop is self limiting: each frame written pushes playoutEndsAt 20 ms
   * further out, so it stops after at most `leadMs` worth of frames no matter
   * how far behind the timer fired. That is what stops a stalled event loop
   * from dumping a second of audio into the carrier in one go.
   */
  private pump = (): void => {
    this.timer = null;
    if (this.stopped) return;
    const now = this.clock.now();

    while (this.queue.length) {
      const buffered = Math.max(0, this.playoutEndsAt - now);
      if (buffered >= this.leadMs) break;
      this.send(this.queue.shift()!);
      this.written++;
      // max(now, ...) rebases after an underrun, so a gap between sentences is
      // a gap rather than something to catch up on at double speed.
      this.playoutEndsAt = Math.max(now, this.playoutEndsAt) + FRAME_MS;
    }

    if (this.queue.length) {
      this.timer = this.clock.setTimer(this.pump, Math.max(1, this.playoutEndsAt - this.leadMs - now));
      return;
    }
    // Nothing left to write, but the carrier is still playing what it has.
    // Wake once more when that finishes so drained() means what it says.
    const tail = this.playoutEndsAt - now;
    if (tail > 0) {
      this.timer = this.clock.setTimer(this.pump, tail);
      return;
    }
    this.settle();
  };
}
