/**
 * Single source of truth for which routes exist and which of them are public.
 *
 * WHY THIS EXISTS: the prerender step used to keep its own hand-written list of
 * marketing pages. Add a public route to src/App.tsx, forget that list, and the
 * new URL silently serves the homepage shell with a homepage canonical, which
 * tells search engines the page is a duplicate of the homepage. Nothing failed,
 * nothing warned, and you would only find out weeks later from Search Console.
 *
 * So the route list is now READ FROM src/App.tsx and cross-checked against the
 * two declarations below. A route that appears in neither list throws, which
 * turns "forgot to prerender the new page" into a red build.
 *
 * Page metadata (title, description, canonical) is likewise read back out of
 * each page component's own PageShell/SEO props, so there is exactly one place
 * those strings are written.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

export const ORIGIN = "https://octadezx.com";

/**
 * Public routes, in sitemap order. `priority` and `changefreq` carry the values
 * the hand-maintained public/sitemap.xml used, so the generated file matches.
 *
 * `file` is resolved from App.tsx; only the homepage needs an override because
 * it is written to dist/index.html rather than dist/<route>/index.html.
 */
export const PUBLIC_ROUTES = [
  { path: "/",            out: "",            priority: "1.0", changefreq: "weekly"  },
  { path: "/platform",    out: "platform",    priority: "0.9", changefreq: "weekly"  },
  { path: "/solutions",   out: "solutions",   priority: "0.9", changefreq: "weekly"  },
  { path: "/pricing",     out: "pricing",     priority: "0.9", changefreq: "weekly"  },
  { path: "/resources",   out: "resources",   priority: "0.8", changefreq: "weekly"  },
  { path: "/customers",   out: "customers",   priority: "0.7", changefreq: "monthly" },
  { path: "/integrations", out: "integrations", priority: "0.8", changefreq: "monthly" },
  { path: "/about",       out: "about",       priority: "0.8", changefreq: "monthly" },
  { path: "/careers",     out: "careers",     priority: "0.8", changefreq: "weekly"  },
  { path: "/affiliates",  out: "affiliates",  priority: "0.8", changefreq: "monthly" },
  { path: "/privacy",     out: "privacy",     priority: "0.3", changefreq: "yearly"  },
  { path: "/blog",        out: "blog",        priority: "0.8", changefreq: "weekly"  },
  // Rendered once per BLOG_POSTS entry rather than as a single file.
  { path: "/blog/:slug",  dynamic: "blog",    priority: "0.7", changefreq: "monthly" },
];

/**
 * Routes deliberately kept out of the index. This mirrors the Disallow lines in
 * public/robots.txt, plus the app-only routes that are not worth listing there.
 * Keep the two in step: if you make one of these public, remove the Disallow.
 */
export const PRIVATE_ROUTES = new Set([
  "/auth",
  "/authorize",
  "/auth/callback",
  "/dashboard",
  "/chat/:businessId",
  "/reset-password",
  "/verification-completed",
  "/octadezx-admin",
  "*", // NotFound
]);

/** Routes declared in App.tsx, with the page component each one renders. */
export async function readAppRoutes(root) {
  const src = await fs.readFile(path.join(root, "src/App.tsx"), "utf8");

  // component name -> source file, from both the lazy and the eager imports
  const files = new Map();
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\("([^"]+)"\)\)/g)) {
    files.set(m[1], m[2]);
  }
  for (const m of src.matchAll(/^import\s+(\w+)\s+from\s+"(\.\/pages\/[^"]+)"/gm)) {
    files.set(m[1], m[2]);
  }

  // `element={<X />}` and the multi-line `element={\n <Guard>\n <X />` form both
  // start with the same token, which is all we need to resolve the component.
  const routes = [];
  for (const m of src.matchAll(/<Route\s+path="([^"]+)"\s+element=\{\s*<(\w+)/g)) {
    routes.push({ path: m[1], component: m[2], file: files.get(m[2]) ?? null });
  }
  if (!routes.length) {
    throw new Error("[routes] parsed no <Route> elements out of src/App.tsx. Has the routing changed shape?");
  }
  return routes;
}

