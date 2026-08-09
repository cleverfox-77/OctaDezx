/**
 * Telnyx's asynchronous callbacks.
 *
 * The TeXML that answers a ringing phone is served by the Fly media server,
 * which is already warm and holds the audio sockets. Everything in here is the
 * opposite kind of work: it happens after the fact, nobody is waiting on the
 * line, and it needs the Supabase service role rather than low latency.
 *
 * One function with a subpath router instead of five functions, because every
 * route shares the same signature verification, the same client and the same
 * secrets, and each extra function is another thing to deploy and another place
 * to forget to set an env var.
 *
 *   POST /voice-telnyx/recording       recordingStatusCallback (voicemail audio)
 *   POST /voice-telnyx/voicemail-done  <Record action>, returns TeXML
 *   POST /voice-telnyx/dial-status     <Dial action>, returns TeXML
 *   POST /voice-telnyx/call-status     statusCallback
 *   POST /voice-telnyx/amd             AsyncAmdStatusCallback
 *
 * verify_jwt = false: the caller is Telnyx, which cannot present a Supabase
 * JWT. Authentication is the Ed25519 webhook signature instead. Without that
 * check anyone who learned the URL could inject fabricated voicemails and call
 * records into a customer's history, so an unverified request is dropped even
 * though dropping it costs us a real voicemail if the key is ever wrong.
 *
 * TeXML is Twilio-compatible on the wire, so the parameter names below
 * (CallSid, RecordingUrl, DialCallStatus) are Telnyx's own, not leftovers.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { readTelnyxRequest, fetchRecording, deleteRecording } from "../_shared/telnyx.ts";
import { transcribeAudio } from "../_shared/transcribe.ts";
import { getOwnerContact, sendOwnerEmail, buildVoicemailEmail } from "../_shared/notify.ts";

const XML = { "content-type": "text/xml; charset=utf-8" };

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const texml = (inner: string) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, { headers: XML });

const sb = () => createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

/** Fire and forget without letting the isolate be torn down mid-flight. */
function background(work: Promise<unknown>) {
  const guarded = work.catch((err) => console.error("[voice-telnyx] background task failed:", err));
  // @ts-ignore EdgeRuntime is provided by the Supabase runtime.
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(guarded);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const url = new URL(req.url);
  // /functions/v1/voice-telnyx/<route>
  const route = url.pathname.split("/").filter(Boolean).pop() ?? "";

  // Reads the body once. Telnyx signs the exact bytes, so it cannot be parsed
  // first and reconstructed afterwards.
  const { ok, params } = await readTelnyxRequest(req);
  if (!ok) {
    console.warn("[voice-telnyx] signature rejected on", route);
    return new Response("Forbidden", { status: 403 });
  }

  try {
    switch (route) {
      case "recording":      return await onRecording(params, url);
      case "voicemail-done": return onVoicemailDone();
      case "dial-status":    return await onDialStatus(params, url);
      case "call-status":    return await onCallStatus(params, url);
      case "amd":            return await onAmd(params);
      default:               return new Response("Not found", { status: 404 });
    }
  } catch (err) {
    console.error(`[voice-telnyx] ${route} threw:`, err);
    // A 500 makes Telnyx retry, which is right for the async callbacks and
    // harmless for the two that return TeXML (the caller has already hung up).
    return new Response("Error", { status: 500 });
  }
});

// ---------------------------------------------------------------- recording

async function onRecording(p: Record<string, string>, url: URL): Promise<Response> {
  if ((p.RecordingStatus ?? "completed") !== "completed") return new Response("OK");

  const businessId = url.searchParams.get("business_id") ?? "";
  const reason = url.searchParams.get("reason") ?? "after_hours";
  const recordingUrl = p.RecordingUrl ?? "";
  const recordingSid = p.RecordingSid ?? "";
  const callSid = p.CallSid ?? "";

  if (!businessId || !recordingUrl || !callSid) {
    console.error("[voice-telnyx] recording callback missing business_id, url or call sid");
    return new Response("OK");
  }

  // Acknowledge now; downloading and transcribing takes seconds and a slow 200
  // just makes Telnyx redeliver the same recording.
  background(storeVoicemail({
    businessId, reason, recordingUrl, recordingSid, callSid,
    from: p.From ?? "", to: p.To ?? "",
    duration: Number(p.RecordingDuration ?? "0") || null,
  }));

  return new Response("OK");
}

