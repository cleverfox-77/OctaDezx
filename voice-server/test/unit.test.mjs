/**
 * Unit tests for the parts of the voice server that are easy to get subtly
 * wrong and hard to notice on a live call: audio framing, sentence splitting,
 * the concurrency limiter, Telnyx signature verification and the TeXML that
 * opens the media stream.
 *
 * Run: node --test test/
 */
import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

// A throwaway Ed25519 pair stands in for Telnyx's. Generated before the imports
// below because config.ts reads env at import time and carrierSignature.ts
// caches the imported key on first use.
const keyPair = await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
const rawPublicKey = new Uint8Array(await webcrypto.subtle.exportKey("raw", keyPair.publicKey));

// config.ts validates required env at import time.
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.VOICE_SERVER_SECRET = "test-voice-secret";
process.env.TELNYX_PUBLIC_KEY = Buffer.from(rawPublicKey).toString("base64");
process.env.TELNYX_VALIDATE_SIGNATURES = "true";
process.env.DEEPGRAM_API_KEY = "test-dg-key";
// Deliberately hostile: this exact value, shipped once, made Deepgram reject
// every transcription socket with a bare HTTP 400 and every call failed on the
// caller's handset having said nothing. See the clamp test at the bottom.
process.env.DEEPGRAM_UTTERANCE_END_MS = "800";

const { toFrames, pcm16ToMulaw, resamplePcm16, FRAME_BYTES, FRAME_MS } = await import("../dist-test/audio.js");
const { PacedWriter } = await import("../dist-test/paced.js");
const { splitSentences } = await import("../dist-test/llm.js");
const { Semaphore } = await import("../dist-test/tts/index.js");
const { verifyCarrierRequest } = await import("../dist-test/carrierSignature.js");
const { connectStream, voicemail } = await import("../dist-test/texml.js");

/** Sign exactly the way Telnyx does: Ed25519 over `{timestamp}|{raw body}`. */
async function signAsTelnyx(rawBody, timestamp) {
  const data = new TextEncoder().encode(`${timestamp}|${rawBody}`);
  const sig = await webcrypto.subtle.sign({ name: "Ed25519" }, keyPair.privateKey, data);
  return Buffer.from(new Uint8Array(sig)).toString("base64");
}

const nowSeconds = () => String(Math.floor(Date.now() / 1000));

// ---------------------------------------------------------------- audio framing

test("toFrames emits exact 20ms frames and keeps the remainder", () => {
  const buf = Buffer.alloc(FRAME_BYTES * 3 + 57, 0x7f);
  const { frames, rest } = toFrames(buf);
  assert.equal(frames.length, 3, "three whole frames");
  for (const f of frames) assert.equal(f.length, FRAME_BYTES);
  assert.equal(rest.length, 57, "partial frame is held back, not sent short");
});

test("toFrames on an exact multiple leaves nothing over", () => {
  const { frames, rest } = toFrames(Buffer.alloc(FRAME_BYTES * 2));
  assert.equal(frames.length, 2);
  assert.equal(rest.length, 0);
});

test("toFrames on a sub-frame buffer emits nothing", () => {
  const { frames, rest } = toFrames(Buffer.alloc(10));
  assert.equal(frames.length, 0, "never send a short frame to the carrier");
  assert.equal(rest.length, 10);
});

test("pcm16ToMulaw halves the byte count and encodes silence as 0xFF", () => {
  const pcm = Buffer.alloc(320);            // 160 samples of digital silence
  const mulaw = pcm16ToMulaw(pcm);
  assert.equal(mulaw.length, 160);
  assert.equal(mulaw[0], 0xff, "mu-law silence");
});

test("pcm16ToMulaw keeps loud positive and negative apart", () => {
  const pos = Buffer.alloc(2); pos.writeInt16LE(20000, 0);
  const neg = Buffer.alloc(2); neg.writeInt16LE(-20000, 0);
  assert.notEqual(pcm16ToMulaw(pos)[0], pcm16ToMulaw(neg)[0], "sign bit must survive");
});

