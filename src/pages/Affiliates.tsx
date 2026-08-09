import { useState } from "react";
import PageShell from "@/components/site/PageShell";
import { MI } from "@/components/site/MaterialIcon";
import ApplicationForm from "@/components/site/ApplicationForm";
import { COMPANY, AFFILIATE, AFFILIATE_PERKS, AFFILIATE_TIERS, AFFILIATE_STEPS, AFFILIATE_FAQS } from "@/components/site/companyData";
import { PLANS as PRICING_PLANS } from "@/lib/plans";

// Only the plans with a fixed monthly price can be put through a commission
// calculator. Enterprise is metered, so its commission depends on what the
// customer actually uses and is quoted case by case.
const PLANS = PRICING_PLANS
  .filter((p) => p.monthly != null)
  .map((p) => ({ id: p.key, label: p.name, price: p.monthly as number }));

const money = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

// Live earnings calculator. Deliberately simple: pick a plan, drag the number
// of accounts, see what 30% recurring actually looks like.
const Calculator = () => {
  const [count, setCount] = useState(15);
  const [plan, setPlan] = useState(PLANS[1]);

  const monthly = count * plan.price * (AFFILIATE.rate / 100);
  const yearly = monthly * 12;
  const bonus = count >= 50 ? 1000 : count >= 25 ? 350 : count >= 10 ? 100 : 0;

  return (
    <div className="glass rounded-3xl p-7 sm:p-10">
      <div className="grid lg:grid-cols-2 gap-9 lg:gap-12 items-center">
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-6">What could you earn?</h3>

          <label className="label text-[9px] block mb-3" style={{ color: "#98a2b3" }}>Plan your referrals choose</label>
          <div className="grid grid-cols-2 gap-2 mb-7">
            {PLANS.map((p) => (
              <button key={p.id} type="button" onClick={() => setPlan(p)}
                className="rounded-xl px-4 py-3 text-sm font-bold transition-all text-left"
                style={plan.id === p.id
                  ? { background: "#000047", color: "#ffffff", border: "1px solid #000047" }
                  : { background: "#ffffff", color: "#0f172a", border: "1px solid #e8eaee" }}>
                {p.label}
                <span className="block text-xs font-medium opacity-70">${p.price}/mo</span>
              </button>
            ))}
          </div>

          <div className="flex items-baseline justify-between mb-3">
            <label htmlFor="ref-count" className="label text-[9px]" style={{ color: "#98a2b3" }}>Active referrals</label>
            <span className="text-lg font-black text-slate-900">{count}</span>
          </div>
          <input id="ref-count" type="range" min={1} max={100} value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-full accent-[#000047] cursor-pointer" />
          <div className="flex justify-between text-xs mt-1.5" style={{ color: "#98a2b3" }}>
            <span>1</span><span>100</span>
          </div>
        </div>

        <div className="rounded-2xl p-7 sm:p-8 text-center" style={{ background: "#000047" }}>
          <div className="label text-[9px] mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>Recurring, every month</div>
          <div className="text-5xl sm:text-6xl font-black text-white tracking-tight mb-1">{money(monthly)}</div>
          <div className="text-sm mb-7" style={{ color: "rgba(255,255,255,0.6)" }}>
            {AFFILIATE.rate}% of {count} {plan.label} {count === 1 ? "account" : "accounts"}
          </div>
          <div className="grid grid-cols-2 gap-px rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.14)" }}>
            <div className="py-4 px-3" style={{ background: "#000047" }}>
              <div className="text-xl font-black text-white">{money(yearly)}</div>
              <div className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>Over 12 months</div>
            </div>
            <div className="py-4 px-3" style={{ background: "#000047" }}>
              <div className="text-xl font-black text-white">{bonus ? money(bonus) : "Not yet"}</div>
              <div className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>Tier bonus</div>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed mt-6" style={{ color: "rgba(255,255,255,0.45)" }}>
            An estimate based on published plan prices. Commission keeps paying for as long as each account stays subscribed.
          </p>
        </div>
      </div>
    </div>
  );
};

