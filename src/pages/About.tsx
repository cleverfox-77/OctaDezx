import { Link } from "react-router-dom";
import PageShell from "@/components/site/PageShell";
import { MI } from "@/components/site/MaterialIcon";
import { COMPANY, GROUP, VALUES, MILESTONES } from "@/components/site/companyData";

const ABOUT_JSONLD = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "@id": "https://octadezx.com/about",
  name: "About OctaDezx",
  description:
    "OctaDezx is an AI customer care platform built and backed by Zeriotic, a web development studio. Both operate under the DezxCorp umbrella.",
  mainEntity: { "@id": "https://octadezx.com/#organization" },
};

const About = () => (
  <PageShell
    title="About us | OctaDezx"
    description="OctaDezx is an AI customer care platform built and backed by Zeriotic, a web development studio. Both teams operate under the DezxCorp umbrella. Meet the company, our values and how we work."
    canonical="https://octadezx.com/about"
    jsonLd={ABOUT_JSONLD}
    transparentNav
  >
    {/* Hero */}
    <section className="relative overflow-hidden px-4 sm:px-6 pt-10 sm:pt-16 pb-6">
      <div className="hero-aurora absolute -top-24 left-1/2 -translate-x-1/2" aria-hidden="true" />
      <div className="max-w-[1440px] mx-auto grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
        <div className="reveal-l">
          <span className="label text-[10px] mb-4 inline-block px-3 py-1.5 rounded-full" style={{ color: "#000047", background: "rgba(0,0,71,0.08)", border: "1px solid rgba(0,0,71,0.18)" }}>About us</span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 leading-[1.05] tracking-tight mb-5">
            A studio that got tired of watching messages go unanswered
          </h1>
          <p className="text-base sm:text-lg max-w-xl leading-relaxed mb-7" style={{ color: "#667085" }}>
            OctaDezx is built and backed by <strong className="text-slate-900 font-semibold">Zeriotic</strong>, a web development
            studio. Both teams are owned by <strong className="text-slate-900 font-semibold">DezxCorp</strong>, the holding company
            behind them. One product, one standard, no committee in between.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/careers"><button className="btn-cta text-white px-6 py-3 rounded-xl text-sm font-bold tracking-tight">See open roles</button></Link>
            <Link to="/affiliates"><button className="btn-ghost px-6 py-3 rounded-xl text-sm font-bold tracking-tight">Affiliate programme</button></Link>
          </div>
        </div>
        <div className="reveal-r rounded-[2rem] overflow-hidden relative aspect-[16/11]" style={{ boxShadow: "0 2px 6px rgba(16,24,40,0.06), 0 24px 60px rgba(16,24,40,0.14)" }}>
          <img src="/media/store-owner.webp" alt="A shop owner answering customers with OctaDezx" loading="eager" className="w-full h-full object-cover" />
        </div>
      </div>
    </section>

    {/* The group */}
    <section id="group" className="py-14 sm:py-24 px-4 sm:px-6 max-w-[1440px] mx-auto scroll-mt-24">
      <div className="text-center mb-12 reveal">
        <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>How we are put together</span>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-4">Three names, one team</h2>
        <p className="text-base max-w-2xl mx-auto leading-relaxed" style={{ color: "#667085" }}>
          DezxCorp is the umbrella. Zeriotic is the studio that builds. OctaDezx is what we ship to business owners.
        </p>
      </div>
      <div className="stagger grid md:grid-cols-3 gap-5 sm:gap-6">
        {GROUP.map((g) => (
          <div key={g.id} id={g.id} className="glass rounded-3xl p-7 sm:p-8 flex flex-col scroll-mt-24">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{ background: "rgba(0,0,71,0.08)" }}>
              <MI name={g.icon} className="text-2xl" style={{ color: "#000047" }} />
            </div>
            <div className="label text-[9px] mb-1.5" style={{ color: "#98a2b3" }}>{g.role}</div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-3 flex items-center gap-2">
              {g.name}
              {g.href && (
                <a href={g.href} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${g.name}`}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-lg transition-colors hover:bg-slate-100" style={{ color: "#000047" }}>
                  <MI name="open_in_new" className="text-base" />
                </a>
              )}
            </h3>
            <p className="text-sm leading-relaxed flex-grow" style={{ color: "#667085" }}>{g.blurb}</p>
            {g.href && (
              <a href={g.href} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-bold mt-4" style={{ color: "#000047" }}>
                Visit zeriotic.com <MI name="arrow_forward" className="text-base" />
              </a>
            )}
            <ul className="mt-6 pt-5 space-y-2.5" style={{ borderTop: "1px solid #e8eaee" }}>
              {g.points.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <MI name="check_circle" className="text-base flex-shrink-0 mt-0.5" style={{ color: "#000047" }} />{p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>

    {/* Story */}
    <section id="story" className="py-6 sm:py-12 px-4 sm:px-6 max-w-[1100px] mx-auto scroll-mt-24">
      <div className="text-center mb-12 reveal">
        <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>Our story</span>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">How OctaDezx started</h2>
      </div>
      <div className="relative">
        <div className="hidden sm:block absolute top-0 bottom-0 left-[15px] w-px" style={{ background: "#e8eaee" }} aria-hidden="true" />
        <div className="stagger space-y-5">
          {MILESTONES.map((m) => (
            <div key={m.year} className="relative sm:pl-14">
              <div className="hidden sm:flex absolute left-0 top-6 w-8 h-8 rounded-full items-center justify-center" style={{ background: "#000047", boxShadow: "0 0 0 6px #f4f5f7" }}>
                <MI name="circle" className="text-[10px] text-white" />
              </div>
              <div className="glass rounded-2xl p-6 sm:p-7">
                <div className="label text-[9px] mb-2" style={{ color: "#000047" }}>{m.year}</div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-2">{m.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Values */}
    <section id="values" className="py-14 sm:py-24 px-4 sm:px-6 max-w-[1440px] mx-auto scroll-mt-24">
      <div className="text-center mb-12 reveal">
        <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>What we believe</span>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">The rules we build by</h2>
      </div>
      <div className="stagger grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {VALUES.map((v) => (
          <div key={v.title} className="glass rounded-2xl p-6 sm:p-7">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(0,0,71,0.08)" }}>
              <MI name={v.icon} className="text-xl" style={{ color: "#000047" }} />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2 tracking-tight">{v.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>{v.desc}</p>
          </div>
        ))}
      </div>
    </section>

    {/* Join us */}
    <section id="join" className="pb-14 sm:pb-20 px-4 sm:px-6 max-w-[1440px] mx-auto scroll-mt-24">
      <div className="stagger grid md:grid-cols-2 gap-5 sm:gap-6">
        <Link to="/careers" className="group cta-card rounded-3xl p-8 sm:p-10 flex flex-col">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{ background: "rgba(0,0,71,0.08)" }}>
            <MI name="work" className="text-2xl" style={{ color: "#000047" }} />
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-3">Careers</h3>
          <p className="text-sm leading-relaxed flex-grow" style={{ color: "#667085" }}>
            We are hiring a Client Acquisition Executive and a Growth Marketer. Remote, paid on results, and close enough to the
            product that your feedback changes it.
          </p>
          <span className="inline-flex items-center gap-1.5 text-sm font-bold mt-6" style={{ color: "#000047" }}>
            See both roles <MI name="arrow_forward" className="text-base transition-transform group-hover:translate-x-1" />
          </span>
        </Link>

        <Link to="/affiliates" className="group cta-card rounded-3xl p-8 sm:p-10 flex flex-col">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{ background: "rgba(0,0,71,0.08)" }}>
            <MI name="handshake" className="text-2xl" style={{ color: "#000047" }} />
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-3">Affiliate programme</h3>
          <p className="text-sm leading-relaxed flex-grow" style={{ color: "#667085" }}>
            Earn 30% of every payment your referrals make, recurring for as long as they stay. Your audience gets 10% off with
            your code. No cap, no exclusivity.
          </p>
          <span className="inline-flex items-center gap-1.5 text-sm font-bold mt-6" style={{ color: "#000047" }}>
            See the offer <MI name="arrow_forward" className="text-base transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      </div>

      <div className="glass rounded-3xl p-7 sm:p-9 mt-5 sm:mt-6 text-center reveal">
        <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-2">Talk to a human</h3>
        <p className="text-sm leading-relaxed mb-5" style={{ color: "#667085" }}>
          Partnerships, press, or a question the FAQ did not cover. We read everything that lands here.
        </p>
        <a href={`mailto:${COMPANY.email}`} className="inline-flex items-center gap-2 text-sm font-bold" style={{ color: "#000047" }}>
          <MI name="mail" className="text-lg" />{COMPANY.email}
        </a>
      </div>
    </section>
  </PageShell>
);

export default About;
