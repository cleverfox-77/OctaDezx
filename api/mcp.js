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

// Humans clicking octadezx.com/mcp in a browser get instructions instead of a
// raw 401. MCP clients are untouched: they POST JSON-RPC or GET with
// Accept: text/event-stream, never a bare text/html GET without auth.
const CONNECT_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>OctaDezx MCP endpoint — connect Claude to your business</title>
<style>
body{margin:0;font-family:Inter,system-ui,-apple-system,sans-serif;background:#f4f5f7;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
.card{max-width:640px;background:#fff;border:1px solid #e8eaee;border-radius:20px;padding:40px;box-shadow:0 24px 60px rgba(16,24,40,.12)}
h1{font-size:22px;margin:0 0 8px}p{line-height:1.65;color:#475569;font-size:15px}
code{background:#f2f4f7;border:1px solid #e8eaee;border-radius:8px;padding:3px 8px;font-size:13px}
ol{color:#475569;line-height:1.9;font-size:15px;padding-left:20px}
.badge{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#000047;background:rgba(0,0,71,.08);border:1px solid rgba(0,0,71,.18);border-radius:999px;padding:5px 12px;margin-bottom:16px}
a{color:#000047;font-weight:600}
.note{font-size:13px;color:#667085;border-top:1px solid #eef0f3;padding-top:16px;margin-top:24px}
</style></head><body><div class="card">
<div class="badge">OctaDezx · MCP endpoint</div>
<h1>You found the machine door. Here is the human one.</h1>
<p>This URL is a live <strong>Model Context Protocol</strong> server. It speaks JSON-RPC to AI clients like Claude, which is why it looks blank in a browser. Connecting takes about a minute:</p>
<ol>
<li>Open <a href="https://claude.ai/settings/connectors" rel="noopener">claude.ai &rarr; Settings &rarr; Connectors</a></li>
<li>Choose <strong>Add custom connector</strong> and paste <code>https://octadezx.com/mcp</code></li>
<li>Approve access with your OctaDezx account when Claude asks</li>
</ol>
<p>Then just talk: <em>"Any customers waiting on us?"</em>, <em>"Reply to Sofia that her refund went out"</em>, <em>"Add this to the knowledge base."</em></p>
<p class="note">Works from your first minute on the free trial. After the 24-hour trial ends, an active subscription keeps the connection live. No account yet? <a href="https://octadezx.com/auth">Start free</a>.</p>
</div></body></html>`;

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // Browser visit (plain GET, wants HTML, no credentials) → connect instructions.
  const accept = String(req.headers["accept"] || "");
  if (req.method === "GET" && !req.headers["authorization"] && accept.includes("text/html")) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.status(200).send(CONNECT_PAGE);
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
