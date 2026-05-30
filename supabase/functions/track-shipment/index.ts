// OctaDezx — Track Shipment Edge Function
// Resolves live tracking for a parcel. Strategy:
//   1. If AfterShip is connected → use it (universal, supports 1000+ couriers).
//   2. Else use platform-specific API (EasyPost, Shippo, Pathao, SteadFast).
//   3. Else return last-known DB status.
// Caches for 60 seconds to avoid hammering courier APIs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface TrackInput {
  trackingNumber?: string;
  shipmentId?: string;
  businessId: string;
}

const CACHE_TTL_SECONDS = 60;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as TrackInput;
    if (!body.businessId || (!body.trackingNumber && !body.shipmentId)) {
      return json({ error: "businessId + trackingNumber|shipmentId required" }, 400);
    }
    const sb = adminClient();

    // Load shipment
    const q = sb.from("shipments").select("*").eq("business_id", body.businessId);
    if (body.shipmentId) q.eq("id", body.shipmentId);
    else q.eq("tracking_number", body.trackingNumber!);
    const { data: shipment } = await q.maybeSingle();
    if (!shipment) return json({ error: "Shipment not found" }, 404);

    // Cache check
    if (shipment.last_synced_at) {
      const ageSec = (Date.now() - new Date(shipment.last_synced_at).getTime()) / 1000;
      if (ageSec < CACHE_TTL_SECONDS) {
        return json({ shipment, cached: true });
      }
    }

    if (!shipment.tracking_number) {
      return json({ shipment, cached: false, note: "No tracking number yet" });
    }

    // Try AfterShip first (universal tracker)
    const { data: aftershipInt } = await sb
      .from("platform_integrations")
      .select("credentials,status")
      .eq("business_id", body.businessId)
      .eq("platform", "aftership")
      .eq("status", "connected")
      .maybeSingle();

    let liveStatus: LiveStatus | null = null;
    try {
      if (aftershipInt) {
        liveStatus = await aftershipTrack(
          (aftershipInt.credentials as any).api_key,
          shipment.tracking_number,
          shipment.courier_platform,
        );
      } else {
        // Fall back to platform-specific tracking
        const { data: integ } = await sb
          .from("platform_integrations")
          .select("credentials")
          .eq("business_id", body.businessId)
          .eq("platform", shipment.courier_platform)
          .eq("status", "connected")
          .maybeSingle();
        const creds = (integ?.credentials as any) ?? {};

        switch (shipment.courier_platform) {
          case "easypost":  liveStatus = await easypostTrack(creds, shipment.tracking_number); break;
          case "shippo":    liveStatus = await shippoTrack(creds, shipment.tracking_number);    break;
          case "steadfast": liveStatus = await steadfastTrack(creds, shipment.tracking_number); break;
          case "pathao":    liveStatus = await pathaoTrack(creds, shipment.tracking_number);    break;
        }
      }
    } catch (e) {
      console.error("Tracking provider failed:", e);
    }

    if (liveStatus) {
      const { data: updated } = await sb
        .from("shipments")
        .update({
          status: liveStatus.status,
          status_detail: liveStatus.detail,
          last_synced_at: new Date().toISOString(),
          raw_response: liveStatus.raw,
        })
        .eq("id", shipment.id)
        .select()
        .single();
      return json({ shipment: updated, cached: false, source: liveStatus.source });
    }

    return json({ shipment, cached: false, note: "Live tracking unavailable, returning last known status" });
  } catch (err: any) {
    console.error(err);
    return json({ error: err.message ?? "Internal error" }, 500);
  }
});

interface LiveStatus {
  status: string;
  detail: string | null;
  source: string;
  raw: Record<string, unknown>;
}

const STATUS_MAP: Record<string, string> = {
  // EasyPost / Shippo / generic
  "pre_transit": "created",
  "in_transit": "in_transit",
  "out_for_delivery": "out_for_delivery",
  "delivered": "delivered",
  "failure": "failed",
  "return_to_sender": "returned",
  "cancelled": "cancelled",
  "unknown": "in_transit",
  // AfterShip tags
  "InfoReceived": "created",
  "InTransit": "in_transit",
  "OutForDelivery": "out_for_delivery",
  "AttemptFail": "failed",
  "Delivered": "delivered",
  "Exception": "failed",
  "Expired": "failed",
};

function mapStatus(raw: string | undefined): string {
  if (!raw) return "in_transit";
  return STATUS_MAP[raw] ?? STATUS_MAP[raw.toLowerCase()] ?? raw.toLowerCase();
}