async function storeVoicemail(a: {
  businessId: string; reason: string; recordingUrl: string; recordingSid: string;
  callSid: string; from: string; to: string; duration: number | null;
}) {
  const supabase = sb();

  const bytes = await fetchRecording(a.recordingUrl);
  if (!bytes) {
    console.error("[voice-telnyx] could not download recording", a.recordingSid);
    return;
  }

  const now = new Date();
  const path = `${a.businessId}/${now.getUTCFullYear()}/` +
    `${String(now.getUTCMonth() + 1).padStart(2, "0")}/${a.callSid}.wav`;

  const { error: upErr } = await supabase.storage
    .from("call-recordings")
    .upload(path, bytes, { contentType: "audio/wav", upsert: true });
  if (upErr) {
    // Without our own copy there is nothing to delete on the carrier's side
    // either, so stop here and let the retry pick it up.
    console.error("[voice-telnyx] recording upload failed:", upErr.message);
    return;
  }

  // Best effort: a voicemail with no transcript still reaches the owner.
  const transcript = await transcribeAudio(bytes, "audio/wav");

  const { data, error } = await supabase.rpc("voice_voicemail_record", {
    p_business_id: a.businessId,
    p_call_sid: a.callSid,
    p_from_e164: a.from,
    p_to_e164: a.to,
    p_recording_path: path,
    p_duration: a.duration,
    p_reason: a.reason,
    p_transcript: transcript?.text ?? null,
    p_confidence: transcript?.confidence ?? null,
  });
  if (error) {
    console.error("[voice-telnyx] voice_voicemail_record failed:", error.message);
    return;
  }

  // Only now is it safe to drop the carrier's copy: we stop paying Telnyx to
  // store it, and a later erasure request has one place to look instead of two.
  if (a.recordingSid) await deleteRecording(a.recordingSid);

  const { email, businessName } = await getOwnerContact(supabase, a.businessId);
  if (email) {
    const mail = buildVoicemailEmail({
      businessName,
      fromE164: a.from || null,
      durationSeconds: a.duration,
      transcript: transcript?.text ?? null,
      reason: a.reason,
    });
    await sendOwnerEmail(supabase, { to: email, ...mail });
  }

  console.log(`[voice-telnyx] voicemail stored ${(data as any)?.voicemail_id ?? "?"} (${path})`);
}

// ------------------------------------------------------------ TeXML replies

function onVoicemailDone(): Response {
  return texml(`<Say>Thanks, we have got your message. Goodbye.</Say><Hangup/>`);
}

/**
 * The transfer leg finished. Anything other than a real conversation means the
 * caller is still on the line with nobody to talk to, so fall through to
 * voicemail rather than dropping them.
 */
async function onDialStatus(p: Record<string, string>, url: URL): Promise<Response> {
  const status = p.DialCallStatus ?? "";
  if (status === "completed" || status === "answered") {
    return texml(`<Hangup/>`);
  }

  const businessId = url.searchParams.get("business_id") ?? "";
  const supabase = sb();
  const { data: settings } = await supabase
    .from("voice_settings")
    .select("voicemail_enabled, voicemail_greeting, voicemail_max_seconds")
    .eq("business_id", businessId)
    .maybeSingle();

  if (!settings?.voicemail_enabled) {
    return texml(`<Say>Sorry, nobody is available right now. Please try again later.</Say><Hangup/>`);
  }

  const base = `${Deno.env.get("SUPABASE_URL")}/functions/v1/voice-telnyx`;
  const q = `business_id=${encodeURIComponent(businessId)}&reason=no_human_available`;
  return texml(
    `<Say>${esc(settings.voicemail_greeting)}</Say>` +
    `<Record maxLength="${settings.voicemail_max_seconds ?? 120}" playBeep="true" trim="trim-silence" ` +
      `timeout="5" transcribe="false" ` +
      `action="${esc(`${base}/voicemail-done`)}" method="POST" ` +
      `recordingStatusCallback="${esc(`${base}/recording?${q}`)}" recordingStatusCallbackMethod="POST"/>` +
    `<Say>We did not get a message. Goodbye.</Say><Hangup/>`,
  );
}

