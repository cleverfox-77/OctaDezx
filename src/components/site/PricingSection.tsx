import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { MI } from "./MaterialIcon";
import { PLANS, FEATURE_MATRIX, FEATURE_GROUPS, PAYG_RATES, type Plan } from "@/lib/plans";

/**
 * The pricing section, shared by the landing page and /pricing.
 *
 * Every number comes from src/lib/plans.ts. The landing page used to carry its
 * own copy of this component with its own copy of the prices, and the two had
 * drifted a whole repricing apart: one still advertised a $9 plan that the
 * other had already replaced.
 */

const COMPARE_PLANS = PLANS.map((p) => p.key as "starter" | "pro" | "advanced" | "enterprise");

const Cell = ({ value, accent }: { value: string | boolean; accent: string }) => {
  if (value === true) return <MI name="check_circle" className="text-base" style={{ color: accent }} />;
  if (value === false) return <span className="text-slate-300 text-base leading-none">&bull;</span>;
  return <span className="text-sm font-semibold text-slate-900">{value}</span>;
};

const PricingSection = () => {
  const [yearly, setYearly] = useState(false);
  const [mobilePlan, setMobilePlan] = useState<Plan>(PLANS[1]);

  const priceBlock = (plan: Plan) => {
    if (plan.monthly == null) {
      return (
        <>
          <div className="text-4xl font-black text-slate-900 tracking-tight leading-none">
            Pay as you go
          </div>
          <p className="text-xs font-bold mt-2" style={{ color: "#7c3aed" }}>
            From ${PAYG_RATES.monthlyMinimum} a month
          </p>
        </>
      );
    }
    const amount = yearly ? plan.yearly! : plan.monthly;
    return (
      <>
        <div className="text-4xl font-black text-slate-900 tracking-tight">
          ${amount.toLocaleString("en-US")}
          <span className="text-lg text-slate-400 font-medium">/{yearly ? "yr" : "mo"}</span>
        </div>
        {yearly
          ? <p className="text-xs font-bold mt-1.5" style={{ color: "#16a34a" }}>2 months free</p>
          : <p className="text-xs mt-1.5 text-slate-400">or ${plan.yearly!.toLocaleString("en-US")} a year</p>}
      </>
    );
  };

  const cardInner = (plan: Plan, onDark = false) => (
    <>
      <div className="mb-7">
        <div className="label mb-2" style={{ color: plan.popular ? "#000047" : undefined }}>
          {plan.popular ? plan.name : <span className="text-slate-500">{plan.name}</span>}
        </div>
        {priceBlock(plan)}
        <p className={`text-sm mt-2 ${onDark ? "text-slate-600" : "text-slate-500"}`}>{plan.desc}</p>
      </div>
      <ul className="space-y-3 mb-8 flex-grow">
        {plan.features.map((f) => (
          <li key={f} className={`flex items-start gap-3 text-sm ${onDark ? "text-slate-700" : "text-slate-600"}`}>
            <MI name="check_circle" className="text-sm mt-0.5 flex-shrink-0" style={{ color: plan.accent }} />{f}
          </li>
        ))}
      </ul>
    </>
  );

  /**
   * Enterprise is invoiced against real usage, so it goes to a person rather
   * than to a checkout page that cannot price it. A bare hash anchor rather
   * than a router Link: the footer carries id="contact" on every page, and the
   * browser scrolls to it wherever the reader happens to be standing.
   */
  const planCta = (plan: Plan, className: string) =>
    plan.monthly == null
      ? <a href="#contact"><button className={className}>{plan.cta}</button></a>
      : <Link to="/auth"><button className={className}>{plan.cta}</button></Link>;

  return (
    <section id="pricing" className="py-12 sm:py-20 md:py-28 px-4 sm:px-6 max-w-[1440px] mx-auto">
      <div className="text-center mb-8 sm:mb-10 reveal">
        <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>Simple Pricing</span>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">
          Pick a volume, not a feature list
        </h2>
        <p className="text-slate-500 max-w-xl mx-auto text-base">
          Every plan has every feature: all the channels, phone calls, image recognition
          and the agentic actions. What changes is how much of it you get.
        </p>
      </div>

      <div className="flex justify-center mb-10 sm:mb-12">
        <div className="glass rounded-full p-1 inline-flex items-center gap-1">
          <button onClick={() => setYearly(false)}
            className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${!yearly ? "text-white" : "text-slate-600 hover:text-slate-900"}`}
            style={!yearly ? { background: "#000047" } : undefined}>Monthly</button>
          <button onClick={() => setYearly(true)}
            className={`px-5 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${yearly ? "text-white" : "text-slate-600 hover:text-slate-900"}`}
            style={yearly ? { background: "#000047" } : undefined}>
            Yearly
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: yearly ? "rgba(255,255,255,0.2)" : "rgba(22,163,74,0.12)", color: yearly ? "#fff" : "#16a34a" }}>2 months free</span>
          </button>
        </div>
      </div>

      <div className="stagger grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 items-start">
        {PLANS.map((plan) =>
          plan.popular ? (
            <div key={plan.key} className="relative group lg:-mt-6">
              <div className="absolute -inset-[1px] rounded-[2rem] opacity-40 blur-sm" style={{ background: "linear-gradient(135deg,#000047,#4f46e5)" }} />
              <div className="relative pricing-pro rounded-[2rem] p-7 sm:p-8 flex flex-col overflow-hidden">
                <div className="absolute top-0 right-6 px-3 py-1 label text-[9px] text-white rounded-b-xl" style={{ background: "linear-gradient(135deg,#000047,#4f46e5)" }}>Most Popular</div>
                {cardInner(plan, true)}
                {planCta(plan, "w-full py-3.5 rounded-xl btn-cta text-white font-bold text-sm")}
              </div>
            </div>
          ) : (
            <div key={plan.key} className="glass rounded-[2rem] p-7 sm:p-8 flex flex-col hover:-translate-y-2 transition-transform duration-300">
              {cardInner(plan)}
              {planCta(plan, "w-full py-3.5 rounded-xl glass text-slate-900 font-bold hover:bg-slate-50 transition-all text-sm")}
            </div>
          )
        )}
      </div>

      <p className="text-center text-sm text-slate-500 mt-9 flex items-center justify-center gap-2">
        <MI name="check_circle" className="text-sm flex-shrink-0" style={{ color: "#16a34a" }} />
        All plans include a 24-hour free trial, no credit card required
      </p>

      {/* ── What each plan actually includes ─────────────────────────────── */}
      <div className="mt-16 sm:mt-24">
        <div className="text-center mb-8 sm:mb-10 reveal">
          <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>Compare plans</span>
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-3">
            Everything, on every plan
          </h3>
          <p className="text-slate-500 max-w-xl mx-auto text-base">
            Nothing below is held back for a higher tier. The only things that move
            up the ladder are volume, seats and how fast we answer you.
          </p>
        </div>

        {/* Desktop: one table */}
        <div className="hidden lg:block glass rounded-[2rem] overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ borderBottom: "1px solid #e8eaee" }}>
                <th className="text-left p-5 text-sm font-bold text-slate-900 w-[38%]">Feature</th>
                {PLANS.map((p) => (
                  <th key={p.key} className="p-5 text-center">
                    <div className="text-sm font-bold text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-400 font-medium mt-0.5">
                      {p.monthly == null ? "Metered" : `$${p.monthly}/mo`}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_GROUPS.map((group) => (
                <Fragment key={group}>
                  <tr style={{ background: "rgba(0,0,71,0.03)" }}>
                    <td colSpan={PLANS.length + 1} className="px-5 py-2.5">
                      <span className="label text-[9px]" style={{ color: "#000047" }}>{group}</span>
                    </td>
                  </tr>
                  {FEATURE_MATRIX.filter((f) => f.group === group).map((f) => (
                    <tr key={f.label} style={{ borderTop: "1px solid #f0f1f4" }}>
                      <td className="px-5 py-3.5">
                        <div className="text-sm font-medium text-slate-800">{f.label}</div>
                        {f.detail && <div className="text-xs mt-0.5" style={{ color: "#98a2b3" }}>{f.detail}</div>}
                      </td>
                      {COMPARE_PLANS.map((key, i) => (
                        <td key={key} className="px-5 py-3.5 text-center">
                          <Cell value={f.values[key]} accent={PLANS[i].accent} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: pick a plan, read one column */}
        <div className="lg:hidden">
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-4 px-4">
            {PLANS.map((p) => (
              <button key={p.key} onClick={() => setMobilePlan(p)}
                className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                  mobilePlan.key === p.key ? "text-white" : "glass text-slate-700"}`}
                style={mobilePlan.key === p.key ? { background: "#000047" } : undefined}>
                {p.name}
              </button>
            ))}
          </div>
          <div className="glass rounded-[2rem] p-5 sm:p-7">
            <div className="flex items-baseline justify-between mb-5 pb-4" style={{ borderBottom: "1px solid #e8eaee" }}>
              <span className="text-lg font-black text-slate-900">{mobilePlan.name}</span>
              <span className="text-sm font-bold" style={{ color: "#667085" }}>
                {mobilePlan.monthly == null ? "Metered" : `$${mobilePlan.monthly} a month`}
              </span>
            </div>
            {FEATURE_GROUPS.map((group) => (
              <div key={group} className="mb-5 last:mb-0">
                <span className="label text-[9px] block mb-2.5" style={{ color: "#000047" }}>{group}</span>
                <ul className="space-y-2.5">
                  {FEATURE_MATRIX.filter((f) => f.group === group).map((f) => {
                    const v = f.values[mobilePlan.key as "starter"];
                    // A string value is a quantity, so the row is included and the
                    // number is the interesting part. Only an explicit false is a
                    // row this plan does not get.
                    return (
                      <li key={f.label} className="flex items-start gap-3">
                        <span className="mt-0.5 flex-shrink-0">
                          <Cell value={v === false ? false : true} accent={mobilePlan.accent} />
                        </span>
                        <span className="text-sm leading-snug" style={{ color: v === false ? "#98a2b3" : "#344054" }}>
                          {f.label}
                          {typeof v === "string" && <strong className="text-slate-900">{`: ${v}`}</strong>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-sm text-slate-500 mt-8 max-w-2xl mx-auto">
          A message is one answer the AI sends, on any channel. Phone minutes cover
          calls in and out. Go over and nothing breaks mid conversation: we tell you,
          and you decide whether to move up.
        </p>
      </div>
    </section>
  );
};

export default PricingSection;
