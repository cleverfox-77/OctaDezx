import { Link } from "react-router-dom";
import { MI } from "@/components/site/MaterialIcon";
import { BLOG_POSTS, PAGE_RELATED_POSTS } from "@/content/blogPosts";

/**
 * Links a marketing page to the articles that go deeper on the same subject.
 *
 * This exists for internal linking as much as for readers: without it the blog
 * posts hang off /blog alone, so nothing on the site points a crawler at an
 * individual article. The matching links are written into the prerendered HTML
 * by scripts/prerender.mjs, which is the copy non-JavaScript fetchers see.
 *
 * Unknown slugs are dropped rather than rendered, so renaming a post degrades to
 * one fewer link instead of a broken one.
 */
const RelatedReading = ({ page, heading = "Read more on this" }: { page: string; heading?: string }) => {
  const posts = (PAGE_RELATED_POSTS[page] ?? [])
    .map((slug) => BLOG_POSTS.find((p) => p.slug === slug))
    .filter((p): p is (typeof BLOG_POSTS)[number] => Boolean(p));

  if (!posts.length) return null;

  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6 max-w-[1440px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8 reveal">
        <div>
          <span className="label text-[10px] mb-3 block" style={{ color: "#000047" }}>From the blog</span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{heading}</h2>
        </div>
        <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: "#000047" }}>
          All articles <MI name="arrow_forward" className="text-base" />
        </Link>
      </div>
      <div className="stagger grid sm:grid-cols-3 gap-5">
        {posts.map((p) => (
          <Link key={p.slug} to={`/blog/${p.slug}`} className="group glass rounded-2xl p-6 flex flex-col">
            <span className="label text-[9px] mb-3" style={{ color: "#000047" }}>{p.tag}</span>
            <h3 className="text-base font-bold text-slate-900 tracking-tight leading-snug mb-2">{p.title}</h3>
            <p className="text-sm leading-relaxed flex-grow" style={{ color: "#667085" }}>{p.excerpt}</p>
            <span className="inline-flex items-center gap-1.5 text-sm font-bold mt-4" style={{ color: "#000047" }}>
              Read <MI name="arrow_forward" className="text-base transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default RelatedReading;
