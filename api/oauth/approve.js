// Consent approval → authorization code.
// Called by the /authorize consent page (NOT by Claude). The logged-in owner
// has clicked "Authorize"; the page sends their Supabase access token + the
// OAuth request params + the chosen business_id. We verify the human owns the
// business, then mint a single-use, PKCE-bound authorization code and return the
// redirect_uri Claude should be sent back to.
import {
  CODE_TTL_SEC,
  randomToken,
  sha256hex,
  readBody,
  restSelect,
  restInsert,
  verifyUser,
  handledPreflight,
  sendJson,
} from "./_lib.js";

export default async function handler(req, res) {
  if (handledPreflight(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "method_not_allowed" });

  try {
    const body = readBody(req);
    const {
      access_token,
      client_id,
      redirect_uri,
      code_challenge,
      code_challenge_method,
      state,
      scope,
      resource,
      business_id,
    } = body;

    // 1. Authenticate the human.
    const user = await verifyUser(access_token);
    if (!user?.id) return sendJson(res, 401, { error: "not_authenticated" });

    // 2. PKCE is mandatory.
    if (!code_challenge || (code_challenge_method && code_challenge_method !== "S256")) {
      return sendJson(res, 400, { error: "invalid_request", error_description: "PKCE S256 required" });
    }

    // 3. Validate the client + exact redirect_uri match.
    if (!client_id || !redirect_uri) {
      return sendJson(res, 400, { error: "invalid_request", error_description: "client_id and redirect_uri required" });
    }
    const clients = await restSelect(
      "oauth_clients",
      `client_id=eq.${encodeURIComponent(client_id)}&select=client_id,redirect_uris`,
    );
    const client = clients[0];
    if (!client) return sendJson(res, 400, { error: "invalid_client" });
    if (!Array.isArray(client.redirect_uris) || !client.redirect_uris.includes(redirect_uri)) {
      return sendJson(res, 400, { error: "invalid_request", error_description: "redirect_uri mismatch" });
    }

    // 4. Confirm the user owns this business.
    if (!business_id) return sendJson(res, 400, { error: "invalid_request", error_description: "business_id required" });
    const owned = await restSelect(
      "businesses",
      `id=eq.${encodeURIComponent(business_id)}&owner_id=eq.${user.id}&select=id`,
    );
    if (!owned[0]) return sendJson(res, 403, { error: "forbidden", error_description: "Not your business" });

    // 5. Mint a single-use authorization code (store hash only).
    const code = randomToken("odxac_", 32);
    await restInsert("oauth_authorization_codes", {
      code_hash: sha256hex(code),
      client_id,
      business_id,
      user_id: user.id,
      redirect_uri,
      code_challenge,
      code_challenge_method: "S256",
      scope: scope || "octadezx",
      resource: resource || null,
      expires_at: new Date(Date.now() + CODE_TTL_SEC * 1000).toISOString(),
    });

    // 6. Build the redirect back to Claude.
    const out = new URL(redirect_uri);
    out.searchParams.set("code", code);
    if (state) out.searchParams.set("state", state);
    return sendJson(res, 200, { redirect_to: out.toString() });
  } catch (e) {
    console.error("approve error:", e);
    return sendJson(res, 500, { error: "server_error" });
  }
}
