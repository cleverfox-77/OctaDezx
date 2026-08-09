/**
 * Choosing which products the model gets to see on a given turn.
 *
 * A spoken prompt cannot carry a hundred item catalog, so it was capped at the
 * first twenty rows the database happened to return. For a business with 102
 * active products that is an assistant which has never heard of eighty percent
 * of what it sells, and it answers accordingly: confidently, and wrong.
 *
 * Ranking against what the caller actually said fixes that, and because the
 * full catalog is already in memory from the once per call context load, it
 * costs the turn no network time at all.
 */

export interface RankableProduct {
  name?: string | null;
  description?: string | null;
  [key: string]: unknown;
}

/** Words worth matching on. Short ones match everything and mean nothing. */
function terms(query: string): string[] {
  const stop = new Set([
    "the", "and", "for", "you", "have", "has", "any", "can", "get", "with",
    "what", "when", "where", "how", "much", "does", "your", "are", "want",
    "need", "like", "would", "could", "about", "please", "there", "this",
    "that", "them", "they", "some", "one", "all", "not", "but", "its",
  ]);
  const found = query.toLowerCase().match(/[a-z0-9'-]{3,}/g) ?? [];
  return [...new Set(found)].filter((t) => !stop.has(t));
}

/**
 * The `limit` products most likely to be about `query`, best first.
 *
 * Always returns a full list where one is available: matches first, then the
 * rest as padding, so a caller asking something the ranking cannot parse still
 * gets an assistant with a catalog rather than an empty one.
 */
export function pickProducts<T extends RankableProduct>(
  products: T[],
  query: string,
  limit = 30,
): T[] {
  if (products.length <= limit) return products;

  const t = terms(query);
  if (!t.length) return products.slice(0, limit);

  const scored = products.map((p, i) => {
    const name = String(p.name ?? "").toLowerCase();
    const desc = String(p.description ?? "").toLowerCase();
    let score = 0;
    for (const term of t) {
      // A hit in the name is the thing they asked for. A hit in the
      // description is a hint, worth far less: every winter boot mentions snow.
      if (name.includes(term)) score += 3;
      else if (desc.includes(term)) score += 1;
    }
    return { p, score, i };
  });

  return scored
    .sort((a, b) => (b.score - a.score) || (a.i - b.i))   // stable below the hits
    .slice(0, limit)
    .map((s) => s.p);
}
