// Alias for enforce-trial-end — kept for backwards compatibility with any cron
// configuration that points to this endpoint. Both functions are identical.
// See enforce-trial-end/index.ts for the canonical implementation.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

serve(async (req) => {
  // ── Secret token guard ────────────────────────────────────────────────────
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: expiredProfiles, error: selectError } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("subscription_status", "trial")
      .lt("trial_start_timestamp", cutoff);

    if (selectError) throw selectError;

    if (!expiredProfiles || expiredProfiles.length === 0) {
      return new Response(JSON.stringify({ message: "No expired trials found." }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    const userIds = expiredProfiles.map((p: any) => p.user_id);

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ subscription_status: "expired", plan_type: "free" })
      .in("user_id", userIds);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ message: `Expired ${userIds.length} trial(s).` }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("trials error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
