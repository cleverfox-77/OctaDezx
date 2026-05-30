import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Authenticate the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lemonSqueezyApiKey = Deno.env.get("LEMON_SQUEEZY_API_KEY");

    // Create client with user's token to get their identity
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get user's subscription info using service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("lemon_squeezy_subscription_id, subscription_status, plan_type")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile.lemon_squeezy_subscription_id) {
      return new Response(
        JSON.stringify({ error: "No active subscription found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip API call for lifetime deals (AppSumo LTD) — these can't be cancelled via LS API
    if (profile.plan_type === "appsumo_ltd") {
      return new Response(
        JSON.stringify({ error: "Lifetime deals cannot be cancelled through the dashboard. Please contact support at kevin@octadezx.com." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip if already cancelled
    if (profile.subscription_status === "cancelled" || profile.subscription_status === "expired") {
      return new Response(
        JSON.stringify({ error: "Subscription is already cancelled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Call Lemon Squeezy API to cancel at period end
    if (!lemonSqueezyApiKey) {
      console.error("LEMON_SQUEEZY_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Payment service not configured. Please contact support." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subscriptionId = profile.lemon_squeezy_subscription_id;
    console.log(`🔄 Cancelling subscription ${subscriptionId} for user ${user.id}`);

    const lsResponse = await fetch(
      `https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`,
      {
        method: "PATCH",
        headers: {
          "Accept": "application/vnd.api+json",
          "Content-Type": "application/vnd.api+json",
          "Authorization": `Bearer ${lemonSqueezyApiKey}`,
        },
        body: JSON.stringify({
          data: {
            type: "subscriptions",
            id: subscriptionId,
            attributes: {
              cancelled: true, // Cancel at period end, not immediately
            },
          },
        }),
      }
    );

    if (!lsResponse.ok) {
      const lsError = await lsResponse.text();
      console.error("Lemon Squeezy API error:", lsError);
      return new Response(
        JSON.stringify({ error: "Failed to cancel subscription. Please try again or contact support." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lsData = await lsResponse.json();
    const endsAt = lsData.data?.attributes?.ends_at;

    console.log(`✅ Subscription cancelled. Ends at: ${endsAt}`);

    // 4. Update profile status
    await supabase
      .from("profiles")
      .update({
        subscription_status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Subscription cancelled successfully",
        endsAt: endsAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Cancel subscription error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
