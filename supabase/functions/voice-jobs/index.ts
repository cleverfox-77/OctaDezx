/**
 * Scheduled voice work: outbound dispatch, reminder generation, audio retention.
 *
 *   POST /voice-jobs/dispatch    every minute   place due outbound calls
 *   POST /voice-jobs/reminders   hourly         queue 24 hour appointment reminders
 *   POST /voice-jobs/retention   nightly        delete audio past its retention window
 *
 * Guarded by CRON_SECRET as a bearer token, the same convention enforce-trial-end
 * already uses and the same one the existing 'expire-trials' pg_cron job sends.
 *
 * Outbound is the highest-risk feature in the product. The FCC's 2024 ruling
 * treats an AI voice as an "artificial voice" under the TCPA, which means a
 * call placed at the wrong hour, to the wrong number, or to somebody who has
 * opted out is a statutory violation per call. Every check below exists for
 * that reason, and each one fails closed.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCall } from "../_shared/telnyx.ts";
import { callWindowCheck, hhmmToMinutes } from "../_shared/callWindow.ts";

const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const VOICE_SERVER_URL = (Deno.env.get("VOICE_SERVER_URL") ?? "").replace(/\/$/, "");

const sb = () => createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  if (!CRON_SECRET) {
    console.error("[voice-jobs] CRON_SECRET is not set, refusing to run");
    return json({ error: "not configured" }, 500);
  }
  if (req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return json({ error: "unauthorized" }, 401);
  }

  const route = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  try {
    switch (route) {
      case "dispatch":  return json(await dispatch());
      case "reminders": return json(await reminders());
      case "retention": return json(await retention());
      default:          return json({ error: `unknown route "${route}"` }, 404);
    }
  } catch (err) {
    console.error(`[voice-jobs] ${route} threw:`, err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

// ---------------------------------------------------------------- dispatch

interface Job {
  id: string; business_id: string; to_e164: string; callee_timezone: string | null;
  purpose: string; payload: Record<string, unknown>; attempts: number;
}

async function dispatch() {
  if (!VOICE_SERVER_URL) {
    console.error("[voice-jobs] VOICE_SERVER_URL not set, cannot place calls");
    return { error: "VOICE_SERVER_URL not set" };
  }

  const supabase = sb();
  const worker = `edge-${crypto.randomUUID().slice(0, 8)}`;

  const { data: jobs, error } = await supabase.rpc("claim_voice_jobs", { p_limit: 10, p_worker: worker });
  if (error) throw new Error(`claim_voice_jobs: ${error.message}`);

  const claimed = (jobs ?? []) as Job[];
  const result = { claimed: claimed.length, placed: 0, skipped: 0, failed: 0 };

  for (const job of claimed) {
    const outcome = await placeCall(supabase, job);
    if (outcome.kind === "placed") result.placed++;
    else if (outcome.kind === "skipped") result.skipped++;
    else result.failed++;
  }

  return result;
}

type Outcome = { kind: "placed" | "skipped" | "failed" };

async function placeCall(supabase: any, job: Job): Promise<Outcome> {
  const finish = async (o: Outcome, opts: { callId?: string; error?: string }) => {
    const { error } = await supabase.rpc("complete_voice_job", {
      p_job_id: job.id,
      p_ok: o.kind === "placed",
      p_call_id: opts.callId ?? null,
      p_error: opts.error ?? null,
      p_skip: o.kind === "skipped",
    });
    if (error) console.error("[voice-jobs] complete_voice_job failed:", error.message);
    return o;
  };

  // Re-check the opt-out list. It is checked at enqueue too, but a reminder
  // queued yesterday must not go out to somebody who opted out this morning.
  const { data: dnc } = await supabase.from("voice_dnc")
    .select("e164").eq("business_id", job.business_id).eq("e164", job.to_e164).maybeSingle();
  if (dnc) return finish({ kind: "skipped" }, { error: "on the do-not-call list" });

  const { data: settings } = await supabase.from("voice_settings")
    .select("enabled, outbound_enabled, timezone, outbound_window_start, outbound_window_end, amd_enabled")
    .eq("business_id", job.business_id).maybeSingle();

  if (!settings?.enabled || !settings?.outbound_enabled) {
    return finish({ kind: "skipped" }, { error: "outbound calling is switched off" });
  }

  const win = callWindowCheck(job, settings.timezone ?? "UTC",
    hhmmToMinutes(settings.outbound_window_start, 9 * 60),
    hhmmToMinutes(settings.outbound_window_end, 20 * 60));
  if (!win.ok) {
    // Not a failure and not a skip forever: try again on the next tick, which
    // will eventually land inside the window.
    const { error } = await supabase.rpc("complete_voice_job", {
      p_job_id: job.id, p_ok: false, p_call_id: null, p_error: win.why, p_skip: false,
    });
    if (error) console.error("[voice-jobs] requeue failed:", error.message);
    return { kind: "skipped" };
  }

  const { data: allowance } = await supabase.rpc("check_voice_allowance", {
    p_business_id: job.business_id, p_estimated_seconds: 120,
  });
  if (!allowance?.allowed) {
    return finish({ kind: "skipped" }, { error: allowance?.reason ?? "no voice allowance" });
  }

  const { data: number } = await supabase.from("voice_phone_numbers")
    .select("e164").eq("business_id", job.business_id)
    .eq("status", "active").eq("outbound_caller_id", true)
    .limit(1).maybeSingle();
  if (!number?.e164) {
    return finish({ kind: "skipped" }, { error: "no outbound caller id configured" });
  }

  const q = new URLSearchParams({ business_id: job.business_id, job_id: job.id, purpose: job.purpose });
  const call = await createCall({
    to: job.to_e164,
    from: number.e164,
    url: `${VOICE_SERVER_URL}/texml/outbound?${q}`,
    // The ids ride on the callback URL because a call that is never ANSWERED
    // has no voice_calls row to look them up from: that row is created by the
    // media server when the stream starts. Without them, the carrier's reason
    // for the failure arrives and cannot be attributed to anything, which is
    // exactly how a job ends up marked done with nothing to show for it.
    statusCallback: `${SUPABASE_URL}/functions/v1/voice-telnyx/call-status`
      + `?business_id=${encodeURIComponent(job.business_id)}&job_id=${encodeURIComponent(job.id)}`,
    amd: settings.amd_enabled !== false,
    amdStatusCallback: `${SUPABASE_URL}/functions/v1/voice-telnyx/amd`,
  });

  if ("error" in call) {
    console.error("[voice-jobs] the carrier rejected the call:", call.error);
    return finish({ kind: "failed" }, { error: call.error });
  }

  // The call row is created by the media server when it answers, so link the
  // job by call sid rather than waiting for an id we do not have yet. An empty
  // sid means the carrier accepted the call without a recognisable id: still
  // placed, just not linkable yet, and querying on "" would match nothing at
  // best and the wrong row at worst.
  const row = call.sid
    ? (await supabase.from("voice_calls")
        .select("id").eq("carrier_call_id", call.sid).maybeSingle()).data
    : null;

  return finish({ kind: "placed" }, { callId: row?.id });
}

// --------------------------------------------------------------- reminders

async function reminders() {
  const { data, error } = await sb().rpc("voice_enqueue_appointment_reminders");
  if (error) throw new Error(`voice_enqueue_appointment_reminders: ${error.message}`);
  return data ?? { scanned: 0, enqueued: 0 };
}

// --------------------------------------------------------------- retention

/**
 * Audio expires, transcripts do not. The recording is what carries voice
 * biometrics and two-party-consent exposure; the text is what the business
 * actually needs to keep.
 */
async function retention() {
  const supabase = sb();
  const { data, error } = await supabase.rpc("voice_retention_due", { p_limit: 200 });
  if (error) throw new Error(`voice_retention_due: ${error.message}`);

  const due = (data ?? []) as { kind: string; row_id: string; business_id: string; path: string }[];
  let deleted = 0;

  for (const item of due) {
    if (!item.path) continue;
    const { error: rmErr } = await supabase.storage.from("call-recordings").remove([item.path]);
    // A missing object is still a success: the row should stop pointing at it.
    if (rmErr && !/not.?found/i.test(rmErr.message)) {
      console.error("[voice-jobs] storage delete failed:", item.path, rmErr.message);
      continue;
    }
    const { error: clrErr } = await supabase.rpc("voice_retention_clear", {
      p_kind: item.kind, p_row_id: item.row_id,
    });
    if (clrErr) { console.error("[voice-jobs] retention clear failed:", clrErr.message); continue; }
    deleted++;
  }

  return { due: due.length, deleted };
}