test("resamplePcm16 24k -> 8k drops to a third of the samples", () => {
  const pcm = Buffer.alloc(24000 * 2);      // 1 second at 24 kHz
  assert.equal(resamplePcm16(pcm, 24000, 8000).length, 8000 * 2);
});

test("resamplePcm16 is a no-op at matching rates", () => {
  const pcm = Buffer.alloc(100);
  assert.equal(resamplePcm16(pcm, 8000, 8000), pcm, "must not copy needlessly");
});

// ------------------------------------------------------------ sentence pipeline

test("splitSentences releases complete sentences and holds the tail", () => {
  const { ready, rest } = splitSentences("We open at nine. We close at six. And on Sun");
  assert.deepEqual(ready, ["We open at nine.", "We close at six."]);
  assert.equal(rest.trim(), "And on Sun", "partial sentence is not spoken yet");
});

test("splitSentences handles ? and ! so questions are not held back", () => {
  const { ready } = splitSentences("Can I help? Great! ");
  assert.deepEqual(ready, ["Can I help?", "Great!"]);
});

test("splitSentences does NOT split a decimal number mid-price", () => {
  // "19.99 " would split at the period if the boundary ignored the digit.
  const { ready, rest } = splitSentences("It costs 19.99 and ships free");
  assert.equal(ready.length, 0, "a price is not a sentence boundary");
  assert.match(rest, /19\.99/);
});

test("splitSentences breaks a long clause at a comma rather than stalling", () => {
  const long = "we have a wide selection of products that customers really enjoy browsing, "
             + "and many more options besides";
  const { ready } = splitSentences(long);
  assert.equal(ready.length, 1, "speak the first clause instead of sitting silent");
  assert.ok(ready[0].endsWith(","), `expected a comma break, got: ${ready[0]}`);
});

test("splitSentences returns nothing for a short fragment", () => {
  const { ready, rest } = splitSentences("Sure");
  assert.equal(ready.length, 0);
  assert.equal(rest, "Sure");
});

// ------------------------------------------------------------------- semaphore

test("Semaphore caps concurrency and recovers on release", () => {
  const s = new Semaphore(2);
  assert.equal(s.tryAcquire(), true);
  assert.equal(s.tryAcquire(), true);
  assert.equal(s.tryAcquire(), false, "third call must be refused, not queued silently");
  s.release();
  assert.equal(s.tryAcquire(), true, "slot is reusable after release");
});

test("Semaphore release never drives the counter negative", () => {
  const s = new Semaphore(1);
  s.release(); s.release();
  assert.equal(s.inUse, 0);
  assert.equal(s.tryAcquire(), true);
  assert.equal(s.tryAcquire(), false, "a stray release must not inflate capacity");
});

// ------------------------------------------------------- telnyx signature (ed25519)
//
// Telnyx signs the request BODY, not the URL, which is why these operate on a
// raw form-encoded string rather than a parsed parameter object.

const BODY = "CallSid=v3%3Aabc&From=%2B14158675310&To=%2B18005551212&CallStatus=completed";

test("verifyCarrierRequest accepts a genuine signature", async () => {
  const ts = nowSeconds();
  assert.equal(await verifyCarrierRequest(await signAsTelnyx(BODY, ts), ts, BODY), true);
});

test("verifyCarrierRequest rejects a tampered body", async () => {
  const ts = nowSeconds();
  const sig = await signAsTelnyx(BODY, ts);
  // An attacker rewriting the caller id, or injecting a fabricated voicemail,
  // must fail the check.
  const tampered = BODY.replace("%2B14158675310", "%2B19995551212");
  assert.equal(await verifyCarrierRequest(sig, ts, tampered), false);
});

test("verifyCarrierRequest rejects a signature lifted onto another timestamp", async () => {
  const ts = nowSeconds();
  const sig = await signAsTelnyx(BODY, ts);
  assert.equal(await verifyCarrierRequest(sig, String(Number(ts) + 1), BODY), false);
});

