// Branded MCP endpoint: https://octadezx.com/mcp
// Thin proxy to the Supabase `mcp` edge function so the whole connector +
// OAuth flow lives on one octadezx.com origin (clean URL, robust discovery).
// Relays the request body + Authorization header, and — critically — passes the
// WWW-Authenticate response header back so Claude can discover the OAuth server.
const MCP_UPSTREAM = "https://dnjhvfmlmvhabrlpcmao.supabase.co/functions/v1/mcp";

const FORWARD_REQ_HEADERS = ["authorization", "content-type", "accept", "mcp-protocol-version", "mcp-session-id"];
const FORWARD_RES_HEADERS = ["content-type", "www-authenticate", "mcp-session-id", "cache-control"];

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type, mcp-protocol-version, mcp-session-id");
  res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate, Mcp-Session-Id");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    const headers = {};
    for (const h of FORWARD_REQ_HEADERS) {
      if (req.headers[h]) headers[h] = req.headers[h];
    }

    const options = { method: req.method, headers };
    if (req.method !== "GET" && req.method !== "HEAD") {
      headers["content-type"] = headers["content-type"] || "application/json";
      options.body = req.body == null ? undefined : typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    }

    const upstream = await fetch(MCP_UPSTREAM, options);
    const buffer = Buffer.from(await upstream.arrayBuffer());

    for (const h of FORWARD_RES_HEADERS) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    res.status(upstream.status).send(buffer);
  } catch (err) {
    console.error("mcp proxy error:", err);
    res.status(502).json({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32603, message: "MCP upstream unreachable" },
    });
  }
}
