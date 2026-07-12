// OctaDezx MCP Server (Model Context Protocol over Streamable HTTP)
// ----------------------------------------------------------------------------
// Lets a business connect OctaDezx to Claude (Claude Desktop / custom connector)
// and run their customer care in natural language: read escalated chats, reply
// to customers, look up + teach the AI, and review orders.
//
// Transport: stateless Streamable HTTP. The client POSTs JSON-RPC 2.0 messages;
// we answer with a single application/json response (no SSE needed for req/resp).
//
// Auth: the OctaDezx API key (odx_...) minted in Dashboard → API Keys / Connect
// to Claude. Same hash-and-lookup scheme as api-v1.
//
// Subscription gate (the product rule):
//   • initialize + tools/list work with ANY valid key  → "you can connect"
//   • tools/call requires an active plan/trial          → "but can't use it"
//     without a subscription, tool calls return a clear "subscription required".
// ----------------------------------------------------------------------------

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SERVER_NAME = "octadezx";
const SERVER_VERSION = "1.0.0";
const DEFAULT_PROTOCOL = "2025-06-18";
const DASHBOARD_BILLING = "https://octadezx.com/dashboard";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  // Let the MCP client read the WWW-Authenticate header so it can discover the
  // OAuth server (RFC 9728) and run the one-click connector flow.
  "Access-Control-Expose-Headers": "WWW-Authenticate, mcp-session-id",
};

// Points Claude at the OctaDezx OAuth server when a request is unauthenticated.
// (octadezx.com fronts both the protected-resource metadata and the auth server.)
const WWW_AUTHENTICATE =
  'Bearer resource_metadata="https://octadezx.com/.well-known/oauth-protected-resource"';

// HTTP 401 + WWW-Authenticate — the trigger that makes a custom connector start
// OAuth instead of failing. Body is still a JSON-RPC error so CLI clients log it.
function unauthorized(id: Json = null): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code: -32001, message: "Authentication required. Connect OctaDezx via OAuth or send an odx_ API key." },
    }),
    { status: 401, headers: { ...CORS, "Content-Type": "application/json", "WWW-Authenticate": WWW_AUTHENTICATE } },
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// deno-lint-ignore no-explicit-any
type Json = any;

function httpJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function rpcResult(id: Json, result: unknown): Response {
  return httpJson({ jsonrpc: "2.0", id, result });
}

function rpcError(id: Json, code: number, message: string, httpStatus = 200): Response {
  return httpJson({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, httpStatus);
}

// A tools/call payload: text content the model reads. isError flags failures.
function toolText(text: string, isError = false) {
  return { content: [{ type: "text", text }], isError };
}
function toolJson(data: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], isError: false };
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Mirror of the frontend useSubscription.checkAccess() so the UI's "subscribed"
// badge and this server agree on who may use the tools.
function hasActiveAccess(profile: Json | null): boolean {
  const status = profile?.subscription_status ?? null;
  if (status === "active" || status === "past_due") return true;
  if (status === "cancelled" || status === "expired") return false;
  // trial / free / null → allowed only while the trial window is open.
  const startRaw = profile?.trial_start_timestamp;
  if (startRaw) {
    const start = new Date(startRaw).getTime();
    if (Number.isFinite(start) && Date.now() > start + 24 * 60 * 60 * 1000) return false;
  }
  return true;
}