test("verifyCarrierRequest rejects a replay outside the tolerance window", async () => {
  // A real signature, correctly made, but captured an hour ago.
  const stale = String(Math.floor(Date.now() / 1000) - 3600);
  assert.equal(await verifyCarrierRequest(await signAsTelnyx(BODY, stale), stale, BODY), false);
});

test("verifyCarrierRequest rejects missing or malformed input without throwing", async () => {
  const ts = nowSeconds();
  assert.equal(await verifyCarrierRequest(undefined, ts, BODY), false);
  assert.equal(await verifyCarrierRequest("sig", undefined, BODY), false);
  assert.equal(await verifyCarrierRequest("not-base64!!", ts, BODY), false, "must not throw");
  assert.equal(await verifyCarrierRequest("", ts, BODY), false);
});

// ----------------------------------------------------------------------- texml
//
// These attributes decide whether a call works at all, and a wrong one fails
// silently: the caller hears nothing and the logs look healthy.

test("connectStream opens a two way RTP stream in the format the pipeline expects", () => {
  const xml = connectStream("wss://voice.example.com/media?call=abc");
  // Without this the stream is one way and the agent is inaudible.
  assert.match(xml, /bidirectionalMode="rtp"/);
  // Both directions pinned to 8 kHz mu-law, which the framing maths assumes.
  assert.match(xml, /codec="PCMU"/);
  assert.match(xml, /bidirectionalCodec="PCMU"/);
  assert.match(xml, /bidirectionalSamplingRate="8000"/);
  // With both_tracks the agent hears its own voice and barges in on itself.
  assert.match(xml, /track="inbound_track"/);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?><Response><Connect>/);
});

test("connectStream escapes the query string in the stream url", () => {
  const xml = connectStream("wss://voice.example.com/media?call=abc&x=1");
  assert.match(xml, /call=abc&amp;x=1/, "a bare ampersand would be invalid XML");
  assert.ok(!/call=abc&x=1/.test(xml));
});

test("connectStream speaks the recording announcement before connecting", () => {
  const xml = connectStream("wss://x/y", "This call may be recorded.");
  assert.ok(
    xml.indexOf("<Say>") < xml.indexOf("<Connect>"),
    "the announcement must be heard before the media stream takes over",
  );
});

test("voicemail escapes a greeting containing markup", () => {
  const xml = voicemail({
    greeting: 'Leave a message <after> the "beep" & wait',
    actionUrl: "https://x/done",
    recordingStatusUrl: "https://x/rec?a=1&b=2",
    maxSeconds: 120,
  });
  assert.ok(!/<after>/.test(xml), "caller supplied text must never become markup");
  assert.match(xml, /&lt;after&gt;/);
  assert.match(xml, /rec\?a=1&amp;b=2/);
  assert.match(xml, /maxLength="120"/);
});

// ------------------------------------------------------------------- outbound
//
// These carry legal weight rather than product weight: an opt-out that the
// regex misses is a call somebody explicitly asked us not to make.

const { isOptOut, outboundOpener, fillPlaceholders } = await import("../dist-test/outbound.js");

test("isOptOut catches the phrases people actually use", () => {
  for (const said of [
    "stop calling me",
    "Stop calling",
    "please don't call me again",
    "do not call this number",
    "take me off your list",
    "remove me from your list",
    "unsubscribe",
    "opt me out please",
    "never call here again",
    "yeah, stop these calls",
  ]) {
    assert.equal(isOptOut(said), true, `should opt out: "${said}"`);
  }
});

test("isOptOut does not fire on ordinary conversation", () => {
  for (const said of [
    "can you call me back tomorrow",
    "I will call you later",
    "stop, I did not catch that",
    "do not worry about it",
    "please call my wife instead",
    "take me to the booking page",
  ]) {
    assert.equal(isOptOut(said), false, `should NOT opt out: "${said}"`);
  }
});

// The opt-out line and the automated disclosure used to be appended to every
// outbound call unconditionally. They are owner settings now, defaulted off, so
// what these tests pin is that each one appears if and only if it is asked for.
// Honouring "stop calling" when it is SAID is unaffected and covered above:
// that is isOptOut, and it does not depend on either setting.

