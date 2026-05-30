// OctaDezx — Create Shipment Edge Function
// Creates a parcel via the business's connected courier and returns tracking info.
// Supports direct integration for: EasyPost, Shippo, AfterShip, Pathao, SteadFast.
// All other couriers are stored in DB with "manual" status — owner fulfils via courier panel.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface OrderItem { name: string; price: number; quantity: number; }
interface ShipmentInput {
  businessId: string;
  orderId: string;
  courierPlatform?: string; // optional override; otherwise uses first connected courier
}

const COURIER_PLATFORMS = new Set([
  "easypost","shippo","aftership","shiprocket",
  "pathao","steadfast","redx","paperfly","ecourier","sundarban",
  "delhivery","bluedart","dtdc","ekart","xpressbees",
  "tcs","leopards","mnp",
  "ninjavan","jtexpress","lalamove","lbc","kerry","poslaju",
  "sfexpress","cainiao","zto","yto","yamato","cjlogistics",
  "dhl","fedex","ups","usps","tnt",
  "gls","postnl","dpd","hermes","royalmail","colissimo",
  "bpost","deutschepost","correos","posteitaliane",
  "canadapost","correios","estafeta","ontrac","dhlecommerce",
  "auspost","startrack","aramex_au","nzpost",
  "aramex","naqel","smsa","dpd_africa","postnet",
  "cdek","russianpost",
]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as ShipmentInput;
    if (!body.businessId || !body.orderId) {
      return json({ error: "businessId and orderId required" }, 400);
    }

    const sb = adminClient();

    // Load order
    const { data: order, error: orderErr } = await sb
      .from("orders")
      .select("*")
      .eq("id", body.orderId)
      .single();
    if (orderErr || !order) return json({ error: "Order not found" }, 404);
    if (order.business_id !== body.businessId) return json({ error: "Order/business mismatch" }, 403);

    // Load business
    const { data: business } = await sb
      .from("businesses")
      .select("*")
      .eq("id", body.businessId)
      .single();
    if (!business) return json({ error: "Business not found" }, 404);

    // Pick courier: explicit > connected primary > first connected
    let courierPlatform = body.courierPlatform;
    let credentials: Record<string, unknown> | null = null;

    if (courierPlatform) {
      const { data: integ } = await sb
        .from("platform_integrations")
        .select("platform,credentials,status")
        .eq("business_id", body.businessId)
        .eq("platform", courierPlatform)
        .eq("status", "connected")
        .maybeSingle();
      if (integ) credentials = (integ.credentials as any) ?? {};
    } else {
      const { data: list } = await sb
        .from("platform_integrations")
        .select("platform,credentials,status")
        .eq("business_id", body.businessId)
        .eq("status", "connected")
        .in("platform", Array.from(COURIER_PLATFORMS));
      if (list && list.length > 0) {
        // Prefer aggregators (cover more carriers) first
        const preferred = list.find(r => ["easypost","shippo","shiprocket","aftership"].includes(r.platform))
                       ?? list[0];
        courierPlatform = preferred.platform;
        credentials = (preferred.credentials as any) ?? {};
      }
    }

    if (!courierPlatform) {
      return json({ error: "No courier connected. Connect a courier in Integrations." }, 400);
    }

    // Route to platform implementation
    const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
    let result: ShipmentResult;
    try {
      switch (courierPlatform) {
        case "easypost":  result = await easypost(credentials!, order, business); break;
        case "shippo":    result = await shippo(credentials!, order, business);    break;
        case "aftership": result = await aftership(credentials!, order, business); break;
        case "pathao":    result = await pathao(credentials!, order, business);    break;
        case "steadfast": result = await steadfast(credentials!, order, business); break;
        default:
          // Manual mode — record shipment, business owner fulfils in courier portal
          result = manual(courierPlatform);
      }
    } catch (e: any) {
      console.error("Courier API failure:", e);
      result = { tracking_number: null, label_url: null, status: "manual",
                 status_detail: `API failure: ${e.message ?? "unknown"}. Use courier panel manually.`,
                 raw_response: { error: String(e) }, cost: null, currency: null };
    }

    // Persist shipment
    const { data: shipment, error: shipErr } = await sb
      .from("shipments")
      .insert({
        business_id: body.businessId,
        order_id: body.orderId,
        courier_platform: courierPlatform,
        tracking_number: result.tracking_number,
        label_url: result.label_url,
        status: result.status,
        status_detail: result.status_detail,
        cost: result.cost,
        currency: result.currency,
        raw_response: result.raw_response,
        last_synced_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (shipErr) return json({ error: shipErr.message }, 500);

    // Update order status
    await sb.from("orders").update({ status: "processing" }).eq("id", body.orderId);

    return json({
      shipment,
      courier: courierPlatform,
      tracking_number: result.tracking_number,
      label_url: result.label_url,
      status: result.status,
    });
  } catch (err: any) {
    console.error(err);
    return json({ error: err.message ?? "Internal error" }, 500);
  }
});

