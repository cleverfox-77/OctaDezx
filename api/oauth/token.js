// Token endpoint (RFC 6749 / OAuth 2.1).
// grant_type=authorization_code → verify the code + PKCE, issue access+refresh.
// grant_type=refresh_token      → rotate to a fresh access+refresh pair.
// All codes/tokens are looked up by SHA-256 hash; plaintext is never stored.
import {
  ACCESS_TTL_SEC,
  REFRESH_TTL_SEC,
  randomToken,
  sha256hex,
  sha256b64url,
  readBody,
  restSelect,
  restInsert,
  restPatch,
  handledPreflight,
  sendJson,
  oauthError,
} from "./_lib.js";

async function issueTokens(res, { business_id, user_id, client_id, scope, resource }) {
  const accessToken = randomToken("odxat_", 32);
  const refreshToken = randomToken("odxrt_", 32);
  const now = Date.now();

  await restInsert("oauth_access_tokens", {
    token_hash: sha256hex(accessToken),
    business_id,
    user_id,
    client_id,
    scope: scope || "octadezx",
    resource: resource || null,
    expires_at: new Date(now + ACCESS_TTL_SEC * 1000).toISOString(),
  });
  await restInsert("oauth_refresh_tokens", {
    token_hash: sha256hex(refreshToken),
    business_id,
    user_id,
    client_id,
    scope: scope || "octadezx",
    resource: resource || null,
    expires_at: new Date(now + REFRESH_TTL_SEC * 1000).toISOString(),
  });

  return sendJson(res, 200, {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TTL_SEC,
    refresh_token: refreshToken,
    scope: scope || "octadezx",
  });
}

export default async function handler(req, res) {
  if (handledPreflight(req, res)) return;
  if (req.method !== "POST") return oauthError(res, 405, "invalid_request", "POST required");

  try {
    const body = readBody(req);
    const grant = body.grant_type;

    // ── authorization_code ──
    if (grant === "authorization_code") {
      const { code, code_verifier, redirect_uri, client_id } = body;
      if (!code || !code_verifier) {
        return oauthError(res, 400, "invalid_request", "code and code_verifier required");
      }

      const codeHash = sha256hex(code);
      const rows = await restSelect("oauth_authorization_codes", `code_hash=eq.${codeHash}&select=*`);
      const ac = rows[0];
      if (!ac) return oauthError(res, 400, "invalid_grant", "Unknown or expired code");
      if (ac.used_at) return oauthError(res, 400, "invalid_grant", "Code already used");
      if (new Date(ac.expires_at).getTime() < Date.now()) {
        return oauthError(res, 400, "invalid_grant", "Code expired");
      }
      if (client_id && ac.client_id !== client_id) {
        return oauthError(res, 400, "invalid_grant", "client_id mismatch");
      }
      if (redirect_uri && ac.redirect_uri !== redirect_uri) {
        return oauthError(res, 400, "invalid_grant", "redirect_uri mismatch");
      }
      // PKCE S256: base64url(sha256(verifier)) must equal the stored challenge.
      if (sha256b64url(code_verifier) !== ac.code_challenge) {
        return oauthError(res, 400, "invalid_grant", "PKCE verification failed");
      }

      // Consume the code atomically (only the first caller patches a row).
      const consumed = await restPatch(
        "oauth_authorization_codes",
        `code_hash=eq.${codeHash}&used_at=is.null`,
        { used_at: new Date().toISOString() },
      );
      if (!consumed.length) return oauthError(res, 400, "invalid_grant", "Code already used");

      return issueTokens(res, {
        business_id: ac.business_id,
        user_id: ac.user_id,
        client_id: ac.client_id,
        scope: ac.scope,
        resource: ac.resource,
      });
    }

    // ── refresh_token ──
    if (grant === "refresh_token") {
      const { refresh_token, client_id } = body;
      if (!refresh_token) return oauthError(res, 400, "invalid_request", "refresh_token required");

      const rtHash = sha256hex(refresh_token);
      const rows = await restSelect("oauth_refresh_tokens", `token_hash=eq.${rtHash}&select=*`);
      const rt = rows[0];
      if (!rt || rt.revoked_at || new Date(rt.expires_at).getTime() < Date.now()) {
        return oauthError(res, 400, "invalid_grant", "Invalid or expired refresh token");
      }
      if (client_id && rt.client_id !== client_id) {
        return oauthError(res, 400, "invalid_grant", "client_id mismatch");
      }

      // Rotate: revoke the presented refresh token, issue a fresh pair.
      await restPatch("oauth_refresh_tokens", `token_hash=eq.${rtHash}`, {
        revoked_at: new Date().toISOString(),
      });
      return issueTokens(res, {
        business_id: rt.business_id,
        user_id: rt.user_id,
        client_id: rt.client_id,
        scope: rt.scope,
        resource: rt.resource,
      });
    }

    return oauthError(res, 400, "unsupported_grant_type", `Unsupported grant_type: ${grant}`);
  } catch (e) {
    console.error("token error:", e);
    return oauthError(res, 500, "server_error", "Token issuance failed");
  }
}