test("the outbound opener stays clean when both extras are off", () => {
  const opener = outboundOpener({ greeting: "Hi, it's Maya from Acme." });
  assert.equal(opener, "Hi, it's Maya from Acme.");
  assert.doesNotMatch(opener, /stop calling/i);
  assert.doesNotMatch(opener, /automated/i);
});

test("the outbound opener carries the opt-out line when the owner enables it", () => {
  const opener = outboundOpener({ greeting: "Hi, it's Maya from Acme.", includeOptOut: true });
  assert.match(opener, /stop calling/i);
});

test("the outbound opener discloses automation when the owner enables it", () => {
  const opener = outboundOpener({ greeting: "Hi, it's Maya from Acme.", discloseAi: true });
  assert.match(opener, /automated/i);
});

test("the outbound opener uses the outbound greeting, never inbound phrasing", () => {
  const opener = outboundOpener({ greeting: "Hi, sorry to call out of the blue." });
  assert.doesNotMatch(opener, /you have reached/i);
});

test("placeholders fill from the business and persona", () => {
  const opener = outboundOpener({
    greeting: "Hi, it's {{name}} from {{business}}.",
    businessName: "Acme Tools",
    personaName: "Maya",
  });
  assert.equal(opener, "Hi, it's Maya from Acme Tools.");
});

test("a missing placeholder value leaves no double spaces or the word undefined", () => {
  const filled = fillPlaceholders("Hi, it's {{name}} from {{business}}.", { business: "Acme" });
  assert.doesNotMatch(filled, /undefined/);
  assert.doesNotMatch(filled, / {2}/);
  assert.equal(filled, "Hi, it's from Acme.");
});

test("an unrecognised placeholder is left exactly as the owner typed it", () => {
  const filled = fillPlaceholders("Hi {{customer}}, it's {{name}}.", { name: "Maya" });
  assert.match(filled, /\{\{customer\}\}/);
});

test("an appointment reminder says what it is about", () => {
  const opener = outboundOpener({
    greeting: "Hi, it's Maya from Acme.",
    purpose: "appointment_reminder",
    payload: { service: "dental cleaning" },
  });
  assert.match(opener, /dental cleaning/);
});

test("a reminder keeps the reason and the opt-out in a readable order", () => {
  const opener = outboundOpener({
    greeting: "Hi, it's Maya from Acme.",
    purpose: "appointment_reminder",
    payload: { service: "dental cleaning" },
    includeOptOut: true,
  });
  // Greeting, then why we rang, then the opt-out. Leading with the opt-out
  // would have people hanging up before hearing the reason for the call.
  assert.ok(opener.indexOf("Maya") < opener.indexOf("dental cleaning"));
  assert.ok(opener.indexOf("dental cleaning") < opener.search(/stop calling/i));
});

test("a reminder with no service named still reads as a sentence", () => {
  const opener = outboundOpener({ greeting: "Hi.", purpose: "appointment_reminder", payload: {} });
  assert.match(opener, /upcoming appointment/);
});

// --------------------------------------------------------- Deepgram constraints

const { config } = await import("../dist-test/config.js");

test("utterance_end_ms is clamped to Deepgram's floor of 1000", () => {
  // The env above asks for 800. Deepgram derives UtteranceEnd from interim
  // results, which arrive about once a second, so it rejects anything under
  // 1000 by refusing the WebSocket entirely: "Unexpected server response: 400".
  // That is not a degraded call, it is a call that fails before hello.
  assert.equal(process.env.DEEPGRAM_UTTERANCE_END_MS, "800");
  assert.equal(config.deepgram.utteranceEndMs, 1000);
});

test("endpointing is the sub-second turn taking knob, and stays sane", () => {
  // Unlike utterance_end_ms this one is free to go below a second, which is
  // why it carries turn taking speed. Still bounded on both ends: too low
  // answers into mid-sentence pauses, too high is the dead air we removed.
  assert.ok(config.deepgram.endpointingMs >= 100, "endpointing too low to be speech");
  assert.ok(config.deepgram.endpointingMs <= 1000, "endpointing slower than UtteranceEnd defeats the point");
});

