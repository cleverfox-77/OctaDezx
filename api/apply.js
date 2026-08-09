/**
 * Careers and affiliate application intake.
 *
 * WHY THIS EXISTS: the forms used to insert straight into public.applications
 * from the browser and stop there. That worked, which was the problem. Two real
 * applications sat in the table for days with nobody notified, while the form
 * promised a reply within two working days. Storage and notification were two
 * independent things and only one of them was wired up.
 *
 * So both now happen in one request. The row is written first, because losing an
 * applicant is worse than losing a notification, and the email is sent after. If
 * SMTP is down the applicant still gets a success screen and the failure is
 * logged loudly rather than shown to them.
 *
 * The insert uses the public anon key and the existing "anyone can apply" RLS
 * policy, exactly as the browser did. No service-role key on Vercel, no schema
 * change. The unique index on (kind, lower(email)) doubles as free rate
 * limiting: one email address can only ever trigger one notification per
 * programme.
 *
 * Required env (Vercel project settings):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 * Optional env:
 *   SMTP_SECURE     "true" to force TLS on connect (set this when PORT is 465)
 *   SMTP_FROM       From header, defaults to OctaDezx <SMTP_USER>
 *   APPLICATIONS_TO where applications are sent, defaults to kevin@octadezx.com
 */
import nodemailer from "nodemailer";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://dnjhvfmlmvhabrlpcmao.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuamh2Zm1sbXZoYWJybHBjbWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMDE1MjQsImV4cCI6MjA3MjY3NzUyNH0.np24-bIV9yTrJ6_HbBePDvGN01ctc7j86u4qqZUOyK4";

const TO = process.env.APPLICATIONS_TO || "kevin@octadezx.com";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Mirrors the WITH CHECK bounds in 20260724090000_applications.sql. Kept in step
// with the migration so a rejected row comes back as a readable message instead
// of a raw Postgres 400.
const LIMITS = {
  role: 80, full_name: 120, email: 200, phone: 40, country: 80,
  link: 300, audience: 400, experience: 80, message: 3000, source: 200,
};

const clean = (v, max) => {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s.length ? s : null;
};

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function buildEmail(row) {
  const isCareer = row.kind === "career";
  const heading = isCareer ? "New career application" : "New affiliate application";
  const fields = [
    ["Name", row.full_name],
    ["Email", row.email],
    isCareer ? ["Role", row.role] : null,
    isCareer ? ["Experience", row.experience] : null,
    ["Phone", row.phone],
    ["Country", row.country],
    ["Link", row.link],
    !isCareer ? ["Audience", row.audience] : null,
    ["Source", row.source],
  ].filter(Boolean).filter(([, v]) => v);

  const text = [
    `${heading}`,
    "",
    ...fields.map(([k, v]) => `${k}: ${v}`),
    "",
    "Message:",
    row.message || "(none)",
    "",
    `Received: ${new Date().toISOString()}`,
    "Reply directly to this email to reach the applicant.",
  ].join("\n");

  const rows = fields
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 14px 6px 0;color:#667085;font-size:13px;white-space:nowrap;vertical-align:top">${esc(k)}</td>` +
        `<td style="padding:6px 0;color:#101828;font-size:13px">${esc(v)}</td></tr>`,
    )
    .join("");

  const html = `<div style="font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;max-width:620px">
  <h2 style="margin:0 0 4px;font-size:18px;color:#000047">${esc(heading)}</h2>
  <p style="margin:0 0 18px;font-size:13px;color:#98a2b3">octadezx.com</p>
  <table style="border-collapse:collapse;margin-bottom:18px">${rows}</table>
  <div style="border-top:1px solid #e8eaee;padding-top:14px">
    <div style="font-size:12px;color:#667085;margin-bottom:6px">Message</div>
    <div style="font-size:13px;color:#101828;white-space:pre-wrap">${esc(row.message || "(none)")}</div>
  </div>
  <p style="margin-top:20px;font-size:12px;color:#98a2b3">Reply directly to this email to reach the applicant.</p>
</div>`;

  const who = row.full_name || row.email;
  const subject = isCareer
    ? `New career application: ${who}${row.role ? ` (${row.role})` : ""}`
    : `New affiliate application: ${who}`;

  return { subject, text, html };
}

async function sendMail(row) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP is not configured (need SMTP_HOST, SMTP_USER, SMTP_PASS)");
  }
  const port = Number(SMTP_PORT) || 587;
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    // Port 465 is implicit TLS; 587 upgrades with STARTTLS. Allow an override
    // for providers that do not follow the convention.
    secure: SMTP_SECURE ? SMTP_SECURE === "true" : port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const { subject, text, html } = buildEmail(row);
  await transporter.sendMail({
    from: SMTP_FROM || `OctaDezx <${SMTP_USER}>`,
    to: TO,
    replyTo: row.full_name ? `${row.full_name} <${row.email}>` : row.email,
    subject,
    text,
    html,
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

  // Honeypot. A real person never sees this field, so anything in it is a bot.
  // Answer 200 so the bot believes it succeeded and does not retry.
  if (typeof body.company_website === "string" && body.company_website.trim()) {
    console.warn("[apply] honeypot triggered, dropping submission");
    return res.status(200).json({ ok: true });
  }

  const kind = body.kind === "career" || body.kind === "affiliate" ? body.kind : null;
  if (!kind) return res.status(400).json({ ok: false, error: "Unknown application type." });

  const full_name = clean(body.full_name, LIMITS.full_name);
  const email = clean(body.email, LIMITS.email)?.toLowerCase() ?? null;
  if (!full_name || full_name.length < 2) {
    return res.status(400).json({ ok: false, error: "Please enter your full name." });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: "Please enter a valid email address." });
  }

  const row = {
    kind,
    role: kind === "career" ? clean(body.role, LIMITS.role) : null,
    full_name,
    email,
    phone: clean(body.phone, LIMITS.phone),
    country: clean(body.country, LIMITS.country),
    link: clean(body.link, LIMITS.link),
    audience: kind === "affiliate" ? clean(body.audience, LIMITS.audience) : null,
    experience: clean(body.experience, LIMITS.experience),
    message: clean(body.message, LIMITS.message),
    source: clean(body.source, LIMITS.source),
  };

  // 1. Save first. An applicant we cannot email is recoverable; one we never
  //    stored is gone.
  let saved;
  try {
    saved = await fetch(`${SUPABASE_URL}/rest/v1/applications`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
  } catch (err) {
    console.error("[apply] could not reach Supabase:", err);
    return res.status(502).json({ ok: false, error: "We could not save that. Please try again." });
  }

  if (!saved.ok) {
    const detail = await saved.text().catch(() => "");
    // The unique index doing its job, not an error worth alarming anyone about.
    if (saved.status === 409 || detail.includes("23505")) {
      return res.status(409).json({ ok: false, code: "duplicate" });
    }
    console.error("[apply] insert rejected:", saved.status, detail);
    return res.status(500).json({ ok: false, error: "We could not save that. Please try again." });
  }

  // 2. Notify. A failure here must not cost the applicant their submission, so
  //    it is logged and swallowed. `emailed` lets the caller tell the difference.
  try {
    await sendMail(row);
  } catch (err) {
    console.error("[apply] SAVED BUT NOT EMAILED:", err.message, "| applicant:", email);
    return res.status(200).json({ ok: true, emailed: false });
  }

  return res.status(200).json({ ok: true, emailed: true });
}
