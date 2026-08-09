/**
 * Owner-facing voice actions that need a credential the browser must never hold.
 *
 *   POST /voice-admin/numbers/search    find purchasable numbers
 *   POST /voice-admin/numbers/buy       buy one and point it at the media server
 *   POST /voice-admin/numbers/release   give one back
 *   POST /voice-admin/preview           synthesise a short voice sample
 *   POST /voice-admin/call              queue a manual outbound call
 *   POST /voice-admin/dnc               add a number to the do-not-call list
 *   POST /voice-admin/erase             erase a caller's audio and close their sessions
 *
 * Every route authenticates the caller's JWT and then re-checks that they own
 * the business_id in the body. RLS is not enough here: the work is done with
 * the service role, which bypasses it.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  searchNumbers as carrierSearch,
  orderNumber as carrierOrder,
  releaseNumber as carrierRelease,
  findNumberId,
} from "../_shared/telnyx.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY") ?? "";
const VOICE_SERVER_URL = (Deno.env.get("VOICE_SERVER_URL") ?? "").replace(/\/$/, "");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

/** Plans that include voice. Mirrors voice_plan_limits in the database. */
const VOICE_PLANS = new Set(["pro", "advanced", "enterprise"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization header" }, 401);

  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const businessId = String(body.business_id ?? "");
  if (!businessId) return json({ error: "business_id is required" }, 400);

  // The service role ignores RLS, so ownership is checked explicitly.
  const { data: biz } = await supabase.from("businesses")
    .select("id, owner_id").eq("id", businessId).maybeSingle();
  if (!biz || biz.owner_id !== user.id) return json({ error: "Not your business" }, 403);

  const { data: profile } = await supabase.from("profiles")
    .select("plan_type, subscription_status").eq("user_id", user.id).maybeSingle();
  const plan = profile?.plan_type ?? "free";

  // The Supabase edge runtime does not guarantee that req.url still carries the
  // /functions/v1/<name> prefix, and it does not here: splitting on that prefix
  // produced undefined, so every route fell through to the 404 default and the
  // dashboard's Search button did nothing. voice-jobs survives the same
  // ambiguity only because it reads the last path segment; these routes are two
  // levels deep and cannot. Match the function name when present, otherwise
  // treat the whole path as the route.
  const path = new URL(req.url).pathname;
  const marker = "/voice-admin";
  const at = path.indexOf(marker);
  const route = (at >= 0 ? path.slice(at + marker.length) : path).replace(/^\/+|\/+$/g, "");

  try {
    switch (route) {
      case "numbers/search":  return json(await searchNumbers(body));
      case "numbers/buy":     return json(await buyNumber(supabase, businessId, plan, body));
      case "numbers/release": return json(await releaseNumber(supabase, businessId, body));
      case "preview":         return json(await preview(body));
      case "call":            return json(await manualCall(supabase, businessId, plan, user.id, body));
      case "dnc":             return json(await addDnc(supabase, businessId, body));
      case "erase":           return json(await erase(supabase, businessId, body));
      default:                return json({ error: `unknown route "${route}"` }, 404);
    }
  } catch (err) {
    console.error(`[voice-admin] ${route} failed:`, err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});

// ----------------------------------------------------------------- numbers

async function searchNumbers(body: Record<string, any>) {
  if (!TELNYX_API_KEY) throw new Error("Telnyx is not configured on this deployment");

  const found = await carrierSearch({
    country: String(body.country ?? "US").slice(0, 2),
    areaCode: body.area_code ? String(body.area_code).replace(/\D/g, "") : undefined,
    contains: body.contains ? String(body.contains).replace(/\D/g, "") : undefined,
    numberType: body.number_type ? String(body.number_type).replace(/[^a-z_]/gi, "") : undefined,
    limit: 20,
  });
  if ("error" in found) throw new Error(found.error);

  return {
    numbers: found.map((n) => ({
      e164: n.e164,
      friendly_name: n.e164,
      locality: n.locality,
      region: n.country,
      monthly_cost_cents: n.monthlyCostCents,
      upfront_cost_cents: n.upfrontCostCents,
      currency: n.currency,
      number_type: n.numberType,
      capabilities: Object.fromEntries(n.features.map((f) => [f, true])),
    })),
  };
}

/**
 * Order a number and record it.
 *
 * Telnyx routes inbound calls by the number's connection rather than by a
 * per-number webhook, so unlike Twilio there is no VoiceUrl to set here. The
 * number is attached to the TeXML application, and that application's Voice URL
 * is what must point at the media server. That is a one time setup step in the
 * Telnyx portal, deliberately not written per purchase: silently repointing the
 * whole account's voice traffic as a side effect of buying one number would be
 * a surprising thing for this route to do.
 */
async function buyNumber(supabase: any, businessId: string, plan: string, body: Record<string, any>) {
  if (!VOICE_PLANS.has(plan)) {
    throw new Error("Phone numbers are available on Pro and above. Upgrade to add voice.");
  }
  if (!VOICE_SERVER_URL) throw new Error("The voice media server is not configured yet");
  if (!Deno.env.get("TELNYX_TEXML_APP_ID")) {
    throw new Error("The Telnyx TeXML application is not configured yet");
  }

  const raw = String(body.e164 ?? "");
  // Presentation characters are safe to drop: a number written +1 (401) 598-2932
  // is the same number. Note this cannot rescue a value whose digits have been
  // masked out, because removing the mask leaves too few digits and the check
  // below still fails, which is the outcome we want. Buying a number that is
  // not the one on screen would be far worse than refusing.
  const e164 = raw.replace(/[\s().-]/g, "");
  if (!/^\+[1-9]\d{6,14}$/.test(e164)) {
    // Echo what arrived. Saying only what a number should look like leaves
    // whoever is debugging with no way to see what went wrong.
    throw new Error(
      `That does not look like a phone number: "${raw}". ` +
      `It should be digits in international format, like +14015982932.`,
    );
  }

  const order = await carrierOrder(e164);
  if ("error" in order) throw new Error(order.error);

  // An order can settle asynchronously, so the number's own record may not
  // exist for a moment. It is not required to store the row, and releasing
  // looks the id up by number anyway, so a null here is survivable rather than
  // a reason to fail a purchase the carrier already accepted.
  const carrierNumberId = await findNumberId(e164);

  const { error } = await supabase.from("voice_phone_numbers").insert({
    business_id: businessId,
    e164,
    carrier_number_id: carrierNumberId,
    friendly_name: `OctaDezx ${businessId.slice(0, 8)}`,
    country: body.country ?? null,
    capabilities: { voice: true },
    provisioned_by: "platform",
  });
  if (error) {
    // Do not silently keep a number the business cannot see but is billed for.
    const undo = await carrierRelease(e164);
    if ("error" in undo) {
      throw new Error(
        `Number ordered but could not be saved, and releasing it failed: ${error.message}. ` +
        `Release ${e164} in the Telnyx portal so it does not keep billing.`,
      );
    }
    throw new Error(`Number ordered but could not be saved, so it was released: ${error.message}`);
  }

  // First number switches voice on, with sensible defaults the owner can edit.
  await supabase.from("voice_settings")
    .upsert({ business_id: businessId, enabled: true }, { onConflict: "business_id", ignoreDuplicates: true });

  return { ok: true, e164, order_id: order.orderId };
}

async function releaseNumber(supabase: any, businessId: string, body: Record<string, any>) {
  const id = String(body.id ?? "");
  const { data: row } = await supabase.from("voice_phone_numbers")
    .select("id, e164").eq("id", id).eq("business_id", businessId).maybeSingle();
  if (!row) throw new Error("Number not found");

  const released = await carrierRelease(row.e164);
  // Already gone on the carrier's side is fine. Anything else should surface
  // rather than marking a number released while it keeps billing.
  if ("error" in released && !/not found/i.test(released.error)) {
    throw new Error(released.error);
  }

  await supabase.from("voice_phone_numbers").update({ status: "released" }).eq("id", row.id);
  return { ok: true };
}

// ----------------------------------------------------------------- preview

/**
 * A short sample of a voice, so the owner can choose one without placing a
 * call. Kept deliberately short: this is billed per character.
 */
async function preview(body: Record<string, any>) {
  const key = Deno.env.get("DEEPGRAM_API_KEY");
  if (!key) throw new Error("Text to speech is not configured on this deployment");

  const voice = String(body.voice ?? "aura-2-thalia-en").replace(/[^a-z0-9-]/gi, "");
  const text = String(body.text ?? "Hi, thanks for calling. How can I help you today?").slice(0, 200);

  const res = await fetch(
    `https://api.deepgram.com/v1/speak?model=${voice}&encoding=linear16&container=wav&sample_rate=24000`,
    {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ text }),
    },
  );
  if (!res.ok) throw new Error(`Voice preview failed (${res.status})`);

  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return { mime: "audio/wav", audio_base64: btoa(binary) };
}