// ----------------------------------------------------------- async callbacks

async function onCallStatus(p: Record<string, string>, url: URL): Promise<Response> {
  const callSid = p.CallSid ?? "";
  if (!callSid) return new Response("OK");

  // The carrier's vocabulary is hyphenated; ours is underscored to match the
  // CHECK. Anything unrecognised maps to null, which leaves the stored status
  // alone rather than writing a value the constraint would reject.
  const map: Record<string, string> = {
    queued: "queued", initiated: "queued", ringing: "ringing", "in-progress": "in_progress",
    completed: "completed", busy: "busy", "no-answer": "no_answer", failed: "failed", canceled: "canceled",
  };
  const status = map[p.CallStatus ?? ""] ?? null;
  const duration = Number(p.CallDuration ?? "0") || null;

  // An outbound leg that was never answered has no transcript and no AI turn,
  // so record why rather than leaving disposition null.
  const disposition =
    status === "no_answer" || status === "busy" ? "abandoned"
    : status === "failed" || status === "canceled" ? "failed"
    : null;

  const supabase = sb();
  const { data, error } = await supabase.rpc("voice_call_result", {
    p_call_sid: callSid,
    p_status: status,
    p_answered_by: p.AnsweredBy ?? null,
    p_duration: duration,
    p_hangup_cause: p.SipResponseCode ?? null,
    p_disposition: disposition,
  });
  if (error) console.error("[voice-telnyx] voice_call_result failed:", error.message);

  // A call that was never ANSWERED has no voice_calls row, because that row is
  // created by the media server when the media stream opens. voice_call_result
  // returns found:false and, until now, the carrier's reason was dropped on the
  // floor. That is why a call that never reached the handset showed up as a job
  // marked "done" with no error anywhere: the one system that knew what went
  // wrong was telling us, and nobody was writing it down.
  const found = (data as { found?: boolean } | null)?.found === true;
  const terminal = status && ["completed", "failed", "busy", "no_answer", "canceled"].includes(status);
  const businessId = url.searchParams.get("business_id");
  const jobId = url.searchParams.get("job_id");

  if (!found && terminal && businessId) {
    const reason = [
      p.CallStatus ?? status,
      p.SipResponseCode ? `SIP ${p.SipResponseCode}` : null,
      p.ErrorCode ? `error ${p.ErrorCode}` : null,
      p.HangupCause ?? null,
    ].filter(Boolean).join(", ");

    const { error: insErr } = await supabase.from("voice_calls").insert({
      business_id: businessId,
      direction: (p.Direction ?? "").includes("inbound") ? "inbound" : "outbound",
      carrier_call_id: callSid,
      from_e164: p.From ?? null,
      to_e164: p.To ?? null,
      status: status ?? "failed",
      // Never answered, so nothing was said and nothing was billed.
      disposition: disposition ?? "failed",
      hangup_cause: p.SipResponseCode ?? null,
      error_message: reason || "the call was never answered",
      duration_seconds: duration ?? 0,
      ended_at: new Date().toISOString(),
    });
    if (insErr) console.error("[voice-telnyx] could not record the unanswered call:", insErr.message);

    // Put the reason where whoever queued the call will actually look.
    if (jobId) {
      const { error: jobErr } = await supabase.from("voice_outbound_jobs")
        .update({ last_error: `not connected: ${reason || "never answered"}`.slice(0, 500) })
        .eq("id", jobId);
      if (jobErr) console.error("[voice-telnyx] could not annotate the job:", jobErr.message);
    }
    console.warn(`[voice-telnyx] call ${callSid} never connected: ${reason}`);
  }

  return new Response("OK");
}

async function onAmd(p: Record<string, string>): Promise<Response> {
  const callSid = p.CallSid ?? "";
  const answeredBy = p.AnsweredBy ?? "";
  if (!callSid || !answeredBy) return new Response("OK");

  const { error } = await sb().rpc("voice_call_result", {
    p_call_sid: callSid,
    p_status: null,
    p_answered_by: answeredBy,
    p_duration: null,
    p_hangup_cause: null,
    p_disposition: answeredBy.startsWith("machine") || answeredBy === "fax" ? "machine" : null,
  });
  if (error) console.error("[voice-telnyx] amd update failed:", error.message);

  return new Response("OK");
}
