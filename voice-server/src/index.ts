/**
 * OctaDezx voice media server.
 *
 * Runs on Fly.io rather than Supabase Edge Functions or Vercel, because both of
 * those are request/response and cannot hold a live bidirectional audio socket
 * for the length of a phone call.
 *
 * The TeXML answer webhook is served from HERE rather than from a Supabase
 * function on purpose: this process is already warm and already holds the
 * credentials, so it can open the STT socket and warm the prompt cache while
 * the phone is still ringing. Async callbacks that do not care about warmth
 * (recording finished, AMD verdict, call status) live in Supabase functions.
 *
 * Carrier is Telnyx. Its media stream protocol is close to Twilio's but not
 * identical: fields are snake_case, the stream id sits at the top level of each
 * message rather than inside start, and messages we send back carry no stream
 * id at all because the socket already identifies the stream.
 */
import http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { config } from "./config.js";
import { CallSession } from "./CallSession.js";
import { Semaphore } from "./tts/index.js";
import { verifyCarrierRequest } from "./carrierSignature.js";
import * as texml from "./texml.js";
import * as db from "./supabase.js";
import { outboundOpener } from "./outbound.js";

const ttsSemaphore = new Semaphore(config.limits.maxConcurrentTts);

/** Calls that passed the TeXML gate and are waiting for their media socket. */
const pending = new Map<string, {
  businessId: string; callId: string; sessionId: string;
  settings: db.VoiceSettings; direction: "inbound" | "outbound";
  remainingSeconds: number; createdAt: number;
  peerE164: string; openingLine?: string; script?: string;
}>();

// A caller who never connects must not leak memory.
setInterval(() => {
  const cutoff = Date.now() - 120_000;
  for (const [sid, v] of pending) if (v.createdAt < cutoff) pending.delete(sid);
}, 60_000).unref();

const live = new Map<string, CallSession>();

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 1_000_000) { reject(new Error("body too large")); req.destroy(); }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const xml = (res: http.ServerResponse, body: string, code = 200) => {
  res.writeHead(code, { "content-type": "text/xml; charset=utf-8" });
  res.end(body);
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", config.publicUrl || `http://${req.headers.host}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      ok: true, liveCalls: live.size,
      tts: { inUse: ttsSemaphore.inUse, capacity: ttsSemaphore.capacity },
    }));
    return;
  }

  if (req.method !== "POST") { res.writeHead(404).end(); return; }

  // The signature covers the exact bytes, so the raw body is kept alongside the
  // parsed form rather than reconstructed from it.
  let raw = "";
  let params: Record<string, string> = {};
  try {
    raw = await readBody(req);
    params = Object.fromEntries(new URLSearchParams(raw));
  } catch {
    res.writeHead(413).end();
    return;
  }

  const signed = await verifyCarrierRequest(
    req.headers["telnyx-signature-ed25519"] as string | undefined,
    req.headers["telnyx-timestamp"] as string | undefined,
    raw,
  );
  if (!signed) {
    console.warn("[texml] bad signature for", url.pathname);
    res.writeHead(403).end();
    return;
  }

  try {
    switch (url.pathname) {
      case "/texml/inbound":  return xml(res, await handleInbound(params, url));
      case "/texml/consent":  return xml(res, await handleConsent(params, url));
      case "/texml/outbound": return xml(res, await handleOutbound(params, url));
      default:                res.writeHead(404).end();
    }
  } catch (err) {
    console.error("[texml] handler threw:", err);
    // Never leave a caller in dead air because our code failed.
    xml(res, texml.sayAndHangup("Sorry, we can't take your call right now. Please try again in a few minutes."));
  }
});

// --------------------------------------------------------------------- inbound

