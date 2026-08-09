/**
 * Batch speech to text, for audio that is already recorded.
 *
 * Used by voicemail transcription and by voice notes arriving on WhatsApp,
 * Messenger and Telegram. Latency does not matter here (nobody is waiting on a
 * live line), so this is a plain request/response call rather than the
 * streaming socket the phone path uses.
 *
 * Deepgram is primary because the account already exists for the real-time
 * pipeline. Gemini is the fallback so a Deepgram outage does not silently drop
 * customer messages, and because GEMINI_API_KEY is guaranteed to be present.
 */

export interface Transcript {
  text: string;
  language?: string;
  confidence?: number;
  provider: string;
}

async function viaDeepgram(bytes: Uint8Array, mimeType: string): Promise<Transcript | null> {
  const key = Deno.env.get("DEEPGRAM_API_KEY");
  if (!key) return null;

  try {
    const res = await fetch(
      "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&detect_language=true",
      {
        method: "POST",
        headers: { Authorization: `Token ${key}`, "content-type": mimeType || "audio/ogg" },
        // A raw Uint8Array is not a BodyInit, and its backing store is typed as
        // ArrayBufferLike (which may be shared). slice() gives a private,
        // definitely-ArrayBuffer copy that fetch accepts on every Deno version.
        body: bytes.slice().buffer,
      },
    );
    if (!res.ok) { console.error("[transcribe] deepgram", res.status); return null; }
    const json = await res.json();
    const alt = json?.results?.channels?.[0]?.alternatives?.[0];
    if (!alt?.transcript) return null;
    return {
      text: alt.transcript,
      confidence: alt.confidence,
      language: json?.results?.channels?.[0]?.detected_language,
      provider: "deepgram",
    };
  } catch (err) {
    console.error("[transcribe] deepgram threw:", err);
    return null;
  }
}

async function viaGemini(bytes: Uint8Array, mimeType: string): Promise<Transcript | null> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return null;

  // Deno has no Buffer; chunk the base64 conversion so a few MB does not blow
  // the argument limit of String.fromCharCode.
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const b64 = btoa(binary);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: "Transcribe this audio verbatim. Reply with the transcript only, no commentary." },
              { inline_data: { mime_type: mimeType || "audio/ogg", data: b64 } },
            ],
          }],
          generationConfig: { temperature: 0 },
        }),
      },
    );
    if (!res.ok) { console.error("[transcribe] gemini", res.status); return null; }
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text ? { text, provider: "gemini" } : null;
  } catch (err) {
    console.error("[transcribe] gemini threw:", err);
    return null;
  }
}

const MAX_BYTES = 10 * 1024 * 1024;

export async function transcribeAudio(bytes: Uint8Array, mimeType: string): Promise<Transcript | null> {
  if (!bytes.length) return null;
  if (bytes.length > MAX_BYTES) {
    console.warn(`[transcribe] audio too large (${bytes.length} bytes), skipping`);
    return null;
  }
  return (await viaDeepgram(bytes, mimeType)) ?? (await viaGemini(bytes, mimeType));
}
