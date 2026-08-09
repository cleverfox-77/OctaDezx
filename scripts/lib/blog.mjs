/**
 * Loads src/content/blogPosts.ts for the build scripts.
 *
 * blogPosts.ts is the single source for posts, the author identity and the
 * internal-link maps, and it has no runtime imports, so esbuild can transpile it
 * to a temp .mjs that Node can import directly. Reading it here rather than
 * duplicating any of it means the prerendered HTML, the sitemap, llms.txt and
 * the React pages can never disagree about what exists.
 *
 * Shared by scripts/prerender.mjs and scripts/verify-seo.mjs; keeping it in its
 * own module is what stops those two importing each other in a cycle.
 */
import { loadTsModule } from "./load-ts.mjs";

export async function loadBlogContent(root) {
  const mod = await loadTsModule(root, "src/content/blogPosts.ts");
  if (!mod.BLOG_POSTS?.length) throw new Error("[blog] BLOG_POSTS is empty or missing");
  return {
    posts: mod.BLOG_POSTS,
    author: mod.BLOG_AUTHOR ?? { name: "The OctaDezx team", url: "https://octadezx.com/about", role: "", bio: "" },
    pageRelated: mod.PAGE_RELATED_POSTS ?? {},
    tagLinks: mod.TAG_PRODUCT_LINKS ?? {},
    defaultLinks: mod.DEFAULT_PRODUCT_LINKS ?? [],
  };
}
