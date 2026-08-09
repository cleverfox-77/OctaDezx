/**
 * Deepgram Aura streaming TTS.
 *
 * Chosen over Fish Audio because it is pay as you go with no prepay gate, it
 * shares the account and key already needed for streaming STT, and critically
 * it can emit `encoding=mulaw&sample_rate=8000` which is exactly what the carrier
 * wants. That removes decode and resample from the hot path entirely.
 *
 * Protocol: a WebSocket that takes {type:"Speak", text}, {type:"Flush"} and
 * {type:"Clear"} as JSON, and returns raw audio as binary frames.
 */
import WebSocket from "ws";
import { config } from "../config.js";
import type { TtsProvider, TtsStream } from "./index.js";

const WS_URL = "wss://api.deepgram.com/v1/speak";

export class DeepgramTts implements TtsProvider {
  readonly name = "deepgram";

  async open(opts: {
    voice: string;
    onAudio: (mulaw: Buffer) => void;
    onFirstByte?: () => void;
    onError?: (err: Error) => void;
  }): Promise<TtsStream> {
    const url =
      `${WS_URL}?model=${encodeURIComponent(opts.voice)}` +
      `&encoding=mulaw&sample_rate=8000&container=none`;

    const ws = new WebSocket(url, {
      headers: { Authorization: `Token ${config.deepgram.apiKey}` },
    });

    let cancelled = false;
    let firstByteSent = false;
    let flushResolve: (() => void) | null = null;
    const pending: string[] = [];

    const ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("deepgram tts connect timeout")), 8000);
      ws.once("open", () => { clearTimeout(timer); resolve(); });
      ws.once("error", (e) => { clearTimeout(timer); reject(e); });
    });

    ws.on("message", (data: WebSocket.RawData, isBinary: boolean) => {
      if (cancelled) return;
      if (isBinary) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
        if (!buf.length) return;
        if (!firstByteSent) { firstByteSent = true; opts.onFirstByte?.(); }
        opts.onAudio(buf);
        return;
      }
      // Control frames. "Flushed" tells us the tail of this turn has been sent.
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "Flushed" && flushResolve) { flushResolve(); flushResolve = null; }
        if (msg.type === "Error" || msg.type === "Warning") {
          opts.onError?.(new Error(`deepgram tts: ${msg.description ?? msg.message ?? "unknown"}`));
        }
      } catch { /* non-JSON control frame, ignore */ }
    });

    ws.on("error", (err) => { if (!cancelled) opts.onError?.(err as Error); });

    await ready;
    for (const t of pending) ws.send(JSON.stringify({ type: "Speak", text: t }));

    const send = (obj: unknown) => {
      if (cancelled || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify(obj));
    };

    return {
      push(text: string) {
        const t = text.trim();
        if (!t) return;
        // Trailing space matters. Aura buffers Speak text server side and
        // concatenates it verbatim, so trimming every producer meant the
        // synthesiser received "...until six.Anything else?" and treated the
        // join as an abbreviation or a domain rather than a sentence boundary.
        // Words ran together at the seam on every multi-sentence reply.
        send({ type: "Speak", text: `${t} ` });
      },
      async end() {
        if (cancelled || ws.readyState !== WebSocket.OPEN) return;
        const done = new Promise<void>((resolve) => { flushResolve = resolve; });
        send({ type: "Flush" });
        // Never hang a call waiting for a tail that is not coming.
        const via = await Promise.race([
          done.then(() => "flushed"),
          new Promise<string>((r) => setTimeout(() => r("timeout"), 5000)),
        ]);

        // Only the acknowledged path closes.
        //
        // `Flushed` is ordered after the audio it describes, so on that path
        // every frame has already reached onAudio and closing loses nothing.
        // The timeout path is the opposite: audio is probably still coming, and
        // setting `cancelled` there muted the message handler and killed the
        // socket mid-utterance, truncating the caller's last sentence. A late
        // tail should be late, not amputated, so it is left to hangup() to
        // close and the audio keeps flowing until then.
        if (via === "flushed") {
          cancelled = true;
          try { ws.close(); } catch { /* already gone */ }
        } else {
          opts.onError?.(new Error("deepgram tts flush timed out, leaving socket open for the tail"));
        }
      },
      cancel() {
        if (cancelled) return;
        // Sent BEFORE the flag, because `send` refuses to write once cancelled
        // is true. Setting it first made this line unreachable, so the Clear
        // that stops Deepgram synthesizing was never actually delivered and
        // only ws.close() was doing the work.
        try {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "Clear" }));
        } catch { /* already gone */ }
        cancelled = true;
        // Release an end() parked on the flush race: its Flushed can never
        // arrive now, and without this it sits for the full five seconds and
        // then resumes to clobber a newer turn's state.
        flushResolve?.();
        flushResolve = null;
        try { ws.close(); } catch { /* already gone */ }
      },
    };
  }
}
