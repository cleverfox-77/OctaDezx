import PageShell from "@/components/site/PageShell";
import { MI } from "@/components/site/MaterialIcon";
import RelatedReading from "@/components/site/RelatedReading";

const TESTIMONIALS = [
  {
    quote: "Before OctaDezx, our team was drowning in repetitive questions about sizing, fabrics and shipping. Now the AI handles every customer conversation in their own language, around the clock. Our response time went from hours to seconds and our online sales have grown without us adding a single new hire.",
    name: "Thomas Pini", role: "CEO, Pini Parma", photo: "/clients/thomas-pini.jpg", logo: "/clients/pini-parma.jpg",
  },
  {
    quote: "We deal with complex client enquiries across multiple markets, and OctaDezx understood our catalogue almost instantly. It resolves the routine questions on its own and escalates only what truly needs a human. Our customers feel looked after 24/7, and that reliability has directly helped us grow our accounts.",
    name: "Tim Shave", role: "CEO, Price & Pierce", photo: "/clients/tim-shave.jpg", logo: "/clients/price-pierce.png",
  },
];

const STATS = [
  { value: "24/7", label: "Always online", sub: "Zero downtime, every timezone" },
  { value: "<10s", label: "Product onboarding", sub: "Paste a URL, go live instantly" },
  { value: "90+", label: "Integrations", sub: "Channels, stores, CRMs and couriers" },
  { value: "99.9%", label: "Uptime SLA", sub: "Enterprise reliability built in" },
];

const Customers = () => (
  <PageShell
    title="Customer stories | OctaDezx"
    description="Leaders who grew with OctaDezx. See how founders use always-on AI to look after every customer and scale without scaling their support team."
    canonical="https://octadezx.com/customers"
    transparentNav
  >
    {/* Hero */}
    <section className="relative overflow-hidden px-4 sm:px-6 pt-10 sm:pt-16 pb-6">
      <div className="max-w-[1440px] mx-auto grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
        <div className="reveal-l">
          <span className="label text-[10px] mb-4 inline-block px-3 py-1.5 rounded-full" style={{ color: "#000047", background: "rgba(0,0,71,0.08)", border: "1px solid rgba(0,0,71,0.18)" }}>Customer stories</span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 leading-[1.05] tracking-tight mb-5">Leaders who grew with OctaDezx</h1>
          <p className="text-base sm:text-lg max-w-xl leading-relaxed" style={{ color: "#667085" }}>
            Real stores, real customers, zero missed messages. While owners run the shop floor, OctaDezx runs the inbox.
          </p>
        </div>
        <div className="reveal-r rounded-[2rem] overflow-hidden relative" style={{ boxShadow: "0 2px 6px rgba(16,24,40,0.06), 0 24px 60px rgba(16,24,40,0.14)" }}>
          <img src="/media/customer-story.webp" alt="A shop owner served by OctaDezx" loading="eager" className="w-full h-full object-cover" />
        </div>
      </div>
    </section>

    {/* Testimonials */}
    <section className="py-14 sm:py-24 px-4 sm:px-6 max-w-[1440px] mx-auto">
      <div className="stagger grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        {TESTIMONIALS.map((t) => (
          <figure key={t.name} className="glass rounded-3xl p-7 sm:p-9 flex flex-col">
            <MI name="format_quote" className="text-4xl mb-4" style={{ color: "#000047" }} />
            <blockquote className="text-base sm:text-lg leading-relaxed text-slate-700 flex-grow">“{t.quote}”</blockquote>
            <figcaption className="flex items-center gap-4 mt-7 pt-6" style={{ borderTop: "1px solid #e8eaee" }}>
              <img src={t.photo} alt={t.name} loading="lazy" className="w-14 h-14 rounded-full object-cover flex-shrink-0" style={{ boxShadow: "0 4px 14px rgba(16,24,40,0.12)" }} />
              <div className="min-w-0">
                <div className="text-slate-900 font-semibold leading-tight">{t.name}</div>
                <div className="text-sm text-slate-500">{t.role}</div>
              </div>
              <div className="ml-auto w-12 h-12 rounded-full bg-white flex items-center justify-center p-2 flex-shrink-0" style={{ border: "1px solid #eceef2" }}>
                <img src={t.logo} alt={t.role} loading="lazy" className="max-w-full max-h-full object-contain" />
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>

    {/* Stats */}
    <section className="py-6 sm:py-10 px-4 sm:px-6 max-w-[1440px] mx-auto">
      <div className="stagger grid grid-cols-2 lg:grid-cols-4 gap-px" style={{ background: "#e8eaee", borderRadius: "20px", overflow: "hidden", border: "1px solid #e8eaee" }}>
        {STATS.map((s) => (
          <div key={s.label} className="flex flex-col items-center justify-center py-10 px-5 text-center" style={{ background: "#ffffff" }}>
            <div className="stat-num mb-1.5">{s.value}</div>
            <div className="text-sm font-semibold text-slate-900 mb-1">{s.label}</div>
            <div className="label text-[9px] text-slate-400">{s.sub}</div>
          </div>
        ))}
      </div>
    </section>
  
    <RelatedReading page="/customers" heading="How teams get results like these" />

  </PageShell>
);

export default Customers;
