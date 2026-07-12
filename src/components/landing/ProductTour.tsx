import { useEffect, useRef, useState } from "react";

/* Zendesk-style tabbed workspace showcase. Every "screenshot" is built in
   CSS/JSX so it always matches the live product palette, weighs nothing and
   animates. Auto-advances; pauses while hovered; tab bar doubles as a
   progress indicator. */

const MI = ({ name, className = "", style }: { name: string; className?: string; style?: React.CSSProperties }) => (
  <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>
);

const TOUR_MS = 6000;

const TABS = [
  { id: "inbox",     label: "Conversations", icon: "forum",         blurb: "Every channel in one calm queue — AI resolves, your team supervises." },
  { id: "orders",    label: "Orders",        icon: "orders",        blurb: "Captured, verified and confirmed by the AI. You just ship." },
  { id: "analytics", label: "Analytics",     icon: "monitoring",    blurb: "Revenue, resolution time and CSAT — live, not last week." },
  { id: "training",  label: "AI Training",   icon: "school",        blurb: "Teach it once. Paste policies, tone and FAQs — it stays on-brand." },
] as const;

type TabId = (typeof TABS)[number]["id"];

const CONVERSATIONS = [
  { name: "Sofia M.",  channel: "WhatsApp",  txt: "Where is my order #OD-1042?",     status: "Resolved by AI", tone: "#16a34a" },
  { name: "James K.",  channel: "Instagram", txt: "Do you ship to Canada?",          status: "Resolved by AI", tone: "#16a34a" },
  { name: "Amelie R.", channel: "Web chat",  txt: "I need to change my invoice…",    status: "Escalated · Full context attached", tone: "#b45309" },
  { name: "Diego L.",  channel: "Facebook",  txt: "Size M still in stock?",          status: "Resolved by AI", tone: "#16a34a" },
];

const ORDERS = [
  { id: "#OD-2048", item: "Classic Oxford · 42",   total: "$129.00", state: "Confirmed",  tone: "#16a34a" },
  { id: "#OD-2047", item: "Leather Loafer · 41",   total: "$99.00",  state: "Payment verified", tone: "#1d4ed8" },
  { id: "#OD-2046", item: "Chelsea Boot · 44",     total: "$189.00", state: "Shipped",    tone: "#7c3aed" },
  { id: "#OD-2045", item: "Suede Derby · 43",      total: "$149.00", state: "Confirmed",  tone: "#16a34a" },
];

const BARS = [42, 58, 47, 66, 74, 62, 88, 96];