test("the caller is acknowledged before the model's measured first token", () => {
  // Filler exists to cover model latency, so it has to fire well inside it.
  // Measured first token on real calls sits around 2.4 seconds.
  assert.ok(config.limits.fillerAfterMs > 0);
  assert.ok(config.limits.fillerAfterMs < 1500, "filler lands too late to cover the gap");
});

test("the fallback turn trigger stays behind both real end-of-speech signals", () => {
  // Three things can start a turn: speech_final (endpointing), UtteranceEnd,
  // and this timer. The timer exists only for when the first two never come.
  // When it was quicker than them it fired on a caller who was still talking,
  // opened a turn, and the real signal then opened a second one that cut the
  // first reply off mid-word. Strict ordering is what prevents that.
  const { endpointingMs, utteranceEndMs, turnFallbackMs } = config.deepgram;
  assert.ok(endpointingMs < utteranceEndMs, "speech_final must lead UtteranceEnd");
  assert.ok(
    turnFallbackMs > utteranceEndMs,
    `fallback (${turnFallbackMs}ms) must trail UtteranceEnd (${utteranceEndMs}ms)`,
  );
  assert.ok(
    turnFallbackMs - utteranceEndMs >= 1000,
    "fallback needs real clearance, not a photo finish, since these are network timings",
  );
});

// ------------------------------------------------------------ catalog ranking

const { pickProducts } = await import("../dist-test/catalog.js");

/** A catalog big enough to force a choice, like the real one (102 items). */
const bigCatalog = [
  ...Array.from({ length: 60 }, (_, i) => ({ name: `Filler Item ${i}`, description: "generic" })),
  { name: "Moab 3 Hiking Boot", description: "waterproof leather hiking boot" },
  { name: "Trail Glove 7", description: "barefoot running shoe" },
  { name: "Hydro Moc Sandal", description: "water friendly slip on" },
  ...Array.from({ length: 40 }, (_, i) => ({ name: `Padding ${i}`, description: "generic" })),
];

test("a product the caller names is included even when it is buried in the catalog", () => {
  const picked = pickProducts(bigCatalog, "do you have the moab hiking boot in a ten", 30);
  assert.ok(
    picked.some((p) => p.name === "Moab 3 Hiking Boot"),
    "the item asked about must reach the prompt, it is item 61 of 103",
  );
  assert.equal(picked.length, 30);
});

test("name matches outrank description matches", () => {
  const picked = pickProducts(bigCatalog, "looking for a hiking boot", 30);
  assert.equal(picked[0].name, "Moab 3 Hiking Boot");
});

test("an unparseable question still yields a full catalog rather than none", () => {
  const picked = pickProducts(bigCatalog, "um", 30);
  assert.equal(picked.length, 30, "never leave the model with nothing to sell");
});

test("a small catalog is passed through untouched", () => {
  const small = [{ name: "One" }, { name: "Two" }];
  assert.deepEqual(pickProducts(small, "anything", 30), small);
});

test("common words do not drag irrelevant items to the front", () => {
  // "the", "you", "have", "what" appear in ordinary speech constantly. If they
  // scored, ranking would be noise and the named product would lose its place.
  const picked = pickProducts(bigCatalog, "what do you have for the trail", 30);
  assert.equal(picked[0].name, "Trail Glove 7");
});

test("a sentence that ends the buffer is released immediately, not at stream close", () => {
  // The common case: the prompt asks for one short sentence, so most replies
  // end with a period and nothing after it. The whitespace-requiring boundary
  // never matches those, so they used to wait for the whole HTTP stream to
  // close before reaching TTS.
  const { ready, rest } = splitSentences("We're open until six.");
  assert.deepEqual(ready, ["We're open until six."]);
  assert.equal(rest, "");
});

test("a price mid-stream is still not mistaken for the end of a sentence", () => {
  // "It costs 19." arriving as one delta with "99 and ships free" still to come
  // must not be spoken as a finished sentence.
  const { ready, rest } = splitSentences("It costs 19.");
  assert.equal(ready.length, 0, "a digit before the period means a number, not a full stop");
  assert.match(rest, /19\.$/);
});

