// OAuth 2.0 Authorization Server Metadata (RFC 8414).
// Served at /.well-known/oauth-authorization-server via a vercel.json rewrite.
// Advertises the endpoints + PKCE so Claude can register and run the code flow.
import { ISSUER, SCOPE, handledPreflight, sendJson } from "./_lib.js";

export default function handler(req, res) {
  if (handledPreflight(req, res)) return;
  sendJson(res, 200, {
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/authorize`,
    token_endpoint: `${ISSUER}/api/oauth/token`,
    registration_endpoint: `${ISSUER}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    scopes_supported: [SCOPE],
  });
}
