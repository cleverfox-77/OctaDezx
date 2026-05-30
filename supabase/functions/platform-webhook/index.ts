/**
 * OctaDezx — Universal Platform Webhook Handler
 *
 * Handles inbound events from:
 *   MESSAGING  : WhatsApp, Facebook Messenger, Instagram DM, Telegram, Viber,
 *                LINE, Twitter/X DM, WeChat, Discord (Interactions), Slack
 *   E-COMMERCE : Shopify orders/products, WooCommerce orders/products
 *   PAYMENTS   : Stripe, PayPal, Square
 *
 * URL: GET/POST /functions/v1/platform-webhook?platform=<p>&business_id=<id>
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY    = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ECOMMERCE_PLATFORMS = new Set(["shopify","woocommerce","amazon","etsy","ebay","bigcommerce","magento","lazada","shopee","tokopedia"]);
const PAYMENT_PLATFORMS   = new Set(["stripe","paypal","square"]);

// ─────────────────────────────────────────────────────────────────
//  Crypto helpers
// ─────────────────────────────────────────────────────────────────
function hexToBytes(hex: string): Uint8Array {
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) b[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return b;
}
function bytesToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
async function hmacSha256(secret: string, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name:"HMAC", hash:"SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data));
}
async function hmacSha1(secret: string, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name:"HMAC", hash:"SHA-1" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data));
}
async function sha1Hex(data: string): Promise<string> {
  return bytesToHex(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(data)));
}

// ─────────────────────────────────────────────────────────────────
//  Messaging send helpers
// ─────────────────────────────────────────────────────────────────
async function sendWhatsApp(to: string, text: string, phoneNumberId: string, token: string) {
  await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method:"POST", headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json" },
    body: JSON.stringify({ messaging_product:"whatsapp", to, type:"text", text:{ body:text } }),
  });
}
async function sendFacebook(psid: string, text: string, token: string) {
  await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${token}`, {
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ recipient:{ id:psid }, message:{ text } }),
  });
}
async function sendInstagram(igsid: string, text: string, token: string) {
  await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${token}`, {
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ recipient:{ id:igsid }, message:{ text } }),
  });
}
async function sendTelegram(chatId: string, text: string, botToken: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ chat_id:chatId, text }),
  });
}
async function sendViber(senderId: string, text: string, authToken: string) {
  await fetch("https://chatapi.viber.com/pa/send_message", {
    method:"POST", headers:{ "X-Viber-Auth-Token":authToken, "Content-Type":"application/json" },
    body: JSON.stringify({ receiver:senderId, type:"text", text }),
  });
}
async function sendLine(replyToken: string, text: string, channelToken: string) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method:"POST", headers:{ Authorization:`Bearer ${channelToken}`, "Content-Type":"application/json" },
    body: JSON.stringify({ replyToken, messages:[{ type:"text", text }] }),
  });
}
async function sendSlack(channelId: string, text: string, botToken: string) {
  await fetch("https://slack.com/api/chat.postMessage", {
    method:"POST", headers:{ Authorization:`Bearer ${botToken}`, "Content-Type":"application/json" },
    body: JSON.stringify({ channel:channelId, text }),
  });
}

/** Build OAuth 1.0a Authorization header for Twitter API */
async function buildOAuth1(
  method: string, url: string,
  apiKey: string, apiSecret: string,
  accessToken: string, accessTokenSecret: string,
): Promise<string> {
  const nonce = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const ts    = Math.floor(Date.now() / 1000).toString();
  const base: Record<string,string> = {
    oauth_consumer_key: apiKey, oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1", oauth_timestamp: ts,
    oauth_token: accessToken, oauth_version: "1.0",
  };
  const paramStr = Object.keys(base).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(base[k])}`).join("&");
  const sigBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramStr)}`;
  const sigKey  = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessTokenSecret)}`;
  const sig     = toBase64(await hmacSha1(sigKey, sigBase));
  return "OAuth " + Object.entries({ ...base, oauth_signature:sig })
    .map(([k,v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`).join(", ");
}
async function sendTwitterDM(recipientId: string, text: string, creds: Record<string,string>) {
  const url  = `https://api.twitter.com/2/dm_conversations/with/${recipientId}/messages`;
  const auth = await buildOAuth1("POST", url, creds.api_key, creds.api_secret, creds.access_token, creds.access_token_secret);
  await fetch(url, {
    method:"POST", headers:{ Authorization:auth, "Content-Type":"application/json" },
    body: JSON.stringify({ text }),
  });
}

