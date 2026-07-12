// Owner email notifications (escalations, order confirmations).
// Delivery goes through the send_email_message Postgres RPC (MailerSend via
// the http extension). That RPC is service-role-only, so it can only be called
// from edge functions — never directly from a browser.

// deno-lint-ignore no-explicit-any
type AnyClient = any;

const DASHBOARD_URL = "https://octadezx.com/dashboard";

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Resolve the business owner's login email (auth.users) — per product spec the
// notification goes to the address the owner signs in with.
export async function getOwnerContact(
  supabase: AnyClient,
  businessId: string,
): Promise<{ email: string | null; businessName: string }> {
  const { data: biz, error } = await supabase
    .from("businesses")
    .select("name, owner_id")
    .eq("id", businessId)
    .single();

  if (error || !biz) {
    console.error("getOwnerContact: business lookup failed", error);
    return { email: null, businessName: "" };
  }

  const { data, error: userErr } = await supabase.auth.admin.getUserById(biz.owner_id);
  if (userErr) {
    console.error("getOwnerContact: auth user lookup failed", userErr);
    return { email: null, businessName: biz.name };
  }

  return { email: data?.user?.email ?? null, businessName: biz.name };
}

export async function sendOwnerEmail(
  supabase: AnyClient,
  opts: { to: string; subject: string; html: string },
): Promise<boolean> {
  const sender = Deno.env.get("EMAIL_SENDER") || "noreply@octadezx.com";
  try {
    const { error } = await supabase.rpc("send_email_message", {
      message: {
        sender,
        recipient: opts.to,
        subject: opts.subject,
        html_body: opts.html,
      },
    });
    if (error) {
      console.error("sendOwnerEmail: RPC failed", error);
      return false;
    }
    console.log(`📧 Email sent to ${opts.to}: ${opts.subject}`);
    return true;
  } catch (err) {
    console.error("sendOwnerEmail: unexpected error", err);
    return false;
  }
}

// ── Shared layout ────────────────────────────────────────────────────────────

function emailShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td style="background:#111827;padding:20px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:bold;">OctaDezx</span>
            <span style="color:#9ca3af;font-size:12px;margin-left:8px;">AI Customer Care</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">${title}</h2>
            ${bodyHtml}
            <div style="margin-top:24px;">
              <a href="${DASHBOARD_URL}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:10px 20px;border-radius:8px;">Open Dashboard</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">You're receiving this because you own this business on OctaDezx. Manage notifications from your dashboard.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;font-size:13px;color:#6b7280;width:140px;vertical-align:top;">${label}</td>
    <td style="padding:6px 0;font-size:13px;color:#111827;">${value}</td>
  </tr>`;
}

// ── Escalation email ─────────────────────────────────────────────────────────

export function buildEscalationEmail(opts: {
  businessName: string;
  customerName: string | null;
  customerEmail: string | null;
  reason: string;
  lastMessage: string;
}): { subject: string; html: string } {
  const subject = `⚠️ Chat escalated to you — ${opts.businessName}`;
  const body = `
    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 16px;">
      Your AI assistant handed a conversation over to a human. The customer is
      waiting for a reply in the <strong>Escalated Chats</strong> section of your dashboard.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px;">
      ${infoRow("Customer", escapeHtml(opts.customerName || "Anonymous"))}
      ${infoRow("Email", escapeHtml(opts.customerEmail || "Not provided"))}
      ${infoRow("Reason", escapeHtml(opts.reason))}
      ${infoRow("Last message", `&ldquo;${escapeHtml(opts.lastMessage.slice(0, 300))}&rdquo;`)}
    </table>`;
  return { subject, html: emailShell("A customer needs your attention", body) };
}

// ── Order confirmation email ─────────────────────────────────────────────────

export function buildOrderEmail(opts: {
  businessName: string;
  orderId: string;
  items: { name: string; price: number; quantity: number }[];
  total: number;
  customerName: string | null;
  customerEmail: string | null;
}): { subject: string; html: string } {
  const subject = `🛒 New order — $${opts.total.toFixed(2)} — ${opts.businessName}`;

  const itemRows = opts.items
    .map(
      (it) => `<tr>
        <td style="padding:8px 12px;font-size:13px;color:#111827;border-bottom:1px solid #f3f4f6;">${escapeHtml(it.name)}</td>
        <td style="padding:8px 12px;font-size:13px;color:#6b7280;border-bottom:1px solid #f3f4f6;text-align:center;">×${it.quantity}</td>
        <td style="padding:8px 12px;font-size:13px;color:#111827;border-bottom:1px solid #f3f4f6;text-align:right;">$${(it.price * it.quantity).toFixed(2)}</td>
      </tr>`,
    )
    .join("");

  const body = `
    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 16px;">
      Your AI assistant just confirmed a new order for <strong>${escapeHtml(opts.businessName)}</strong>.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px;">
      ${infoRow("Order ID", escapeHtml(opts.orderId))}
      ${infoRow("Customer", escapeHtml(opts.customerName || "Anonymous"))}
      ${infoRow("Email", escapeHtml(opts.customerEmail || "Not provided"))}
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <tr style="background:#f9fafb;">
        <th style="padding:8px 12px;font-size:12px;color:#6b7280;text-align:left;">Item</th>
        <th style="padding:8px 12px;font-size:12px;color:#6b7280;text-align:center;">Qty</th>
        <th style="padding:8px 12px;font-size:12px;color:#6b7280;text-align:right;">Subtotal</th>
      </tr>
      ${itemRows}
      <tr>
        <td colspan="2" style="padding:10px 12px;font-size:14px;font-weight:bold;color:#111827;">Total</td>
        <td style="padding:10px 12px;font-size:14px;font-weight:bold;color:#111827;text-align:right;">$${opts.total.toFixed(2)}</td>
      </tr>
    </table>`;
  return { subject, html: emailShell("New order received", body) };
}
