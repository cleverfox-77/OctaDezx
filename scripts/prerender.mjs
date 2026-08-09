/**
 * Static prerender for the OctaDezx marketing site.
 *
 * WHY: the app is a client-rendered Vite SPA. Vite emits a single dist/index.html
 * shell, and vercel.json rewrites every non-API path to it. So a fetcher that does
 * NOT run JavaScript (AI crawlers like GPTBot/ClaudeBot/PerplexityBot, social
 * scrapers, and Google's first pass) gets the HOMEPAGE head on every URL: the
 * homepage <title>, description, OG tags and, worst of all, a canonical pointing at
 * https://octadezx.com/. That canonical tells search engines every blog post is a
 * duplicate of the homepage, and AI answer engines that fetch a post URL get
 * homepage boilerplate instead of the article.
 *
 * WHAT THIS DOES: after `vite build`, clone dist/index.html for each public route
 * and rewrite the head (title, description, keywords, canonical, Open Graph,
 * Twitter) to that page's real values, swap the fallback block inside #root for
 * that page's real content, and for blog posts inject BlogPosting + BreadcrumbList
 * JSON-LD that includes the full articleBody. Written to dist/<route>/index.html.
 * Vercel serves these static files before applying the SPA rewrite, so raw-HTML
 * fetchers now get correct, unique, citable HTML per route. When a real browser
 * loads the page, React's createRoot clears #root and react-helmet-async adopts
 * the data-rh tags, so nothing conflicts.
 *
 * The fallback deliberately lives INSIDE #root instead of in a <noscript>: text
 * extractors built on Mozilla Readability strip <noscript> along with <script>
 * before pulling text, so a noscript-only fallback reads as an empty page to a
 * large share of AI crawlers.
 *
 * No headless browser required: content comes from the same data the app renders.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ORIGIN, PUBLIC_ROUTES, resolvePublicPages } from "./lib/routes.mjs";
import { loadBlogContent } from "./lib/blog.mjs";
import { loadTsModule } from "./lib/load-ts.mjs";
import { verifySeo } from "./verify-seo.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const OG_DEFAULT = `${ORIGIN}/og-image.png`;

// ── escaping ──────────────────────────────────────────────────────────────
const escAttr = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const escHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// inline JSON-LD must not contain a raw "<" that could break out of <script>
const jsonLd = (obj) => JSON.stringify(obj).replace(/</g, "\\u003c");

// ── head rewriters (regex keyed on stable attributes) ───────────────────────
const setTitle = (html, title) => html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escHtml(title)}</title>`);
const setMeta = (html, keyEq, content) => {
  const re = new RegExp(`(<meta\\b[^>]*\\b${keyEq}[^>]*\\bcontent=")[^"]*(")`);
  return re.test(html) ? html.replace(re, `$1${escAttr(content)}$2`) : html;
};
const setCanonical = (html, url) =>
  html.replace(/(<link\b[^>]*rel="canonical"[^>]*href=")[^"]*(")/, `$1${escAttr(url)}$2`);
const injectHead = (html, extra) => html.replace("</head>", `${extra}\n</head>`);

// The fallback block inside #root is delimited by comment markers rather than by
// matching <div id="root">...</div>, because the content itself contains nested
// closing tags that a non-greedy element match would trip over.
const FALLBACK_RE = /<!-- prerender:start -->[\s\S]*?<!-- prerender:end -->/;
const setFallback = (html, inner) => {
  if (!FALLBACK_RE.test(html)) {
    throw new Error(
      "prerender markers not found in dist/index.html. index.html must keep " +
        "<!-- prerender:start --> / <!-- prerender:end --> inside #root.",
    );
  }
  return html.replace(FALLBACK_RE, `<!-- prerender:start -->${inner}<!-- prerender:end -->`);
};

/** Apply the shared head fields every route needs. */
function applyHead(html, { title, description, canonical, keywords, ogType = "website", ogImage = OG_DEFAULT }) {
  html = setTitle(html, title);
  html = setCanonical(html, canonical);
  html = setMeta(html, 'name="description"', description);
  if (keywords) html = setMeta(html, 'name="keywords"', keywords);
  html = setMeta(html, 'property="og:url"', canonical);
  html = setMeta(html, 'property="og:title"', title);
  html = setMeta(html, 'property="og:description"', description);
  html = setMeta(html, 'property="og:type"', ogType);
  html = setMeta(html, 'property="og:image"', ogImage);
  html = setMeta(html, 'property="twitter:url"', canonical);
  html = setMeta(html, 'property="twitter:title"', title);
  html = setMeta(html, 'property="twitter:description"', description);
  html = setMeta(html, 'property="twitter:image"', ogImage);
  return html;
}