const AFFILIATE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: AFFILIATE_FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const Affiliates = () => (
  <PageShell
    title="Affiliate programme | OctaDezx"
    description="Earn 30% recurring commission on every payment, for as long as your referrals stay. Your audience gets 10% off with your code, plus cash bonuses at 10, 25 and 50 accounts. Apply in two minutes."
    canonical="https://octadezx.com/affiliates"
    jsonLd={AFFILIATE_JSONLD}
    transparentNav
  >
    {/* Hero */}
    <section className="relative overflow-hidden px-4 sm:px-6 pt-10 sm:pt-16 pb-6">
      <div className="hero-aurora absolute -top-24 left-1/2 -translate-x-1/2" aria-hidden="true" />
      <div className="max-w-[900px] mx-auto text-center reveal">
        <span className="label text-[10px] mb-4 inline-block px-3 py-1.5 rounded-full" style={{ color: "#000047", background: "rgba(0,0,71,0.08)", border: "1px solid rgba(0,0,71,0.18)" }}>Affiliate programme</span>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 leading-[1.05] tracking-tight mb-5">
          Earn <span style={{ color: "#000047" }}>{AFFILIATE.rate}% recurring</span>, for as long as they stay
        </h1>
        <p className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-8" style={{ color: "#667085" }}>
          Not a one off bounty. Every payment your referral makes pays you {AFFILIATE.rate}%, every single month, with no cap and
          no exclusivity. Your audience gets {AFFILIATE.audienceDiscount}% off with your code, so you are handing them a genuine
          discount rather than a bare link.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          <a href="#apply"><button className="btn-cta text-white px-6 py-3 rounded-xl text-sm font-bold tracking-tight">Become a partner</button></a>
          <a href="#calculator"><button className="btn-ghost px-6 py-3 rounded-xl text-sm font-bold tracking-tight">Work out your earnings</button></a>
        </div>

        <div className="stagger grid grid-cols-2 lg:grid-cols-4 gap-px max-w-3xl mx-auto" style={{ background: "#e8eaee", borderRadius: "20px", overflow: "hidden", border: "1px solid #e8eaee" }}>
          {[
            { v: `${AFFILIATE.rate}%`, l: "Recurring commission" },
            { v: "Lifetime", l: "For as long as they stay" },
            { v: `${AFFILIATE.cookieDays} days`, l: "Cookie window" },
            { v: `$${AFFILIATE.minPayout}`, l: "Minimum payout" },
          ].map((s) => (
            <div key={s.l} className="py-7 px-4" style={{ background: "#ffffff" }}>
              <div className="affiliate-stat mb-1">{s.v}</div>
              <div className="label text-[9px] text-slate-400">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Why */}
    <section className="py-14 sm:py-20 px-4 sm:px-6 max-w-[1440px] mx-auto">
      <div className="text-center mb-11 reveal">
        <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>The offer</span>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Built to keep paying you</h2>
      </div>
      <div className="stagger grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {AFFILIATE_PERKS.map((p) => (
          <div key={p.title} className="glass rounded-2xl p-6 sm:p-7">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(0,0,71,0.08)" }}>
              <MI name={p.icon} className="text-xl" style={{ color: "#000047" }} />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2 tracking-tight">{p.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>{p.desc}</p>
          </div>
        ))}
      </div>
    </section>

    {/* Calculator */}
    <section id="calculator" className="pb-14 sm:pb-20 px-4 sm:px-6 max-w-[1100px] mx-auto scroll-mt-24">
      <div className="reveal-s"><Calculator /></div>
    </section>

    {/* Bonus tiers */}
    <section className="pb-14 sm:pb-20 px-4 sm:px-6 max-w-[1100px] mx-auto">
      <div className="text-center mb-10 reveal">
        <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>Bonus tiers</span>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-4">Cash on top of commission</h2>
        <p className="text-base max-w-xl mx-auto leading-relaxed" style={{ color: "#667085" }}>
          These stack with your monthly {AFFILIATE.rate}%. Nothing here replaces your commission, it is added to it.
        </p>
      </div>
      <div className="stagger grid sm:grid-cols-3 gap-4 sm:gap-5">
        {AFFILIATE_TIERS.map((t, i) => (
          <div key={t.active} className="glass rounded-2xl p-7 text-center relative overflow-hidden">
            {i === 2 && (
              <span className="absolute top-4 right-4 text-[9px] font-bold px-2.5 py-1 rounded-full" style={{ background: "#000047", color: "#ffffff" }}>TOP TIER</span>
            )}
            <div className="label text-[9px] mb-3" style={{ color: "#98a2b3" }}>{t.active}</div>
            <div className="text-4xl font-black text-slate-900 tracking-tight mb-3">{t.bonus}</div>
            <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>{t.note}</p>
          </div>
        ))}
      </div>
    </section>

    {/* How it works */}
    <section id="how" className="pb-14 sm:pb-20 px-4 sm:px-6 max-w-[1100px] mx-auto scroll-mt-24">
      <div className="text-center mb-11 reveal">
        <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>How it works</span>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Four steps, then it runs itself</h2>
      </div>
      <div className="stagger grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {AFFILIATE_STEPS.map((s, i) => (
          <div key={s.title} className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#000047" }}>
                <span className="text-sm font-black text-white">{i + 1}</span>
              </div>
              <MI name={s.icon} className="text-xl" style={{ color: "#000047" }} />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2 tracking-tight">{s.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </section>

    {/* FAQ */}
    <section id="faq" className="pb-14 sm:pb-20 px-4 sm:px-6 max-w-[1100px] mx-auto scroll-mt-24">
      <div className="text-center mb-10 reveal">
        <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>Questions</span>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Before you apply</h2>
      </div>
      <div className="stagger grid sm:grid-cols-2 gap-4 sm:gap-5">
        {AFFILIATE_FAQS.map((f) => (
          <div key={f.q} className="glass rounded-2xl p-6">
            <h3 className="text-base font-bold text-slate-900 mb-2 tracking-tight flex items-start gap-2">
              <MI name="help" className="text-lg flex-shrink-0" style={{ color: "#000047" }} />{f.q}
            </h3>
            <p className="text-sm leading-relaxed ml-7" style={{ color: "#667085" }}>{f.a}</p>
          </div>
        ))}
      </div>
    </section>

    {/* Apply */}
    <section id="apply" className="pb-14 sm:pb-20 px-4 sm:px-6 max-w-[820px] mx-auto scroll-mt-24">
      <div className="text-center mb-9 reveal">
        <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>Apply</span>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-4">Start earning on your audience</h2>
        <p className="text-base max-w-xl mx-auto leading-relaxed" style={{ color: "#667085" }}>
          Tell us who you reach and where you would share OctaDezx. Approved partners get their link and discount code the same
          week.
        </p>
      </div>
      <div className="reveal-s">
        <ApplicationForm
          kind="affiliate"
          linkLabel="Your website, channel or profile"
          linkPlaceholder="https://yoursite.com"
          audienceLabel="Who is your audience, and how big is it?"
          audiencePlaceholder="e.g. 12k newsletter subscribers, mostly Shopify store owners"
          messageLabel="How would you promote OctaDezx?"
          messagePlaceholder="Review video, newsletter feature, client recommendations, a comparison post..."
          submitLabel="Apply to the programme"
          successTitle="You are in the queue"
          successBody="Thanks for applying. We review partners by hand and will send your referral link and discount code as soon as you are approved, usually within two working days."
          fallbackEmail={COMPANY.affiliateEmail}
        />
      </div>
    </section>
  </PageShell>
);

export default Affiliates;