// ───────────────────────────── helpers ─────────────────────────────

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}
function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface ShipmentResult {
  tracking_number: string | null;
  label_url: string | null;
  status: string;
  status_detail: string | null;
  cost: number | null;
  currency: string | null;
  raw_response: Record<string, unknown>;
}

function manual(platform: string): ShipmentResult {
  return {
    tracking_number: null,
    label_url: null,
    status: "manual",
    status_detail: `Create parcel manually in ${platform} panel, then add tracking number in dashboard.`,
    cost: null,
    currency: null,
    raw_response: { mode: "manual", platform },
  };
}

// ───────────────────────── EasyPost (US/EU/100+ couriers) ─────────────────────────
async function easypost(creds: any, order: any, business: any): Promise<ShipmentResult> {
  const apiKey = creds.api_key;
  if (!apiKey) throw new Error("EasyPost api_key missing");
  const auth = "Basic " + btoa(`${apiKey}:`);

  // Use stored business address as 'from', order shipping_address as 'to'
  const toAddr = parseAddress(order.shipping_address) ?? {
    name: order.customer_name, street1: "Address on file", city: "—", country: "US", zip: "00000",
  };
  const fromAddr = {
    name: business.name,
    street1: business.business_address ?? "1 Main St",
    city: "Origin", country: "US", zip: "00000",
    phone: business.business_phone ?? "",
    email: business.business_email ?? "",
  };

  const parcel = { length: 10, width: 8, height: 4, weight: 16 }; // sane defaults; ounces

  const res = await fetch("https://api.easypost.com/v2/shipments", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      shipment: {
        to_address: toAddr,
        from_address: fromAddr,
        parcel,
        reference: order.id,
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "EasyPost error");

  // Buy cheapest rate
  const cheapest = (data.rates ?? []).sort((a: any, b: any) => +a.rate - +b.rate)[0];
  if (!cheapest) throw new Error("No rates returned");

  const buy = await fetch(`https://api.easypost.com/v2/shipments/${data.id}/buy`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ rate: { id: cheapest.id } }),
  });
  const bought = await buy.json();
  if (!buy.ok) throw new Error(bought?.error?.message ?? "EasyPost buy failed");

  return {
    tracking_number: bought.tracking_code ?? null,
    label_url: bought.postage_label?.label_url ?? null,
    status: "created",
    status_detail: "Label purchased via EasyPost",
    cost: bought.selected_rate?.rate ? Number(bought.selected_rate.rate) : null,
    currency: bought.selected_rate?.currency ?? "USD",
    raw_response: bought,
  };
}

// ───────────────────────── Shippo (similar to EasyPost, US-focused) ─────────────────────────
async function shippo(creds: any, order: any, business: any): Promise<ShipmentResult> {
  const apiKey = creds.api_token ?? creds.api_key;
  if (!apiKey) throw new Error("Shippo api_token missing");

  const toAddr = parseAddress(order.shipping_address) ?? {
    name: order.customer_name, street1: "Address on file", city: "—", country: "US", zip: "00000",
  };
  const fromAddr = {
    name: business.name, street1: business.business_address ?? "1 Main St",
    city: "Origin", country: "US", zip: "00000",
  };

  const res = await fetch("https://api.goshippo.com/shipments/", {
    method: "POST",
    headers: { Authorization: `ShippoToken ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      address_from: fromAddr,
      address_to: toAddr,
      parcels: [{ length: "10", width: "8", height: "4", distance_unit: "in",
                  weight: "16", mass_unit: "oz" }],
      async: false,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail ?? "Shippo error");

  const cheapest = (data.rates ?? []).sort((a: any, b: any) => +a.amount - +b.amount)[0];
  if (!cheapest) throw new Error("No Shippo rates");

  const tx = await fetch("https://api.goshippo.com/transactions/", {
    method: "POST",
    headers: { Authorization: `ShippoToken ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ rate: cheapest.object_id, label_file_type: "PDF", async: false }),
  });
  const txData = await tx.json();
  if (!tx.ok) throw new Error("Shippo transaction failed");

  return {
    tracking_number: txData.tracking_number ?? null,
    label_url: txData.label_url ?? null,
    status: "created",
    status_detail: "Label purchased via Shippo",
    cost: txData.rate?.amount ? Number(txData.rate.amount) : null,
    currency: txData.rate?.currency ?? "USD",
    raw_response: txData,
  };
}