// ---------------------------------------------------------------- outbound

async function manualCall(
  supabase: any, businessId: string, plan: string, userId: string, body: Record<string, any>,
) {
  if (!VOICE_PLANS.has(plan)) throw new Error("Outbound calling is available on Pro and above");

  const to = String(body.to_e164 ?? "").replace(/[^\d+]/g, "");
  if (!/^\+[1-9]\d{6,14}$/.test(to)) throw new Error("Enter the number in international format, e.g. +8801700000000");

  const { data, error } = await supabase.rpc("enqueue_voice_job", {
    p_business_id: businessId,
    p_to_e164: to,
    p_purpose: "manual",
    p_payload: { note: String(body.note ?? "").slice(0, 500) },
    p_scheduled_for: body.scheduled_for ?? new Date().toISOString(),
    p_idempotency_key: body.idempotency_key ?? null,
    p_callee_timezone: body.callee_timezone ?? null,
    // Recorded because "why were we allowed to call this person" is the first
    // question asked in any complaint.
    p_consent_source: String(body.consent_source ?? "").slice(0, 200) || null,
    p_created_by: userId,
  });
  if (error) throw new Error(error.message);
  return data;
}

async function addDnc(supabase: any, businessId: string, body: Record<string, any>) {
  const e164 = String(body.e164 ?? "").replace(/[^\d+]/g, "");
  if (!e164) throw new Error("e164 is required");
  const { data, error } = await supabase.rpc("voice_dnc_add", {
    p_business_id: businessId, p_e164: e164, p_reason: String(body.reason ?? "added by owner").slice(0, 200),
  });
  if (error) throw new Error(error.message);
  return data;
}