/** Parse WeChat XML payload */
function parseWeChatXML(xml: string): Record<string,string> {
  const r: Record<string,string> = {};
  for (const m of xml.matchAll(/<(\w+)><!\[CDATA\[([^\]]*)\]\]><\/\1>/g)) r[m[1]] = m[2];
  for (const m of xml.matchAll(/<(\w+)>([^<]+)<\/\1>/g)) if (!r[m[1]]) r[m[1]] = m[2];
  return r;
}
function buildWeChatReply(toUser: string, fromUser: string, text: string): string {
  return `<xml><ToUserName><![CDATA[${toUser}]]></ToUserName><FromUserName><![CDATA[${fromUser}]]></FromUserName><CreateTime>${Math.floor(Date.now()/1000)}</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[${text}]]></Content></xml>`;
}

// ─────────────────────────────────────────────────────────────────
//  AI reply
// ─────────────────────────────────────────────────────────────────
async function getAIReply(businessId: string, sessionId: string, message: string): Promise<string> {
  try {
    const res  = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat-response`, {
      method:"POST",
      headers:{ Authorization:`Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type":"application/json", apikey:SUPABASE_ANON_KEY },
      body: JSON.stringify({ session_id:sessionId, business_id:businessId, message }),
    });
    const d = await res.json();
    return d.response ?? "I'm here to help! Please try again.";
  } catch { return "Something went wrong. Please try again shortly."; }
}

// ─────────────────────────────────────────────────────────────────
//  Shared: find-or-create session + save messages + get AI reply
// ─────────────────────────────────────────────────────────────────
async function handleMessage(
  sb: ReturnType<typeof createClient>,
  businessId: string, userId: string, platform: string, text: string,
): Promise<string> {
  let { data: sess } = await sb.from("chat_sessions" as any).select("id")
    .eq("business_id", businessId).eq("user_id" as any, userId).eq("status","active").maybeSingle();

  if (!sess) {
    const { data: ns } = await sb.from("chat_sessions" as any)
      .insert({ business_id:businessId, user_id:userId, source:platform, status:"active" } as any)
      .select("id").single();
    sess = ns;
  }
  if (!sess) throw new Error("session error");

  await sb.from("chat_messages" as any).insert({ session_id:sess.id, content:text,   sender_type:"user" } as any);
  const reply = await getAIReply(businessId, sess.id, text);
  await sb.from("chat_messages" as any).insert({ session_id:sess.id, content:reply, sender_type:"ai"   } as any);
  return reply;
}

// ─────────────────────────────────────────────────────────────────
//  E-commerce webhook handler
// ─────────────────────────────────────────────────────────────────
function shopifyStatus(o: any): string {
  if (o.cancelled_at || ["voided","refunded"].includes(o.financial_status)) return "cancelled";
  if (["fulfilled"].includes(o.fulfillment_status))  return "delivered";
  if (o.fulfillment_status === "partial")             return "shipped";
  if (["paid","partially_paid"].includes(o.financial_status)) return "confirmed";
  return "pending";
}
function wooStatus(s: string): string {
  return ({ pending:"pending","on-hold":"pending",processing:"confirmed",completed:"delivered",
            shipped:"shipped",cancelled:"cancelled",refunded:"cancelled",failed:"cancelled" } as any)[s] ?? "pending";
}

