/**
 * Deepgram streaming speech to text.
 *
 * The carrier's mu-law bytes are forwarded verbatim: Deepgram accepts
 * `encoding=mulaw&sample_rate=8000`, so there is no transcode on the input side.
 *
 * We rely on Deepgram for endpointing rather than writing a VAD. It already
 * emits SpeechStarted and UtteranceEnd alongside interim transcripts, which is
 * everything the turn-taking state machine needs from one socket.
 */
import WebSocket from "ws";
import { config } from "./config.js";

export interface SttEvents {
  /** Interim, low latency, may change. Used to detect barge-in. */
  onInterim: (text: string) => void;
  /** Stable transcript for a chunk of speech. */
  onFinal: (text: string) => void;
  /** Deepgram believes the caller has stopped talking. Time to answer. */
  onUtteranceEnd: () => void;
  /**
   * Endpointing decided the caller stopped, which lands roughly
   * `endpointingMs` after silence instead of the full second UtteranceEnd
   * needs. Same meaning as onUtteranceEnd, just sooner, and it is the only one
   * of the two that can be tuned below a second.
   */
  onSpeechFinal?: () => void;
  /**
   * The caller has started talking. Fires roughly a second before anything is
   * transcribed, which makes it the earliest warning that a turn is coming and
   * the only free moment to get the request path ready for it.
   */
  onSpeechStarted?: () => void;
  onError?: (err: Error) => void;
}

export class SttStream {
  private ws: WebSocket | null = null;
  private closed = false;
  private keepAlive: NodeJS.Timeout | null = null;
  private backlog: Buffer[] = [];

  constructor(private readonly events: SttEvents) {}

  async connect(): Promise<void> {
    const qs = new URLSearchParams({
      model: config.deepgram.sttModel,
      encoding: "mulaw",
      sample_rate: String(8000),
      channels: "1",
      interim_results: "true",
      punctuate: "true",
      smart_format: "true",
      endpointing: String(config.deepgram.endpointingMs),
      utterance_end_ms: String(config.deepgram.utteranceEndMs),
      vad_events: "true",
    });

    const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${qs}`, {
      headers: { Authorization: `Token ${config.deepgram.apiKey}` },
    });
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("deepgram stt connect timeout")), 8000);
      ws.once("open", () => { clearTimeout(timer); resolve(); });
      ws.once("error", (e) => { clearTimeout(timer); reject(e); });
    });

    // Audio buffered while the socket was still opening.
    for (const b of this.backlog) ws.send(b);
    this.backlog = [];

    // Deepgram closes idle sockets; a silent caller must not drop the stream.
    this.keepAlive = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "KeepAlive" }));
    }, 8000);

    ws.on("message", (raw) => {
      if (this.closed) return;
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      if (msg.type === "UtteranceEnd") { this.events.onUtteranceEnd(); return; }
      // Already asked for via vad_events=true, and until now thrown away.
      if (msg.type === "SpeechStarted") { this.events.onSpeechStarted?.(); return; }
      if (msg.type !== "Results") return;

      const text: string = msg.channel?.alternatives?.[0]?.transcript ?? "";
      if (!text.trim()) return;

      if (!msg.is_final) { this.events.onInterim(text); return; }

      this.events.onFinal(text);
      // speech_final rides on the last is_final of a stretch of speech and is
      // the fast half of Deepgram's two end-of-speech signals. UtteranceEnd
      // still arrives behind it as the backstop for when endpointing misses.
      if (msg.speech_final) this.events.onSpeechFinal?.();
    });

    ws.on("error", (err) => { if (!this.closed) this.events.onError?.(err as Error); });
  }

  /** Forward one mu-law chunk straight from the carrier. */
  send(mulaw: Buffer): void {
    if (this.closed) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Bounded so a never-opening socket cannot grow without limit.
      if (this.backlog.length < 250) this.backlog.push(mulaw);
      return;
    }
    this.ws.send(mulaw);
  }

  close(): void {
    this.closed = true;
    if (this.keepAlive) clearInterval(this.keepAlive);
    try {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "CloseStream" }));
      }
      this.ws?.close();
    } catch { /* already gone */ }
    this.ws = null;
  }
}