/**
 * Fail the build when App.tsx and this file disagree. This is the whole point of
 * the module: an unclassified route is almost always a new public page that
 * would otherwise ship as a homepage duplicate.
 */
export function assertRoutesClassified(appRoutes) {
  const known = new Set([...PUBLIC_ROUTES.map((r) => r.path), ...PRIVATE_ROUTES]);
  const unknown = appRoutes.filter((r) => !known.has(r.path));
  if (unknown.length) {
    throw new Error(
      `[routes] ${unknown.length} route(s) in src/App.tsx are not classified: ` +
        unknown.map((r) => r.path).join(", ") +
        "\n  Add each one to PUBLIC_ROUTES (it will be prerendered and put in the sitemap) " +
        "or to PRIVATE_ROUTES (and add a Disallow to public/robots.txt) in scripts/lib/routes.mjs.",
    );
  }
  // The reverse direction: a public route we prerender that no longer exists in
  // the app would 404 for real users while still sitting in the sitemap.
  const inApp = new Set(appRoutes.map((r) => r.path));
  const stale = PUBLIC_ROUTES.filter((r) => !inApp.has(r.path));
  if (stale.length) {
    throw new Error(
      `[routes] PUBLIC_ROUTES lists route(s) that no longer exist in src/App.tsx: ` +
        stale.map((r) => r.path).join(", "),
    );
  }
}

/**
 * Pull title/description/canonical back out of a page component.
 *
 * Every marketing page authors these as literal strings on a PageShell (or, on
 * the homepage, an SEO element), so reading them here means the prerendered head
 * and the rendered head cannot drift apart.
 */
export async function readPageMeta(root, file, routePath) {
  const abs = path.join(root, "src", file.replace(/^\.\//, "")) + ".tsx";
  let src;
  try {
    src = await fs.readFile(abs, "utf8");
  } catch {
    throw new Error(`[routes] ${routePath}: cannot read page source ${abs}`);
  }

  const block = src.match(/<(?:PageShell|SEO)\b[\s\S]{0,1200}?(?:\/>|>)/);
  if (!block) {
    throw new Error(
      `[routes] ${routePath} (${file}) renders no PageShell or SEO element, so it has no title, ` +
        "description or canonical of its own. Wrap the page in PageShell.",
    );
  }
  const grab = (key) => (block[0].match(new RegExp(`\\b${key}="([^"]+)"`)) || [])[1];

  const meta = { title: grab("title"), description: grab("description"), canonical: grab("canonical") };
  for (const [k, v] of Object.entries(meta)) {
    if (!v) {
      throw new Error(
        `[routes] ${routePath} (${file}): could not read a literal ${k}. ` +
          "Prerendering reads these props as text, so they must be plain strings, not variables.",
      );
    }
  }
  const expected = routePath === "/" ? `${ORIGIN}/` : `${ORIGIN}${routePath}`;
  if (meta.canonical !== expected) {
    throw new Error(`[routes] ${routePath}: canonical says ${meta.canonical}, expected ${expected}`);
  }
  return meta;
}

/** Public routes that render to a single file, with their metadata resolved. */
export async function resolvePublicPages(root) {
  const appRoutes = await readAppRoutes(root);
  assertRoutesClassified(appRoutes);

  const byPath = new Map(appRoutes.map((r) => [r.path, r]));
  const pages = [];
  for (const route of PUBLIC_ROUTES) {
    if (route.dynamic) continue;
    const app = byPath.get(route.path);
    if (!app?.file) {
      throw new Error(`[routes] ${route.path}: could not resolve which page component App.tsx renders for it.`);
    }
    pages.push({ ...route, file: app.file, meta: await readPageMeta(root, app.file, route.path) });
  }
  return { pages, appRoutes };
}