async function handleInbound(p: Record<string, string>, _url: URL): Promise<string> {
  const to = p.To ?? "";
  const from = p.From ?? "";
  const callSid = p.CallSid ?? "";

  const owner = await db.lookupNumber(to);
  if (!owner) return texml.reject();

  const settings = await db.getVoiceSettings(owner.businessId);
  if (!settings || !settings.enabled) return texml.reject();

  const allowance = await db.checkAllowance(owner.businessId);
  const open = await db.isBusinessOpen(owner.businessId);

  // Out of minutes, or closed: take a message rather than turning them away.
  const mustVoicemail = !allowance?.allowed || open === false;
  if (mustVoicemail) {
    if (!settings.voicemail_enabled || settings.after_hours_action === "hangup") {
      return texml.sayAndHangup("Sorry, we're closed right now. Do try us again during opening hours.");
    }
    if (settings.after_hours_action === "transfer" && settings.transfer_enabled && settings.transfer_e164) {
      return texml.dialHuman(
        settings.transfer_e164,
        cb(`/voice-telnyx/dial-status?business_id=${owner.businessId}`),
        "Connecting you now.",
      );
    }
    const reason = !allowance?.allowed ? "over_limit" : "after_hours";
    return texml.voicemail({
      greeting: settings.voicemail_greeting,
      actionUrl: cb("/voice-telnyx/voicemail-done"),
      recordingStatusUrl: cb(`/voice-telnyx/recording?business_id=${owner.businessId}&reason=${reason}`),
      maxSeconds: settings.voicemail_max_seconds,
    });
  }

  // Two-party consent jurisdictions: ask before recording anything.
  if (settings.record_calls && settings.consent_mode === "announce_and_require_ack") {
    return texml.consentGather(
      `${config.publicUrl}/texml/consent?call=${encodeURIComponent(callSid)}`,
      settings.recording_announcement,
    );
  }

  return startMedia({
    businessId: owner.businessId, settings, from, to, callSid,
    direction: "inbound",
    announcement: settings.record_calls && settings.consent_mode === "announce"
      ? settings.recording_announcement : undefined,
    remainingSeconds: allowance?.remaining_seconds ?? 0,
  });
}

async function handleConsent(p: Record<string, string>, _url: URL): Promise<string> {
  const callSid = p.CallSid ?? "";
  const to = p.To ?? "";
  const from = p.From ?? "";
  const declined = (p.Digits ?? "2") !== "1";

  const owner = await db.lookupNumber(to);
  if (!owner) return texml.reject();
  const settings = await db.getVoiceSettings(owner.businessId);
  if (!settings) return texml.reject();
  const allowance = await db.checkAllowance(owner.businessId);

  // Declining recording still gets a full conversation and a text transcript.
  return startMedia({
    businessId: owner.businessId, settings, from, to, callSid,
    direction: "inbound",
    consent: declined ? "declined" : "announced",
    remainingSeconds: allowance?.remaining_seconds ?? 0,
  });
}

async function handleOutbound(p: Record<string, string>, url: URL): Promise<string> {
  const callSid = p.CallSid ?? "";
  const businessId = url.searchParams.get("business_id") ?? "";
  const jobId = url.searchParams.get("job_id") ?? "";
  const settings = await db.getVoiceSettings(businessId);
  // Silence, not an explanation. This is an OUTBOUND leg: a stranger has just
  // picked up a call we placed. There is no version of "Configuration error"
  // that a person answering their own phone should ever hear, and apologising
  // for having rung them is worse than simply not being there.
  if (!settings) {
    console.error(`[texml] outbound ${callSid} has no voice_settings for business ${businessId}`);
    return texml.reject();
  }

  // Async AMD: the carrier answers immediately and posts the verdict separately, so
  // a human never hears the 2 to 4 seconds of dead air synchronous AMD costs.
  const answeredBy = p.AnsweredBy;
  if (answeredBy && answeredBy !== "human") {
    return texml.leaveMachineMessage(settings.amd_message);
  }

  const allowance = await db.checkAllowance(businessId);
  if (!allowance?.allowed) {
    console.warn(`[texml] outbound ${callSid} blocked: ${allowance?.reason ?? "no allowance"}`);
    return texml.reject();
  }

  const [job, businessName] = await Promise.all([
    jobId ? db.getOutboundJob(jobId) : Promise.resolve(null),
    db.getBusinessName(businessId),
  ]);

  return startMedia({
    businessId, settings,
    from: p.From ?? "", to: p.To ?? "", callSid,
    direction: "outbound",
    remainingSeconds: allowance.remaining_seconds ?? 0,
    script: db.callScript(job, settings),
    openingLine: outboundOpener({
      // The outbound greeting, not the inbound one. Falling back to `greeting`
      // only covers a server running ahead of the migration.
      greeting: settings.outbound_greeting || settings.greeting,
      businessName,
      personaName: settings.persona_name,
      purpose: job?.purpose,
      payload: job?.payload,
      includeOptOut: settings.include_opt_out,
      discloseAi: settings.disclose_ai,
    }),
  });
}

