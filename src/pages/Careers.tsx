import PageShell from "@/components/site/PageShell";
import { MI } from "@/components/site/MaterialIcon";
import ApplicationForm from "@/components/site/ApplicationForm";
import { COMPANY, ROLES, PERKS } from "@/components/site/companyData";

const POSTED = "2026-07-24";

// One JobPosting per open role, so the listings can surface in Google Jobs.
const JOB_JSONLD = ROLES.map((r) => ({
  "@context": "https://schema.org",
  "@type": "JobPosting",
  title: r.title,
  description: `${r.summary} Responsibilities: ${r.responsibilities.join(". ")}. Requirements: ${r.requirements.join(". ")}.`,
  datePosted: POSTED,
  employmentType: r.type.toLowerCase().includes("contract") ? ["FULL_TIME", "CONTRACTOR"] : ["FULL_TIME", "OTHER"],
  hiringOrganization: { "@type": "Organization", name: "OctaDezx", sameAs: "https://octadezx.com", logo: "https://octadezx.com/logo.jpeg" },
  jobLocationType: "TELECOMMUTE",
  applicantLocationRequirements: { "@type": "Country", name: "Worldwide" },
  directApply: true,
  url: `https://octadezx.com/careers#${r.slug}`,
}));

const Careers = () => (
  <PageShell
    title="Careers | OctaDezx"
    description="Join OctaDezx. We are hiring a Client Acquisition Executive and a Growth Marketer, fully remote, paid on results. Apply in two minutes."
    canonical="https://octadezx.com/careers"
    jsonLd={JOB_JSONLD}
    transparentNav
  >
    {/* Hero */}
    <section className="relative overflow-hidden px-4 sm:px-6 pt-10 sm:pt-16 pb-6">
      <div className="hero-aurora absolute -top-24 left-1/2 -translate-x-1/2" aria-hidden="true" />
      <div className="max-w-[900px] mx-auto text-center reveal">
        <span className="label text-[10px] mb-4 inline-block px-3 py-1.5 rounded-full" style={{ color: "#000047", background: "rgba(0,0,71,0.08)", border: "1px solid rgba(0,0,71,0.18)" }}>Careers</span>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 leading-[1.05] tracking-tight mb-5">
          Two open roles. Both change the number.
        </h1>
        <p className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-8" style={{ color: "#667085" }}>
          We are a small team under the DezxCorp umbrella, shipping an AI customer care platform that businesses go live on in
          under ten minutes. What we need now is people who can put it in front of the right owners and keep the funnel full.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a href="#roles"><button className="btn-cta text-white px-6 py-3 rounded-xl text-sm font-bold tracking-tight">See the roles</button></a>
          <a href="#apply"><button className="btn-ghost px-6 py-3 rounded-xl text-sm font-bold tracking-tight">Apply now</button></a>
        </div>
      </div>
    </section>

    {/* Roles */}
    <section id="roles" className="py-12 sm:py-20 px-4 sm:px-6 max-w-[1100px] mx-auto scroll-mt-24">
      <div className="stagger space-y-5 sm:space-y-6">
        {ROLES.map((r) => (
          <article key={r.slug} id={r.slug} className="glass rounded-3xl p-7 sm:p-10 scroll-mt-24">
            <div className="flex flex-wrap items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,0,71,0.08)" }}>
                <MI name={r.icon} className="text-2xl" style={{ color: "#000047" }} />
              </div>
              <div className="min-w-0 flex-grow">
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">{r.title}</h2>
                <div className="flex flex-wrap gap-2 mt-3">
                  {[r.team, r.type, r.location].map((t) => (
                    <span key={t} className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: "rgba(0,0,71,0.06)", color: "#000047" }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-sm sm:text-base leading-relaxed mb-6" style={{ color: "#667085" }}>{r.summary}</p>

            <div className="rounded-2xl px-5 py-4 mb-7 flex items-start gap-3" style={{ background: "rgba(0,0,71,0.05)" }}>
              <MI name="payments" className="text-xl flex-shrink-0" style={{ color: "#000047" }} />
              <div>
                <div className="text-xs font-bold text-slate-900 mb-0.5">What it pays</div>
                <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>{r.comp}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-7">
              <div>
                <h3 className="label text-[9px] mb-3" style={{ color: "#000047" }}>What you will do</h3>
                <ul className="space-y-2.5">
                  {r.responsibilities.map((x) => (
                    <li key={x} className="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed">
                      <MI name="check_circle" className="text-base flex-shrink-0 mt-0.5" style={{ color: "#000047" }} />{x}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="label text-[9px] mb-3" style={{ color: "#000047" }}>What we need from you</h3>
                <ul className="space-y-2.5">
                  {r.requirements.map((x) => (
                    <li key={x} className="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed">
                      <MI name="check_circle" className="text-base flex-shrink-0 mt-0.5" style={{ color: "#000047" }} />{x}
                    </li>
                  ))}
                </ul>
                <h3 className="label text-[9px] mt-6 mb-3" style={{ color: "#98a2b3" }}>Nice to have</h3>
                <ul className="space-y-2">
                  {r.bonus.map((x) => (
                    <li key={x} className="flex items-start gap-2.5 text-sm leading-relaxed" style={{ color: "#667085" }}>
                      <MI name="add" className="text-base flex-shrink-0 mt-0.5" style={{ color: "#98a2b3" }} />{x}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <a href="#apply" className="inline-flex items-center gap-2 mt-8 text-sm font-bold" style={{ color: "#000047" }}>
              Apply for this role <MI name="arrow_forward" className="text-base" />
            </a>
          </article>
        ))}
      </div>
    </section>

    {/* Perks */}
    <section className="py-6 sm:py-12 px-4 sm:px-6 max-w-[1440px] mx-auto">
      <div className="text-center mb-10 reveal">
        <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>Working here</span>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">What you get</h2>
      </div>
      <div className="stagger grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {PERKS.map((p) => (
          <div key={p.title} className="glass rounded-2xl p-6">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(0,0,71,0.08)" }}>
              <MI name={p.icon} className="text-xl" style={{ color: "#000047" }} />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2 tracking-tight">{p.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>{p.desc}</p>
          </div>
        ))}
      </div>
    </section>

    {/* Apply */}
    <section id="apply" className="py-14 sm:py-20 px-4 sm:px-6 max-w-[820px] mx-auto scroll-mt-24">
      <div className="text-center mb-9 reveal">
        <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>Apply</span>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-4">Tell us what you have closed</h2>
        <p className="text-base max-w-xl mx-auto leading-relaxed" style={{ color: "#667085" }}>
          No cover letter theatre. Pick the role, show us the work, and we will reply either way.
        </p>
      </div>
      <div className="reveal-s">
        <ApplicationForm
          kind="career"
          roles={ROLES.map((r) => ({ slug: r.slug, title: r.title }))}
          linkLabel="Portfolio, LinkedIn or anything that shows your work"
          linkPlaceholder="https://linkedin.com/in/you"
          messageLabel="Why you, for this role"
          messagePlaceholder="What have you sold or grown? Numbers beat adjectives."
          submitLabel="Send application"
          successTitle="Application received"
          successBody="Thanks for applying. We read every one by hand and will get back to you within two working days, whichever way it goes."
          fallbackEmail={COMPANY.careersEmail}
        />
      </div>
    </section>
  </PageShell>
);

export default Careers;
