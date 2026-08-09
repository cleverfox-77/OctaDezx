/**
 * Post-build gate on the prerendered output.
 *
 * The prerender step can fail quietly in ways nobody notices for weeks: a route
 * whose canonical still points at the homepage, a page whose fallback block came
 * out empty, JSON-LD that does not parse, an em dash slipping into visible copy.
 * Every one of those is invisible in a browser, because the React app renders
 * correctly on top of it. This turns all of them into a failed build.
 *
 * Runs automatically at the end of scripts/prerender.mjs, and standalone via
 * `npm run verify:seo` against whatever is currently in dist/.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ORIGIN, resolvePublicPages } from "./lib/routes.mjs";
import { loadBlogContent } from "./lib/blog.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

const HOMEPAGE_TITLE = "OctaDezx | 24/7 AI Customer Care &amp; Customer Service Agent";
const MIN_FALLBACK_CHARS = 500;

const textOf = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Check one prerendered file. `expect.out` is the dist folder ("" for the
 * homepage), `expect.canonical` the URL it must claim as its own.
 */
async function checkRoute(expect, problems) {
  const rel = path.join(expect.out, "index.html");
  const file = path.join(DIST, rel);
  const label = expect.canonical.replace(ORIGIN, "") || "/";
  let html;
  try {
    html = await fs.readFile(file, "utf8");
  } catch {
    problems.push(`${label}: no prerendered file at dist/${rel.replace(/\\/g, "/")}`);
    return;
  }

  const fail = (msg) => problems.push(`${label}: ${msg}`);

  // 1. exactly one canonical, and it points at this page
  const canonicals = [...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  if (canonicals.length !== 1) fail(`expected 1 canonical, found ${canonicals.length}`);
  else if (canonicals[0] !== expect.canonical) fail(`canonical is ${canonicals[0]}, expected ${expect.canonical}`);

  // 2. a real title, and not the homepage's on a sub-page
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
  if (!title.trim()) fail("empty <title>");
  else if (expect.out !== "" && title === HOMEPAGE_TITLE) fail("still carries the homepage <title>");

  // 3. a description of its own
  const desc = (html.match(/<meta\b[^>]*name="description"[^>]*content="([^"]*)"/) || [])[1] || "";
  if (!desc.trim()) fail("empty meta description");

  // 4. the fallback block actually holds content. An empty one means crawlers
  //    that do not run JavaScript see a blank page even though the head is right.
  const block = html.match(/<!-- prerender:start -->([\s\S]*?)<!-- prerender:end -->/);
  if (!block) fail("prerender markers missing");
  else {
    const chars = textOf(block[1]).length;
    if (chars < MIN_FALLBACK_CHARS) fail(`fallback content is only ${chars} chars (min ${MIN_FALLBACK_CHARS})`);
  }

  // 5. every JSON-LD block parses, and posts carry the article schema
  const types = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]);
      for (const node of Array.isArray(data) ? data : [data]) {
        for (const n of node["@graph"] || [node]) if (n["@type"]) types.push(n["@type"]);
      }
    } catch (err) {
      fail(`JSON-LD does not parse: ${err.message}`);
    }
  }
  if (expect.isPost) {
    for (const required of ["BlogPosting", "BreadcrumbList"]) {
      if (!types.includes(required)) fail(`missing ${required} structured data`);
    }
  }

  // 6. the standing no-dash rule, entities included. A literal-character scan
  //    missed a &mdash; in the blog list once, so check both forms.
  const visible = block ? block[1] : html;
  for (const [needle, name] of [["—", "em dash"], ["–", "en dash"], ["&mdash;", "&mdash;"], ["&ndash;", "&ndash;"]]) {
    if (visible.includes(needle)) fail(`visible copy contains ${name}`);
  }
}

/** @param {{out:string,canonical:string,isPost?:boolean}[]} expected */
export async function verifySeo(expected, { quiet = false } = {}) {
  const problems = [];
  for (const e of expected) await checkRoute(e, problems);

  if (problems.length) {
    console.error(`\n[verify-seo] ${problems.length} problem(s) across ${expected.length} routes:`);
    for (const p of problems) console.error(`  ${p}`);
    console.error("");
    const err = new Error(`[verify-seo] ${problems.length} route(s) failed verification`);
    err.problems = problems;
    throw err;
  }
  if (!quiet) console.log(`[verify-seo] ${expected.length} routes OK (canonical, title, description, content, schema, no dashes).`);
}

/**
 * The list of routes that must exist in dist, rebuilt from the same sources the
 * build itself reads. Exported so prerender.mjs and the standalone run check
 * exactly the same set.
 */
export async function expectedRoutes() {
  const { pages } = await resolvePublicPages(ROOT);
  const { posts } = await loadBlogContent(ROOT);
  return [
    ...pages.map((p) => ({ out: p.out, canonical: p.meta.canonical })),
    ...posts.map((p) => ({ out: path.join("blog", p.slug), canonical: `${ORIGIN}/blog/${p.slug}`, isPost: true })),
  ];
}

// Standalone entry: `npm run verify:seo` against whatever is in dist/.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    await verifySeo(await expectedRoutes());
  } catch (err) {
    if (!err.problems) console.error(err.message);
    process.exit(1);
  }
}
