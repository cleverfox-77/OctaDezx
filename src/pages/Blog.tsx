import { Link } from "react-router-dom";
import PageShell from "@/components/site/PageShell";
import { MI } from "@/components/site/MaterialIcon";
import { BLOG_POSTS } from "@/content/blogPosts";

const BLOG_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Blog",
  "@id": "https://octadezx.com/blog",
  name: "The OctaDezx blog",
  description: "Practical writing on AI customer care, support automation and turning conversations into revenue.",
  publisher: { "@id": "https://octadezx.com/#organization" },
  blogPost: BLOG_POSTS.map((p) => ({
    "@type": "BlogPosting",
    headline: p.title,
    description: p.excerpt,
    datePublished: p.date,
    url: `https://octadezx.com/blog/${p.slug}`,
    image: `https://octadezx.com${p.cover}`,
    author: { "@type": "Organization", name: p.author },
  })),
};

const BLOG_BREADCRUMB = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://octadezx.com/" },
    { "@type": "ListItem", position: 2, name: "Blog", item: "https://octadezx.com/blog" },
  ],
};

const Meta = ({ tag, date, mins }: { tag: string; date: string; mins: number }) => (
  <div className="flex flex-wrap items-center gap-2.5 text-xs" style={{ color: "#98a2b3" }}>
    <span className="font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(0,0,71,0.07)", color: "#000047" }}>{tag}</span>
    <span>{date}</span>
    <span aria-hidden="true">&middot;</span>
    <span>{mins} min read</span>
  </div>
);

const Blog = () => {
  const [featured, ...rest] = BLOG_POSTS;

  return (
    <PageShell
      title="Blog | OctaDezx"
      description="Practical writing on AI customer care: what actually automates, how to train a support agent on your catalogue, when to escalate to a human, and the metrics that tell you it is working."
      canonical="https://octadezx.com/blog"
      jsonLd={[BLOG_JSONLD, BLOG_BREADCRUMB]}
      transparentNav
    >
      {/* Hero */}
      <section className="relative overflow-hidden px-4 sm:px-6 pt-10 sm:pt-16 pb-4">
        <div className="hero-aurora absolute -top-24 left-1/2 -translate-x-1/2" aria-hidden="true" />
        <div className="max-w-[900px] mx-auto text-center reveal">
          <span className="label text-[10px] mb-4 inline-block px-3 py-1.5 rounded-full" style={{ color: "#000047", background: "rgba(0,0,71,0.08)", border: "1px solid rgba(0,0,71,0.18)" }}>Blog</span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 leading-[1.05] tracking-tight mb-5">
            Writing on customer care AI
          </h1>
          <p className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: "#667085" }}>
            What actually automates, what does not, and how to run an AI support agent without creating more work than it saves.
            No hype, no vendor maths.
          </p>
        </div>
      </section>

      {/* Featured */}
      <section className="py-10 sm:py-14 px-4 sm:px-6 max-w-[1440px] mx-auto">
        <Link to={`/blog/${featured.slug}`} className="group block cta-card rounded-3xl overflow-hidden reveal-s">
          <div className="grid lg:grid-cols-2">
            <div className="relative h-56 sm:h-72 lg:h-full min-h-[220px] overflow-hidden">
              <img src={featured.cover} alt={featured.coverAlt ?? featured.title} loading="eager" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
            </div>
            <div className="p-7 sm:p-10 flex flex-col justify-center">
              <div className="mb-4"><Meta tag={featured.tag} date={featured.displayDate} mins={featured.readMinutes} /></div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight mb-4">{featured.title}</h2>
              <p className="text-sm sm:text-base leading-relaxed mb-6" style={{ color: "#667085" }}>{featured.excerpt}</p>
              <span className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: "#000047" }}>
                Read it <MI name="arrow_forward" className="text-base transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </div>
        </Link>
      </section>

      {/* Grid */}
      <section className="pb-14 sm:pb-20 px-4 sm:px-6 max-w-[1440px] mx-auto">
        <div className="stagger grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {rest.map((p) => (
            <Link key={p.slug} to={`/blog/${p.slug}`} className="group glass rounded-3xl overflow-hidden flex flex-col">
              <div className="h-44 overflow-hidden flex-shrink-0">
                <img src={p.cover} alt={p.coverAlt ?? p.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.05]" />
              </div>
              <div className="p-6 flex flex-col flex-grow">
                <div className="mb-3"><Meta tag={p.tag} date={p.displayDate} mins={p.readMinutes} /></div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-snug mb-2.5">{p.title}</h2>
                <p className="text-sm leading-relaxed flex-grow" style={{ color: "#667085" }}>{p.excerpt}</p>
                <span className="inline-flex items-center gap-1.5 text-sm font-bold mt-5" style={{ color: "#000047" }}>
                  Read <MI name="arrow_forward" className="text-base transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </PageShell>
  );
};

export default Blog;
