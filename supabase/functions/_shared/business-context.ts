/**
 * Shared business context for every AI channel (web chat, messaging platforms, voice).
 *
 * WHY THIS EXISTS: `ai-chat-response` grew the only copy of "what does this
 * business sell, what are its policies, what does it know". Adding voice as a
 * second caller meant either importing that 1,100-line function or copying the
 * rules into a second place, and copies drift.
 *
 * What is shared here is the DATA and the retrieval, which must never disagree
 * between channels. What is deliberately NOT shared is the prompt wording: chat
 * wants markdown and product images, voice must never emit an asterisk or a URL.
 * Forcing one prompt builder to serve both would make both worse.
 */

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  stock_quantity?: number | null;
  is_active?: boolean | null;
}

export interface BusinessRow {
  id: string;
  name: string;
  description: string | null;
  policies: string | null;
  ai_instructions: string | null;
  business_type?: string | null;
  type_config?: Record<string, unknown> | null;
  products?: Product[];
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
}

/**
 * How the AI describes what each kind of business offers.
 * Mirrors TYPE_PROFILES in ai-chat-response/index.ts. Keep in step: this is the
 * one duplication we accept, because ai-chat-response is a working production
 * path and a live refactor of its prompt strings is not worth the risk today.
 */
export const TYPE_PROFILES: Record<string, { role: string; catalogLabel: string; sells: boolean }> = {
  ecommerce:  { role: "AI sales assistant for an online store",          catalogLabel: "PRODUCTS",          sells: true },
  retail:     { role: "AI sales assistant for a retail store",           catalogLabel: "PRODUCTS",          sells: true },
  restaurant: { role: "AI assistant for a restaurant / food business",   catalogLabel: "MENU ITEMS",        sells: true },
  agency:     { role: "AI client-care assistant for a professional services agency", catalogLabel: "SERVICES", sells: false },
  saas:       { role: "AI support assistant for a software (SaaS) company", catalogLabel: "PLANS & PRODUCTS", sells: false },
  healthcare: { role: "AI front-desk assistant for a healthcare provider", catalogLabel: "SERVICES",        sells: false },
  education:  { role: "AI admissions/support assistant for an education provider", catalogLabel: "PROGRAMS & COURSES", sells: false },
  finance:    { role: "AI customer-care assistant for a financial services business", catalogLabel: "SERVICES", sells: false },
  realestate: { role: "AI assistant for a real-estate business",         catalogLabel: "LISTINGS & SERVICES", sells: false },
  travel:     { role: "AI booking/support assistant for a travel & hospitality business", catalogLabel: "PACKAGES & SERVICES", sells: false },
  enterprise: { role: "AI customer-care assistant for an enterprise organisation", catalogLabel: "PRODUCTS & SERVICES", sells: false },
  other:      { role: "AI customer-care assistant",                      catalogLabel: "PRODUCTS & SERVICES", sells: false },
};

export function getTypeProfile(business: Pick<BusinessRow, "business_type">) {
  return TYPE_PROFILES[business.business_type ?? "ecommerce"] ?? TYPE_PROFILES.ecommerce;
}

/** Customer text can never be allowed to forge a control marker. */
export const stripMarkers = (s: string) => s.replace(/\|\|/g, "¦¦");

/** Pull `||ESCALATE:{...}||` out of a reply, returning the cleaned text. */
export function parseEscalation(text: string): { clean: string; reason: string | null } {
  const m = text.match(/\|\|ESCALATE:(\{[\s\S]*?\})\|\|/);
  if (!m) return { clean: text, reason: null };
  let reason: string | null = "Customer needs a human";
  try { reason = JSON.parse(m[1])?.reason ?? reason; } catch { /* keep default */ }
  return { clean: text.replace(m[0], "").trim(), reason };
}

/** Pull `||APPOINTMENT:{...}||` out of a reply, returning the cleaned text. */
export function parseAppointment(text: string): { clean: string; appointment: Record<string, unknown> | null } {
  const m = text.match(/\|\|APPOINTMENT:(\{[\s\S]*?\})\|\|/);
  if (!m) return { clean: text, appointment: null };
  let appointment: Record<string, unknown> | null = null;
  try { appointment = JSON.parse(m[1]); } catch { /* malformed, drop it */ }
  return { clean: text.replace(m[0], "").trim(), appointment };
}

/**
 * Pull `||ORDER:{...}||` out of a reply, returning the cleaned text.
 *
 * Markers rather than model function calling, deliberately. Function calling
 * needs a second round trip mid-stream, and on a phone call that round trip is
 * silence the caller hears. The marker rides out on the same stream that is
 * already being spoken, and the sentence before it is the spoken confirmation.
 */