// ───────────────────────── AfterShip (universal tracker, not a label printer) ─────────────────────────
async function aftership(creds: any, order: any, _business: any): Promise<ShipmentResult> {
  // AfterShip doesn't create labels — it tracks any tracking number across 1000+ couriers.
  // If used as primary courier, we fall back to manual mode but enable tracking on whatever
  // number the owner supplies later.
  return {
    tracking_number: null, label_url: null, status: "manual",
    status_detail: "AfterShip is a tracker only — add tracking number after shipping. AfterShip will auto-update status.",
    cost: null, currency: null,
    raw_response: { provider: "aftership", note: "tracking-only" },
  };
}

// ───────────────────────── Pathao Courier (Bangladesh) ─────────────────────────
async function pathao(creds: any, order: any, business: any): Promise<ShipmentResult> {
  const { client_id, client_secret, username, password, base_url } = creds;
  if (!client_id || !client_secret) throw new Error("Pathao client_id/client_secret missing");

  const base = base_url ?? "https://api-hermes.pathao.com";

  // 1. Get token
  const tokenRes = await fetch(`${base}/aladdin/api/v1/issue-token`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id, client_secret, username, password, grant_type: "password" }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(tokenData?.message ?? "Pathao auth failed");
  const access = tokenData.access_token;

  // 2. Create order
  const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
  const itemNames = items.map(i => `${i.name} x${i.quantity}`).join(", ");

  const createRes = await fetch(`${base}/aladdin/api/v1/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      store_id: creds.store_id,
      merchant_order_id: order.id,
      recipient_name: order.customer_name ?? "Customer",
      recipient_phone: order.customer_phone ?? "01700000000",
      recipient_address: order.shipping_address ?? "Dhaka",
      recipient_city: 1, recipient_zone: 1, recipient_area: 1, // defaults; owner can override per integration
      delivery_type: 48, item_type: 2,
      special_instruction: itemNames.slice(0, 100),
      item_quantity: items.reduce((s, i) => s + (i.quantity ?? 1), 0) || 1,
      item_weight: 0.5,
      amount_to_collect: Number(order.total_amount ?? 0),
    }),
  });
  const created = await createRes.json();
  if (!createRes.ok) throw new Error(created?.message ?? "Pathao create order failed");

  return {
    tracking_number: created?.data?.consignment_id ?? null,
    label_url: null,
    status: "created",
    status_detail: "Pathao consignment created",
    cost: created?.data?.delivery_fee ? Number(created.data.delivery_fee) : null,
    currency: "BDT",
    raw_response: created,
  };
}

// ───────────────────────── SteadFast Courier (Bangladesh) ─────────────────────────
async function steadfast(creds: any, order: any, _business: any): Promise<ShipmentResult> {
  const { api_key, secret_key } = creds;
  if (!api_key || !secret_key) throw new Error("SteadFast api_key/secret_key missing");

  const res = await fetch("https://portal.packzy.com/api/v1/create_order", {
    method: "POST",
    headers: {
      "Api-Key": api_key,
      "Secret-Key": secret_key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      invoice: order.id.slice(0, 12),
      recipient_name: order.customer_name ?? "Customer",
      recipient_phone: order.customer_phone ?? "01700000000",
      recipient_address: order.shipping_address ?? "—",
      cod_amount: Number(order.total_amount ?? 0),
      note: (Array.isArray(order.items) ? order.items.map((i: any) => `${i.name}`).join(", ") : "").slice(0, 200),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message ?? "SteadFast error");

  return {
    tracking_number: data?.consignment?.tracking_code ?? null,
    label_url: null,
    status: "created",
    status_detail: "SteadFast consignment created",
    cost: null,
    currency: "BDT",
    raw_response: data,
  };
}

function parseAddress(addr: any): any | null {
  if (!addr) return null;
  if (typeof addr === "object") return addr;
  if (typeof addr === "string") return { name: "Customer", street1: addr, city: "—", country: "US", zip: "00000" };
  return null;
}