async function ecommerceWebhook(
  req: Request, sb: ReturnType<typeof createClient>,
  integration: any, body: any, raw: string, platform: string, businessId: string,
): Promise<Response> {
  const creds = integration.credentials as Record<string,string>;

  // ── Shopify ──────────────────────────────────────────────────
  if (platform === "shopify") {
    const hmacHeader = req.headers.get("x-shopify-hmac-sha256") ?? "";
    if (creds.webhook_secret && hmacHeader) {
      const expected = toBase64(await hmacSha256(creds.webhook_secret, raw));
      if (expected !== hmacHeader) return new Response("Unauthorized", { status:401 });
    }
    const topic = req.headers.get("x-shopify-topic") ?? "";

    if (topic.startsWith("orders/")) {
      const o = body;
      const name = [`${o.shipping_address?.first_name ?? ""}`, `${o.shipping_address?.last_name ?? ""}`]
        .join(" ").trim() || `${o.customer?.first_name ?? ""} ${o.customer?.last_name ?? ""}`.trim() || "Unknown";
      await sb.from("orders" as any).upsert({
        business_id:     businessId,
        external_id:     `shopify_${o.id}`,
        source_platform: "shopify",
        customer_name:   name || "Unknown",
        customer_email:  o.email ?? "",
        customer_phone:  o.phone ?? o.shipping_address?.phone ?? "",
        items: (o.line_items ?? []).map((li: any) => ({ name:li.title, quantity:li.quantity, price:parseFloat(li.price ?? "0") })),
        total_amount:    parseFloat(o.total_price ?? "0"),
        status:          shopifyStatus(o),
        notes:           o.note ?? "",
        shipping_address: o.shipping_address
          ? `${o.shipping_address.address1 ?? ""} ${o.shipping_address.city ?? ""} ${o.shipping_address.country ?? ""}`.trim() : "",
      }, { onConflict:"business_id,external_id" });
    }

    if (topic.startsWith("products/")) {
      const p = body; const fv = p.variants?.[0] ?? {};
      await sb.from("products" as any).upsert({
        business_id:     businessId,
        external_id:     `shopify_${p.id}`,
        source_platform: "shopify",
        name:            p.title,
        description:     (p.body_html ?? "").replace(/<[^>]*>/g, "").slice(0, 2000),
        category:        p.product_type || p.vendor || "General",
        price:           parseFloat(fv.price ?? "0"),
        stock_quantity:  (p.variants ?? []).reduce((s: number, v: any) => s + (v.inventory_quantity ?? 0), 0),
        is_active:       p.status === "active",
        metadata:        { vendor:p.vendor, handle:p.handle },
      }, { onConflict:"business_id,external_id" });
    }
    return new Response("OK", { status:200 });
  }

  // ── WooCommerce ──────────────────────────────────────────────
  if (platform === "woocommerce") {
    const sig = req.headers.get("x-wc-webhook-signature") ?? "";
    if (creds.webhook_secret && sig) {
      const expected = toBase64(await hmacSha256(creds.webhook_secret, raw));
      if (expected !== sig) return new Response("Unauthorized", { status:401 });
    }
    const topic = req.headers.get("x-wc-webhook-topic") ?? "";

    if (topic.startsWith("order.")) {
      const o = body;
      await sb.from("orders" as any).upsert({
        business_id:     businessId,
        external_id:     `woocommerce_${o.id}`,
        source_platform: "woocommerce",
        customer_name:   `${o.billing?.first_name ?? ""} ${o.billing?.last_name ?? ""}`.trim() || "Unknown",
        customer_email:  o.billing?.email ?? "",
        customer_phone:  o.billing?.phone ?? "",
        items: (o.line_items ?? []).map((li: any) => ({ name:li.name, quantity:li.quantity, price:parseFloat(li.price ?? "0") })),
        total_amount:    parseFloat(o.total ?? "0"),
        status:          wooStatus(o.status),
        notes:           o.customer_note ?? "",
        shipping_address: o.shipping ? `${o.shipping.address_1 ?? ""} ${o.shipping.city ?? ""} ${o.shipping.country ?? ""}`.trim() : "",
      }, { onConflict:"business_id,external_id" });
    }
    if (topic.startsWith("product.")) {
      const p = body;
      await sb.from("products" as any).upsert({
        business_id:     businessId,
        external_id:     `woocommerce_${p.id}`,
        source_platform: "woocommerce",
        name:            p.name,
        description:     (p.description ?? "").replace(/<[^>]*>/g, "").slice(0, 2000),
        category:        p.categories?.[0]?.name ?? "General",
        price:           parseFloat(p.price ?? "0"),
        stock_quantity:  p.stock_quantity ?? 0,
        is_active:       p.status === "publish",
        metadata:        { sku:p.sku, slug:p.slug },
      }, { onConflict:"business_id,external_id" });
    }
    return new Response("OK", { status:200 });
  }

  return new Response("OK", { status:200 });
}

