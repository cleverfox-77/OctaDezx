#!/usr/bin/env node
/**
 * Measures what the plan calls the P0 risk: how long a caller waits between
 * finishing a sentence and hearing the first syllable of the reply.
 *
 * This drives the REAL server over the REAL protocol. It posts a TeXML webhook,
 * takes the WebSocket URL out of the TeXML it gets back, connects as Telnyx
 * would, and plays audio in at wall-clock speed. Nothing is stubbed, so the
 * number it prints is the number a caller experiences: endpointing, STT,
 * retrieval, Gemini, TTS and playout, end to end.
 *
 * Feeding audio in as fast as possible would produce a much prettier number and
 * a meaningless one, because Deepgram's endpointing works on arrival timing.
 * Every frame here is paced at its true 20 ms.
 *
 * ON SIGNATURES: Telnyx signs webhooks with Ed25519, so unlike the old Twilio
 * HMAC this probe cannot forge one from a shared secret. Two ways to run it:
 *
 *   1. Point it at a server started with TELNYX_VALIDATE_SIGNATURES=false.
 *      Simplest, and appropriate because this is a synthetic load generator
 *      that should never run against the machine taking real calls.
 *
 *   2. Generate a probe key pair with `node scripts/latency-probe.mjs --keygen`,
 *      set the printed public key as TELNYX_PUBLIC_KEY on the target server,
 *      and pass the private half here as PROBE_SIGNING_KEY. That server will
 *      then reject genuine Telnyx traffic, which is the point: it is a test rig.
 *
 * Usage:
 *   VOICE_SERVER_URL=https://octadezx-voice.fly.dev \
 *   DEEPGRAM_API_KEY=... PROBE_TO=+18005550100 \
 *   node scripts/latency-probe.mjs --turns 8
 *
 * VOICE_SERVER_URL must be reachable; it is no longer required to match the
 * signed URL, because Telnyx signs the body rather than the address.
 */
import { webcrypto } from "node:crypto";
import { WebSocket } from "ws";

const argOf = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

// ------------------------------------------------------------------ keygen

if (process.argv.includes("--keygen")) {
  const pair = await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const pub = Buffer.from(await webcrypto.subtle.exportKey("raw", pair.publicKey)).toString("base64");
  const priv = Buffer.from(await webcrypto.subtle.exportKey("pkcs8", pair.privateKey)).toString("base64");
  console.log("Set on the TEST server only (it will then reject real Telnyx webhooks):");
  console.log(`  TELNYX_PUBLIC_KEY=${pub}\n`);
  console.log("Pass to this probe:");
  console.log(`  PROBE_SIGNING_KEY=${priv}`);
  process.exit(0);
}

// ------------------------------------------------------------------- config

const need = (name) => {
  const v = process.env[name];
  if (!v) { console.error(`Missing ${name}`); process.exit(1); }
  return v;
};

const BASE = need("VOICE_SERVER_URL").replace(/\/$/, "");
const DG_KEY = need("DEEPGRAM_API_KEY");
const TO = process.env.PROBE_TO ?? "+18005550100";
const FROM = process.env.PROBE_FROM ?? "+18005550199";
const SIGNING_KEY = process.env.PROBE_SIGNING_KEY ?? "";

const TURNS = Number(argOf("turns", "6"));
const VOICE = argOf("voice", "aura-2-thalia-en");

const FRAME_BYTES = 160;   // 20 ms of 8 kHz mu-law
const FRAME_MS = 20;

/** What the probe "says". Ordinary questions, not tongue twisters. */
const UTTERANCES = [
  "Hi there, what are your opening hours today?",
  "Do you deliver to the airport area?",
  "How much does the standard service cost?",
  "Can I book something for tomorrow afternoon?",
  "What payment methods do you take?",
  "Is there anyone available right now?",
  "Do you have that in a larger size?",
  "How long does delivery usually take?",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- signing

let signingKey = null;
if (SIGNING_KEY) {
  signingKey = await webcrypto.subtle.importKey(
    "pkcs8", Buffer.from(SIGNING_KEY, "base64"), { name: "Ed25519" }, false, ["sign"],
  );
}

/** Telnyx's scheme: Ed25519 over `{unix seconds}|{raw body}`. */
async function signHeaders(rawBody) {
  if (!signingKey) return {};
  const timestamp = String(Math.floor(Date.now() / 1000));
  const data = new TextEncoder().encode(`${timestamp}|${rawBody}`);
  const sig = await webcrypto.subtle.sign({ name: "Ed25519" }, signingKey, data);
  return {
    "telnyx-timestamp": timestamp,
    "telnyx-signature-ed25519": Buffer.from(new Uint8Array(sig)).toString("base64"),
  };
}

// ------------------------------------------------------------------- audio

/** Speak a line into mu-law 8 kHz, the exact wire format PCMU carries. */
async function synth(text) {
  const url = "https://api.deepgram.com/v1/speak" +
    `?model=${VOICE}&encoding=mulaw&sample_rate=8000&container=none`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Token ${DG_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Deepgram speak ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Ask the server to answer a call, and read back where it wants the audio. */
async function openCall(callSid) {
  const url = `${BASE}/texml/inbound`;
  const body = new URLSearchParams({
    CallSid: callSid, To: TO, From: FROM, AccountSid: "probe", Direction: "inbound",
  }).toString();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(await signHeaders(body)),
    },
    body,
  });
  const xml = await res.text();

  if (res.status === 403) {
    throw new Error(
      "The server rejected the signature.\n" +
      "Either start it with TELNYX_VALIDATE_SIGNATURES=false, or run this probe with\n" +
      "PROBE_SIGNING_KEY set to the private half of its TELNYX_PUBLIC_KEY (--keygen).",
    );
  }
  if (!res.ok) throw new Error(`TeXML ${res.status}: ${xml}`);

  const stream = /<Stream url="([^"]+)"/.exec(xml);
  if (!stream) {
    throw new Error(
      `The server did not hand out a media stream. It answered with:\n${xml}\n` +
      `Check that ${TO} is an active voice_phone_numbers row, that voice_settings.enabled ` +
      `is true, that the plan includes voice, and that the business is inside its opening hours.`,
    );
  }
  return stream[1].replace(/&amp;/g, "&");
}

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

