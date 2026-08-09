/**
 * Send a team invitation.
 *
 *   POST /team-invite  { business_id, email, role }
 *
 * The invitation itself is created with the CALLER'S OWN JWT, not the service
 * role. That is deliberate: create_team_invitation already checks the caller is
 * an owner or admin, that only an owner may create admins, and that the plan
 * has a seat free. Creating it here with the service role would bypass
 * auth.uid() and force this function to reimplement all three checks, giving
 * two places for the rule to live and one place for it to rot.
 *
 * The service role is used for exactly one thing: send_email_message, the
 * MailerSend RPC, which is service-role-only so that a browser can never send
 * mail from the verified domain.
 *
 * The raw token exists only in this request. The database stores its SHA-256.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { escapeHtml } from "../_shared/notify.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://octadezx.com").replace(/\/$/, "");

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization header" }, 401);

  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const businessId = String(body.business_id ?? "");
  const email = String(body.email ?? "").trim().toLowerCase();
  const role = String(body.role ?? "agent");
  if (!businessId || !email) return json({ error: "business_id and email are required" }, 400);

  // Every authorisation rule is enforced inside this RPC. A caller who is not a
  // manager, or whose plan is full, gets an exception here and nothing is
  // created, so there is no state to unwind.
  const { data: created, error: rpcErr } = await userClient.rpc("create_team_invitation", {
    p_business_id: businessId,
    p_email: email,
    p_role: role,
  });
  if (rpcErr) {
    console.error("create_team_invitation failed:", rpcErr.message);
    return json({ error: rpcErr.message }, 403);
  }

  const invitation = (created as { token: string }[] | null)?.[0];
  if (!invitation?.token) return json({ error: "Could not create the invitation" }, 500);

  const inviteUrl = `${SITE_URL}/dashboard?invite=${encodeURIComponent(invitation.token)}`;

  // Business name for the email. Read with the caller's client so it is still
  // subject to RLS; they are a manager, so it resolves.
  const { data: biz } = await userClient
    .from("businesses").select("name").eq("id", businessId).maybeSingle();
  const businessName = biz?.name ?? "an OctaDezx workspace";

  // Only now do we reach for the service role, and only to post the mail.
  let emailed = false;
  try {
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const sender = Deno.env.get("EMAIL_SENDER") || "noreply@octadezx.com";
    const safeName = escapeHtml(businessName);
    const safeInviter = escapeHtml(user.email ?? "a teammate");

    const { error: mailErr } = await admin.rpc("send_email_message", {
      message: {
        sender,
        recipient: email,
        subject: `${safeInviter} invited you to ${safeName} on OctaDezx`,
        html_body: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0f172a">
            <h2 style="margin:0 0 16px;font-size:20px;font-weight:800">You have been added to ${safeName}</h2>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569">
              ${safeInviter} invited you to help handle customer conversations for ${safeName} on OctaDezx.
            </p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569">
              This link works once and expires in 7 days. It only opens for this email address, so sign in
              or sign up with <strong>${escapeHtml(email)}</strong> first if you do not have an account yet.
            </p>
            <a href="${inviteUrl}" style="display:inline-block;background:#000047;color:#fff;text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:700;font-size:15px">
              Join the team
            </a>
            <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#94a3b8">
              If the button does not work, paste this into your browser:<br>${inviteUrl}
            </p>
            <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">
              Not expecting this? Ignore this email and nothing happens.
            </p>
          </div>`,
      },
    });
    if (mailErr) console.error("send_email_message failed:", mailErr.message);
    else emailed = true;
  } catch (err) {
    // A mail failure must not lose the invitation: the manager still gets the
    // link back and can send it themselves.
    console.error("team-invite mail error:", err);
  }

  return json({ ok: true, emailed, invite_url: inviteUrl });
});