// ─────────────────────────────────────────────────────────────────
//  Payment webhook handler
// ─────────────────────────────────────────────────────────────────
async function paymentWebhook(
  req: Request, sb: ReturnType<typeof createClient>,
  integration: any, body: any, raw: string, platform: string, businessId: string,
): Promise<Response> {
  const creds = integration.credentials as Record<string,string>;

  if (platform === "stripe") {
    const sig = req.headers.get("stripe-signature") ?? "";
    if (creds.webhook_secret && sig) {
      const parts = sig.split(",").reduce((acc: Record<string,string[]>, p) => {
        const [k,v] = p.split("=",2); (acc[k] ??= []).push(v); return acc;
      }, {});
      const ts = parts["t"]?.[0] ?? "";
      const v1s = parts["v1"] ?? [];
      const expected = bytesToHex(await hmacSha256(creds.webhook_secret, `${ts}.${raw}`));
      if (!v1s.includes(expected)) return new Response("Unauthorized", { status:401 });
    }
    const ev = body; const obj = ev.data?.object ?? {};
    if (["payment_intent.succeeded","charge.succeeded"].includes(ev.type)) {
      const amount = (obj.amount ?? obj.amount_captured ?? 0) / 100;
      await sb.from("orders" as any).upsert({
        business_id:     businessId,
        external_id:     `stripe_${obj.id}`,
        source_platform: "stripe",
        customer_name:   obj.billing_details?.name ?? obj.description ?? "Stripe Customer",
        customer_email:  obj.billing_details?.email ?? obj.receipt_email ?? "",
        items:           [{ name:"Payment", quantity:1, price:amount }],
        total_amount:    amount, status:"confirmed",
        notes:           `Stripe ${ev.type} — ${obj.id}`,
      }, { onConflict:"business_id,external_id" });
    }
    if (["charge.refunded","payment_intent.canceled"].includes(ev.type)) {
      await sb.from("orders" as any).update({ status:"cancelled" })
        .eq("external_id", `stripe_${obj.id}`).eq("business_id", businessId);
    }
    await sb.from("platform_integrations" as any)
      .update({ last_message_at:new Date().toISOString() }).eq("id", integration.id);
    return new Response(JSON.stringify({ received:true }), { status:200, headers:{ "Content-Type":"application/json" } });
  }

  if (platform === "paypal") {
    const res = body.resource ?? {};
    if (["PAYMENT.CAPTURE.COMPLETED","CHECKOUT.ORDER.APPROVED"].includes(body.event_type ?? "")) {
      const amount = parseFloat(res.amount?.value ?? res.purchase_units?.[0]?.amount?.value ?? "0");
      await sb.from("orders" as any).upsert({
        business_id:     businessId,
        external_id:     `paypal_${res.id}`,
        source_platform: "paypal",
        customer_name:   res.payer?.name ? `${res.payer.name.given_name ?? ""} ${res.payer.name.surname ?? ""}`.trim() : "PayPal Customer",
        customer_email:  res.payer?.email_address ?? "",
        items:           [{ name:"PayPal Payment", quantity:1, price:amount }],
        total_amount:    amount, status:"confirmed",
        notes:           `PayPal ${body.event_type} — ${res.id}`,
      }, { onConflict:"business_id,external_id" });
    }
    return new Response("OK", { status:200 });
  }

  if (platform === "square") {
    const wSig = req.headers.get("x-square-hmacsha256-signature") ?? "";
    if (creds.webhook_secret && wSig) {
      const expected = toBase64(await hmacSha256(creds.webhook_secret, req.url + raw));
      if (expected !== wSig) return new Response("Unauthorized", { status:401 });
    }
    const payment = body.data?.object?.payment ?? {};
    if ((body.type ?? "").includes("payment") && payment.status === "COMPLETED") {
      const amount = (payment.amount_money?.amount ?? 0) / 100;
      await sb.from("orders" as any).upsert({
        business_id:     businessId,
        external_id:     `square_${payment.id}`,
        source_platform: "square",
        customer_name:   payment.buyer_email_address ?? "Square Customer",
        customer_email:  payment.buyer_email_address ?? "",
        items:           [{ name:"Square Payment", quantity:1, price:amount }],
        total_amount:    amount, status:"confirmed",
        notes:           `Square ${body.type} — ${payment.id}`,
      }, { onConflict:"business_id,external_id" });
    }
    return new Response("OK", { status:200 });
  }

  return new Response("OK", { status:200 });
}