// Canonical Train-AI field names per business type, mirrored from
// src/lib/businessTypes.ts. Used so Claude writes type_config keys the dashboard
// also renders (any key still trains the AI server-side, but matching keys keep
// the owner's Train AI screen in sync).
const RECOMMENDED_FIELDS: Record<string, { name: string; label: string }[]> = {
  ecommerce: [
    { name: "shipping_info", label: "Shipping & Delivery" },
    { name: "payment_methods", label: "Payment Methods" },
    { name: "order_requirements", label: "Info to Collect Before an Order" },
  ],
  retail: [
    { name: "store_locations", label: "Store Location(s)" },
    { name: "opening_hours", label: "Opening Hours" },
    { name: "payment_methods", label: "Payment Methods" },
  ],
  agency: [
    { name: "services_offered", label: "Services Offered" },
    { name: "pricing_model", label: "Pricing Model" },
    { name: "booking_process", label: "How Clients Get Started" },
  ],
  saas: [
    { name: "pricing_plans", label: "Plans & Pricing" },
    { name: "support_channels", label: "Support Channels & Hours" },
    { name: "demo_process", label: "Trials & Demos" },
  ],
  restaurant: [
    { name: "menu_highlights", label: "Menu Highlights" },
    { name: "opening_hours", label: "Opening Hours" },
    { name: "delivery_options", label: "Delivery, Pickup & Reservations" },
  ],
  healthcare: [
    { name: "services_offered", label: "Services & Specialities" },
    { name: "appointment_booking", label: "Appointment Booking Process" },
    { name: "insurance_accepted", label: "Insurance / Payment" },
  ],
  education: [
    { name: "programs_offered", label: "Programs & Courses" },
    { name: "admission_process", label: "Admission / Enrolment Process" },
    { name: "schedule_info", label: "Schedules & Batches" },
  ],
  finance: [
    { name: "services_offered", label: "Services Offered" },
    { name: "eligibility_requirements", label: "Eligibility / Required Documents" },
    { name: "consultation_process", label: "Consultation Process" },
  ],
  realestate: [
    { name: "service_areas", label: "Service Areas" },
    { name: "listings_focus", label: "Property Types & Listings" },
    { name: "viewing_process", label: "Viewing & Buying Process" },
  ],
  travel: [
    { name: "packages_destinations", label: "Packages & Destinations" },
    { name: "booking_process", label: "Booking Process" },
    { name: "cancellation_policy", label: "Changes & Cancellations" },
  ],
  enterprise: [
    { name: "departments", label: "Departments / Service Lines" },
    { name: "escalation_contacts", label: "Escalation Path" },
    { name: "support_hours", label: "Support Hours & Channels" },
  ],
  other: [
    { name: "key_services", label: "Key Products / Services" },
    { name: "common_questions", label: "Common Customer Questions" },
    { name: "contact_process", label: "How Customers Reach the Team" },
  ],
};

