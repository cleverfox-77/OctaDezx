import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const crypto = globalThis.crypto;

// ============================================================================
// PLAN MAPPING
// TODO: Replace these with actual numeric variant IDs from Lemon Squeezy
// Dashboard → Products → click product → variant ID in URL/settings
// ============================================================================
const PLAN_MAP: Record<string, string> = {
  '1179644': 'starter',    // Starter $9/mo
  '1130312': 'pro',        // Pro $29/mo
  '1530207': 'enterprise', // Enterprise $99/mo
  '1530191': 'appsumo_ltd', // AppSumo LTD $230 one-time
};

function getPlanFromVariant(variantId: string | number): string {
  return PLAN_MAP[variantId.toString()] || 'starter';
}

// ============================================================================
// HMAC-SHA256 SIGNATURE VERIFICATION
// ============================================================================
async function verifySignature(secret: string, signature: string, body: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const signatureBytes = new Uint8Array(
    signature.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );

  return crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    encoder.encode(body)
  );
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
serve(async (req) => {
  try {
    // 1. Verify signature
    const signature = req.headers.get("x-signature");
    const secret = Deno.env.get("LEMON_SQUEEZY_WEBHOOK_SECRET");

    if (!signature || !secret) {
      console.error("Missing signature or webhook secret");
      return new Response("Missing signature or secret", { status: 400 });
    }

    const body = await req.text();
    const isValid = await verifySignature(secret, signature, body);

    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response("Invalid signature", { status: 401 });
    }

    // 2. Parse payload
    const payload = JSON.parse(body);
    const eventName = payload.meta.event_name;
    const customData = payload.meta.custom_data;

    console.log(`🔔 Lemon Squeezy webhook: ${eventName}`);

    // 3. Initialize Supabase with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Route by event type
    if (eventName === "subscription_created") {
      // ── Recurring subscription started ──
      const userId = customData?.user_id;
      const customerId = payload.data.attributes.customer_id;
      const subscriptionId = payload.data.id;
      const variantId = payload.data.attributes.variant_id;
      const planType = getPlanFromVariant(variantId);

      console.log(`✅ Subscription created: user=${userId}, plan=${planType}, variant=${variantId}`);

      if (userId) {
        const { error } = await supabase
          .from("profiles")
          .update({
            subscription_status: "active",
            subscription_plan: planType,
            plan_type: planType,
            lemon_squeezy_customer_id: customerId.toString(),
            lemon_squeezy_subscription_id: subscriptionId.toString(),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        if (error) {
          console.error("Error updating profile:", error);
          return new Response("Error updating profile", { status: 500 });
        }
      } else {
        console.warn("⚠️ No user_id in custom_data for subscription_created");
      }

    } else if (eventName === "order_created") {
      // ── One-time purchase (AppSumo LTD) or first order ──
      const userId = customData?.user_id;
      const customerId = payload.data.attributes.customer_id;
      const variantId = payload.data.attributes.first_order_item?.variant_id
        || payload.data.attributes.variant_id;
      const planType = getPlanFromVariant(variantId);

      // Check if this is a one-time purchase (no subscription)
      const isOneTime = !payload.data.attributes.subscription_id;

      console.log(`🛒 Order created: user=${userId}, plan=${planType}, oneTime=${isOneTime}, variant=${variantId}`);

      if (userId) {
        const updateData: Record<string, any> = {
          subscription_status: "active",
          subscription_plan: planType,
          plan_type: planType,
          lemon_squeezy_customer_id: customerId.toString(),
          updated_at: new Date().toISOString(),
        };

        // For one-time purchases, store order ID instead of subscription ID
        if (isOneTime) {
          updateData.lemon_squeezy_subscription_id = `order_${payload.data.id}`;
        }

        const { error } = await supabase
          .from("profiles")
          .update(updateData)
          .eq("user_id", userId);

        if (error) {
          console.error("Error updating profile for order:", error);
          return new Response("Error updating profile", { status: 500 });
        }
      } else {
        console.warn("⚠️ No user_id in custom_data for order_created");
      }

    } else if (eventName === "subscription_updated") {
      // ── Plan change, payment status change, reactivation ──
      const subscriptionId = payload.data.id;
      const status = payload.data.attributes.status; // active, past_due, paused, cancelled, expired
      const variantId = payload.data.attributes.variant_id;
      const planType = getPlanFromVariant(variantId);

      console.log(`🔄 Subscription updated: sub=${subscriptionId}, status=${status}, plan=${planType}`);

      // Map Lemon Squeezy status to our status
      let ourStatus = "active";
      if (status === "past_due") {
        ourStatus = "past_due";
      } else if (status === "paused" || status === "cancelled") {
        ourStatus = "cancelled";
      } else if (status === "expired") {
        ourStatus = "expired";
      }

      const updateData: Record<string, any> = {
        subscription_status: ourStatus,
        updated_at: new Date().toISOString(),
      };

      // Only update plan if subscription is still active/past_due
      if (ourStatus === "active" || ourStatus === "past_due") {
        updateData.subscription_plan = planType;
        updateData.plan_type = planType;
      } else {
        // Downgrade to free on cancellation/expiration
        updateData.plan_type = "free";
        updateData.subscription_plan = "free";
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("lemon_squeezy_subscription_id", subscriptionId.toString());

      if (error) {
        console.error("Error updating profile for subscription_updated:", error);
      }

    } else if (eventName === "subscription_expired" || eventName === "subscription_cancelled") {
      // ── Subscription ended ──
      const subscriptionId = payload.data.id;
      console.log(`❌ Subscription ${eventName}: ${subscriptionId}`);

      const { error } = await supabase
        .from("profiles")
        .update({
          subscription_status: "expired",
          plan_type: "free",
          subscription_plan: "free",
          updated_at: new Date().toISOString(),
        })
        .eq("lemon_squeezy_subscription_id", subscriptionId.toString());

      if (error) {
        console.error("Error updating profile for expiration:", error);
      }
    } else {
      console.log(`ℹ️ Unhandled event: ${eventName}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    // Log full error server-side only; never expose internal details in the response body
    console.error("❌ Webhook error:", error);
    return new Response("Webhook processing failed", { status: 400 });
  }
});