export const ProductTour = () => {
  const [active, setActive] = useState<TabId>("inbox");
  const [cycle, setCycle] = useState(0); // remounts progress bar per switch
  const hovering = useRef(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const visible = useRef(false);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting; }, { threshold: 0.2 });
    if (sectionRef.current) io.observe(sectionRef.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      if (hovering.current || !visible.current) return;
      setActive((cur) => {
        const i = TABS.findIndex((tab) => tab.id === cur);
        return TABS[(i + 1) % TABS.length].id;
      });
      setCycle((c) => c + 1);
    }, TOUR_MS);
    return () => clearInterval(t);
  }, []);

  const pick = (id: TabId) => { setActive(id); setCycle((c) => c + 1); };
  const activeTab = TABS.find((t) => t.id === active)!;

  return (
    <div
      ref={sectionRef}
      onMouseEnter={() => { hovering.current = true; }}
      onMouseLeave={() => { hovering.current = false; }}
    >
      {/* Tabs */}
      <div className="flex flex-wrap justify-center gap-x-2 gap-y-3 mb-4 border-b" style={{ borderColor: "#e8eaee" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => pick(t.id)}
            className={`tour-tab flex items-center gap-2 px-4 sm:px-5 py-3 text-sm font-semibold transition-colors ${
              active === t.id ? "active text-slate-900" : "text-slate-500 hover:text-slate-800"
            }`}
            style={{ ["--tour-ms" as string]: `${TOUR_MS}ms` }}
            aria-pressed={active === t.id}
          >
            <MI name={t.icon} className="text-lg" style={{ color: active === t.id ? "#000047" : "#98a2b3" }} />
            {t.label}
            <span className="tour-tab-bar"><span key={active === t.id ? cycle : -1} /></span>
          </button>
        ))}
      </div>

      <p className="text-center text-sm mb-8" style={{ color: "#667085" }}>{activeTab.blurb}</p>

      {/* Stage */}
      <div className="tour-stage rounded-[1.75rem] overflow-hidden max-w-[980px] mx-auto">
        {/* window chrome */}
        <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: "#eef0f3", background: "#f9fafb" }}>
          <div className="flex gap-1.5">
            {["bg-red-400", "bg-yellow-400", "bg-green-400"].map((c, i) => (
              <span key={i} className={`w-2.5 h-2.5 rounded-full ${c}`} />
            ))}
          </div>
          <div className="mx-auto flex items-center gap-2 px-4 py-1 rounded-lg text-[11px] font-medium text-slate-500"
            style={{ background: "#eef0f3" }}>
            <MI name="lock" className="text-xs" />
            app.octadezx.com / {active}
          </div>
        </div>

        <div className="flex min-h-[380px]">
          {/* mock sidebar */}
          <div className="hidden md:flex w-44 flex-col gap-1 border-r px-3 py-4 flex-shrink-0"
            style={{ borderColor: "#eef0f3", background: "#fbfcfd" }}>
            {TABS.map((t) => (
              <button key={t.id} onClick={() => pick(t.id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all ${
                  active === t.id ? "text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
                style={active === t.id ? { background: "#000047" } : undefined}>
                <MI name={t.icon} className="text-base" />
                {t.label}
              </button>
            ))}
            <div className="mt-auto px-3 py-2 rounded-lg flex items-center gap-2" style={{ background: "rgba(22,163,74,0.08)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 status-pulse" />
              <span className="text-[10px] font-semibold text-green-700">AI online</span>
            </div>
          </div>

          {/* mock content */}
          <div className="flex-1 p-5 sm:p-6" style={{ background: "#ffffff" }}>
            {active === "inbox" && (
              <div key={cycle} className="tour-panel space-y-2.5">
                {CONVERSATIONS.map((c, i) => (
                  <div key={c.name} className="mock-row flex items-center gap-3 rounded-xl border px-4 py-3"
                    style={{ borderColor: "#eef0f3", animationDelay: `${i * 80}ms` }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                      style={{ background: "linear-gradient(135deg,#000047,#4f46e5)" }}>
                      {c.name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{c.name}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold text-slate-500"
                          style={{ background: "#f2f4f7" }}>{c.channel}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{c.txt}</p>
                    </div>
                    <span className="text-[10px] font-semibold flex-shrink-0 hidden sm:block" style={{ color: c.tone }}>{c.status}</span>
                  </div>
                ))}
                <div className="mock-row flex items-center gap-2 px-4 pt-1" style={{ animationDelay: "360ms" }}>
                  <div className="mock-typing flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                  </div>
                  <span className="text-[11px] text-slate-400">AI replying to 3 customers…</span>
                </div>
              </div>
            )}

            {active === "orders" && (
              <div key={cycle} className="tour-panel">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[["Today", "$1,284"], ["This week", "$9,412"], ["AOV", "$64.20"]].map(([l, v], i) => (
                    <div key={l} className="mock-row rounded-xl border px-4 py-3" style={{ borderColor: "#eef0f3", animationDelay: `${i * 70}ms` }}>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{l}</div>
                      <div className="text-lg font-black text-slate-900">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {ORDERS.map((o, i) => (
                    <div key={o.id} className="mock-row flex items-center gap-3 rounded-xl border px-4 py-2.5"
                      style={{ borderColor: "#eef0f3", animationDelay: `${200 + i * 80}ms` }}>
                      <span className="text-xs font-bold text-slate-900 w-20 flex-shrink-0">{o.id}</span>
                      <span className="text-xs text-slate-500 flex-1 truncate">{o.item}</span>
                      <span className="text-xs font-semibold text-slate-900 hidden sm:block">{o.total}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ color: o.tone, background: `${o.tone}14` }}>{o.state}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {active === "analytics" && (
              <div key={cycle} className="tour-panel">
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[["Resolution rate", "94%"], ["Avg response", "1.2s"], ["CSAT", "4.9/5"]].map(([l, v], i) => (
                    <div key={l} className="mock-row rounded-xl border px-4 py-3" style={{ borderColor: "#eef0f3", animationDelay: `${i * 70}ms` }}>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{l}</div>
                      <div className="text-lg font-black text-slate-900">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border p-4" style={{ borderColor: "#eef0f3" }}>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">Conversations resolved · last 8 weeks</div>
                  <div className="flex items-end gap-2 h-32">
                    {BARS.map((b, i) => (
                      <div key={i} className="mock-bar flex-1" style={{ height: `${b}%`, animationDelay: `${150 + i * 60}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {active === "training" && (
              <div key={cycle} className="tour-panel space-y-3">
                {[
                  ["Brand voice", "Friendly, concise, always signs off with the customer's name."],
                  ["Returns policy", "30-day returns, free exchange, refund to original payment method."],
                  ["Shipping", "Free above $30. 3–5 business days domestic, 7–10 international."],
                ].map(([title, body], i) => (
                  <div key={title} className="mock-row rounded-xl border px-4 py-3 flex items-start gap-3"
                    style={{ borderColor: "#eef0f3", animationDelay: `${i * 90}ms` }}>
                    <MI name="check_circle" className="text-base mt-0.5" style={{ color: "#16a34a" }} />
                    <div>
                      <div className="text-xs font-bold text-slate-900">{title}</div>
                      <p className="text-xs text-slate-500 leading-relaxed">{body}</p>
                    </div>
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-widest text-green-700 flex-shrink-0">Learned</span>
                  </div>
                ))}
                <div className="mock-row rounded-xl border-2 border-dashed px-4 py-4 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400"
                  style={{ borderColor: "#e8eaee", animationDelay: "300ms" }}>
                  <MI name="add" className="text-base" />
                  Drop a policy, FAQ or document — the AI learns it in seconds
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductTour;