export function parseOrder(text: string): { clean: string; order: Record<string, unknown> | null } {
  const m = text.match(/\|\|ORDER:(\{[\s\S]*?\})\|\|/);
  if (!m) return { clean: text, order: null };
  let order: Record<string, unknown> | null = null;
  try { order = JSON.parse(m[1]); } catch { /* malformed, drop it */ }
  return { clean: text.replace(m[0], "").trim(), order };
}

/**
 * Pull `||SEND:{"channel":"whatsapp","text":"..."}||` out of a reply.
 *
 * The channel is checked against what is genuinely reachable before anything is
 * sent, never trusted from here: this object is model output shaped by whatever
 * the caller said out loud.
 */
export function parseSend(text: string): { clean: string; send: Record<string, unknown> | null } {
  const m = text.match(/\|\|SEND:(\{[\s\S]*?\})\|\|/);
  if (!m) return { clean: text, send: null };
  let send: Record<string, unknown> | null = null;
  try { send = JSON.parse(m[1]); } catch { /* malformed, drop it */ }
  return { clean: text.replace(m[0], "").trim(), send };
}

/** Strip any leftover marker syntax so nothing internal is ever spoken or shown. */
export const stripAllMarkers = (s: string) => s.replace(/\|\|[A-Z_]+:[\s\S]*?\|\|/g, "").trim();

/**
 * Business plus active catalog, in one round trip.
 * Mirrors the nested select in ai-chat-response so both see the same catalog.
 */
export async function loadBusiness(businessId: string, supabase: any): Promise<BusinessRow | null> {
  const { data, error } = await supabase
    .from("businesses")
    .select("id, name, description, policies, ai_instructions, business_type, type_config, products ( id, name, description, price, stock_quantity, is_active )")
    .eq("id", businessId)
    .single();
  if (error || !data) {
    console.error("[business-context] business load failed:", error?.message);
    return null;
  }
  return { ...data, products: (data.products ?? []).filter((p: Product) => p.is_active !== false) };
}

const EMBED_MODEL = "text-embedding-004";   // 768-dim, matches match_knowledge_base_articles' vector(768)

/** Embed a string with Gemini. Returns null on any failure so callers can fall back. */
export async function embed(text: string): Promise<number[] | null> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: `models/${EMBED_MODEL}`,
          content: { parts: [{ text: text.slice(0, 8000) }] },
        }),
      },
    );
    if (!res.ok) { console.error("[business-context] embed failed:", res.status); return null; }
    const json = await res.json();
    const values = json?.embedding?.values;
    return Array.isArray(values) && values.length ? values : null;
  } catch (err) {
    console.error("[business-context] embed threw:", err);
    return null;
  }
}

/**
 * Knowledge for one question.
 *
 * Prefers vector retrieval via the existing `match_knowledge_base_articles` RPC
 * (defined in 20260120190028_fix_rpc_function.sql and, until now, never called).
 * Falls back to recent articles with each one clipped, because voice cannot
 * afford the full-table dump that the chat path still does: every extra
 * thousand tokens is latency the caller hears as silence.
 */
export async function loadKnowledge(
  businessId: string,
  supabase: any,
  question: string,
  { matchCount = 4, clipChars = 1200 }: { matchCount?: number; clipChars?: number } = {},
): Promise<KnowledgeEntry[]> {
  const vector = await embed(question);
  if (vector) {
    try {
      const { data, error } = await supabase.rpc("match_knowledge_base_articles", {
        query_embedding: vector,
        match_threshold: 0.5,
        match_count: matchCount,
        p_business_id: businessId,
      });
      if (!error && Array.isArray(data) && data.length) {
        return data.map((d: any) => ({
          id: d.id, title: d.title, content: String(d.content ?? "").slice(0, clipChars),
        }));
      }
    } catch (err) {
      console.error("[business-context] vector search failed, falling back:", err);
    }
  }

  // Fallback: newest articles, clipped. Never the whole table.
  const { data } = await supabase
    .from("knowledge_base_articles")
    .select("id, title, content")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(8);
  return ((data ?? []) as KnowledgeEntry[]).map((d) => ({
    ...d, content: String(d.content ?? "").slice(0, clipChars),
  }));
}

/** Compact catalog summary for a prompt. Voice keeps this short on purpose. */
export function summariseCatalog(products: Product[], label: string, limit = 25): string {
  if (!products.length) return "";
  const lines = products.slice(0, limit).map((p) => {
    const price = p.price != null ? ` ${p.price}` : "";
    const stock = p.stock_quantity != null && p.stock_quantity <= 0 ? " (out of stock)" : "";
    return `- ${p.name}${price}${stock}`;
  });
  const more = products.length > limit ? `\n(and ${products.length - limit} more)` : "";
  return `${label}:\n${lines.join("\n")}${more}`;
}