async function erase(supabase: any, businessId: string, body: Record<string, any>) {
  const e164 = String(body.e164 ?? "").replace(/[^\d+]/g, "");
  if (!e164) throw new Error("e164 is required");

  // Collect the object keys before the rows forget them, or the audio is
  // orphaned in the bucket forever.
  const [{ data: calls }, { data: vms }] = await Promise.all([
    supabase.from("voice_calls").select("recording_path")
      .eq("business_id", businessId).or(`from_e164.eq.${e164},to_e164.eq.${e164}`)
      .not("recording_path", "is", null),
    supabase.from("voice_voicemails").select("recording_path")
      .eq("business_id", businessId).eq("from_e164", e164),
  ]);

  const paths = [...(calls ?? []), ...(vms ?? [])]
    .map((r: any) => r.recording_path).filter((p: string) => p);
  if (paths.length) {
    const { error: rmErr } = await supabase.storage.from("call-recordings").remove(paths);
    if (rmErr) console.error("[voice-admin] erase: storage remove failed:", rmErr.message);
  }

  const { data, error } = await supabase.rpc("voice_erase_caller", {
    p_business_id: businessId, p_e164: e164,
  });
  if (error) throw new Error(error.message);
  return { ...(data as object), audio_objects_deleted: paths.length };
}