/**
 * Absolute URL of a Supabase edge function route.
 *
 * The carrier fetches these directly, so they must be real public URLs rather
 * than anything relative.
 */
function cb(path: string): string {
  return `${config.supabase.url}/functions/v1${path}`;
}

async function startMedia(a: {
  businessId: string; settings: db.VoiceSettings;
  from: string; to: string; callSid: string;
  direction: "inbound" | "outbound";
  announcement?: string; consent?: string; remainingSeconds: number;
  openingLine?: string; script?: string;
}): Promise<string> {
  const started = await db.callStart({
    businessId: a.businessId, direction: a.direction,
    from: a.from, to: a.to, callSid: a.callSid,
  });
  if (!started) return texml.sayAndHangup("Sorry, we can't take your call right now. Please try again in a few minutes.");

  pending.set(a.callSid, {
    businessId: a.businessId, callId: started.call_id, sessionId: started.session_id,
    settings: a.settings, direction: a.direction,
    remainingSeconds: a.remainingSeconds, createdAt: Date.now(),
    // Whoever is on the other end, which is who an opt-out applies to.
    peerE164: a.direction === "inbound" ? a.from : a.to,
    openingLine: a.openingLine,
    script: a.script,
  });

  const wsUrl = `${config.publicUrl.replace(/^http/, "ws")}/media?call=${encodeURIComponent(a.callSid)}`;
  return texml.connectStream(wsUrl, a.announcement);
}

// ----------------------------------------------------------------- media socket

const wss = new WebSocketServer({ server, path: "/media" });

wss.on("connection", (ws: WebSocket, req) => {
  const url = new URL(req.url ?? "/media", "http://localhost");
  const callSid = url.searchParams.get("call") ?? "";
  let session: CallSession | null = null;

  ws.on("message", async (raw) => {
    let msg: any;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.event) {
      // Telnyx opens with `connected` before `start`. Nothing to do, but it is
      // listed so an unexpected event is genuinely unexpected.
      case "connected":
        break;

      case "start": {
        const ctx = pending.get(callSid);
        if (!ctx) { console.warn("[media] unknown call", callSid); ws.close(); return; }
        pending.delete(callSid);

        // stream_id sits at the top level of the message, not inside start.
        session = new CallSession({
          ws, streamId: msg.stream_id ?? "", callSid,
          businessId: ctx.businessId, callId: ctx.callId, sessionId: ctx.sessionId,
          settings: ctx.settings, direction: ctx.direction,
          ttsSemaphore, remainingSeconds: ctx.remainingSeconds,
          peerE164: ctx.peerE164, openingLine: ctx.openingLine, script: ctx.script,
        });
        live.set(callSid, session);
        await session.start();
        break;
      }
      case "media":
        session?.onMedia(msg.media.payload);
        break;
      case "stop":
        await session?.onStop();
        live.delete(callSid);
        break;

      // The carrier reports stream-level problems in band. Silence here would
      // look identical to a caller who simply stopped talking.
      case "error":
        console.error("[media] carrier stream error:", JSON.stringify(msg.payload ?? msg));
        break;
    }
  });

  ws.on("close", async () => {
    if (session) { await session.hangup("completed", "socket_closed"); live.delete(callSid); }
  });
  ws.on("error", (e) => console.error("[media] socket error:", e));
});

server.listen(config.port, () => {
  console.log(`[voice-server] listening on :${config.port}`);
  console.log(`[voice-server] public url ${config.publicUrl || "(unset)"}`);
  console.log(`[voice-server] tts ${config.tts.provider}, stt ${config.deepgram.sttModel}`);
});

// Fly sends SIGTERM on deploy. Finish live calls rather than cutting them off.
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, async () => {
    console.log(`[voice-server] ${sig}, draining ${live.size} call(s)`);
    server.close();
    await Promise.all([...live.values()].map((s) => s.hangup("completed", "server_shutdown")));
    process.exit(0);
  });
}
