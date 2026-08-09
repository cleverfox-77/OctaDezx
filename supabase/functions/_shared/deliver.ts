/**
 * Sending something to the person you are on the phone with.
 *
 * A caller asks for a link, a price list or a photo. The assistant should be
 * able to say "I'll send that to your WhatsApp" and have it actually arrive.
 * Before this existed it would cheerfully promise a text and send nothing,
 * which is worse than saying no.
 *
 * WHAT IS AND IS NOT REACHABLE, because this is the whole design constraint:
 *
 *   A phone call gives us one identifier, the caller's number. Meta and
 *   Telegram do not address people by phone number. A Messenger recipient is a
 *   page-scoped PSID, an Instagram recipient is an IGSID, a Telegram recipient
 *   is a chat id. Those are opaque and are only learned when that person
 *   messages the business first. There is no lookup from a phone number to any
 *   of them, so a caller cannot be reached on Messenger, Instagram or Telegram
 *   just because the business has connected those channels.
 *
 *   WhatsApp is the exception, and the reason this feature works at all: a
 *   WhatsApp user IS their phone number. Someone who has messaged the business
 *   on WhatsApp is stored as `whatsapp:<digits>`, so a caller can be matched to
 *   that conversation exactly.
 *
 * THE 24 HOUR WINDOW: Meta only allows free-form messages within 24 hours of
 * the customer's last inbound message. Outside it, a send is silently dropped
 * or rejected unless it uses a pre-approved template. So reachability is not
 * "the business connected WhatsApp", it is "this person messaged us recently",
 * and that is what is checked below. Anything else would put us straight back
 * to promising things that never arrive.
 */

/** Meta's free-form messaging window. Their rule, not ours. */
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ReachableChannel {
  platform: string;
  /** What the assistant should call it out loud. */
  label: string;
  /** Platform-scoped recipient id. For WhatsApp this is the phone digits. */
  target: string;
  sessionId: string | null;
}

/** Digits only, so +880 1749-595605 and 8801749595605 compare equal. */
export const phoneDigits = (e164: string) => String(e164 ?? "").replace(/\D/g, "");

const LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  facebook: "Facebook Messenger",
  instagram: "Instagram",
};

/**
 * Which connected channels this particular caller can actually be reached on
 * right now. Empty is the normal answer for a cold call, and the caller-facing
 * behaviour for empty is to not offer at all.
 */
export async function reachableChannels(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  businessId: string,
  callerE164: string | null | undefined,
): Promise<ReachableChannel[]> {
  const digits = phoneDigits(callerE164 ?? "");
  if (!digits) return [];

  const [integrationsRes, sessionsRes] = await Promise.all([
    // "connected" is the value the connect flow writes once the webhook has
    // verified. "pending" and "disconnected" both mean we cannot send.
    supabase.from("platform_integrations")
      .select("platform, status")
      .eq("business_id", businessId)
      .eq("status", "connected"),
    // Only identities keyed by the caller's own number can belong to them.
    supabase.from("chat_sessions")
      .select("id, source, external_user_id, updated_at")
      .eq("business_id", businessId)
      .like("external_user_id", `%${digits}`)
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);

  const active = new Set(
    ((integrationsRes?.data ?? []) as { platform: string }[]).map((i) => i.platform),
  );
  if (!active.size) return [];

  const sessions = (sessionsRes?.data ?? []) as
    { id: string; source: string | null; external_user_id: string | null }[];

  const out: ReachableChannel[] = [];
  const seen = new Set<string>();

  for (const s of sessions) {
    const id = s.external_user_id ?? "";
    const sep = id.indexOf(":");
    if (sep < 1) continue;
    const platform = id.slice(0, sep);
    const target = id.slice(sep + 1);
    if (!active.has(platform) || seen.has(platform) || !target) continue;

    // The recipient must BE this caller's number, not merely end in the same
    // digits. The lookup above is a suffix match, so an Instagram or Messenger
    // id that happens to end in "1749595605" would otherwise come back as a
    // match and we would send this caller's details to a total stranger.
    // Only phone-keyed identities can be proven to belong to the caller, which
    // in practice means WhatsApp, and that limit is the honest one: there is no
    // lookup from a phone number to a PSID, an IGSID or a Telegram chat id.
    if (phoneDigits(target) !== digits) continue;

    if (!(await withinServiceWindow(supabase, s.id))) continue;

    seen.add(platform);
    out.push({ platform, label: LABELS[platform] ?? platform, target, sessionId: s.id });
  }
  return out;
}

/** Did this person message us inside Meta's 24 hour window? */
async function withinServiceWindow(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  sessionId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - SERVICE_WINDOW_MS).toISOString();
  const { data } = await supabase.from("chat_messages")
    .select("id")
    .eq("session_id", sessionId)
    .eq("sender_type", "customer")
    .gte("created_at", since)
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

/**
 * Send it, and write it into the conversation history so the business can see
 * what its assistant sent on their behalf.
 *
 * Returns a plain ok/error rather than throwing: a failed send must never take
 * down the phone call that triggered it.
 */
export async function deliverToChannel(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  businessId: string,
  channel: ReachableChannel,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const body = String(text ?? "").trim().slice(0, 4000);
  if (!body) return { ok: false, error: "nothing to send" };

  const { data: rows } = await supabase.from("platform_integrations")
    .select("credentials")
    .eq("business_id", businessId)
    .eq("platform", channel.platform)
    .limit(1);
  const creds = ((rows ?? [])[0]?.credentials ?? {}) as Record<string, string>;

  try {
    let res: Response | null = null;
    switch (channel.platform) {
      case "whatsapp": {
        const token = creds.access_token;
        const phoneNumberId = creds.phone_number_id;
        if (!token || !phoneNumberId) return { ok: false, error: "whatsapp is not fully configured" };
        res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp", to: channel.target,
            type: "text", text: { body },
          }),
        });
        break;
      }
      case "facebook":
      case "instagram": {
        const token = creds.access_token;
        if (!token) return { ok: false, error: `${channel.platform} is not fully configured` };
        res = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${token}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipient: { id: channel.target }, message: { text: body } }),
        });
        break;
      }
      case "telegram": {
        const token = creds.bot_token;
        if (!token) return { ok: false, error: "telegram is not fully configured" };
        res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: channel.target, text: body }),
        });
        break;
      }
      default:
        return { ok: false, error: `cannot send on ${channel.platform}` };
    }

    // Meta answers 200 with an error object for some failures, so the status
    // alone is not proof it went out.
    const detail = await res.text().catch(() => "");
    if (!res.ok || /"error"\s*:/.test(detail)) {
      return { ok: false, error: `${channel.platform} rejected it: ${detail.slice(0, 200)}` };
    }

    if (channel.sessionId) {
      await supabase.from("chat_messages").insert({
        session_id: channel.sessionId,
        sender_type: "ai",
        content: body,
        metadata: { kind: "sent_from_call", channel: channel.platform },
      });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