// ─────────────────────────────────────────────────────────────────
//  MAIN HANDLER
// ─────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url        = new URL(req.url);
  const platform   = url.searchParams.get("platform") ?? "";
  const businessId = url.searchParams.get("business_id") ?? "";
  if (!platform || !businessId)
    return new Response(JSON.stringify({ error:"Missing platform or business_id" }), { status:400 });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ── GET: verification challenges ────────────────────────────
  if (req.method === "GET") {

    // Meta platforms
    if (["whatsapp","facebook","instagram"].includes(platform)) {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      if (mode === "subscribe" && challenge) {
        const { data: intg } = await sb.from("platform_integrations" as any)
          .select("webhook_verify_token").eq("business_id", businessId).eq("platform", platform).single();
        if (intg?.webhook_verify_token === token) {
          await sb.from("platform_integrations" as any)
            .update({ webhook_verified:true, status:"connected" })
            .eq("business_id", businessId).eq("platform", platform);
          return new Response(challenge, { status:200 });
        }
        return new Response("Forbidden", { status:403 });
      }
      return new Response("OK", { status:200 });
    }

    // Twitter CRC
    if (platform === "twitter") {
      const crcToken = url.searchParams.get("crc_token");
      if (crcToken) {
        const { data: intg } = await sb.from("platform_integrations" as any)
          .select("credentials").eq("business_id", businessId).eq("platform", "twitter").single();
        const secret = (intg?.credentials as any)?.api_secret ?? "";
        const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name:"HMAC", hash:"SHA-256" }, false, ["sign"]);
        const sig = toBase64(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(crcToken)));
        return new Response(JSON.stringify({ response_token:`sha256=${sig}` }), { headers:{ "Content-Type":"application/json" } });
      }
      return new Response("OK", { status:200 });
    }

    // WeChat echo
    if (platform === "wechat") {
      const signature = url.searchParams.get("signature") ?? "";
      const timestamp = url.searchParams.get("timestamp") ?? "";
      const nonce     = url.searchParams.get("nonce") ?? "";
      const echostr   = url.searchParams.get("echostr") ?? "";
      const { data: intg } = await sb.from("platform_integrations" as any)
        .select("credentials,webhook_verify_token").eq("business_id", businessId).eq("platform", "wechat").single();
      const token = (intg?.credentials as any)?.token ?? intg?.webhook_verify_token ?? "";
      const hash  = await sha1Hex([token, timestamp, nonce].sort().join(""));
      if (hash === signature) {
        await sb.from("platform_integrations" as any)
          .update({ webhook_verified:true, status:"connected" })
          .eq("business_id", businessId).eq("platform", "wechat");
        return new Response(echostr, { status:200 });
      }
      return new Response("Forbidden", { status:403 });
    }

    return new Response("OK", { status:200 });
  }

  // ── POST ─────────────────────────────────────────────────────
  if (req.method !== "POST") return new Response("Method not allowed", { status:405 });

  const raw = await req.text();
  let body: any;
  try { body = JSON.parse(raw); } catch { body = {}; }

  // Load integration
  const { data: integration, error: intErr } = await sb.from("platform_integrations" as any)
    .select("*").eq("business_id", businessId).eq("platform", platform).single();
  if (intErr || !integration) return new Response("Integration not found", { status:404 });

  // Route
  if (ECOMMERCE_PLATFORMS.has(platform)) return ecommerceWebhook(req, sb, integration, body, raw, platform, businessId);
  if (PAYMENT_PLATFORMS.has(platform))   return paymentWebhook(req, sb, integration, body, raw, platform, businessId);

  // ── Messaging ────────────────────────────────────────────────
  const creds = (integration as any).credentials as Record<string,string>;
  let senderId = "", messageText = "", lineReplyToken = "";

  try {
    if (platform === "whatsapp") {
      const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!msg) return new Response("OK", { status:200 });
      senderId = msg.from; messageText = msg.text?.body ?? msg.interactive?.button_reply?.title ?? "";
    }
    else if (platform === "facebook") {
      const ev = body?.entry?.[0]?.messaging?.[0];
      if (!ev?.message) return new Response("OK", { status:200 });
      senderId = ev.sender.id; messageText = ev.message.text ?? "";
    }
    else if (platform === "instagram") {
      const ev = body?.entry?.[0]?.messaging?.[0];
      if (!ev?.message) return new Response("OK", { status:200 });
      senderId = ev.sender.id; messageText = ev.message.text ?? "";
    }
    else if (platform === "telegram") {
      const msg = body?.message ?? body?.edited_message;
      if (!msg) return new Response("OK", { status:200 });
      senderId = String(msg.chat.id); messageText = msg.text ?? "";
    }
    else if (platform === "viber") {
      if (!body?.message) return new Response("OK", { status:200 });
      senderId = body?.sender?.id ?? ""; messageText = body.message.text ?? "";
    }
    else if (platform === "line") {
      const ev = body?.events?.[0];
      if (!ev || ev.type !== "message" || ev.message?.type !== "text") return new Response("OK", { status:200 });
      senderId = ev.source?.userId ?? ""; messageText = ev.message.text ?? ""; lineReplyToken = ev.replyToken ?? "";
    }
    else if (platform === "twitter") {
      const dm = body?.direct_message_events?.[0];
      if (!dm) return new Response("OK", { status:200 });
      senderId = dm.message_create?.sender_id ?? ""; messageText = dm.message_create?.message_data?.text ?? "";
      if (creds.bot_user_id && senderId === creds.bot_user_id) return new Response("OK", { status:200 });
    }
    else if (platform === "wechat") {
      const parsed = parseWeChatXML(raw);
      if (parsed.MsgType !== "text") return new Response("success", { status:200 });
      senderId = parsed.FromUserName ?? ""; messageText = parsed.Content ?? "";
      const toUser = parsed.ToUserName ?? "";
      if (!messageText.trim() || !senderId) return new Response("success", { status:200 });
      const reply = await handleMessage(sb, businessId, `wechat:${senderId}`, "wechat", messageText);
      return new Response(buildWeChatReply(senderId, toUser, reply), { status:200, headers:{ "Content-Type":"application/xml" } });
    }
    else if (platform === "discord") {
      // Verify Ed25519
      const sigH = req.headers.get("x-signature-ed25519") ?? "";
      const tsH  = req.headers.get("x-signature-timestamp") ?? "";
      if (creds.public_key && sigH && tsH) {
        try {
          const k = await crypto.subtle.importKey("raw", hexToBytes(creds.public_key), { name:"Ed25519" } as any, false, ["verify"]);
          const ok = await crypto.subtle.verify("Ed25519", k, hexToBytes(sigH), new TextEncoder().encode(tsH + raw));
          if (!ok) return new Response("Unauthorized", { status:401 });
        } catch { return new Response("Unauthorized", { status:401 }); }
      }
      if (body?.type === 1) return new Response(JSON.stringify({ type:1 }), { headers:{ "Content-Type":"application/json" } });
      if (body?.type === 2 || body?.type === 3) {
        const userId  = body?.member?.user?.id ?? body?.user?.id ?? "";
        const cmdText = body?.data?.options?.[0]?.value ?? body?.data?.name ?? "";
        if (!cmdText || !userId) return new Response(JSON.stringify({ type:1 }), { headers:{ "Content-Type":"application/json" } });
        const reply = await handleMessage(sb, businessId, `discord:${userId}`, "discord", cmdText);
        return new Response(JSON.stringify({ type:4, data:{ content:reply.slice(0,2000) } }), { headers:{ "Content-Type":"application/json" } });
      }
      return new Response(JSON.stringify({ type:1 }), { headers:{ "Content-Type":"application/json" } });
    }
    else if (platform === "slack") {
      if (body?.type === "url_verification") {
        await sb.from("platform_integrations" as any)
          .update({ webhook_verified:true, status:"connected" })
          .eq("business_id", businessId).eq("platform", "slack");
        return new Response(JSON.stringify({ challenge:body.challenge }), { headers:{ "Content-Type":"application/json" } });
      }
      if (body?.type === "event_callback") {
        const ev = body.event;
        if (!ev || ev.type !== "message" || ev.bot_id) return new Response("OK", { status:200 });
        senderId = ev.user ?? ""; messageText = ev.text ?? "";
        if (!messageText.trim() || !senderId) return new Response("OK", { status:200 });
        const channelId = ev.channel ?? creds.channel_id ?? "";
        const reply = await handleMessage(sb, businessId, `slack:${senderId}`, "slack", messageText);
        await sendSlack(channelId, reply, creds.bot_token ?? "");
        await sb.from("platform_integrations" as any)
          .update({ message_count:((integration as any).message_count ?? 0) + 1, last_message_at:new Date().toISOString() })
          .eq("id", (integration as any).id);
        return new Response("OK", { status:200 });
      }
      return new Response("OK", { status:200 });
    }
  } catch(e) {
    console.error("Parse error:", e);
    return new Response("Parse error", { status:422 });
  }

  if (!messageText.trim() || !senderId) return new Response("OK", { status:200 });

  try {
    const reply = await handleMessage(sb, businessId, `${platform}:${senderId}`, platform, messageText);

    await sb.from("platform_integrations" as any)
      .update({ message_count:((integration as any).message_count ?? 0) + 1, last_message_at:new Date().toISOString() })
      .eq("id", (integration as any).id);

    if (platform === "whatsapp")  await sendWhatsApp(senderId, reply, creds.phone_number_id, creds.access_token);
    if (platform === "facebook")  await sendFacebook(senderId, reply, creds.page_access_token);
    if (platform === "instagram") await sendInstagram(senderId, reply, creds.page_access_token);
    if (platform === "telegram")  await sendTelegram(senderId, reply, creds.bot_token);
    if (platform === "viber")     await sendViber(senderId, reply, creds.auth_token);
    if (platform === "line")      await sendLine(lineReplyToken, reply, creds.channel_access_token);
    if (platform === "twitter")   await sendTwitterDM(senderId, reply, creds);
  } catch(e) { console.error("Send error:", e); }

  return new Response("OK", { status:200 });
});