test("a too-short fragment ending in a period is not released on its own", () => {
  const { ready } = splitSentences("Ok.");
  assert.equal(ready.length, 0, "wait for something worth speaking");
});

test("end-of-buffer release does not pre-empt a real multi-sentence split", () => {
  const { ready, rest } = splitSentences("We open at nine. We close at six.");
  assert.deepEqual(ready, ["We open at nine.", "We close at six."]);
  assert.equal(rest, "");
});

// Regression cases found by running the compiled splitter against realistic
// Gemini delta boundaries. Each of these was spoken as a separate utterance,
// with sentence-final intonation and a synthesis gap, mid-sentence.
test("an abbreviation at the buffer end is not spoken as a finished sentence", () => {
  for (const frag of [
    "We open at nine a.",
    "Sure, that's Dr.",
    "You're on Saint Mary's St.",
    "That's flat No.",
    "We do repairs, servicing, etc.",
    "Delivery is around 3 days approx.",
  ]) {
    const { ready } = splitSentences(frag);
    assert.equal(ready.length, 0, `spoke a fragment: ${JSON.stringify(frag)}`);
  }
});

test("a real sentence at the buffer end is still released immediately", () => {
  for (const s of ["We're open until six.", "That's booked for you.", "Can I help with anything else?"]) {
    const { ready } = splitSentences(s);
    assert.deepEqual(ready, [s], `failed to release: ${JSON.stringify(s)}`);
  }
});

test("an abbreviation mid-buffer still splits at the real sentence end", () => {
  const { ready, rest } = splitSentences("We open at nine a.m. and close at six. ");
  assert.ok(ready.length >= 1, "the completed sentence must still be spoken");
  assert.ok(
    ready.join(" ").includes("nine a.m. and close at six."),
    `sentence was fragmented: ${JSON.stringify(ready)}`,
  );
  assert.equal(rest.trim(), "");
});

// ---------------------------------------------------------------- frame pacing
//
// The pacer is the piece that makes the call feel real, and it is driven by a
// timer, so every test here runs on a fake clock. Nothing sleeps.

function fakeClock() {
  let now = 0;
  let seq = 0;
  const timers = new Map();
  return {
    now: () => now,
    setTimer: (fn, ms) => { const id = ++seq; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimer: (id) => { timers.delete(id); },
    /** Advance the clock, firing due timers in time order as we go. */
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let next = null;
        for (const [id, t] of timers) {
          if (t.at <= target && (next === null || t.at < timers.get(next).at)) next = id;
        }
        if (next === null) break;
        const t = timers.get(next);
        timers.delete(next);
        now = Math.max(now, t.at);
        t.fn();
      }
      now = target;
    },
    get pending() { return timers.size; },
  };
}

/** `n` frames' worth of mu-law, as one buffer. */
const audio = (frames) => Buffer.alloc(frames * FRAME_BYTES, 0xff);

function writer(leadMs = 60) {
  const clock = fakeClock();
  const sent = [];
  const w = new PacedWriter((f) => sent.push(f), leadMs, clock);
  return { w, sent, clock };
}

test("pacing does not delay the first audio, it writes a lead immediately", () => {
  const { w, sent } = writer(60);
  w.push(audio(50));
  // 60 ms of lead is exactly three 20 ms frames, written before any time passes.
  // Time to first byte is what the whole pipeline exists to protect, so a pacer
  // that held the first frame back would be a regression, not a fix.
  assert.equal(sent.length, 3);
});

test("the rest is paced at 20 ms per frame instead of dumped", () => {
  const { w, sent, clock } = writer(60);
  w.push(audio(50));
  assert.equal(sent.length, 3, "lead only");
  clock.advance(200);                    // 10 more frames' worth of time
  assert.equal(sent.length, 13, `expected 3 + 10, got ${sent.length}`);
  assert.ok(sent.length < 50, "the whole reply must not be handed over at once");
});

