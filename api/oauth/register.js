// Dynamic Client Registration (RFC 7591).
// Claude POSTs its redirect_uris on first connect; we mint a client_id.
// Public PKCE clients get no secret (token_endpoint_auth_method = "none").
import {
  randomToken,
  readBody,
  restInsert,
  isAllowedRedirect,
  handledPreflight,
  sendJson,
  oauthError,
} from "./_lib.js";

export default async function handler(req, res) {
  if (handledPreflight(req, res)) return;
  if (req.method !== "POST") return oauthError(res, 405, "invalid_request", "POST required");

  try {
    const body = readBody(req);
    const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];

    if (redirectUris.length === 0) {
      return oauthError(res, 400, "invalid_redirect_uri", "redirect_uris is required");
    }
    for (const uri of redirectUris) {
      if (typeof uri !== "string" || !isAllowedRedirect(uri)) {
        return oauthError(
          res,
          400,
          "invalid_redirect_uri",
          `redirect_uri not allowed: ${uri}. Must be a Claude (claude.ai/claude.com) https URL or http loopback.`,
        );
      }
    }

    const clientId = randomToken("odxc_", 16);
    const clientName =
      typeof body.client_name === "string" && body.client_name.trim()
        ? body.client_name.trim().slice(0, 200)
        : "MCP Client";

    await restInsert("oauth_clients", {
      client_id: clientId,
      client_secret: null,
      client_name: clientName,
      redirect_uris: redirectUris,
    });

    // RFC 7591 §3.2.1 — echo back the registered metadata.
    return sendJson(res, 201, {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: redirectUris,
      client_name: clientName,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "octadezx",
    });
  } catch (e) {
    console.error("register error:", e);
    return oauthError(res, 500, "server_error", "Registration failed");
  }
}
