import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageShell from "@/components/site/PageShell";
import { MI } from "@/components/site/MaterialIcon";
import RelatedReading from "@/components/site/RelatedReading";
import {
  INTEGRATION_GROUPS,
  ALL_INTEGRATIONS,
  INTEGRATION_COUNT,
} from "@/components/site/integrationsData";

/**
 * The integrations directory.
 *
 * "View all 50+ integrations" was a button with no handler for as long as the
 * landing page has existed. The claim was true and there was nowhere to go and
 * check it. This is the page it should always have pointed at, and it lists
 * every single one rather than a curated dozen.
 */

const GROUP_ICONS: Record<string, string> = {
  "built-in": "bolt",
  messaging: "chat",
  "e-commerce": "shopping_bag",
  "crm-helpdesk": "support_agent",
  payments: "payments",
  shipping: "local_shipping",
};

const Integrations = () => {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const results = useMemo(
    () => (q ? ALL_INTEGRATIONS.filter((i) => i.name.toLowerCase().includes(q) || i.blurb.toLowerCase().includes(q)) : null),
    [q],
  );

  return (
    <PageShell
      title="Integrations | OctaDezx"
      // Kept as a plain string on purpose: scripts/lib/routes.mjs reads this prop
      // as text to build the prerendered head, and cannot evaluate an expression.
      description="Every channel, store, CRM and courier OctaDezx connects to. 90+ integrations across messaging, e-commerce, CRM and helpdesk, payments and shipping worldwide, on every plan."
      canonical="https://octadezx.com/integrations"
      transparentNav
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "OctaDezx integrations",
        description: `Platforms, stores, CRMs, payment providers and couriers that OctaDezx connects to. ${INTEGRATION_COUNT} in total.`,
        numberOfItems: INTEGRATION_COUNT,
        itemListElement: ALL_INTEGRATIONS.map((item, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: item.name,
          description: item.blurb,
        })),
      }}
    >
      {/* Hero */}
      <section className="relative overflow-hidden px-4 sm:px-6 pt-10 sm:pt-16 pb-8">
        <div className="hero-aurora absolute -top-24 left-1/2 -translate-x-1/2" aria-hidden="true" />
        <div className="max-w-[900px] mx-auto text-center reveal">
          <span className="label text-[10px] mb-4 inline-block px-3 py-1.5 rounded-full"
            style={{ color: "#000047", background: "rgba(0,0,71,0.08)", border: "1px solid rgba(0,0,71,0.18)" }}>
            Integrations
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 leading-[1.05] tracking-tight mb-5">
            {INTEGRATION_COUNT} places we plug into
          </h1>
          <p className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: "#667085" }}>
            Every channel your customers message you on, every store your catalogue lives in,
            every courier that carries your parcels. All of it on every plan, none of it an add on.
          </p>
        </div>

        <div className="max-w-[560px] mx-auto mt-8 reveal">
          <div className="glass rounded-2xl flex items-center gap-3 px-5 py-3.5">
            <MI name="search" className="text-lg flex-shrink-0" style={{ color: "#98a2b3" }} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for WhatsApp, Shopify, DHL..."
              aria-label="Search integrations"
              className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search" className="flex-shrink-0">
                <MI name="close" className="text-lg" style={{ color: "#98a2b3" }} />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Results, or the full directory */}
      <section className="px-4 sm:px-6 pb-8 max-w-[1440px] mx-auto">
        {results ? (
          <>
            <p className="text-sm mb-5" style={{ color: "#667085" }}>
              {results.length === 0
                ? "Nothing matches that yet."
                : `${results.length} ${results.length === 1 ? "match" : "matches"} for "${query}"`}
            </p>
            {results.length === 0 ? (
              <div className="glass rounded-[2rem] p-8 text-center">
                <p className="text-sm mb-4" style={{ color: "#667085" }}>
                  If your customers are somewhere we do not reach yet, the REST API and webhooks
                  will get you there, and we would genuinely like to hear which one it is.
                </p>
                <a href="#contact" className="font-bold text-sm" style={{ color: "#000047" }}>Tell us what is missing</a>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {results.map((item) => (
                  <div key={item.id} className="glass rounded-2xl px-5 py-4">
                    <div className="flex items-baseline justify-between gap-3 mb-1">
                      <span className="font-bold text-slate-900 text-sm">{item.name}</span>
                      <span className="label text-[8px] flex-shrink-0" style={{ color: "#98a2b3" }}>{item.group}</span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "#667085" }}>{item.blurb}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          INTEGRATION_GROUPS.map((group) => (
            <div key={group.slug} id={group.slug} className="mb-12 sm:mb-16" style={{ scrollMarginTop: "84px" }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(0,0,71,0.08)" }}>
                  <MI name={GROUP_ICONS[group.slug] ?? "hub"} className="text-lg" style={{ color: "#000047" }} />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{group.title}</h2>
                <span className="text-sm font-semibold" style={{ color: "#98a2b3" }}>{group.items.length}</span>
              </div>
              <p className="text-sm sm:text-base mb-5 max-w-2xl" style={{ color: "#667085" }}>{group.intro}</p>
              <div className="stagger grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.items.map((item) => (
                  <div key={item.id} className="glass rounded-2xl px-5 py-4">
                    <div className="font-bold text-slate-900 text-sm mb-1">{item.name}</div>
                    <p className="text-xs leading-relaxed" style={{ color: "#667085" }}>{item.blurb}</p>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {/* The honest footnote about what connecting actually involves */}
      <section className="px-4 sm:px-6 pb-6 max-w-[1440px] mx-auto">
        <div className="glass rounded-[2rem] p-6 sm:p-8 grid sm:grid-cols-3 gap-6">
          {[
            {
              icon: "key",
              title: "You bring the account",
              desc: "Each connection uses your own credentials from that platform, pasted once in the dashboard. We never resell anyone else's API.",
            },
            {
              icon: "sync",
              title: "It syncs both ways",
              desc: "Stores push catalogue and orders in. Conversations and tickets go back out to your CRM or helpdesk.",
            },
            {
              icon: "all_inclusive",
              title: "Every plan, no extra fee",
              desc: "Connect one or connect forty. Plans differ on volume and seats, never on which integrations you are allowed.",
            },
          ].map((s) => (
            <div key={s.title}>
              <div className="flex items-center gap-2.5 mb-2">
                <MI name={s.icon} className="text-lg" style={{ color: "#000047" }} />
                <span className="font-bold text-slate-900 text-sm">{s.title}</span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>{s.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-sm mt-8" style={{ color: "#667085" }}>
          Missing one? The <Link to="/resources" className="font-bold" style={{ color: "#000047" }}>REST API and webhooks</Link>
          {" "}cover anything not on this list.
        </p>
      </section>

      <RelatedReading page="/integrations" heading="Worth reading next" />
    </PageShell>
  );
};

export default Integrations;
