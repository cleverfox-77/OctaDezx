import { Link } from "react-router-dom";
import PageShell from "@/components/site/PageShell";
import { MI, DEMO_CHAT_URL } from "@/components/site/MaterialIcon";
import { CAPABILITIES } from "@/components/site/siteData";
import AmbientVideo from "@/components/landing/AmbientVideo";
import AgenticActions from "@/components/landing/AgenticActions";
import ImageRecognition from "@/components/landing/ImageRecognition";
import VoiceSection from "@/components/landing/VoiceSection";
import RelatedReading from "@/components/site/RelatedReading";

const STEPS = [
  { n: "01", title: "Describe your business", desc: "Pick your business type and answer a few questions in plain English. Selling products? Paste a storefront address or drop a CSV and the catalogue structures itself.", icon: "edit_note" },
  { n: "02", title: "Train the AI", desc: "Set tone, policies and escalation rules in plain language. No scripts, no engineers.", icon: "psychology" },
  { n: "03", title: "Connect and go live", desc: "Flip on WhatsApp, Instagram, Facebook, Telegram or your web widget. One agent on every channel.", icon: "rocket_launch" },
];

const Platform = () => (
  <PageShell
    title="Platform | Agentic AI for customer care"
    description="An agentic AI platform for any business: it places orders, books appointments, answers the phone, reads photos customers send, replies to comments, follows up leads and ships a native Claude MCP server."
    canonical="https://octadezx.com/platform"
    transparentNav
  >
    {/* Hero */}
    <section className="relative overflow-hidden px-4 sm:px-6 pt-10 sm:pt-16 pb-6">
      <div className="hero-aurora absolute -top-24 left-1/2 -translate-x-1/2" aria-hidden="true" />
      <div className="max-w-[1440px] mx-auto grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
        <div className="reveal-l">
          <span className="label text-[10px] mb-4 inline-block px-3 py-1.5 rounded-full"
            style={{ color: "#000047", background: "rgba(0,0,71,0.08)", border: "1px solid rgba(0,0,71,0.18)" }}>The platform</span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 leading-[1.05] tracking-tight mb-5">
            One AI agent that <span className="grad-cyan">does the work</span>
          </h1>
          <p className="text-base sm:text-lg max-w-xl mb-8 leading-relaxed" style={{ color: "#667085" }}>
            OctaDezx answers your customers on every channel and then acts: it books the appointment,
            places the order, answers the phone and follows up the lead. Your team only sees what
            genuinely needs a person, with the whole conversation attached.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/auth"><button className="btn-cta text-white px-8 py-4 rounded-2xl text-sm sm:text-base font-bold w-full sm:w-auto">Try free for 24 hours</button></Link>
            <Link to={DEMO_CHAT_URL}><button className="btn-ghost px-7 py-4 rounded-2xl text-sm sm:text-base font-bold flex items-center justify-center gap-2 w-full sm:w-auto"><MI name="chat" style={{ color: "#000047" }} />Live demo</button></Link>
          </div>
        </div>
        <div className="reveal-r rounded-[2rem] overflow-hidden" style={{ border: "1px solid #e8eaee", boxShadow: "0 2px 6px rgba(16,24,40,0.06), 0 24px 60px rgba(16,24,40,0.12)" }}>
          <AmbientVideo src="/media/loop-product.mp4" poster="/media/loop-product-poster.webp" label="OctaDezx dashboard in motion" className="w-full block" />
        </div>
      </div>
    </section>

    {/* What separates an agent from a chatbot */}
    <AgenticActions variant="strip" />

    {/* Image recognition */}
    <ImageRecognition />

    {/* AI phone calls */}
    <VoiceSection />

    {/* Capabilities */}
    <section id="capabilities" className="py-14 sm:py-24 px-4 sm:px-6 max-w-[1440px] mx-auto">
      <div className="text-center mb-10 sm:mb-14 reveal">
        <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>Capabilities</span>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">Everything a business needs answered</h2>
        <p className="max-w-2xl mx-auto text-base" style={{ color: "#667085" }}>Whether you take bookings, take orders or just take questions, it runs non-stop while you get on with the business.</p>
      </div>
      <div className="stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {CAPABILITIES.map((c) => (
          <div key={c.title} className="bento rounded-[2rem] p-7 group" style={{ background: "#ffffff", border: "1px solid #e8eaee" }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(0,0,71,0.08)" }}>
              <MI name={c.icon} className="text-xl transition-transform duration-300 group-hover:scale-110" style={{ color: "#000047" }} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2 tracking-tight">{c.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>{c.desc}</p>
          </div>
        ))}
      </div>
    </section>

    {/* How it works */}
    <section id="how" className="py-14 sm:py-24 px-4 sm:px-6" style={{ background: "#ebedf1" }}>
      <div className="max-w-[1440px] mx-auto">
        <div className="text-center mb-10 sm:mb-14 reveal">
          <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>Quick start</span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">Live in under 10 minutes</h2>
          <p className="max-w-xl mx-auto text-base" style={{ color: "#667085" }}>No developers, no integration team. Three steps.</p>
        </div>
        <div className="stagger grid sm:grid-cols-3 gap-4 sm:gap-5">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-[2rem] p-7 sm:p-8 flex flex-col" style={{ background: "#ffffff", border: "1px solid #e8eaee" }}>
              <div className="flex items-center justify-between mb-5">
                <span className="text-5xl font-black leading-none select-none" style={{ color: "rgba(15,23,42,0.07)" }}>{s.n}</span>
                <div className="p-2.5 rounded-xl" style={{ background: "rgba(0,0,71,0.08)" }}><MI name={s.icon} className="text-xl" style={{ color: "#000047" }} /></div>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2 tracking-tight">{s.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Claude MCP */}
    <section id="claude" className="py-14 sm:py-24 relative overflow-hidden" style={{ background: "linear-gradient(180deg, #0b0b2e 0%, #000047 100%)" }}>
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />
      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div className="reveal-l">
          <span className="label text-[10px] mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ color: "#b4c5ff", background: "rgba(180,197,255,0.1)", border: "1px solid rgba(180,197,255,0.25)" }}>
            <MI name="smart_toy" className="text-sm" /> Native MCP server
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-5 tracking-tight">Run your business from inside Claude</h2>
          <p className="text-base leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.75)" }}>
            Connect Claude to your business at <a href="/mcp" target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-1 rounded-md hover:underline" style={{ background: "rgba(255,255,255,0.1)", color: "#b4c5ff" }}>octadezx.com/mcp</a> and manage everything in plain language.
          </p>
          <ul className="space-y-3">
            {["List escalated chats and reply to customers", "Check orders, book appointments and reply to comments", "Analyse ads, study competitor creative and publish posts", "Teach the knowledge base, all from one chat"].map((t) => (
              <li key={t} className="flex items-start gap-3 text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
                <MI name="check_circle" className="text-base flex-shrink-0 mt-[1px]" style={{ color: "#4ade80" }} />{t}
              </li>
            ))}
          </ul>
        </div>
        <div className="reveal-r rounded-[1.5rem] p-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <div className="flex items-center gap-2.5 pb-3 mb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#d97757" }} />
            <span className="text-xs font-semibold text-white/80">Claude</span>
            <span className="label text-[8px] ml-auto px-2 py-0.5 rounded-full" style={{ color: "#b4c5ff", background: "rgba(180,197,255,0.1)" }}>OctaDezx connected</span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-end"><div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md text-sm text-white" style={{ background: "rgba(255,255,255,0.12)" }}>Any customers waiting on us?</div></div>
            <div className="flex items-center gap-2 text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}><MI name="build" className="text-xs" /><span className="font-mono">list_escalated_chats</span></div>
            <div className="flex justify-start"><div className="max-w-[90%] px-4 py-3 rounded-2xl rounded-bl-md text-sm leading-relaxed" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.85)" }}>Two customers are waiting: <strong className="text-white">Sofia</strong> (refund, 12 min) and <strong className="text-white">James</strong> (bulk pricing, 34 min). Want me to draft replies?</div></div>
          </div>
        </div>
      </div>
    </section>

    {/* Integrations + follow-ups strip */}
    <section id="integrations" className="py-14 sm:py-24 px-4 sm:px-6 max-w-[1440px] mx-auto">
      <div className="grid lg:grid-cols-2 gap-6">
        <div id="followups" className="reveal-l rounded-[2rem] p-8 sm:p-10 flex flex-col justify-between" style={{ background: "#ffffff", border: "1px solid #e8eaee" }}>
          <div>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ background: "rgba(0,0,71,0.08)" }}><MI name="person_add" className="text-xl" style={{ color: "#000047" }} /></div>
            <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Follow-ups & lead outreach</h3>
            <p className="text-sm sm:text-base leading-relaxed mb-6" style={{ color: "#667085" }}>Every customer who shares a name or email becomes a lead. The AI follows your plain-language playbook, and you re-engage with one click, straight into their existing chat thread.</p>
          </div>
          <Link to="/solutions#support" className="text-sm font-bold inline-flex items-center gap-1" style={{ color: "#000047" }}>Explore solutions <MI name="arrow_forward" className="text-base" /></Link>
        </div>
        <div className="reveal-r rounded-[2rem] p-8 sm:p-10 flex flex-col justify-between" style={{ background: "#ffffff", border: "1px solid #e8eaee" }}>
          <div>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ background: "rgba(0,0,71,0.08)" }}><MI name="hub" className="text-xl" style={{ color: "#000047" }} /></div>
            <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Connected to everything</h3>
            <p className="text-sm sm:text-base leading-relaxed mb-6" style={{ color: "#667085" }}>WhatsApp, Instagram, Facebook, Telegram, Shopify, WooCommerce and 90+ more, synced in real time so the AI answers wherever your customers already are.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["WhatsApp", "Instagram", "Facebook", "Shopify", "Telegram", "Gmail"].map((t) => (
              <span key={t} className="px-3 py-1 rounded-full label text-[10px] text-slate-600" style={{ background: "#f2f4f7", border: "1px solid #e8eaee" }}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  
    <RelatedReading page="/platform" heading="Go deeper on how the AI works" />

  </PageShell>
);

export default Platform;
