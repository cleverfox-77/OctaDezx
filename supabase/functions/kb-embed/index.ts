/**
 * Fills in missing knowledge base embeddings.
 *
 * WHY THIS EXISTS: `match_knowledge_base_articles` has been in the database
 * since January and nothing ever populated `knowledge_base_articles.embedding`,
 * so every semantic search silently fell back to "the newest few articles".
 * Voice cannot live with that: dumping the whole knowledge base into a prompt
 * is latency the caller hears as silence.
 *
 * Articles are written from four places (the dashboard, file training, the
 * scraper and the MCP server). Rather than teach all four to embed, a trigger
 * clears the vector whenever the text changes and this sweeper refills it.
 * One place to get right instead of four, at the cost of a few minutes' lag.
 *
 * Runs on a 5 minute cron. Also safe to call by hand to backfill.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { embed } from "../_shared/business-context.ts";

const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  if (!CRON_SECRET) return json({ error: "CRON_SECRET is not set" }, 500);
  if (req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Small batches: the Gemini embedding endpoint is rate limited and there is
  // no deadline here, so a backlog drains over a few ticks rather than one
  // long run that risks timing out and redoing the same work.
  const { data, error } = await supabase.rpc("kb_pending_embeddings", { p_limit: 25 });
  if (error) return json({ error: `kb_pending_embeddings: ${error.message}` }, 500);

  const pending = (data ?? []) as { id: string; title: string; content: string }[];
  let done = 0;
  let failed = 0;

  for (const article of pending) {
    // Title carries real signal ("Refund policy"), so embed it with the body.
    const vector = await embed(`${article.title ?? ""}\n\n${article.content ?? ""}`.trim());
    if (!vector) { failed++; continue; }

    const { error: setErr } = await supabase.rpc("kb_set_embedding", {
      p_id: article.id,
      // pgvector's text input format. Sent as a string so this function does
      // not need a vector codec on the client side.
      p_embedding: `[${vector.join(",")}]`,
    });
    if (setErr) { console.error("[kb-embed] set failed:", setErr.message); failed++; continue; }
    done++;
  }

  console.log(`[kb-embed] embedded ${done}, failed ${failed}, remaining in batch ${pending.length - done - failed}`);
  return json({ pending: pending.length, embedded: done, failed });
});
