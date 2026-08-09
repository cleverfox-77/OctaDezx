import { supabase } from "@/integrations/supabase/client";

/**
 * Call the voice-admin edge function.
 *
 * Everything that needs a Telnyx or Deepgram credential goes through here. The
 * browser never holds those keys: it sends the user's own session token and the
 * function re-checks that they own the business before acting.
 */
// Same fallbacks as integrations/supabase/client.ts, so this keeps working in a
// checkout with no .env file rather than posting to "undefined/functions/v1".
const BASE = import.meta.env.VITE_SUPABASE_URL || "https://dnjhvfmlmvhabrlpcmao.supabase.co";
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export async function callVoiceAdmin<T = any>(route: string, body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Your session expired. Sign in again.");

  const res = await fetch(`${BASE}/functions/v1/voice-admin/${route}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(ANON ? { apikey: ANON } : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
  return json as T;
}