// ── Tool catalogue ───────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: "list_escalated_chats",
    description: "List conversations the AI handed off to a human (status = escalated). These are customers waiting for a reply. Returns session id, customer name/email, the escalation reason and when it happened.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "Max sessions to return (default 20, max 100)." } },
    },
  },
  {
    name: "list_chats",
    description: "List recent customer conversations for this business. Optionally filter by status.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["active", "escalated", "resolved"], description: "Filter by status. Omit for all." },
        limit: { type: "number", description: "Max sessions (default 20, max 100)." },
      },
    },
  },
  {
    name: "get_conversation",
    description: "Get the full message history of one chat session, oldest first.",
    inputSchema: {
      type: "object",
      properties: { sessionId: { type: "string", description: "The chat session UUID." } },
      required: ["sessionId"],
    },
  },
  {
    name: "reply_to_customer",
    description: "Send a human reply into a chat session. The customer sees it instantly in their chat. Use this to answer a customer the AI escalated. The session stays human-handled so the AI won't talk over you.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "The chat session UUID." },
        message: { type: "string", description: "The reply to send to the customer." },
        resolve: { type: "boolean", description: "If true, also mark the conversation resolved after sending." },
      },
      required: ["sessionId", "message"],
    },
  },
  {
    name: "resolve_chat",
    description: "Mark a chat session as resolved (handled, no further action needed).",
    inputSchema: {
      type: "object",
      properties: { sessionId: { type: "string", description: "The chat session UUID." } },
      required: ["sessionId"],
    },
  },
  {
    name: "search_knowledge",
    description: "Search this business's knowledge base (FAQs, docs, policies) by keyword. Use it to find what the AI already knows before answering a customer.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keywords to search titles and content." },
        limit: { type: "number", description: "Max articles (default 5, max 20)." },
      },
      required: ["query"],
    },
  },
  {
    name: "add_knowledge",
    description: "Teach the AI a new fact or answer by adding a knowledge base article. The AI will use this in future customer chats, reducing escalations.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short title / the question this answers." },
        content: { type: "string", description: "The full answer or information." },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "list_orders",
    description: "List recent orders captured for this business (from chat or connected platforms).",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "Max orders (default 20, max 100)." } },
    },
  },
  {
    name: "business_overview",
    description: "Live snapshot of this business: counts of active / escalated / resolved chats, total orders and knowledge base articles, plus business name and type.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_business_profile",
    description: "Read this business's full setup: name, type, description, customer-facing policies, the AI's behaviour instructions, and the type-specific training fields (type_config). Also reports which recommended fields are still empty. Call this FIRST when helping an owner set up or train their assistant, so you know what's already configured and what's missing.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "update_business_profile",
    description: "Set up or train the assistant by writing the business's core details. Provide only the fields you want to change. `details` is an object of training fields keyed by the recommended field names from get_business_profile (e.g. {\"opening_hours\":\"Daily 11am-11pm\"}); it is merged into the existing config. Everything written here is used by the AI when answering customers.",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Short business description the AI introduces itself with." },
        policies: { type: "string", description: "Customer-facing policies (returns, cancellations, etc.)." },
        ai_instructions: { type: "string", description: "How the assistant should behave/talk. Replaces the current instructions — fetch them first if you only want to tweak." },
        details: { type: "object", description: "Training fields merged into type_config, e.g. {\"services_offered\":\"...\",\"pricing_model\":\"...\"}. Use the recommended field names for the business type. Set a field to an empty string to remove it." },
      },
    },
  },
  {
    name: "list_products",
    description: "List this business's products / services / menu items / listings (whatever the catalog holds for this type), with prices and categories.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "Max items (default 50, max 200)." } },
    },
  },
  {
    name: "add_product",
    description: "Add an item to the catalog (a product, service, plan, dish, listing, etc.) so the AI can recommend and answer about it.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Item name." },
        price: { type: "number", description: "Price (optional)." },
        description: { type: "string", description: "What it is / details (optional)." },
        category: { type: "string", description: "Category or grouping (optional)." },
      },
      required: ["name"],
    },
  },
  {
    name: "get_recent_conversations",
    description: "Fetch recent customer conversations WITH their messages so you can analyse them for insights — common questions, why chats get escalated, sentiment, recurring complaints, sales opportunities, busy periods, etc. Returns the raw material; do the analysis yourself and summarise for the owner.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "How many recent sessions to pull (default 10, max 40)." },
        status: { type: "string", enum: ["active", "escalated", "resolved"], description: "Optionally restrict to one status." },
        messagesPerChat: { type: "number", description: "Max messages per session (default 25, max 60)." },
      },
    },
  },
  {
    name: "update_product",
    description: "Edit an existing catalog item. Provide the productId (from list_products) and only the fields you want to change. Use is_active=false to hide an item from the AI without deleting it.",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string", description: "The product UUID (from list_products)." },
        name: { type: "string", description: "New name." },
        price: { type: "number", description: "New price." },
        description: { type: "string", description: "New description." },
        category: { type: "string", description: "New category." },
        stock_quantity: { type: "number", description: "New stock quantity." },
        is_active: { type: "boolean", description: "Whether the AI should offer this item." },
      },
      required: ["productId"],
    },
  },
  {
    name: "delete_product",
    description: "Permanently remove a catalog item. Prefer update_product with is_active=false if you only want to hide it temporarily. Always confirm with the owner before deleting.",
    inputSchema: {
      type: "object",
      properties: { productId: { type: "string", description: "The product UUID (from list_products)." } },
      required: ["productId"],
    },
  },
  {
    name: "update_knowledge",
    description: "Edit an existing knowledge base article. Provide the articleId (from search_knowledge) and the title and/or content to change.",
    inputSchema: {
      type: "object",
      properties: {
        articleId: { type: "string", description: "The article UUID (from search_knowledge)." },
        title: { type: "string", description: "New title." },
        content: { type: "string", description: "New content." },
      },
      required: ["articleId"],
    },
  },
  {
    name: "delete_knowledge",
    description: "Permanently remove a knowledge base article so the AI no longer uses it. Always confirm with the owner before deleting.",
    inputSchema: {
      type: "object",
      properties: { articleId: { type: "string", description: "The article UUID (from search_knowledge)." } },
      required: ["articleId"],
    },
  },
];

const clampLimit = (v: unknown, def: number, max: number): number => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.floor(n), max);
};

