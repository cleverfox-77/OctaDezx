/**
 * OctaDezx — Train the AI from an uploaded file
 *
 * Owner-authenticated. Accepts a CSV / PDF / image / text file (base64),
 * uses Gemini to extract clean Q&A knowledge, and writes the results into
 * the business's knowledge_base_articles (RLS enforced with the caller's JWT).
 *
 * POST { businessId, filename, mimeType, dataBase64 }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Text-ish types we can hand to Gemini as plain text; everything else (pdf,
// images) goes inline as base64. DOCX and other binary office formats aren't
// supported by Gemini inline — ask the owner to export to PDF or paste text.
const TEXT_TYPES = /^(text\/|application\/(json|csv))|csv$/i;
const INLINE_TYPES = /^(application\/pdf|image\/(png|jpe?g|webp|gif|heic|heif))$/i;

const MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-001", "gemini-3.1-flash-lite"];

async function extractKnowledge(mimeType: string, dataBase64: string, filename: string): Promise<{ title: string; content: string }[]> {
  const instruction =
    `You are building a customer-service knowledge base for a business. Read the attached document (${filename}) ` +
    `and extract its useful facts as a JSON array of {"title","content"} objects. Each object is one self-contained ` +
    `Q&A-style article the AI can answer customers from (policies, hours, prices, services, FAQs, product facts, etc.). ` +
    `Write clear, complete sentences. Do NOT invent facts that are not in the document. Return ONLY the JSON array, no prose, no code fences.`;

  const parts: unknown[] = [{ text: instruction }];
  if (INLINE_TYPES.test(mimeType)) {
    parts.push({ inline_data: { mime_type: mimeType, data: dataBase64 } });
  } else {
    // decode base64 → text for CSV / txt / md / json
    const text = new TextDecoder().decode(Uint8Array.from(atob(dataBase64), (c) => c.charCodeAt(0)));
    parts.push({ text: `--- DOCUMENT CONTENT ---\n${text.slice(0, 200000)}` });
  }

  let lastErr = "";
  for (const model of MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
        }),
      },
    );
    if (!res.ok) { lastErr = `Gemini ${model} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`; continue; }
    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    if (!raw) { lastErr = `Gemini ${model} returned empty`; continue; }
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    try {
      const arr = JSON.parse(cleaned);
      if (Array.isArray(arr)) {
        return arr
          .filter((a) => a && (a.title || a.content))
          .map((a) => ({ title: String(a.title ?? "Untitled").slice(0, 300), content: String(a.content ?? "").slice(0, 20000) }))
          .filter((a) => a.content.trim());
      }
    } catch {
      // Model didn't return clean JSON — store the whole extraction as one article.
      return [{ title: filename.replace(/\.[^.]+$/, "").slice(0, 300), content: raw.slice(0, 20000) }];
    }
  }
  throw new Error(lastErr || "Gemini extraction failed");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!GEMINI_API_KEY) return json({ error: "AI is not configured (missing GEMINI_API_KEY)." }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Not authenticated" }, 401);

  // User-bound client: RLS makes sure the caller can only write to a business they own.
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await sb.auth.getUser();
  if (!userData?.user) return json({ error: "Not authenticated" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const { businessId, filename = "document", mimeType = "", dataBase64 = "" } = body ?? {};
  if (!businessId || !dataBase64) return json({ error: "businessId and dataBase64 are required" }, 400);

  // Confirm ownership (defense in depth; RLS also enforces it on insert).
  const { data: biz } = await sb.from("businesses").select("id").eq("id", businessId).eq("owner_id", userData.user.id).maybeSingle();
  if (!biz) return json({ error: "Business not found or not yours" }, 403);

  if (!TEXT_TYPES.test(mimeType) && !INLINE_TYPES.test(mimeType)) {
    return json({ error: "Unsupported file type. Upload a PDF, image, CSV, or text file (export other documents to PDF first)." }, 415);
  }

  let articles: { title: string; content: string }[];
  try {
    articles = await extractKnowledge(mimeType, dataBase64, filename);
  } catch (e) {
    return json({ error: `Could not read that file: ${e instanceof Error ? e.message : String(e)}` }, 502);
  }
  if (!articles.length) return json({ error: "No usable content found in that file." }, 422);

  const rows = articles.map((a) => ({ business_id: businessId, title: a.title, content: a.content, source_type: "file" }));
  const { data: inserted, error } = await sb.from("knowledge_base_articles").insert(rows as any).select("id, title");
  if (error) return json({ error: `Saved extraction but failed to store: ${error.message}` }, 500);

  return json({ added: inserted?.length ?? 0, titles: (inserted ?? []).map((r: any) => r.title) });
});
