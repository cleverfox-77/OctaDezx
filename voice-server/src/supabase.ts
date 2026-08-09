/**
 * The media server's entire write surface onto Supabase.
 *
 * Deliberately narrow: this process runs outside Supabase on Fly and holds a
 * service role key, so it calls a fixed set of SECURITY DEFINER RPCs instead of
 * touching tables. A leaked key then has a bounded blast radius, and the
 * metering and transcript rules stay in one place (20260803000100_voice_functions.sql).
 */
import { config } from "./config.js";

async function rpc<T = any>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(`${config.supabase.url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        apikey: config.supabase.serviceKey,
        Authorization: `Bearer ${config.supabase.serviceKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      console.error(`[supabase] ${fn} -> ${res.status}`, await res.text().catch(() => ""));
      return null;
    }
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : null;
  } catch (err) {
    console.error(`[supabase] ${fn} threw:`, err);
    return null;
  }
}

async function select<T = any>(path: string): Promise<T[]> {
  try {
    const res = await fetch(`${config.supabase.url}/rest/v1/${path}`, {
      headers: {
        apikey: config.supabase.serviceKey,
        Authorization: `Bearer ${config.supabase.serviceKey}`,
      },
    });
    if (!res.ok) return [];
    return (await res.json()) as T[];
  } catch { return []; }
}

export interface VoiceSettings {
  business_id: string;
  enabled: boolean;
  greeting: string;
  tts_provider: string;
  tts_voice: string;
  language: string;
  timezone: string;
  max_call_seconds: number;
  record_calls: boolean;
  consent_mode: "off" | "announce" | "announce_and_require_ack";
  recording_announcement: string;
  transfer_enabled: boolean;
  transfer_e164: string | null;
  voicemail_enabled: boolean;
  voicemail_greeting: string;
  voicemail_max_seconds: number;
  after_hours_action: "voicemail" | "ai" | "transfer" | "hangup";
  amd_message: string;

  // Persona and training. The select is already `*`, so these arrive with the
  // row; they are optional here only so a server running ahead of the migration
  // keeps answering calls instead of crashing on a missing column.
  persona_name?: string | null;
  persona_role?: string | null;
  persona_style?: string;
  /** Spoken when WE placed the call. `greeting` is for calls coming in. */
  outbound_greeting?: string;
  outbound_script?: string;
  disclose_ai?: boolean;
  include_opt_out?: boolean;
}

/** Which business owns this number, and how do they want calls handled? */
export async function lookupNumber(e164: string): Promise<{ businessId: string } | null> {
  const rows = await select<{ business_id: string }>(
    `voice_phone_numbers?e164=eq.${encodeURIComponent(e164)}&status=eq.active&select=business_id&limit=1`,
  );
  return rows[0] ? { businessId: rows[0].business_id } : null;
}

/** Just the name, for greeting placeholders. Cheap enough to fetch per call. */
export async function getBusinessName(businessId: string): Promise<string> {
  const rows = await select<{ name: string }>(
    `businesses?id=eq.${encodeURIComponent(businessId)}&select=name&limit=1`,
  );
  return rows[0]?.name ?? "";
}

export async function getVoiceSettings(businessId: string): Promise<VoiceSettings | null> {
  const rows = await select<VoiceSettings>(
    `voice_settings?business_id=eq.${businessId}&select=*&limit=1`,
  );
  return rows[0] ?? null;
}

/** Business facts and knowledge, as the AI turn needs them. */
export interface TurnContext {
  business: Record<string, unknown> | null;
  knowledge: { title: string; content: string }[];
}

/**
 * Everything a turn needs to know about the business, fetched ONCE per call.
 *
 * This ran inside the edge function on every single turn, and the telemetry put
 * it at 836 to 1226 ms of the caller's silence, every time. None of it can
 * change mid-call. An isolate-level cache did not help because Supabase gave us
 * a cold isolate on every request, so `warm` was false on every measured turn.
 *
 * Here it is fetched once while the greeting is still playing, by a long lived
 * process with an already warm connection to the same database, and sent along
 * with each turn. The edge function still loads it itself if this is missing.
 */