// ── Tool dispatch (only reached for subscribed businesses) ───────────────────
async function runTool(
  supabase: Json,
  businessId: string,
  name: string,
  args: Json,
): Promise<ReturnType<typeof toolJson>> {
  switch (name) {
    case "list_escalated_chats": {
      const limit = clampLimit(args?.limit, 20, 100);
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("id, customer_name, customer_email, escalation_reason, created_at, updated_at")
        .eq("business_id", businessId)
        .eq("status", "escalated")
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (error) return toolText(`Failed to load escalated chats: ${error.message}`, true);
      return toolJson({ count: data?.length ?? 0, sessions: data ?? [] });
    }

    case "list_chats": {
      const limit = clampLimit(args?.limit, 20, 100);
      let q = supabase
        .from("chat_sessions")
        .select("id, customer_name, customer_email, status, escalation_reason, created_at, updated_at")
        .eq("business_id", businessId)
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (typeof args?.status === "string") q = q.eq("status", args.status);
      const { data, error } = await q;
      if (error) return toolText(`Failed to load chats: ${error.message}`, true);
      return toolJson({ count: data?.length ?? 0, sessions: data ?? [] });
    }

    case "get_conversation": {
      const sessionId = String(args?.sessionId ?? "");
      if (!UUID_RE.test(sessionId)) return toolText("Invalid sessionId.", true);
      const { data: session } = await supabase
        .from("chat_sessions")
        .select("id, business_id, status, customer_name, customer_email")
        .eq("id", sessionId)
        .maybeSingle();
      if (!session || session.business_id !== businessId) return toolText("Session not found for this business.", true);
      const { data: messages, error } = await supabase
        .from("chat_messages")
        .select("sender_type, content, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (error) return toolText(`Failed to load messages: ${error.message}`, true);
      return toolJson({
        session: { id: session.id, status: session.status, customer_name: session.customer_name, customer_email: session.customer_email },
        messages: messages ?? [],
      });
    }

    case "reply_to_customer": {
      const sessionId = String(args?.sessionId ?? "");
      const message = String(args?.message ?? "").trim();
      if (!UUID_RE.test(sessionId)) return toolText("Invalid sessionId.", true);
      if (!message) return toolText("message is required.", true);
      if (message.length > 4000) return toolText("message too long (max 4000 chars).", true);
      const { data: session } = await supabase
        .from("chat_sessions")
        .select("id, business_id, status")
        .eq("id", sessionId)
        .maybeSingle();
      if (!session || session.business_id !== businessId) return toolText("Session not found for this business.", true);

      const { error: msgErr } = await supabase.from("chat_messages").insert({
        session_id: sessionId,
        sender_type: "human",
        content: message,
      });
      if (msgErr) return toolText(`Failed to send reply: ${msgErr.message}`, true);

      // Keep the session human-handled (escalated) so the AI doesn't reply over
      // the human — unless the agent asked to resolve it.
      const newStatus = args?.resolve ? "resolved" : "escalated";
      await supabase.from("chat_sessions").update({ status: newStatus }).eq("id", sessionId);

      return toolText(
        `Reply sent to the customer.${args?.resolve ? " Conversation marked resolved." : " Conversation kept open for the human."}`,
      );
    }

    case "resolve_chat": {
      const sessionId = String(args?.sessionId ?? "");
      if (!UUID_RE.test(sessionId)) return toolText("Invalid sessionId.", true);
      const { data: session } = await supabase
        .from("chat_sessions")
        .select("id, business_id")
        .eq("id", sessionId)
        .maybeSingle();
      if (!session || session.business_id !== businessId) return toolText("Session not found for this business.", true);
      const { error } = await supabase.from("chat_sessions").update({ status: "resolved" }).eq("id", sessionId);
      if (error) return toolText(`Failed to resolve: ${error.message}`, true);
      return toolText("Conversation marked resolved.");
    }

    case "search_knowledge": {
      const query = String(args?.query ?? "").trim();
      if (!query) return toolText("query is required.", true);
      const limit = clampLimit(args?.limit, 5, 20);
      // Strip characters that would break a PostgREST or-filter; `*` is the
      // wildcard inside .or() (maps to SQL `%`).
      const safe = query.replace(/[%_*(),]/g, " ").replace(/\s+/g, " ").trim();
      if (!safe) return toolJson({ count: 0, articles: [] });
      const pattern = `*${safe}*`;
      const { data, error } = await supabase
        .from("knowledge_base_articles")
        .select("id, title, content, url, updated_at")
        .eq("business_id", businessId)
        .or(`title.ilike.${pattern},content.ilike.${pattern}`)
        .limit(limit);
      if (error) return toolText(`Search failed: ${error.message}`, true);
      const trimmed = (data ?? []).map((a: Json) => ({
        ...a,
        content: typeof a.content === "string" && a.content.length > 1200 ? a.content.slice(0, 1200) + "…" : a.content,
      }));
      return toolJson({ count: trimmed.length, articles: trimmed });
    }

    case "add_knowledge": {
      const title = String(args?.title ?? "").trim();
      const content = String(args?.content ?? "").trim();
      if (!title) return toolText("title is required.", true);
      if (!content) return toolText("content is required.", true);
      const { data, error } = await supabase
        .from("knowledge_base_articles")
        .insert({ business_id: businessId, title, content, source_type: "mcp" })
        .select("id, title")
        .single();
      if (error) return toolText(`Failed to add knowledge: ${error.message}`, true);
      return toolText(`Added knowledge base article "${data.title}". The AI will use it in future chats.`);
    }

    case "list_orders": {
      const limit = clampLimit(args?.limit, 20, 100);
      const { data, error } = await supabase
        .from("orders")
        .select("id, customer_name, customer_email, customer_phone, items, total_amount, status, source_platform, created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return toolText(`Failed to load orders: ${error.message}`, true);
      return toolJson({ count: data?.length ?? 0, orders: data ?? [] });
    }

    case "business_overview": {
      const { data: biz } = await supabase
        .from("businesses")
        .select("name, business_type, description")
        .eq("id", businessId)
        .maybeSingle();
      const countWhere = async (status?: string) => {
        let q = supabase.from("chat_sessions").select("id", { count: "exact", head: true }).eq("business_id", businessId);
        if (status) q = q.eq("status", status);
        const { count } = await q;
        return count ?? 0;
      };
      const tableCount = async (table: string) => {
        const { count } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("business_id", businessId);
        return count ?? 0;
      };
      const [active, escalated, resolved, totalChats, orders, articles] = await Promise.all([
        countWhere("active"),
        countWhere("escalated"),
        countWhere("resolved"),
        countWhere(),
        tableCount("orders"),
        tableCount("knowledge_base_articles"),
      ]);
      return toolJson({
        business: { name: biz?.name ?? null, type: biz?.business_type ?? null, description: biz?.description ?? null },
        chats: { active, escalated, resolved, total: totalChats },
        orders,
        knowledge_articles: articles,
      });
    }

    case "get_business_profile": {
      const { data: biz, error } = await supabase
        .from("businesses")
        .select("name, business_type, description, policies, ai_instructions, type_config")
        .eq("id", businessId)
        .maybeSingle();
      if (error || !biz) return toolText(`Failed to load profile: ${error?.message ?? "not found"}`, true);
      const cfg = (biz.type_config && typeof biz.type_config === "object" ? biz.type_config : {}) as Record<string, string>;
      const recommended = RECOMMENDED_FIELDS[biz.business_type] ?? RECOMMENDED_FIELDS.other;
      const missing = recommended
        .filter((f) => !(cfg[f.name] ?? "").toString().trim())
        .map((f) => ({ field: f.name, label: f.label }));
      return toolJson({
        name: biz.name,
        business_type: biz.business_type,
        description: biz.description ?? "",
        policies: biz.policies ?? "",
        ai_instructions: biz.ai_instructions ?? "",
        training_fields: cfg,
        recommended_fields: recommended,
        missing_recommended_fields: missing,
      });
    }

    case "update_business_profile": {
      const patch: Record<string, unknown> = {};
      if (typeof args?.description === "string") patch.description = args.description.trim();
      if (typeof args?.policies === "string") patch.policies = args.policies.trim();
      if (typeof args?.ai_instructions === "string") patch.ai_instructions = args.ai_instructions.trim();

      let mergedConfig: Record<string, string> | undefined;
      if (args?.details && typeof args.details === "object" && !Array.isArray(args.details)) {
        const { data: cur } = await supabase.from("businesses").select("type_config").eq("id", businessId).maybeSingle();
        const existing = (cur?.type_config && typeof cur.type_config === "object" ? cur.type_config : {}) as Record<string, string>;
        mergedConfig = { ...existing };
        for (const [k, v] of Object.entries(args.details as Record<string, unknown>)) {
          const val = v == null ? "" : String(v).trim();
          if (val === "") delete mergedConfig[k];
          else mergedConfig[k] = val;
        }
        patch.type_config = mergedConfig;
      }

      if (Object.keys(patch).length === 0) {
        return toolText("Nothing to update. Provide description, policies, ai_instructions and/or details.", true);
      }

      const { error } = await supabase.from("businesses").update(patch).eq("id", businessId);
      if (error) return toolText(`Failed to update profile: ${error.message}`, true);
      const changed = Object.keys(patch).map((k) => (k === "type_config" ? "training fields" : k.replace(/_/g, " ")));
      return toolText(`Updated: ${changed.join(", ")}. The AI now uses this when answering customers.`);
    }

    case "list_products": {
      const limit = clampLimit(args?.limit, 50, 200);
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, category, description, stock_quantity, is_active")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return toolText(`Failed to load products: ${error.message}`, true);
      return toolJson({ count: data?.length ?? 0, products: data ?? [] });
    }

    case "add_product": {
      const pname = String(args?.name ?? "").trim();
      if (!pname) return toolText("name is required.", true);
      const row: Record<string, unknown> = { business_id: businessId, name: pname, source_platform: "mcp", is_active: true };
      if (args?.price != null && Number.isFinite(Number(args.price))) row.price = Number(args.price);
      if (typeof args?.description === "string" && args.description.trim()) row.description = args.description.trim();
      if (typeof args?.category === "string" && args.category.trim()) row.category = args.category.trim();
      const { data, error } = await supabase.from("products").insert(row).select("id, name, price").single();
      if (error) return toolText(`Failed to add item: ${error.message}`, true);
      return toolText(`Added "${data.name}"${data.price != null ? ` (${data.price})` : ""} to the catalog.`);
    }

    case "get_recent_conversations": {
      const limit = clampLimit(args?.limit, 10, 40);
      const perChat = clampLimit(args?.messagesPerChat, 25, 60);
      let q = supabase
        .from("chat_sessions")
        .select("id, customer_name, status, escalation_reason, source, created_at, updated_at")
        .eq("business_id", businessId)
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (typeof args?.status === "string") q = q.eq("status", args.status);
      const { data: sessions, error } = await q;
      if (error) return toolText(`Failed to load conversations: ${error.message}`, true);

      const withMessages = await Promise.all(
        (sessions ?? []).map(async (s: Json) => {
          const { data: msgs } = await supabase
            .from("chat_messages")
            .select("sender_type, content, created_at")
            .eq("session_id", s.id)
            .order("created_at", { ascending: true })
            .limit(perChat);
          return { ...s, messages: msgs ?? [] };
        }),
      );
      return toolJson({ count: withMessages.length, conversations: withMessages });
    }

    case "update_product": {
      const productId = String(args?.productId ?? "");
      if (!UUID_RE.test(productId)) return toolText("Invalid productId.", true);
      const patch: Record<string, unknown> = {};
      if (typeof args?.name === "string" && args.name.trim()) patch.name = args.name.trim();
      if (args?.price != null && Number.isFinite(Number(args.price))) patch.price = Number(args.price);
      if (typeof args?.description === "string") patch.description = args.description.trim();
      if (typeof args?.category === "string") patch.category = args.category.trim();
      if (args?.stock_quantity != null && Number.isFinite(Number(args.stock_quantity))) patch.stock_quantity = Number(args.stock_quantity);
      if (typeof args?.is_active === "boolean") patch.is_active = args.is_active;
      if (Object.keys(patch).length === 0) return toolText("Nothing to update. Provide at least one field to change.", true);
      // Scope by business_id so a key can only edit its own catalog.
      const { data, error } = await supabase
        .from("products")
        .update(patch)
        .eq("id", productId)
        .eq("business_id", businessId)
        .select("id, name")
        .maybeSingle();
      if (error) return toolText(`Failed to update item: ${error.message}`, true);
      if (!data) return toolText("Item not found for this business.", true);
      return toolText(`Updated "${data.name}".`);
    }

    case "delete_product": {
      const productId = String(args?.productId ?? "");
      if (!UUID_RE.test(productId)) return toolText("Invalid productId.", true);
      const { data, error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId)
        .eq("business_id", businessId)
        .select("id, name")
        .maybeSingle();
      if (error) return toolText(`Failed to delete item: ${error.message}`, true);
      if (!data) return toolText("Item not found for this business.", true);
      return toolText(`Deleted "${data.name}" from the catalog.`);
    }

    case "update_knowledge": {
      const articleId = String(args?.articleId ?? "");
      if (!UUID_RE.test(articleId)) return toolText("Invalid articleId.", true);
      const patch: Record<string, unknown> = {};
      if (typeof args?.title === "string" && args.title.trim()) patch.title = args.title.trim();
      if (typeof args?.content === "string" && args.content.trim()) patch.content = args.content.trim();
      if (Object.keys(patch).length === 0) return toolText("Nothing to update. Provide title and/or content.", true);
      const { data, error } = await supabase
        .from("knowledge_base_articles")
        .update(patch)
        .eq("id", articleId)
        .eq("business_id", businessId)
        .select("id, title")
        .maybeSingle();
      if (error) return toolText(`Failed to update article: ${error.message}`, true);
      if (!data) return toolText("Article not found for this business.", true);
      return toolText(`Updated knowledge base article "${data.title}".`);
    }

    case "delete_knowledge": {
      const articleId = String(args?.articleId ?? "");
      if (!UUID_RE.test(articleId)) return toolText("Invalid articleId.", true);
      const { data, error } = await supabase
        .from("knowledge_base_articles")
        .delete()
        .eq("id", articleId)
        .eq("business_id", businessId)
        .select("id, title")
        .maybeSingle();
      if (error) return toolText(`Failed to delete article: ${error.message}`, true);
      if (!data) return toolText("Article not found for this business.", true);
      return toolText(`Deleted knowledge base article "${data.title}". The AI will no longer use it.`);
    }

    default:
      return toolText(`Unknown tool: ${name}`, true);
  }
}

// Resolve the presented credential → businessId. Accepts BOTH the legacy odx_
// API key (api_keys) and an OAuth access token (oauth_access_tokens, odxat_…).
// Both are looked up by SHA-256 hash — the same scheme used when they're minted.
async function resolveAuth(
  supabase: Json,
  req: Request,
): Promise<{ businessId: string } | { error: "missing" | "invalid" }> {
  const authHeader = req.headers.get("authorization") ?? "";
  const url = new URL(req.url);
  const presented = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : (req.headers.get("x-api-key") ?? url.searchParams.get("key") ?? "").trim();
  if (!presented) return { error: "missing" };

  const hash = await sha256Hex(presented);

  // Legacy odx_ API key (Claude Desktop / non-OAuth clients) — kept working.
  if (presented.startsWith("odx_")) {
    const { data: keyRow } = await supabase
      .from("api_keys")
      .select("id, business_id, revoked_at")
      .eq("key_hash", hash)
      .maybeSingle();
    if (!keyRow || keyRow.revoked_at) return { error: "invalid" };
    supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id).then(() => {}, () => {});
    return { businessId: keyRow.business_id as string };
  }

  // OAuth access token minted by the one-click connector flow.
  const { data: tok } = await supabase
    .from("oauth_access_tokens")
    .select("token_hash, business_id, expires_at, revoked_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (!tok || tok.revoked_at) return { error: "invalid" };
  if (new Date(tok.expires_at).getTime() < Date.now()) return { error: "invalid" };
  supabase.from("oauth_access_tokens").update({ last_used_at: new Date().toISOString() }).eq("token_hash", hash).then(() => {}, () => {});
  return { businessId: tok.business_id as string };
}

// Methods handled before any credential check.
const PREAUTH_METHODS = new Set(["ping", "notifications/initialized", "notifications/cancelled"]);
const needsAuth = (m: Json) => !PREAUTH_METHODS.has(m?.method);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return rpcError(null, -32603, "Server configuration error", 500);
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Some clients probe with GET (or open a stream). Answer an unauthenticated
  // GET with 401 + WWW-Authenticate so OAuth discovery can start; otherwise
  // return server info.
  if (req.method === "GET") {
    const auth = await resolveAuth(supabase, req);
    if ("error" in auth) return unauthorized(null);
    return httpJson({ name: SERVER_NAME, version: SERVER_VERSION, transport: "streamable-http", note: "POST JSON-RPC 2.0 messages here." });
  }
  if (req.method !== "POST") return rpcError(null, -32600, "Method not allowed", 405);

  // Parse the JSON-RPC message first so we can echo its id in errors.
  let body: Json;
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  // Resolve auth once — the credential is identical for every message in a batch.
  const auth = await resolveAuth(supabase, req);
  const businessId = "businessId" in auth ? auth.businessId : "";

  if (Array.isArray(body)) {
    // Unauthenticated + any auth-needing message → 401 so the connector OAuths.
    if (!businessId && body.some(needsAuth)) return unauthorized(null);
    const responses = await Promise.all(body.map((m) => handleMessage(supabase, businessId, m)));
    const nonNull = responses.filter((r) => r !== null);
    if (nonNull.length === 0) return new Response(null, { status: 202, headers: CORS });
    return httpJson(nonNull);
  }

  if (!businessId && needsAuth(body)) return unauthorized(body?.id ?? null);
  const single = await handleMessage(supabase, businessId, body);
  if (single === null) return new Response(null, { status: 202, headers: CORS });
  return httpJson(single);
});

