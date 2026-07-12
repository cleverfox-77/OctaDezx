// OctaDezx Public API v1
// ----------------------------------------------------------------------------
// Lets businesses use OctaDezx from their own website/backend with an API key
// minted in Dashboard → API Keys (create_api_key RPC). Keys look like
// `odx_...`; only their SHA-256 hash is stored, so auth = hash & lookup.
//
// Endpoints (base: /functions/v1/api-v1):
//   POST /message              { message, sessionId?, customerName?, customerEmail? }
//        → { sessionId, reply, escalated, order }
//   GET  /messages?sessionId=  → { sessionId, messages: [...] }
//
// Escalations and orders triggered through this API behave exactly like the
// hosted chat widget: they appear in the dashboard and email the owner.
// ----------------------------------------------------------------------------

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    // The functions gateway (verify_jwt) only accepts JWT-shaped tokens; both the
    // service key and SUPABASE_ANON_KEY env may be the new opaque sb_* format.
    // Internal function-to-function calls therefore use the legacy anon JWT
    // (public by design — it ships in the frontend bundle).
    const envAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const gatewayJwt = envAnon.startsWith("eyJ")
      ? envAnon
      : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuamh2Zm1sbXZoYWJybHBjbWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMDE1MjQsImV4cCI6MjA3MjY3NzUyNH0.np24-bIV9yTrJ6_HbBePDvGN01ctc7j86u4qqZUOyK4";
    if (!supabaseUrl || !serviceKey) return json({ error: "Server configuration error" }, 500);
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // ── API key auth ─────────────────────────────────────────────────────────
    const authHeader = req.headers.get("authorization") ?? "";
    const presented = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : (req.headers.get("x-api-key") ?? "").trim();

    if (!presented.startsWith("odx_")) {
      return json({ error: "Missing API key. Send it as `Authorization: Bearer odx_...` or `x-api-key`." }, 401);
    }

    const keyHash = await sha256Hex(presented);
    const { data: keyRow } = await supabase
      .from("api_keys")
      .select("id, business_id, revoked_at")
      .eq("key_hash", keyHash)
      .maybeSingle();

    if (!keyRow || keyRow.revoked_at) {
      return json({ error: "Invalid or revoked API key" }, 401);
    }

    // Per-key throttle (60 req/min) on top of the business's plan limits.
    const { data: allowed, error: rlErr } = await supabase.rpc("check_ip_rate_limit", {
      p_key: `api:${keyRow.id}`,
      p_max: 60,
      p_window_seconds: 60,
    });
    if (!rlErr && allowed === false) {
      return json({ error: "Rate limit exceeded (60 requests/minute per key)" }, 429);
    }

    // Fire-and-forget usage stamp.
    supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyRow.id)
      .then(() => {}, () => {});

    const businessId = keyRow.business_id as string;
    const url = new URL(req.url);
    const path = url.pathname.replace(/^.*\/api-v1/, "").replace(/\/+$/, "") || "/";

    // ── GET /messages ────────────────────────────────────────────────────────
    if (req.method === "GET" && path === "/messages") {
      const sessionId = url.searchParams.get("sessionId") ?? "";
      if (!UUID_RE.test(sessionId)) return json({ error: "Invalid sessionId" }, 400);

      const { data: session } = await supabase
        .from("chat_sessions")
        .select("id, business_id, status")
        .eq("id", sessionId)
        .maybeSingle();
      if (!session || session.business_id !== businessId) {
        return json({ error: "Session not found for this business" }, 404);
      }

      const { data: messages } = await supabase
        .from("chat_messages")
        .select("id, sender_type, content, image_url, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      return json({ sessionId, status: session.status, messages: messages ?? [] });
    }

    // ── POST /message (also accepts / and /chat) ─────────────────────────────
    if (req.method === "POST" && (path === "/" || path === "/message" || path === "/chat")) {
      const body = await req.json().catch(() => ({}));
      const message = typeof body?.message === "string" ? body.message.trim() : "";
      if (!message) return json({ error: "Missing `message` (string)" }, 400);
      if (message.length > 4000) return json({ error: "`message` too long (max 4000 chars)" }, 400);

      const customerName = typeof body?.customerName === "string" && body.customerName.trim()
        ? body.customerName.trim().slice(0, 120)
        : "API Customer";
      const customerEmail = typeof body?.customerEmail === "string" && body.customerEmail.trim()
        ? body.customerEmail.trim().slice(0, 200)
        : null;

      // Resolve or create the session.
      let session: { id: string; status: string } | null = null;
      if (body?.sessionId) {
        if (!UUID_RE.test(body.sessionId)) return json({ error: "Invalid sessionId" }, 400);
        const { data } = await supabase
          .from("chat_sessions")
          .select("id, business_id, status")
          .eq("id", body.sessionId)
          .maybeSingle();
        if (!data || data.business_id !== businessId) {
          return json({ error: "Session not found for this business" }, 404);
        }
        session = { id: data.id, status: data.status };
      } else {
        const { data, error } = await supabase
          .from("chat_sessions")
          .insert({
            business_id: businessId,
            customer_name: customerName,
            customer_email: customerEmail,
            status: "active",
            source: "api",
          })
          .select("id, status")
          .single();
        if (error || !data) {
          console.error("api-v1: session create failed", error);
          return json({ error: "Could not create chat session" }, 500);
        }
        session = { id: data.id, status: data.status };
      }

      // Store the customer's message regardless of session state so the human
      // agent sees it in the dashboard.
      await supabase.from("chat_messages").insert({
        session_id: session.id,
        sender_type: "customer",
        content: message,
      });

      // Escalated / human-handled sessions don't get an AI reply.
      if (session.status !== "active") {
        return json({
          sessionId: session.id,
          reply: null,
          escalated: true,
          info: "This conversation is being handled by a human. Poll GET /messages for replies.",
        });
      }

      // Build history (last 10 turns) for conversation memory.
      const { data: histRows } = await supabase
        .from("chat_messages")
        .select("sender_type, content")
        .eq("session_id", session.id)
        .order("created_at", { ascending: false })
        .limit(11);
      const history = (histRows ?? [])
        .slice(1) // exclude the message we just inserted
        .reverse()
        .map((m: { sender_type: string; content: string }) => ({
          role: m.sender_type === "customer" ? "user" : "assistant",
          content: m.content,
        }));

      // Delegate to the same AI brain as the hosted widget (escalation +
      // owner emails happen inside ai-chat-response).
      const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-chat-response`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gatewayJwt}`,
        },
        body: JSON.stringify({ message, businessId, sessionId: session.id, history }),
      });
      const aiData = await aiRes.json().catch(() => null);

      if (aiData?.rateLimited) {
        return json({ sessionId: session.id, reply: null, escalated: false, error: aiData.reason ?? "rate_limited" }, 429);
      }

      let reply: string | null = aiData?.response ?? null;
      let order: unknown = null;

      if (reply) {
        // Same order protocol as the widget: names/quantities only — prices are
        // recomputed server-side by create-order.
        const orderMatch = reply.match(/\|\|ORDER_CONFIRMED:(.*?)\|\|/s);
        if (orderMatch) {
          reply = reply.replace(orderMatch[0], "").trim();
          try {
            const raw = JSON.parse(orderMatch[1]);
            const items = Array.isArray(raw?.items)
              ? raw.items
                  .filter((it: { name?: unknown }) => it && typeof it.name === "string")
                  .map((it: { name: string; quantity?: unknown }) => ({
                    name: it.name,
                    quantity: Number(it.quantity) || 1,
                  }))
              : [];
            if (items.length > 0) {
              const orderRes = await fetch(`${supabaseUrl}/functions/v1/create-order`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${gatewayJwt}`,
                },
                body: JSON.stringify({
                  businessId,
                  sessionId: session.id,
                  items,
                  customerName,
                  customerEmail,
                }),
              });
              const orderData = await orderRes.json().catch(() => null);
              order = orderData?.order ?? null;
            }
          } catch (e) {
            console.error("api-v1: order parse failed", e);
          }
        }

        await supabase.from("chat_messages").insert({
          session_id: session.id,
          sender_type: "ai",
          content: reply,
        });
      }

      return json({
        sessionId: session.id,
        reply,
        escalated: Boolean(aiData?.escalated),
        order,
      });
    }

    return json({
      error: "Not found",
      endpoints: {
        "POST /message": "{ message, sessionId?, customerName?, customerEmail? }",
        "GET /messages?sessionId=<uuid>": "conversation history",
      },
    }, 404);
  } catch (err) {
    console.error("api-v1 error:", err);
    return json({ error: "Unexpected server error" }, 500);
  }
});
