import { Link } from "react-router-dom";
import PageShell from "@/components/site/PageShell";
import { MI, DEMO_CHAT_URL } from "@/components/site/MaterialIcon";
import { FAQS } from "@/components/site/siteData";
import AmbientVideo from "@/components/landing/AmbientVideo";
import RelatedReading from "@/components/site/RelatedReading";

const Resources = () => (
  <PageShell
    title="Resources | OctaDezx"
    description="Try the live demo, read customer stories and get every question answered about running customer support and sales on OctaDezx."
    canonical="https://octadezx.com/resources"
    transparentNav
  >
    {/* Hero */}
    <section className="relative overflow-hidden px-4 sm:px-6 pt-10 sm:pt-16 pb-6">
      <div className="hero-aurora absolute -top-24 left-1/2 -translate-x-1/2" aria-hidden="true" />
      <div className="max-w-[900px] mx-auto text-center reveal">
        <span className="label text-[10px] mb-4 inline-block px-3 py-1.5 rounded-full" style={{ color: "#000047", background: "rgba(0,0,71,0.08)", border: "1px solid rgba(0,0,71,0.18)" }}>Resources</span>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 leading-[1.05] tracking-tight mb-5">See it, then decide</h1>
        <p className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: "#667085" }}>
          Chat with a real AI-powered store, browse customer stories, and get every question answered before you sign up.
        </p>
      </div>
    </section>

    {/* Live demo */}
    <section id="demo" className="py-14 sm:py-24 px-4 sm:px-6 max-w-[1180px] mx-auto" style={{ scrollMarginTop: "68px" }}>
      <div className="reveal-s grid lg:grid-cols-2 gap-8 items-center">
        <div className="rounded-[2rem] overflow-hidden relative" style={{ border: "1px solid #e8eaee", boxShadow: "0 2px 6px rgba(16,24,40,0.06), 0 24px 60px rgba(16,24,40,0.14)" }}>
          <AmbientVideo src="/media/loop-hero.mp4" poster="/media/hero-chat.webp" label="OctaDezx resolving and confirming an order" className="w-full block" />
        </div>
        <div>
          <span className="label text-[10px] mb-3 flex items-center gap-2" style={{ color: "#16a34a" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 status-pulse inline-block" /> Live and working, no account needed
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4 tracking-tight">Try it yourself, right now</h2>
          <p className="text-base leading-relaxed mb-6" style={{ color: "#667085" }}>
            Chat with <strong className="text-slate-900">Merrell</strong>, a real premium leather shoe store powered by OctaDezx. Ask about products, prices, or place an order. It all works.
          </p>
          <Link to={DEMO_CHAT_URL}>
            <button className="btn-cta text-white py-4 px-8 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5"><MI name="chat" className="text-xl" />Start chatting with Merrell →</button>
          </Link>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            {[["lock", "Anonymous session"], ["bolt", "Real AI responses"], ["shopping_bag", "Actual product catalog"]].map(([i, t]) => (
              <span key={t} className="flex items-center gap-1.5 text-xs" style={{ color: "#667085" }}><MI name={i} className="text-sm flex-shrink-0" style={{ color: "#000047" }} />{t}</span>
            ))}
          </div>
        </div>
      </div>
    </section>

    {/* FAQ */}
    <section id="faq" className="py-14 sm:py-24 px-4 sm:px-6 max-w-[1440px] mx-auto" style={{ scrollMarginTop: "68px" }}>
      <div className="text-center mb-10 sm:mb-14 reveal">
        <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>FAQ</span>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">Questions, answered</h2>
        <p className="max-w-xl mx-auto text-base" style={{ color: "#667085" }}>Everything you need to know about running customer support and sales on OctaDezx.</p>
      </div>
      <div className="stagger grid sm:grid-cols-2 gap-4 sm:gap-5">
        {FAQS.map((f) => (
          <div key={f.q} className="glass rounded-2xl p-6">
            <h3 className="text-base font-bold text-slate-900 mb-2 tracking-tight">{f.q}</h3>
            <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>{f.a}</p>
          </div>
        ))}
      </div>
    </section>
  
    <RelatedReading page="/resources" heading="Guides to get you started" />

  </PageShell>
);

export default Resources;