async function main() {
  console.log(`[probe] server ${BASE}`);
  console.log(`[probe] signing ${signingKey ? "on" : "off (server must not validate)"}`);
  console.log(`[probe] synthesising ${TURNS} utterance(s)`);
  const clips = [];
  for (let i = 0; i < TURNS; i++) clips.push(await synth(UTTERANCES[i % UTTERANCES.length]));

  const callSid = `probe${Date.now()}`;
  const wsUrl = await openCall(callSid);
  console.log(`[probe] media socket ${wsUrl}`);

  const ws = new WebSocket(wsUrl);
  const streamId = `probe-stream-${Date.now()}`;

  let lastAudioAt = 0;      // when the server last sent us audio
  let awaitingSince = 0;    // when we finished speaking, 0 while not measuring
  let resolveReply = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.event === "media") {
      lastAudioAt = Date.now();
      if (awaitingSince && resolveReply) {
        const ms = lastAudioAt - awaitingSince;
        awaitingSince = 0;
        const done = resolveReply;
        resolveReply = null;
        done(ms);
      }
    }
    // A clear means the server thinks we interrupted it, which on this probe
    // means its barge-in guard is firing on our own playback leaking back.
    if (msg.event === "clear") console.log("[probe] server sent clear (barge-in triggered)");
  });

  await new Promise((res, rej) => {
    ws.once("open", res);
    ws.once("error", rej);
  });

  // Telnyx's opening handshake. Field names are snake_case and stream_id sits
  // at the top level, not inside start.
  ws.send(JSON.stringify({ event: "connected", version: "1.0.0" }));
  ws.send(JSON.stringify({
    event: "start",
    sequence_number: "1",
    start: {
      call_control_id: callSid,
      media_format: { encoding: "PCMU", sample_rate: 8000, channels: 1 },
    },
    stream_id: streamId,
  }));

  /** Wait until the server has been quiet for `quietMs`, i.e. it stopped talking. */
  const waitForSilence = async (quietMs = 700, timeoutMs = 20000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await sleep(100);
      if (lastAudioAt && Date.now() - lastAudioAt > quietMs) return true;
    }
    return false;
  };

  console.log("[probe] waiting for the greeting to finish");
  if (!await waitForSilence()) console.warn("[probe] never heard a greeting, continuing anyway");

  const results = [];
  for (let turn = 0; turn < TURNS; turn++) {
    const clip = clips[turn];
    const frames = Math.floor(clip.length / FRAME_BYTES);

    // Play the question in at real time. Pacing is the whole point.
    const startedAt = Date.now();
    for (let i = 0; i < frames; i++) {
      ws.send(JSON.stringify({
        event: "media",
        stream_id: streamId,
        media: { payload: clip.subarray(i * FRAME_BYTES, (i + 1) * FRAME_BYTES).toString("base64") },
      }));
      const target = startedAt + (i + 1) * FRAME_MS;
      const drift = target - Date.now();
      if (drift > 0) await sleep(drift);
    }

    // Silence after the question, because that is what endpointing listens for.
    const measured = new Promise((res) => { resolveReply = res; });
    awaitingSince = Date.now();
    const silence = Buffer.alloc(FRAME_BYTES, 0xff);   // mu-law silence
    const quietUntil = Date.now() + 6000;
    while (Date.now() < quietUntil && awaitingSince) {
      ws.send(JSON.stringify({
        event: "media", stream_id: streamId, media: { payload: silence.toString("base64") },
      }));
      await sleep(FRAME_MS);
    }

    const ms = await Promise.race([measured, sleep(6000).then(() => null)]);
    if (ms === null) {
      console.log(`  turn ${turn + 1}: no reply within 6s`);
    } else {
      results.push(ms);
      console.log(`  turn ${turn + 1}: ${ms} ms`);
    }

    // Let the reply play out before asking the next thing.
    await waitForSilence(700, 25000);
  }

  ws.send(JSON.stringify({ event: "stop", stream_id: streamId, stop: { call_control_id: callSid } }));
  ws.close();

  if (!results.length) {
    console.error("\nNo turns completed. Check the server logs for STT, LLM or TTS errors.");
    process.exit(1);
  }

  const sorted = [...results].sort((a, b) => a - b);
  const mean = Math.round(results.reduce((a, b) => a + b, 0) / results.length);
  console.log("\nStop speaking to first audio");
  console.log(`  samples ${results.length} of ${TURNS}`);
  console.log(`  mean    ${mean} ms`);
  console.log(`  P50     ${pct(sorted, 50)} ms`);
  console.log(`  P95     ${pct(sorted, 95)} ms`);
  console.log(`  worst   ${sorted[sorted.length - 1]} ms`);
  console.log("\nTarget from the plan: P50 under 900 ms. If P95 is above roughly 1.5s after");
  console.log("sentence pipelining and filler phrases, the architecture needs revisiting");
  console.log("before launch, not after.");
}

main().catch((err) => { console.error(err); process.exit(1); });