// Returns a JSON-RPC response object, or null for notifications (→ HTTP 202).
// `businessId` was resolved by the caller (resolveAuth); it is non-empty for any
// message whose method needs auth.
async function handleMessage(supabase: Json, businessId: string, msg: Json): Promise<Json | null> {
  const id = msg?.id ?? null;
  const method = msg?.method;
  const isNotification = id === null || id === undefined;

  // ── Methods that need no auth/state ──
  if (method === "notifications/initialized" || method === "notifications/cancelled") return null;
  if (method === "ping") return { jsonrpc: "2.0", id, result: {} };

  // Defensive: auth-needing methods always arrive with a valid businessId.
  if (!businessId) {
    if (isNotification) return null;
    return { jsonrpc: "2.0", id, error: { code: -32001, message: "Authentication required." } };
  }

  // ── initialize / tools/list — allowed for any valid credential (connect freely) ──
  if (method === "initialize") {
    const requested = msg?.params?.protocolVersion;
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: typeof requested === "string" ? requested : DEFAULT_PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        instructions: "OctaDezx customer-care tools. Use list_escalated_chats to find customers waiting, get_conversation to read context, reply_to_customer to answer, and add_knowledge to teach the AI so it can handle similar questions itself next time.",
      },
    };
  }

  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  }

  // ── tools/call — requires an active subscription/trial ──
  if (method === "tools/call") {
    const toolName = msg?.params?.name;
    const args = msg?.params?.arguments ?? {};
    if (!toolName || !TOOLS.some((t) => t.name === toolName)) {
      return { jsonrpc: "2.0", id, error: { code: -32602, message: `Unknown tool: ${toolName}` } };
    }

    // Subscription gate.
    const { data: biz } = await supabase.from("businesses").select("owner_id").eq("id", businessId).maybeSingle();
    let profile: Json = null;
    if (biz?.owner_id) {
      const { data } = await supabase
        .from("profiles")
        .select("subscription_status, trial_start_timestamp, plan_type")
        .eq("user_id", biz.owner_id)
        .maybeSingle();
      profile = data;
    }
    if (!hasActiveAccess(profile)) {
      return {
        jsonrpc: "2.0",
        id,
        result: toolText(
          `🔒 Subscription required. This OctaDezx connection is linked but the business has no active plan, so tools are locked. Ask the owner to subscribe at ${DASHBOARD_BILLING} (Billing) to unlock customer-care tools.`,
          true,
        ),
      };
    }

    try {
      const result = await runTool(supabase, businessId, toolName, args);
      return { jsonrpc: "2.0", id, result };
    } catch (err) {
      console.error("mcp tool error:", err);
      return { jsonrpc: "2.0", id, result: toolText(`Tool failed: ${err instanceof Error ? err.message : String(err)}`, true) };
    }
  }

  if (isNotification) return null;
  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
}
