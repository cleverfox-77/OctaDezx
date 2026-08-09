import { Link, useParams, Navigate } from "react-router-dom";
import PageShell from "@/components/site/PageShell";
import { MI } from "@/components/site/MaterialIcon";
import { BLOG_POSTS, BLOG_AUTHOR, TAG_PRODUCT_LINKS, DEFAULT_PRODUCT_LINKS, getPost } from "@/content/blogPosts";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPost(slug) : undefined;

  // Unknown slug: send readers to the index rather than a dead end.
  if (!post) return <Navigate to="/blog" replace />;

  const url = `https://octadezx.com/blog/${post.slug}`;

  // Related posts, same topic first. Previously this took the first three posts
  // in the array, which meant every post linked to the same three regardless of
  // subject. Same-tag first keeps the internal links topically relevant, which
  // is what actually passes context to readers and to search engines.
  const others = BLOG_POSTS.filter((p) => p.slug !== post.slug);
  const related = [
    ...others.filter((p) => p.tag === post.tag),
    ...others.filter((p) => p.tag !== post.tag),
  ].slice(0, 3);

  const blogPosting = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: post.title,
    description: post.excerpt,
    image: {
      "@type": "ImageObject",
      url: `https://octadezx.com${post.cover}`,
      width: 1600,
      height: 900,
    },
    datePublished: post.date,
    dateModified: post.date,
    articleSection: post.tag,
    inLanguage: "en",
    isAccessibleForFree: true,
    wordCount: post.sections.reduce(
      (n, s) => n + (s.paragraphs?.join(" ").split(/\s+/).length || 0) + (s.bullets?.join(" ").split(/\s+/).length || 0),
      0,
    ),
    keywords: post.keywords,
    author: {
      "@type": "Organization",
      "@id": "https://octadezx.com/#organization",
      name: BLOG_AUTHOR.name,
      url: BLOG_AUTHOR.url,
      description: BLOG_AUTHOR.bio,
      knowsAbout: [
        "AI customer care",
        "customer service automation",
        "omnichannel customer support",
        "conversational commerce",
      ],
    },
    publisher: { "@id": "https://octadezx.com/#organization" },
    isPartOf: { "@type": "Blog", "@id": "https://octadezx.com/blog", name: "The OctaDezx blog" },
    // Ties the article to the product as an entity rather than as ad copy in the
    // prose. An answer engine reading this knows the piece is about AI customer
    // care AND which software the publisher makes, which is what makes a citation
    // turn into a recommendation. The same @id is on the SoftwareApplication node
    // that SEO.tsx emits on this page, so the two merge into one entity.
    about: {
      "@type": "SoftwareApplication",
      "@id": "https://octadezx.com/#software",
      name: "OctaDezx",
      applicationCategory: "BusinessApplication",
    },
  };

  // FAQPage: Google shows FAQ rich results only for a narrow set of sites now,
  // but the markup is still one of the cleanest question-and-answer formats for
  // AI answer engines to lift and cite, which is the point here.
  const faqPage = post.faqs?.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: post.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }
    : null;

  // Breadcrumb so Google can render Home > Blog > Post in the result, and LLMs
  // can place the article in the site hierarchy.
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://octadezx.com/" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://octadezx.com/blog" },
      { "@type": "ListItem", position: 3, name: post.title, item: url },
    ],
  };

  const jsonLd = faqPage ? [blogPosting, breadcrumb, faqPage] : [blogPosting, breadcrumb];

  return (
    <PageShell
      title={`${post.title} | OctaDezx`}
      description={post.excerpt}
      canonical={url}
      image={`https://octadezx.com${post.cover}`}
      type="article"
      jsonLd={jsonLd}
      transparentNav
    >
      <article>
        {/* Header */}
        <header className="relative overflow-hidden px-4 sm:px-6 pt-10 sm:pt-14 pb-8">
          <div className="hero-aurora absolute -top-24 left-1/2 -translate-x-1/2" aria-hidden="true" />
          <div className="max-w-[760px] mx-auto reveal">
            <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm font-bold mb-7" style={{ color: "#000047" }}>
              <MI name="arrow_back" className="text-base" /> All posts
            </Link>
            <div className="flex flex-wrap items-center gap-2.5 text-xs mb-5" style={{ color: "#98a2b3" }}>
              <span className="font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(0,0,71,0.07)", color: "#000047" }}>{post.tag}</span>
              <span>{post.displayDate}</span>
              <span aria-hidden="true">&middot;</span>
              <span>{post.readMinutes} min read</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 leading-[1.1] tracking-tight mb-5">{post.title}</h1>
            <p className="text-base sm:text-lg leading-relaxed" style={{ color: "#667085" }}>{post.excerpt}</p>
            <div className="flex items-center gap-3 mt-6 pt-6 border-t" style={{ borderColor: "#e8eaee" }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,0,71,0.07)" }}>
                <MI name="groups" className="text-lg" style={{ color: "#000047" }} />
              </div>
              <div className="text-sm">
                <span className="font-bold text-slate-900">{BLOG_AUTHOR.name}</span>
                <span style={{ color: "#98a2b3" }}> &middot; {BLOG_AUTHOR.role}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="px-4 sm:px-6 max-w-[900px] mx-auto">
          <div className="rounded-[2rem] overflow-hidden reveal-s" style={{ boxShadow: "0 2px 6px rgba(16,24,40,0.06), 0 24px 60px rgba(16,24,40,0.14)" }}>
            <img src={post.cover} alt={post.coverAlt ?? post.title} loading="eager" className="w-full h-auto object-cover" />
          </div>
        </div>

        {/* Key takeaways: the short answer up front, for readers who will not
            scroll and for answer engines that lift the summary as the answer. */}
        {post.takeaways?.length ? (
          <div className="px-4 sm:px-6 max-w-[760px] mx-auto pt-12 sm:pt-16">
            <aside className="glass rounded-2xl p-6 sm:p-7" aria-labelledby="key-takeaways">
              <h2 id="key-takeaways" className="label text-[10px] mb-4" style={{ color: "#000047" }}>Key takeaways</h2>
              <ul className="space-y-3">
                {post.takeaways.map((t, i) => (
                  <li key={i} className="flex items-start gap-3 text-[15px] leading-[1.65]" style={{ color: "#475467" }}>
                    <MI name="bolt" className="text-lg flex-shrink-0 mt-0.5" style={{ color: "#000047" }} />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        ) : null}

        {/* Body */}
        <div className="px-4 sm:px-6 max-w-[760px] mx-auto py-12 sm:py-16">
          {post.sections.map((s, i) => (
            <section key={i} className="mb-9 last:mb-0">
              {s.heading && (
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-4 mt-2">{s.heading}</h2>
              )}
              {s.paragraphs?.map((p, j) => (
                <p key={j} className="text-[15px] sm:text-base leading-[1.75] mb-4" style={{ color: "#475467" }}>{p}</p>
              ))}
              {s.bullets && (
                <ul className="space-y-3 my-5">
                  {s.bullets.map((b, j) => (
                    <li key={j} className="flex items-start gap-3 text-[15px] sm:text-base leading-[1.7]" style={{ color: "#475467" }}>
                      <MI name="check_circle" className="text-lg flex-shrink-0 mt-0.5" style={{ color: "#000047" }} />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
              {s.table && (
                <figure className="my-7">
                  <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid #e8eaee" }}>
                    <table className="w-full text-left border-collapse text-[14px] sm:text-[15px]">
                      {s.table.caption && <caption className="sr-only">{s.table.caption}</caption>}
                      <thead>
                        <tr style={{ background: "rgba(0,0,71,0.04)" }}>
                          {s.table.columns.map((c, k) => (
                            <th key={k} scope="col" className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {s.table.rows.map((row, r) => (
                          <tr key={r} style={{ borderTop: "1px solid #e8eaee" }}>
                            {row.map((cell, c) => (
                              <td key={c} className={`px-4 py-3 align-top leading-[1.6] ${c === 0 ? "font-semibold text-slate-900" : ""}`}
                                style={c === 0 ? undefined : { color: "#475467" }}>
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </figure>
              )}
              {s.callout && (
                <blockquote className="my-7 rounded-2xl px-6 py-5 text-[15px] sm:text-base font-medium leading-relaxed text-slate-900"
                  style={{ background: "rgba(0,0,71,0.05)", borderLeft: "3px solid #000047" }}>
                  {s.callout}
                </blockquote>
              )}
            </section>
          ))}

          {/* FAQs: plain question and answer pairs, mirrored in FAQPage JSON-LD.
              This is the format answer engines quote most reliably. */}
          {post.faqs?.length ? (
            <section className="mt-14 pt-10 border-t" style={{ borderColor: "#e8eaee" }}>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-6">Frequently asked questions</h2>
              <div className="space-y-5">
                {post.faqs.map((f, i) => (
                  <div key={i} className="glass rounded-2xl p-5 sm:p-6">
                    <h3 className="text-base font-bold text-slate-900 mb-2 leading-snug">{f.q}</h3>
                    <p className="text-[15px] leading-[1.7]" style={{ color: "#475467" }}>{f.a}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Topical links back into the product. Chosen by tag so the pointer
              matches what the reader just read, rather than sending everyone to
              the same page. Also gives the marketing pages an inbound path from
              the writing, which the blog previously had in one direction only. */}
          <div className="mt-12 rounded-2xl p-5 sm:p-6" style={{ background: "#f8fafc", border: "1px solid #e8eaee" }}>
            <div className="label text-[10px] mb-3" style={{ color: "#000047" }}>Where this fits in OctaDezx</div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {(TAG_PRODUCT_LINKS[post.tag] ?? DEFAULT_PRODUCT_LINKS).map((l) => (
                <Link key={l.to} to={l.to} className="text-sm font-bold inline-flex items-center gap-1.5" style={{ color: "#000047" }}>
                  {l.label} <MI name="arrow_forward" className="text-base" />
                </Link>
              ))}
            </div>
          </div>

          {/* Author / E-E-A-T: say plainly who wrote this and why they would know. */}
          <aside className="mt-12 rounded-2xl p-6 sm:p-7 flex flex-col sm:flex-row gap-5" style={{ background: "rgba(0,0,71,0.04)", border: "1px solid #e8eaee" }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#000047" }}>
              <MI name="groups" className="text-2xl" style={{ color: "#ffffff" }} />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 mb-1">About {BLOG_AUTHOR.name}</div>
              <p className="text-[14px] leading-[1.7] mb-3" style={{ color: "#475467" }}>{BLOG_AUTHOR.bio}</p>
              <Link to="/about" className="text-sm font-bold inline-flex items-center gap-1.5" style={{ color: "#000047" }}>
                More about the company <MI name="arrow_forward" className="text-base" />
              </Link>
            </div>
          </aside>

          {/* Inline product nudge */}
          <div className="glass rounded-3xl p-7 sm:p-9 mt-12 text-center">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mb-2">See it working on your own catalogue</h3>
            <p className="text-sm leading-relaxed mb-6 max-w-lg mx-auto" style={{ color: "#667085" }}>
              Paste a storefront URL, connect a channel, and watch the AI answer real questions about your real products. Free for
              24 hours, no card needed.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/auth"><button className="btn-cta text-white px-6 py-3 rounded-xl text-sm font-bold tracking-tight">Start free</button></Link>
              <Link to="/resources#demo"><button className="btn-ghost px-6 py-3 rounded-xl text-sm font-bold tracking-tight">Try the live demo</button></Link>
            </div>
          </div>
        </div>
      </article>

      {/* Related */}
      <section className="pb-14 sm:pb-20 px-4 sm:px-6 max-w-[1440px] mx-auto">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-7 text-center">Keep reading</h2>
        <div className="stagger grid sm:grid-cols-3 gap-5">
          {related.map((p) => (
            <Link key={p.slug} to={`/blog/${p.slug}`} className="group glass rounded-2xl overflow-hidden flex flex-col">
              <div className="h-36 overflow-hidden flex-shrink-0">
                <img src={p.cover} alt={p.coverAlt ?? p.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.05]" />
              </div>
              <div className="p-5 flex flex-col flex-grow">
                <div className="label text-[9px] mb-2" style={{ color: "#000047" }}>{p.tag}</div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight leading-snug flex-grow">{p.title}</h3>
                <span className="text-xs font-semibold mt-3" style={{ color: "#98a2b3" }}>{p.readMinutes} min read</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </PageShell>
  );
};

export default BlogPost;