test("a partial frame is held until later audio completes it", () => {
  const { w, sent } = writer(60);
  w.push(Buffer.alloc(FRAME_BYTES - 1, 0xff));
  assert.equal(sent.length, 0, "half a frame is not a frame");
  w.push(Buffer.alloc(1, 0xff));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].length, FRAME_BYTES, "frames must be exactly 20 ms");
});

test("playedMs reports what the caller heard, not what we handed over", () => {
  const { w, clock } = writer(60);
  w.beginTurn();
  w.push(audio(100));                    // two seconds of speech
  assert.equal(w.playedMs(), 0, "nothing has played at t=0, even though frames went out");
  clock.advance(500);
  assert.equal(w.playedMs(), 500);
  // The bug this replaces: frames written == frames heard, so an interruption
  // half a second in credited the caller with the entire two seconds.
  assert.ok(w.framesWritten * FRAME_MS > w.playedMs(), "writer should be slightly ahead");
});

test("beginTurn rebases the counters so turn two is not credited with turn one", () => {
  const { w, clock } = writer(60);
  w.beginTurn();
  w.push(audio(50));
  clock.advance(1000);
  w.clear();                             // barge-in
  w.beginTurn();
  assert.equal(w.framesWritten, 0, "a new turn starts from zero");
  assert.equal(w.playedMs(), 0, "and has been heard for zero milliseconds");
});

test("clear drops everything not yet written", () => {
  const { w, sent, clock } = writer(60);
  w.push(audio(100));
  const atBargeIn = sent.length;
  w.clear();
  clock.advance(2000);
  assert.equal(sent.length, atBargeIn, "no frame may escape after a barge-in");
});

test("drained resolves only once playback has finished, not once writing has", async () => {
  const { w, clock } = writer(60);
  w.beginTurn();
  w.push(audio(25));                     // half a second of audio
  let done = false;
  const p = w.drained().then(() => { done = true; });
  clock.advance(200);
  await Promise.resolve();
  assert.equal(done, false, "still being heard at 200 ms of 500");
  clock.advance(400);
  await p;
  assert.equal(done, true);
  assert.ok(w.playedMs() >= 500, "the full utterance was heard before we moved on");
});

test("a barge-in releases a turn parked on drained", async () => {
  const { w, clock } = writer(60);
  w.push(audio(250));                    // five seconds
  const p = w.drained();
  clock.advance(100);
  w.clear();
  await p;                               // must not hang: nothing more will play
});

test("hangup releases a turn parked on drained", async () => {
  const { w } = writer(60);
  w.push(audio(250));
  const p = w.drained();
  w.stop();
  await p;                               // the leak that would hold the session alive
});

test("stop leaves no timer running", () => {
  const { w, clock } = writer(60);
  w.push(audio(250));
  w.stop();
  assert.equal(clock.pending, 0, "a live 20 ms timer would outlive the call");
});

test("a late timer does not compound into drift", () => {
  const { w, sent, clock } = writer(60);
  w.push(audio(500));                    // ten seconds
  clock.advance(5000);
  // Deadline driven, so 5 s of wall clock is 5 s of audio (plus the lead),
  // whatever the timer did in between. A fixed 20 ms interval would have fallen
  // behind here and the carrier would have underrun.
  const expected = 5000 / FRAME_MS + 60 / FRAME_MS;
  assert.ok(
    Math.abs(sent.length - expected) <= 2,
    `drifted: wrote ${sent.length} frames in 5s, expected about ${expected}`,
  );
});

test("a gap between sentences is a gap, not something to catch up on", () => {
  const { w, sent, clock } = writer(60);
  w.push(audio(5));                      // 100 ms
  clock.advance(3000);                   // long think, nothing to send
  const before = sent.length;
  w.push(audio(50));
  // Rebased to now rather than to a playoutEndsAt three seconds in the past, so
  // the new audio starts playing immediately instead of the pacer believing it
  // owes the caller three seconds and firing it all out at once.
  assert.ok(sent.length - before <= 4, `dumped ${sent.length - before} frames after the gap`);
});