export async function loadTurnContext(businessId: string): Promise<TurnContext> {
  const id = encodeURIComponent(businessId);
  const [rows, articles] = await Promise.all([
    select<any>(
      `businesses?id=eq.${id}&limit=1&select=id,name,description,policies,ai_instructions,` +
      `business_type,type_config,products(id,name,description,price,stock_quantity,is_active)`,
    ),
    select<any>(
      `knowledge_base_articles?business_id=eq.${id}&select=title,content&order=created_at.desc&limit=6`,
    ),
  ]);

  const business = rows[0] ?? null;
  if (business) {
    business.products = (business.products ?? []).filter((p: any) => p.is_active !== false);
  }
  return {
    business,
    knowledge: articles.map((a) => ({
      title: String(a.title ?? ""),
      // Matches the edge function's own clip. Shorter was tried for latency and
      // it just gave the model half an article to be confident from.
      content: String(a.content ?? "").slice(0, 1200),
    })),
  };
}

export const checkAllowance = (businessId: string, estimatedSeconds = 60) =>
  rpc<{
    allowed: boolean; reason?: string; plan?: string;
    remaining_seconds?: number; per_call_seconds?: number;
  }>("check_voice_allowance", { p_business_id: businessId, p_estimated_seconds: estimatedSeconds });

export const isBusinessOpen = (businessId: string) =>
  rpc<boolean>("is_business_open", { p_business_id: businessId });

export const callStart = (args: {
  businessId: string; direction: "inbound" | "outbound";
  from: string; to: string; callSid: string; streamId?: string;
}) =>
  // The RPC parameter names predate the carrier swap and are unchanged on
  // purpose: TeXML posts CallSid exactly as Twilio did, and renaming function
  // arguments would break every call site for no behavioural gain.
  rpc<{ call_id: string; session_id: string; reused: boolean }>("voice_call_start", {
    p_business_id: args.businessId,
    p_direction: args.direction,
    p_from_e164: args.from,
    p_to_e164: args.to,
    p_call_sid: args.callSid,
    p_stream_sid: args.streamId ?? null,
  });

export const appendTurn = (
  sessionId: string,
  sender: "customer" | "ai" | "system",
  content: string,
  metadata: Record<string, unknown> = {},
) =>
  rpc<string>("voice_append_turn", {
    p_session_id: sessionId, p_sender: sender, p_content: content, p_metadata: metadata,
  });

export const recordUsage = (businessId: string, callId: string, seconds: number) =>
  rpc<{ remaining_seconds: number; soft_warning: boolean; hard_cutoff: boolean }>(
    "record_voice_usage",
    { p_business_id: businessId, p_call_id: callId, p_seconds: seconds },
  );

/**
 * Honour an opt-out immediately, including for calls already queued.
 *
 * Under the TCPA an opt-out has to take effect straight away, so this is called
 * from inside the live call rather than queued for later processing.
 */
export const dncAdd = (businessId: string, e164: string, reason = "caller asked to stop calling") =>
  rpc<{ ok: boolean; cancelled_jobs: number }>("voice_dnc_add", {
    p_business_id: businessId, p_e164: e164, p_reason: reason,
  });

export interface OutboundJob {
  id: string;
  purpose: string;
  payload: Record<string, unknown>;
  to_e164: string;
}

/** The reason we are calling, so the opening line and the model both know it. */
export async function getOutboundJob(id: string): Promise<OutboundJob | null> {
  const rows = await select<OutboundJob>(
    `voice_outbound_jobs?id=eq.${encodeURIComponent(id)}&select=id,purpose,payload,to_e164&limit=1`,
  );
  return rows[0] ?? null;
}

/**
 * What this specific call is about, as written by the owner.
 *
 * The dashboard's "what the call is about" box lands in payload.note. Falling
 * back to the business default means a queued call with nothing typed still
 * has context rather than the assistant improvising a reason for ringing.
 */
export function callScript(job: OutboundJob | null, settings: VoiceSettings): string {
  const note = job?.payload?.note;
  const typed = typeof note === "string" ? note.trim() : "";
  return typed || (settings.outbound_script ?? "").trim();
}

export const callEnd = (args: {
  callId: string; status?: string; disposition?: string;
  durationSeconds?: number; hangupCause?: string;
}) =>
  rpc("voice_call_end", {
    p_call_id: args.callId,
    p_status: args.status ?? "completed",
    p_disposition: args.disposition ?? "ai_handled",
    p_duration_seconds: args.durationSeconds ?? null,
    p_hangup_cause: args.hangupCause ?? null,
  });
