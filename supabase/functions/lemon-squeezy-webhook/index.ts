import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const crypto = globalThis.crypto;

// ============================================================================
// PLAN MAPPING
// Variant IDs come from Lemon Squeezy:
// Dashboard → Products → click product → variant ID in URL/settings
// Yearly variants map to the SAME plan key as their monthly counterpart.
// ============================================================================
// PRICES DID NOT MOVE IN THE AUGUST 2026 REPRICING, THE NAMES DID. Every
// variant below still charges exactly what it charged before; each one now
// resolves to the plan key one rung down the ladder, so a customer paying $99
// lands on 'pro' where they used to land on 'advanced'. Keep this file and
// src/lib/plans.ts in step: the variant ids are duplicated there for the
// checkout links, and a mismatch means somebody pays for one plan and receives
// another. Migration 20260806040000_plan_repricing.sql moved existing rows.
const PLAN_MAP: Record<string, string> = {
  // ── Monthly ──
  '1130312': 'starter',    // $29/mo
  '1926998': 'pro',        // $99/mo
  '1926975': 'advanced',   // $199/mo

  // ── Yearly (2 months free) ──
  '1927010': 'starter',    // $290/yr
  '1530207': 'pro',        // $990/yr
  '1926951': 'advanced',   // $1,990/yr

  // ── Withdrawn ──
  // The $9 tier. Archive these products in Lemon Squeezy so nobody can reach
  // the checkout; until that is done, anyone who does gets the grandfathered
  // key rather than a $29 plan for $9.
  '1926986': 'legacy_starter', // $9/mo
  '1179644': 'legacy_starter', // $90/yr

  // ── One-time ──
  '1530191': 'appsumo_ltd', // AppSumo LTD $230 one-time
};

function getPlanFromVariant(variantId: string | number): string {
  const plan = PLAN_MAP[variantId.toString()];
  if (!plan) {
    // Loud failure beats a silent wrong plan: log so it shows in function logs.
    // Falling back to the cheapest paid tier is the deliberate direction to be
    // wrong in. Someone who bought Advanced and receives Starter complains and
    // we fix it; the reverse loses money quietly and nobody ever reports it.
    console.error(`⚠️ Unknown Lemon Squeezy variant ${variantId} — defaulting to 'starter'. Add it to PLAN_MAP.`);
  }
  return plan || 'starter';
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
