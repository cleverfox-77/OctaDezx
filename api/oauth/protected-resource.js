// OAuth 2.0 Protected Resource Metadata (RFC 9728).
// Served at /.well-known/oauth-protected-resource via a vercel.json rewrite.
// Tells the MCP client which authorization server guards the MCP resource.
import { ISSUER, MCP_RESOURCE, SCOPE, handledPreflight, sendJson } from "./_lib.js";

export default function handler(req, res) {
  if (handledPreflight(req, res)) return;
  sendJson(res, 200, {
    resource: MCP_RESOURCE,
    authorization_servers: [ISSUER],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ["header"],
    resource_documentation: "https://octadezx.com/dashboard",
  });
}
