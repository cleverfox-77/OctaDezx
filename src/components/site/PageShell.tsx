import { ReactNode } from "react";
import { SEO } from "@/components/SEO";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import CtaSection from "./CtaSection";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import "../../styles/landing.css";

interface PageShellProps {
  title: string;
  description: string;
  canonical: string;
  children: ReactNode;
  cta?: { eyebrow?: string; title?: string; sub?: string } | false;
  transparentNav?: boolean;
  /** Page-specific structured data (JobPosting, Article, AboutPage, ...). */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  image?: string;
  type?: string;
}

// Wraps a marketing page in the shared theme, nav, closing CTA and footer.
const PageShell = ({ title, description, canonical, children, cta, transparentNav = false, jsonLd, image, type }: PageShellProps) => {
  useScrollReveal();
  return (
    <div className="octa-landing min-h-screen" style={{ background: "#f4f5f7", color: "#0f172a" }}>
      <SEO title={title} description={description} canonical={canonical} jsonLd={jsonLd} image={image} type={type} />
      <SiteNav transparentAtTop={transparentNav} />
      <main className="relative pt-[68px]">{children}</main>
      {cta !== false && <CtaSection {...(cta || {})} />}
      <SiteFooter />
    </div>
  );
};

export default PageShell;
