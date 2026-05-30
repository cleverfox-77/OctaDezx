// OctaDezx — Secure server-side order creation
// ----------------------------------------------------------------------------
// The customer chat used to insert orders directly from the browser, trusting
// the price/total emitted by the AI inside an ||ORDER_CONFIRMED:{...}|| marker.
// That let a customer prompt-inject a cheaper price (or skip the bot entirely
// and POST any total via the public anon key).
//
// This function is the ONLY thing allowed to write to `orders` (service role).
// It ignores any price the client/AI sends and recomputes every line total from
// the authoritative product catalogue for the given business.
// ----------------------------------------------------------------------------

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface IncomingItem {
  name?: string;
  quantity?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { businessId, sessionId, items, customerName, customerEmail } = await req.json();

    // ── Validate input shape ────────────────────────────────────────────────
    if (!businessId || !sessionId || !Array.isArray(items) || items.length === 0) {
      return json({ error: "Missing businessId, sessionId or items" }, 400);
    }
    if (!UUID_RE.test(businessId) || !UUID_RE.test(sessionId)) {
      return json({ error: "Invalid id format" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Server configuration error" }, 500);
    }
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // ── The session must exist AND belong to this business ───────────────────
    // (The session UUID is the customer's unguessable capability for this chat.)
    const { data: session, error: sessErr } = await supabase
      .from("chat_sessions")
      .select("id, business_id, user_id, customer_name, customer_email, status")
      .eq("id", sessionId)
      .single();

    if (sessErr || !session || session.business_id !== businessId) {
      return json({ error: "Invalid session for this business" }, 403);
    }

    // ── Defense in depth: if the caller presents a JWT, it must own the session
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ") && session.user_id) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data: { user } } = await callerClient.auth.getUser();
      // Only reject when we positively identify a *different* user.
      if (user && user.id !== session.user_id) {
        return json({ error: "Session does not belong to caller" }, 403);
      }
    }

    // ── Load the authoritative catalogue for this business ───────────────────
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id, name, price, metadata")
      .eq("business_id", businessId);

    if (prodErr || !products || products.length === 0) {
      return json({ error: "No catalogue found for this business" }, 400);
    }

    const norm = (s: string) => s.trim().toLowerCase();
    const byExact = new Map<string, typeof products[number]>();
    for (const p of products) byExact.set(norm(p.name), p);

    // ── Resolve each requested item to a catalogue product + REAL price ──────
    const resolved: { name: string; price: number; quantity: number }[] = [];
    const unmatched: string[] = [];

    for (const raw of items as IncomingItem[]) {
      const reqName = typeof raw?.name === "string" ? raw.name : "";
      if (!reqName) continue;

      // Quantity: positive integer, capped to a sane maximum.
      let qty = Math.floor(Number(raw?.quantity));
      if (!Number.isFinite(qty) || qty < 1) qty = 1;
      if (qty > 999) qty = 999;

      // Match by exact (normalised) name, then fall back to a contains match.
      let product = byExact.get(norm(reqName));
      if (!product) {
        product = products.find(
          (p) => norm(p.name).includes(norm(reqName)) || norm(reqName).includes(norm(p.name)),
        );
      }

      if (!product || product.price == null) {
        unmatched.push(reqName);
        continue;
      }

      resolved.push({ name: product.name, price: Number(product.price), quantity: qty });
    }

    if (resolved.length === 0) {
      return json({ error: "None of the requested items matched the catalogue", unmatched }, 422);
    }

    // ── Server is the single source of truth for the total ───────────────────
    const total = Number(
      resolved.reduce((sum, it) => sum + it.price * it.quantity, 0).toFixed(2),
    );

    const safeName = (typeof customerName === "string" && customerName.trim()) || session.customer_name || "Anonymous";
    const safeEmail = (typeof customerEmail === "string" && customerEmail.trim()) || session.customer_email || null;

    const { data: order, error: insErr } = await supabase
      .from("orders")
      .insert({
        business_id: businessId,
        session_id: sessionId,
        customer_name: safeName,
        customer_email: safeEmail,
        items: resolved,
        total_amount: total,
        status: "pending",
      })
      .select()
      .single();

    if (insErr || !order) {
      console.error("Order insert failed:", insErr);
      return json({ error: "Could not create order" }, 500);
    }

    return json({ order, unmatched });
  } catch (err) {
    console.error("create-order error:", err);
    return json({ error: "Unexpected error creating order" }, 500);
  }
});