// ───────────── AfterShip ─────────────
async function aftershipTrack(apiKey: string, tracking: string, slug?: string): Promise<LiveStatus> {
  if (!apiKey) throw new Error("AfterShip api_key missing");
  // Try to ensure the tracking is registered
  await fetch("https://api.aftership.com/v4/trackings", {
    method: "POST",
    headers: { "aftership-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ tracking: { tracking_number: tracking, slug: slug ?? undefined } }),
  }).catch(() => {});

  const res = await fetch(
    `https://api.aftership.com/v4/trackings/${slug ? slug + "/" : ""}${tracking}`,
    { headers: { "aftership-api-key": apiKey } },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.meta?.message ?? "AfterShip error");
  const tag = data?.data?.tracking?.tag ?? "InfoReceived";
  const detail = data?.data?.tracking?.checkpoints?.slice(-1)?.[0]?.message ?? null;
  return { status: mapStatus(tag), detail, source: "aftership", raw: data };
}

// ───────────── EasyPost ─────────────
async function easypostTrack(creds: any, tracking: string): Promise<LiveStatus> {
  const apiKey = creds.api_key;
  if (!apiKey) throw new Error("EasyPost api_key missing");
  const auth = "Basic " + btoa(`${apiKey}:`);
  const res = await fetch(`https://api.easypost.com/v2/trackers?tracking_code=${encodeURIComponent(tracking)}`, {
    headers: { Authorization: auth },
  });
  const data = await res.json();
  const t = data?.trackers?.[0];
  return {
    status: mapStatus(t?.status),
    detail: t?.status_detail ?? null,
    source: "easypost",
    raw: data,
  };
}

// ───────────── Shippo ─────────────
async function shippoTrack(creds: any, tracking: string): Promise<LiveStatus> {
  const apiKey = creds.api_token ?? creds.api_key;
  if (!apiKey) throw new Error("Shippo api_token missing");
  // Carrier required for Shippo tracking; default to USPS if unknown
  const carrier = creds.carrier ?? "usps";
  const res = await fetch(`https://api.goshippo.com/tracks/${carrier}/${tracking}`, {
    headers: { Authorization: `ShippoToken ${apiKey}` },
  });
  const data = await res.json();
  return {
    status: mapStatus(data?.tracking_status?.status),
    detail: data?.tracking_status?.status_details ?? null,
    source: "shippo",
    raw: data,
  };
}

// ───────────── SteadFast (Bangladesh) ─────────────
async function steadfastTrack(creds: any, tracking: string): Promise<LiveStatus> {
  const { api_key, secret_key } = creds;
  const res = await fetch(`https://portal.packzy.com/api/v1/status_by_trackingcode/${tracking}`, {
    headers: { "Api-Key": api_key, "Secret-Key": secret_key },
  });
  const data = await res.json();
  // SteadFast statuses: pending, delivered_approval_pending, partial_delivered_approval_pending,
  // cancelled_approval_pending, unknown_approval_pending, delivered, partial_delivered,
  // cancelled, hold, in_review, unknown
  const raw = data?.delivery_status ?? "unknown";
  const map: Record<string, string> = {
    pending: "created", in_review: "created", hold: "in_transit",
    delivered: "delivered", partial_delivered: "delivered",
    cancelled: "cancelled", cancelled_approval_pending: "cancelled",
    delivered_approval_pending: "out_for_delivery",
    partial_delivered_approval_pending: "out_for_delivery",
    unknown: "in_transit", unknown_approval_pending: "in_transit",
  };
  return {
    status: map[raw] ?? "in_transit",
    detail: `SteadFast: ${raw}`,
    source: "steadfast",
    raw: data,
  };
}

// ───────────── Pathao (Bangladesh) ─────────────
async function pathaoTrack(creds: any, consignmentId: string): Promise<LiveStatus> {
  const { client_id, client_secret, username, password, base_url } = creds;
  const base = base_url ?? "https://api-hermes.pathao.com";
  const tokenRes = await fetch(`${base}/aladdin/api/v1/issue-token`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id, client_secret, username, password, grant_type: "password" }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(tokenData?.message ?? "Pathao auth failed");

  const res = await fetch(`${base}/aladdin/api/v1/orders/${consignmentId}/info`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const data = await res.json();
  const raw = (data?.data?.order_status ?? "unknown").toLowerCase().replaceAll(" ", "_");
  return {
    status: mapStatus(raw),
    detail: data?.data?.order_status_slug ?? null,
    source: "pathao",
    raw: data,
  };
}

// ─────────────
function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}
function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
