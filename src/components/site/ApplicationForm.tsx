import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MI } from "./MaterialIcon";

export type ApplicationKind = "career" | "affiliate";

interface Props {
  kind: ApplicationKind;
  /** Career only: the roles a candidate can pick from. */
  roles?: { slug: string; title: string }[];
  defaultRole?: string;
  linkLabel: string;
  linkPlaceholder: string;
  /** Affiliate only: free-text description of where they will promote us. */
  audienceLabel?: string;
  audiencePlaceholder?: string;
  messageLabel: string;
  messagePlaceholder: string;
  submitLabel: string;
  successTitle: string;
  successBody: string;
  fallbackEmail: string;
}

const EXPERIENCE = ["Less than 1 year", "1 to 3 years", "3 to 5 years", "5 years or more"];

const inputCls =
  "w-full rounded-xl px-4 py-3 text-sm text-slate-900 bg-white outline-none transition-shadow placeholder:text-slate-400";
const inputStyle = { border: "1px solid #e8eaee" } as const;
const labelCls = "block text-xs font-bold text-slate-700 mb-1.5";

// Shared application form for the careers and affiliate pages.
//
// Posts to /api/apply, which saves the row AND emails the team in one request.
// It used to insert straight into public.applications from here, which saved
// fine but notified nobody, so real applications went unread for days. Keeping
// the two steps together server-side is what stops them drifting apart again.
const ApplicationForm = ({
  kind, roles, defaultRole, linkLabel, linkPlaceholder, audienceLabel, audiencePlaceholder,
  messageLabel, messagePlaceholder, submitLabel, successTitle, successBody, fallbackEmail,
}: Props) => {
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", country: "",
    role: defaultRole || roles?.[0]?.slug || "", link: "", audience: "", experience: "", message: "",
  });
  // Honeypot: hidden from people, catnip for bots. Anything here means drop it.
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.full_name.trim().length < 2) return setError("Please enter your full name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return setError("Please enter a valid email address.");

    setSending(true);
    // Where the applicant came from, trimmed to fit the column policy.
    const source = `${window.location.pathname}${window.location.search}${document.referrer ? ` ref:${document.referrer}` : ""}`.slice(0, 200);

    const payload = {
      kind,
      role: kind === "career" ? form.role.slice(0, 80) : null,
      full_name: form.full_name.trim().slice(0, 120),
      email: form.email.trim().toLowerCase().slice(0, 200),
      phone: form.phone.trim().slice(0, 40) || null,
      country: form.country.trim().slice(0, 80) || null,
      link: form.link.trim().slice(0, 300) || null,
      audience: form.audience.trim().slice(0, 400) || null,
      experience: form.experience.slice(0, 80) || null,
      message: form.message.trim().slice(0, 3000) || null,
      source,
    };

    const DUPLICATE = "You have already applied with this email. We have your application and will be in touch.";

    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, company_website: companyWebsite }),
      });

      // No function deployed (and `npm run dev`, where Vercel routes do not
      // exist). Fall back to the direct insert so the applicant is never lost,
      // and make the missing notification loud in the console rather than
      // silently recreating the bug this endpoint was built to fix.
      if (res.status === 404) {
        const { error: err } = await (supabase as any).from("applications").insert(payload);
        setSending(false);
        if (!err) {
          console.warn("[apply] /api/apply is missing. Saved to Supabase, but NOBODY WAS EMAILED.");
          return setDone(true);
        }
        if (err.code === "23505") return setError(DUPLICATE);
        return setError(err.message || `Something went wrong. Please email ${fallbackEmail} instead.`);
      }

      const data = await res.json().catch(() => ({}) as { ok?: boolean; code?: string; error?: string });
      setSending(false);

      if (res.ok && data.ok) return setDone(true);
      if (data.code === "duplicate") return setError(DUPLICATE);
      setError(data.error || `Something went wrong. Please email ${fallbackEmail} instead.`);
    } catch {
      setSending(false);
      setError(`We could not reach the server. Please email us at ${fallbackEmail} and we will pick it up.`);
    }
  };

  if (done) {
    return (
      <div className="glass rounded-3xl p-8 sm:p-10 text-center">
        <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-5" style={{ background: "rgba(0,0,71,0.08)" }}>
          <MI name="check_circle" className="text-3xl" style={{ color: "#000047" }} />
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-2">{successTitle}</h3>
        <p className="text-sm leading-relaxed max-w-md mx-auto" style={{ color: "#667085" }}>{successBody}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="glass rounded-3xl p-6 sm:p-8">
      {/* Honeypot. Hidden from sight, from tab order and from screen readers, so
          only an automated form filler will ever put anything in it. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="app-company-website">Company website</label>
        <input
          id="app-company-website"
          name="company_website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={companyWebsite}
          onChange={(e) => setCompanyWebsite(e.target.value)}
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
        <div>
          <label className={labelCls} htmlFor="app-name">Full name</label>
          <input id="app-name" required value={form.full_name} onChange={set("full_name")} className={inputCls} style={inputStyle} placeholder="Your name" />
        </div>
        <div>
          <label className={labelCls} htmlFor="app-email">Email</label>
          <input id="app-email" type="email" required value={form.email} onChange={set("email")} className={inputCls} style={inputStyle} placeholder="you@example.com" />
        </div>

        {kind === "career" && roles && (
          <div>
            <label className={labelCls} htmlFor="app-role">Role</label>
            <select id="app-role" value={form.role} onChange={set("role")} className={inputCls} style={inputStyle}>
              {roles.map((r) => <option key={r.slug} value={r.slug}>{r.title}</option>)}
            </select>
          </div>
        )}

        {kind === "career" && (
          <div>
            <label className={labelCls} htmlFor="app-exp">Experience</label>
            <select id="app-exp" value={form.experience} onChange={set("experience")} className={inputCls} style={inputStyle}>
              <option value="">Select</option>
              {EXPERIENCE.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className={labelCls} htmlFor="app-country">Country</label>
          <input id="app-country" value={form.country} onChange={set("country")} className={inputCls} style={inputStyle} placeholder="Where you are based" />
        </div>
        <div>
          <label className={labelCls} htmlFor="app-phone">Phone or WhatsApp <span className="font-medium text-slate-400">(optional)</span></label>
          <input id="app-phone" value={form.phone} onChange={set("phone")} className={inputCls} style={inputStyle} placeholder="+880 1XXX XXXXXX" />
        </div>

        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="app-link">{linkLabel}</label>
          <input id="app-link" value={form.link} onChange={set("link")} className={inputCls} style={inputStyle} placeholder={linkPlaceholder} />
        </div>

        {kind === "affiliate" && (
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="app-audience">{audienceLabel}</label>
            <input id="app-audience" value={form.audience} onChange={set("audience")} className={inputCls} style={inputStyle} placeholder={audiencePlaceholder} />
          </div>
        )}

        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="app-message">{messageLabel}</label>
          <textarea id="app-message" rows={5} value={form.message} onChange={set("message")} className={`${inputCls} resize-y`} style={inputStyle} placeholder={messagePlaceholder} />
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-xl px-4 py-3 text-sm flex items-start gap-2" style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", color: "#b91c1c" }}>
          <MI name="error" className="text-lg flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button type="submit" disabled={sending} className="btn-cta text-white w-full mt-6 py-3.5 rounded-xl text-sm font-bold tracking-tight disabled:opacity-60">
        {sending ? "Sending..." : submitLabel}
      </button>
      <p className="text-xs text-center mt-4" style={{ color: "#98a2b3" }}>
        We read every application by hand and reply within two working days.
      </p>
    </form>
  );
};

export default ApplicationForm;