// .pf is styled by the small <style> block in index.html, so the fallback is
// readable the instant the HTML parses rather than waiting on the app bundle.
const MAIN = `<main class="pf">`;

/** Fallback content for a simple marketing page.
 *
 *  `related` gives the page real links into individual blog posts. Without them
 *  the articles are reachable only from /blog and the sitemap, so nothing on the
 *  site points a non-JavaScript crawler at any single article. */
function pageFallback(headline, description, related = [], body = "") {
  let h = `${MAIN}<h1>${escHtml(headline)}</h1><p>${escHtml(description)}</p>`;
  h += body;
  if (related.length) {
    h += `<h2>Read more on this</h2><ul>`;
    for (const post of related) {
      h += `<li><a href="${ORIGIN}/blog/${post.slug}">${escHtml(post.title)}</a><br>${escHtml(post.excerpt)}</li>`;
    }
    h += `</ul>`;
  }
  return h +
    `<p><a href="${ORIGIN}/">OctaDezx home</a> &middot; <a href="${ORIGIN}/pricing">Pricing</a> &middot; ` +
    `<a href="${ORIGIN}/blog">Blog</a> &middot; <a href="${ORIGIN}/auth">Start free trial</a></p></main>`;
}

/**
 * Body copy for the pages that are not blog driven.
 *
 * Without this, /about, /careers, /affiliates and /privacy shipped a fallback of
 * only ~200 to 280 characters, so a crawler that does not run JavaScript saw a
 * headline and little else. The content is read from the same companyData.ts the
 * React pages render, so it cannot drift, and verify-seo enforces a minimum
 * length rather than trusting anyone to remember.
 */
function pageBody(routePath, c) {
  const ul = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
  switch (routePath) {
    case "/about":
      return (
        `<h2>The group</h2>` +
        ul((c.GROUP ?? []).map((g) => `<strong>${escHtml(g.name)}</strong>, ${escHtml(g.role)}. ${escHtml(g.blurb)}`)) +
        `<h2>What we hold to</h2>` +
        ul((c.VALUES ?? []).map((v) => `<strong>${escHtml(v.title)}</strong>. ${escHtml(v.desc)}`)) +
        `<h2>How we got here</h2>` +
        ul((c.MILESTONES ?? []).map((m) => `<strong>${escHtml(m.title)}</strong>. ${escHtml(m.desc)}`))
      );
    case "/careers":
      return (
        `<h2>Open roles</h2>` +
        (c.ROLES ?? [])
          .map(
            (r) =>
              `<h3>${escHtml(r.title)}</h3><p>${escHtml(r.team)}, ${escHtml(r.type)}, ${escHtml(r.location)}. ` +
              `${escHtml(r.summary)} ${escHtml(r.comp)}</p>` +
              (r.responsibilities?.length ? ul(r.responsibilities.map(escHtml)) : ""),
          )
          .join("") +
        `<h2>How we work</h2>` +
        ul((c.PERKS ?? []).map((p) => `<strong>${escHtml(p.title)}</strong>. ${escHtml(p.desc)}`)) +
        `<p>Apply by email: <a href="mailto:${escHtml(c.COMPANY?.careersEmail ?? "")}">${escHtml(c.COMPANY?.careersEmail ?? "")}</a></p>`
      );
    case "/affiliates": {
      const a = c.AFFILIATE ?? {};
      return (
        `<p>Earn ${a.rate}% recurring commission on every payment for as long as your referral stays. ` +
        `Your audience gets ${a.audienceDiscount}% off with your code. ` +
        `${a.cookieDays} day attribution window, paid monthly once you clear $${a.minPayout}.</p>` +
        `<h2>What you get</h2>` +
        ul((c.AFFILIATE_PERKS ?? []).map((p) => `<strong>${escHtml(p.title)}</strong>. ${escHtml(p.desc)}`)) +
        `<h2>Bonus tiers</h2>` +
        ul((c.AFFILIATE_TIERS ?? []).map((t) => `${escHtml(t.active)}: ${escHtml(t.bonus)}. ${escHtml(t.note)}`)) +
        `<h2>How it works</h2>` +
        ul((c.AFFILIATE_STEPS ?? []).map((s) => `<strong>${escHtml(s.title)}</strong>. ${escHtml(s.desc)}`))
      );
    }
    default:
      return "";
  }
}

