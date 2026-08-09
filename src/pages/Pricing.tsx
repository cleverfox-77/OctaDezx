import { Link } from "react-router-dom";
import PageShell from "@/components/site/PageShell";
import { MI } from "@/components/site/MaterialIcon";
import PricingSection from "@/components/site/PricingSection";
import RelatedReading from "@/components/site/RelatedReading";

const PRICING_FAQS = [
  { q: "Is there a free trial?", a: "Yes, a 24-hour free trial with full access to every feature. No credit card required." },
  { q: "Can I change plans later?", a: "Any time. Upgrade or downgrade from your dashboard, and the change applies immediately." },
  { q: "What counts as a customer?", a: "A unique person who messages your AI in a day. Every plan lists the daily limit up front, so there are no surprises." },
  { q: "Do I need to talk to sales?", a: "No. Every plan, including Enterprise, is fully self-serve. Pick a plan, pay, and go live." },
  { q: "What happens if I go over my limit?", a: "The AI keeps answering; we simply let you know so you can upgrade when it makes sense. Nothing breaks mid-conversation." },
  { q: "Can I cancel anytime?", a: "Yes. Cancel from your dashboard in one click, and you keep access until the end of the period you paid for." },
];

const Pricing = () => (
  <PageShell
    title="Pricing | OctaDezx"
    description="Simple, self-serve pricing for OctaDezx agentic AI customer care. Starter $29, Pro $99, Advanced $199 a month, or Enterprise pay as you go. Every plan has every feature; you choose the volume."
    canonical="https://octadezx.com/pricing"
    transparentNav
  >
    {/* Hero */}
    <section className="relative overflow-hidden px-4 sm:px-6 pt-10 sm:pt-16 pb-0">
      <div className="hero-aurora absolute -top-24 left-1/2 -translate-x-1/2" aria-hidden="true" />
      <div className="max-w-[900px] mx-auto text-center reveal">
        <span className="label text-[10px] mb-4 inline-block px-3 py-1.5 rounded-full" style={{ color: "#000047", background: "rgba(0,0,71,0.08)", border: "1px solid rgba(0,0,71,0.18)" }}>Pricing</span>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 leading-[1.05] tracking-tight mb-5">Pricing that scales with you</h1>
        <p className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: "#667085" }}>
          Start free for 24 hours. Every plan is self-serve, no sales calls. Switch to yearly for two months free.
        </p>
      </div>
    </section>

    <PricingSection />

    {/* Pricing FAQ */}
    <section className="pb-4 sm:pb-10 px-4 sm:px-6 max-w-[1440px] mx-auto">
      <div className="text-center mb-10 reveal">
        <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>Billing questions</span>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Good to know</h2>
      </div>
      <div className="stagger grid sm:grid-cols-2 gap-4 sm:gap-5">
        {PRICING_FAQS.map((f) => (
          <div key={f.q} className="glass rounded-2xl p-6">
            <h3 className="text-base font-bold text-slate-900 mb-2 tracking-tight flex items-start gap-2">
              <MI name="help" className="text-lg flex-shrink-0" style={{ color: "#000047" }} />{f.q}
            </h3>
            <p className="text-sm leading-relaxed ml-7" style={{ color: "#667085" }}>{f.a}</p>
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-slate-500 mt-9">
        Still deciding? <Link to="/resources#demo" className="font-bold" style={{ color: "#000047" }}>Try the live demo</Link> or <Link to="/auth" className="font-bold" style={{ color: "#000047" }}>start your free trial</Link>.
      </p>
    </section>
  
    <RelatedReading page="/pricing" heading="What this actually costs you" />

  </PageShell>
);

export default Pricing;
