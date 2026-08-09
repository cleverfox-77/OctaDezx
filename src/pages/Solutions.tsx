import { Link } from "react-router-dom";
import PageShell from "@/components/site/PageShell";
import { MI } from "@/components/site/MaterialIcon";
import { INDUSTRIES } from "@/components/site/siteData";
import BusinessBreakdown from "@/components/landing/BusinessBreakdown";
import RelatedReading from "@/components/site/RelatedReading";

const NEEDS = [
  { id: "support", icon: "support_agent", tag: "Customer support", title: "Answer every customer, 24/7", desc: "Service questions, prices, order status, returns and policies, resolved instantly in the customer's own language. Only the tricky ones reach your team, with full context." },
  { id: "appointments", icon: "event_available", tag: "Appointments", title: "Book slots right in the chat", desc: "Customers pick a time in conversation and the AI books it around the hours and services you set. Confirmed bookings land in your dashboard, and it does the same thing on a phone call." },
  { id: "vision", icon: "image_search", tag: "Image recognition", title: "Let them send a photo", desc: "A customer can attach a picture instead of describing it. The AI says what it can see, checks it against your catalogue, and tells them honestly when you do not sell that thing." },
  { id: "comments", icon: "reviews", tag: "Comment replies", title: "Reply to comments in public", desc: "When someone comments on your Facebook or Instagram post, the AI replies right there, or privately in their messages, using the same knowledge it uses in chat." },
  { id: "training", icon: "upload_file", tag: "File training", title: "Learn from your files", desc: "Upload a PDF, CSV, price list or a photo of your menu. OctaDezx reads it straight into its knowledge and answers from it within seconds." },
  { id: "growth", icon: "rocket_launch", tag: "Growth via Claude", title: "Run marketing from Claude", desc: "Connect Claude and ask it to analyse your ads, study competitor creative, and draft or publish posts, all through the native OctaDezx MCP server." },
];

const Solutions = () => (
  <PageShell
    title="Solutions | An AI agent for every kind of business"
    description="What OctaDezx actually does for restaurants, clinics, agencies, salons, estate agents, schools, SaaS teams, stores and enterprises. A breakdown per business type, plus appointments, image recognition, comment replies and file training."
    canonical="https://octadezx.com/solutions"
    transparentNav
  >
    {/* Hero */}
    <section className="relative overflow-hidden px-4 sm:px-6 pt-10 sm:pt-16 pb-6">
      <div className="hero-aurora absolute -top-24 left-1/2 -translate-x-1/2" aria-hidden="true" />
      <div className="max-w-[1440px] mx-auto grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
        <div className="reveal-l">
          <span className="label text-[10px] mb-4 inline-block px-3 py-1.5 rounded-full" style={{ color: "#000047", background: "rgba(0,0,71,0.08)", border: "1px solid rgba(0,0,71,0.18)" }}>Solutions</span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 leading-[1.05] tracking-tight mb-5">
            Built for <span className="grad-cyan">how you work</span>
          </h1>
          <p className="text-base sm:text-lg max-w-xl mb-8 leading-relaxed" style={{ color: "#667085" }}>
            The same agent, shaped by the kind of business you run. A restaurant gets a menu and reservations,
            a clinic gets services and appointments, an agency gets lead capture, a store gets orders and shipments.
            Twelve business types, sixteen industries, one platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/auth"><button className="btn-cta text-white px-8 py-4 rounded-2xl text-sm sm:text-base font-bold w-full sm:w-auto">Start free</button></Link>
            <Link to="/pricing"><button className="btn-ghost px-7 py-4 rounded-2xl text-sm sm:text-base font-bold w-full sm:w-auto">See pricing</button></Link>
          </div>
        </div>
        <div className="reveal-r rounded-[2rem] overflow-hidden" style={{ border: "1px solid #e8eaee", boxShadow: "0 2px 6px rgba(16,24,40,0.06), 0 24px 60px rgba(16,24,40,0.12)" }}>
          <img src="/media/solutions-industries.webp" alt="Industries OctaDezx serves" loading="eager" className="w-full block" />
        </div>
      </div>
    </section>

    {/* By need */}
    <section className="py-14 sm:py-24 px-4 sm:px-6 max-w-[1440px] mx-auto">
      <div className="text-center mb-10 sm:mb-14 reveal">
        <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>By need</span>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">One agent, many jobs</h2>
        <p className="max-w-2xl mx-auto text-base" style={{ color: "#667085" }}>Turn on exactly what your business needs. Everything runs from the same trained AI.</p>
      </div>
      <div className="stagger grid grid-cols-1 md:grid-cols-2 gap-5">
        {NEEDS.map((n) => (
          <div key={n.id} id={n.id} className="group rounded-[2rem] p-7 sm:p-8 transition-all hover:-translate-y-1 hover:shadow-lg" style={{ background: "#ffffff", border: "1px solid #e8eaee", scrollMarginTop: "88px" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,0,71,0.08)" }}><MI name={n.icon} className="text-xl transition-transform duration-300 group-hover:scale-110" style={{ color: "#000047" }} /></div>
              <span className="label text-[9px]" style={{ color: "#98a2b3" }}>{n.tag}</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 tracking-tight">{n.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>{n.desc}</p>
          </div>
        ))}
      </div>
    </section>

    {/* The per-business-type breakdown, the substance of this page */}
    <BusinessBreakdown variant="full" />

    {/* By industry */}
    <section id="industries" className="py-14 sm:py-24 px-4 sm:px-6" style={{ background: "#ebedf1", scrollMarginTop: "68px" }}>
      <div className="max-w-[1440px] mx-auto">
        <div className="text-center mb-10 sm:mb-14 reveal">
          <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>By industry</span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">From solo founders to enterprise teams</h2>
          <p className="max-w-2xl mx-auto text-base" style={{ color: "#667085" }}>The dashboard adapts to each type, so you only ever see the tools your business actually uses.</p>
        </div>
        <div className="stagger grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {INDUSTRIES.map((b) => (
            <div key={b.label} className="glass rounded-2xl p-5 transition-all hover:-translate-y-1 hover:shadow-lg">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(0,0,71,0.08)" }}><MI name={b.icon} className="text-lg" style={{ color: "#000047" }} /></div>
              <div className="font-bold text-slate-900 text-sm mb-1">{b.label}</div>
              <p className="text-xs leading-relaxed" style={{ color: "#667085" }}>{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  
    <RelatedReading page="/solutions" heading="How this plays out channel by channel" />

  </PageShell>
);

export default Solutions;