/**
 * The privacy policy is written as JSX prose rather than a data module, so its
 * section headings are read straight out of the component. That is enough for a
 * crawler to know what the policy covers without restating the policy here.
 */
async function privacyBody(root) {
  const src = await fs.readFile(path.join(root, "src/pages/PrivacyPolicy.tsx"), "utf8");
  const headings = [...src.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((m) => m[1].trim());
  const intro = (src.match(/<p className="text-muted-foreground leading-relaxed">\s*([^<]{80,}?)\s*<\/p>/) || [])[1];
  let h = intro ? `<p>${escHtml(intro.trim())}</p>` : "";
  if (headings.length) {
    h += `<h2>What this policy covers</h2><ul>${headings.map((t) => `<li>${escHtml(t)}</li>`).join("")}</ul>`;
  }
  return h;
}

// Blog data, loaded from the same module the React app uses so the byline,
// E-E-A-T bio and internal-link maps can never drift from the live pages.
// Filled once in main() from scripts/lib/blog.mjs.
let AUTHOR = { name: "The OctaDezx team", url: `${ORIGIN}/about`, role: "", bio: "" };
let PAGE_RELATED = {};
let TAG_LINKS = {};
let DEFAULT_LINKS = [];

/** Resolve a page's related slugs to real posts, dropping any that no longer
 *  exist so a renamed post can never produce a prerendered 404 link. */
function relatedFor(routePath, posts) {
  return (PAGE_RELATED[routePath] ?? [])
    .map((slug) => posts.find((p) => p.slug === slug))
    .filter(Boolean);
}

function tableText(t) {
  const lines = [t.caption, t.columns.join(" | ")].filter(Boolean);
  for (const row of t.rows) lines.push(row.join(" | "));
  return lines.join("\n");
}

function articleText(post) {
  const parts = [post.excerpt];
  if (post.takeaways?.length) parts.push("Key takeaways", ...post.takeaways);
  for (const s of post.sections) {
    if (s.heading) parts.push(s.heading);
    if (s.paragraphs) parts.push(...s.paragraphs);
    if (s.bullets) parts.push(...s.bullets);
    if (s.table) parts.push(tableText(s.table));
    if (s.callout) parts.push(s.callout);
  }
  if (post.faqs?.length) {
    parts.push("Frequently asked questions");
    for (const f of post.faqs) parts.push(`${f.q}\n${f.a}`);
  }
  return parts.join("\n\n");
}

/** Same ordering as BlogPost.tsx: same tag first, then fill. Keeping the two in
 *  step matters because this is the copy a non-JavaScript crawler reads. */
function relatedPosts(post, posts) {
  const others = posts.filter((p) => p.slug !== post.slug);
  return [
    ...others.filter((p) => p.tag === post.tag),
    ...others.filter((p) => p.tag !== post.tag),
  ].slice(0, 3);
}

function articleHtml(post, posts = []) {
  let h = `${MAIN}<nav><a href="${ORIGIN}/blog">All posts</a></nav>`;
  h += `<h1>${escHtml(post.title)}</h1>`;
  h += `<p><strong>${escHtml(post.excerpt)}</strong></p>`;
  h += `<p>${escHtml(post.tag)} &middot; ${escHtml(post.displayDate)} &middot; ${post.readMinutes} min read &middot; By ${escHtml(AUTHOR.name)}, ${escHtml(AUTHOR.role)}</p>`;
  if (post.takeaways?.length) {
    h += `<h2>Key takeaways</h2><ul>`;
    for (const t of post.takeaways) h += `<li>${escHtml(t)}</li>`;
    h += `</ul>`;
  }
  for (const s of post.sections) {
    if (s.heading) h += `<h2>${escHtml(s.heading)}</h2>`;
    if (s.paragraphs) for (const p of s.paragraphs) h += `<p>${escHtml(p)}</p>`;
    if (s.bullets) { h += "<ul>"; for (const b of s.bullets) h += `<li>${escHtml(b)}</li>`; h += "</ul>"; }
    if (s.table) {
      h += `<table>`;
      if (s.table.caption) h += `<caption>${escHtml(s.table.caption)}</caption>`;
      h += `<thead><tr>`;
      for (const c of s.table.columns) h += `<th scope="col">${escHtml(c)}</th>`;
      h += `</tr></thead><tbody>`;
      for (const row of s.table.rows) {
        h += `<tr>`;
        for (const cell of row) h += `<td>${escHtml(cell)}</td>`;
        h += `</tr>`;
      }
      h += `</tbody></table>`;
    }
    if (s.callout) h += `<blockquote>${escHtml(s.callout)}</blockquote>`;
  }
  if (post.faqs?.length) {
    h += `<h2>Frequently asked questions</h2><dl>`;
    for (const f of post.faqs) h += `<dt><strong>${escHtml(f.q)}</strong></dt><dd>${escHtml(f.a)}</dd>`;
    h += `</dl>`;
  }
  const productLinks = TAG_LINKS[post.tag] ?? DEFAULT_LINKS;
  if (productLinks.length) {
    h += `<h2>Where this fits in OctaDezx</h2><ul>`;
    for (const l of productLinks) h += `<li><a href="${ORIGIN}${l.to}">${escHtml(l.label)}</a></li>`;
    h += `</ul>`;
  }
  // Post to post links. Without these the raw HTML gives a crawler no path from
  // one article to a sibling, so the topic cluster only exists for readers who
  // run JavaScript. The React page renders the same three.
  const related = relatedPosts(post, posts);
  if (related.length) {
    h += `<h2>Keep reading</h2><ul>`;
    for (const r of related) {
      h += `<li><a href="${ORIGIN}/blog/${r.slug}">${escHtml(r.title)}</a><br>${escHtml(r.excerpt)}</li>`;
    }
    h += `</ul>`;
  }
  h += `<h2>About the author</h2><p><strong>${escHtml(AUTHOR.name)}</strong>, ${escHtml(AUTHOR.role)}. ${escHtml(AUTHOR.bio)}</p>`;
  h += `<p><a href="${ORIGIN}/auth">Start your free trial</a> &middot; <a href="${ORIGIN}/blog">More guides</a></p></main>`;
  return h;
}

function blogPostJsonLd(post) {
  const url = `${ORIGIN}/blog/${post.slug}`;
  const wordCount = post.sections.reduce(
    (n, s) => n + (s.paragraphs?.join(" ").split(/\s+/).length || 0) + (s.bullets?.join(" ").split(/\s+/).length || 0),
    0,
  );
  const blogPosting = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: post.title,
    description: post.excerpt,
    image: { "@type": "ImageObject", url: `${ORIGIN}${post.cover}`, width: 1600, height: 900 },
    datePublished: post.date,
    dateModified: post.date,
    articleSection: post.tag,
    inLanguage: "en",
    isAccessibleForFree: true,
    wordCount,
    keywords: post.keywords,
    articleBody: articleText(post),
    author: {
      "@type": "Organization",
      "@id": `${ORIGIN}/#organization`,
      name: AUTHOR.name,
      url: AUTHOR.url,
      description: AUTHOR.bio,
      knowsAbout: [
        "AI customer care",
        "customer service automation",
        "omnichannel customer support",
        "conversational commerce",
      ],
    },
    publisher: { "@id": `${ORIGIN}/#organization` },
    isPartOf: { "@type": "Blog", "@id": `${ORIGIN}/blog`, name: "The OctaDezx blog" },
    // Same @id as the SoftwareApplication node in index.html, so the article and
    // the product resolve to one entity for anything reading the page.
    about: {
      "@type": "SoftwareApplication",
      "@id": `${ORIGIN}/#software`,
      name: "OctaDezx",
      applicationCategory: "BusinessApplication",
    },
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${ORIGIN}/` },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${ORIGIN}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: url },
    ],
  };
  const graph = [blogPosting, breadcrumb];
  if (post.faqs?.length) {
    graph.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: post.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }
  return `<script type="application/ld+json" data-rh="true">${jsonLd(graph)}</script>`;
}

async function writeRoute(routePath, html) {
  const dir = path.join(DIST, routePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "index.html"), html, "utf8");
}

/** sitemap.xml, generated so a new page or post can never be left out of it. */
function sitemapXml(pages, posts, today) {
  const blogRule = PUBLIC_ROUTES.find((r) => r.dynamic === "blog");
  const entry = (loc, lastmod, changefreq, priority) =>
    `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n` +
    `    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

  const urls = pages.map((p) => entry(p.meta.canonical, today, p.changefreq, p.priority));
  for (const post of posts) {
    urls.push(entry(`${ORIGIN}/blog/${post.slug}`, post.date, blogRule.changefreq, blogRule.priority));
  }
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!-- Generated by scripts/prerender.mjs from scripts/lib/routes.mjs and\n` +
    `     src/content/blogPosts.ts. Do not edit by hand: add the route or the post\n` +
    `     to those sources and it appears here automatically. -->\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`
  );
}

/** Replace the blog link list in llms.txt with one built from BLOG_POSTS. */
function llmsBlogList(posts) {
  const byTag = new Map();
  for (const p of posts) {
    if (!byTag.has(p.tag)) byTag.set(p.tag, []);
    byTag.get(p.tag).push(p);
  }
  let out = "";
  for (const [tag, group] of byTag) {
    out += `\n${tag}:\n`;
    for (const p of group) out += `- ${p.title}: ${ORIGIN}/blog/${p.slug}\n`;
  }
  return out;
}

async function main() {
  let template;
  try {
    template = await fs.readFile(path.join(DIST, "index.html"), "utf8");
  } catch {
    console.error("[prerender] dist/index.html not found. Run `vite build` first.");
    process.exit(1);
  }

  // Routes and their metadata come from src/App.tsx and each page's own
  // PageShell/SEO props, so adding a public page without prerendering it is a
  // build failure rather than a silent homepage duplicate.
  const { pages } = await resolvePublicPages(ROOT);
  const company = await loadTsModule(ROOT, "src/components/site/companyData.ts");
  const blog = await loadBlogContent(ROOT);
  const posts = blog.posts;
  AUTHOR = blog.author;
  PAGE_RELATED = blog.pageRelated;
  TAG_LINKS = blog.tagLinks;
  DEFAULT_LINKS = blog.defaultLinks;

  let count = 0;

  for (const page of pages) {
    const { title, description, canonical } = page.meta;
    let html = applyHead(template, { title, description, canonical });

    if (page.path === "/") {
      // The homepage keeps the hand-written fallback already in index.html; only
      // its head is normalised, so raw and rendered HTML agree.
      await fs.writeFile(path.join(DIST, "index.html"), html, "utf8");
    } else if (page.path === "/blog") {
      let list = `${MAIN}<h1>The OctaDezx blog</h1><p>${escHtml(description)}</p><ul>`;
      for (const post of posts) {
        // No dash separator here: visible site copy never uses em or en dashes.
        list += `<li><a href="${ORIGIN}/blog/${post.slug}">${escHtml(post.title)}</a><br>${escHtml(post.excerpt)}</li>`;
      }
      list += `</ul></main>`;
      await writeRoute(page.out, setFallback(html, list));
    } else {
      const headline = title.split("|")[0].trim();
      const body = page.path === "/privacy" ? await privacyBody(ROOT) : pageBody(page.path, company);
      html = setFallback(html, pageFallback(headline, description, relatedFor(page.path, posts), body));
      await writeRoute(page.out, html);
    }
    count++;
  }

  // /blog/:slug posts
  for (const post of posts) {
    const canonical = `${ORIGIN}/blog/${post.slug}`;
    let html = applyHead(template, {
      title: `${post.title} | OctaDezx`,
      description: post.excerpt,
      canonical,
      keywords: post.keywords,
      ogType: "article",
      ogImage: `${ORIGIN}${post.cover}`,
    });
    html = setFallback(html, articleHtml(post, posts));
    html = injectHead(html, blogPostJsonLd(post));
    await writeRoute(`blog/${post.slug}`, html);
    count++;
  }

  console.log(`[prerender] wrote ${count} route files (${pages.length} pages, ${posts.length} posts).`);

  // sitemap.xml is generated rather than hand-maintained: every blog batch used
  // to need a manual edit here, and a forgotten one is invisible until traffic
  // fails to appear.
  const today = new Date().toISOString().slice(0, 10);
  await fs.writeFile(path.join(DIST, "sitemap.xml"), sitemapXml(pages, posts, today), "utf8");
  console.log(`[prerender] sitemap.xml: ${pages.length + posts.length} urls`);

  // Same reasoning for the blog list inside llms.txt.
  const llmsTxt = path.join(DIST, "llms.txt");
  try {
    const src = await fs.readFile(llmsTxt, "utf8");
    const start = src.indexOf("## Blog: in-depth guides");
    const end = src.indexOf("\n## ", start + 1);
    if (start !== -1) {
      const head =
        "## Blog: in-depth guides\n\nVendor-neutral, practical writing on AI customer care and omnichannel " +
        "support. These answer the questions businesses actually ask and are written to be quoted and cited.\n";
      const rebuilt = src.slice(0, start) + head + llmsBlogList(posts) + (end === -1 ? "\n" : src.slice(end));
      await fs.writeFile(llmsTxt, rebuilt, "utf8");
      console.log(`[prerender] llms.txt: regenerated blog list (${posts.length} posts)`);
    }
  } catch {
    console.warn("[prerender] dist/llms.txt not found, skipped blog list regeneration");
  }

  // llms-full.txt ships from public/ with link lists only. Append the actual
  // article text, generated from the same source the pages render, so an answer
  // engine that prefers this file gets the content itself rather than 29 URLs it
  // then has to go and fetch. Generated at build time so it can never drift.
  const llmsPath = path.join(DIST, "llms-full.txt");
  try {
    let llms = await fs.readFile(llmsPath, "utf8");
    const marker = "\n\n## Full article text\n";
    if (llms.includes(marker.trim())) {
      console.log("[prerender] llms-full.txt already carries full text, skipping");
    } else {
      let body = `${marker}\nThe complete text of every article below, so this file can be used directly as a source. Each entry gives the canonical URL, then the article.\n`;
      for (const post of posts) {
        body += `\n\n### ${post.title}\n`;
        body += `URL: ${ORIGIN}/blog/${post.slug}\n`;
        body += `Published: ${post.date}. Topic: ${post.tag}. Author: ${AUTHOR.name}.\n\n`;
        body += `${articleText(post)}\n`;
      }
      await fs.writeFile(llmsPath, llms + body, "utf8");
      const kb = ((llms.length + body.length) / 1024).toFixed(1);
      console.log(`[prerender] llms-full.txt: inlined ${posts.length} articles, now ${kb}KB`);
    }
  } catch {
    console.warn("[prerender] dist/llms-full.txt not found, skipped full-text append");
  }

  // Gate: read back everything just written and fail the build on a wrong
  // canonical, a homepage title on a sub-page, an empty fallback, unparseable
  // JSON-LD or a stray dash. All of those look fine in a browser.
  await verifySeo([
    ...pages.map((p) => ({ out: p.out, canonical: p.meta.canonical })),
    ...posts.map((p) => ({ out: path.join("blog", p.slug), canonical: `${ORIGIN}/blog/${p.slug}`, isPost: true })),
  ]);
}

main().catch((err) => {
  console.error("[prerender] failed:", err);
  process.exit(1);
});
