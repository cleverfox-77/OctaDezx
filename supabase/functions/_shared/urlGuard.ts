// Shared SSRF guard for edge functions that fetch user-supplied URLs.
// Blocks non-http(s) schemes and any host that resolves to a private,
// loopback, link-local (incl. the cloud metadata 169.254.169.254) or
// otherwise non-public address.

function ipv4ToParts(host: string): number[] | null {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1).map((n) => Number(n));
  if (parts.some((n) => n < 0 || n > 255)) return null;
  return parts;
}

export function isPrivateIPv4(host: string): boolean {
  const p = ipv4ToParts(host);
  if (!p) return false;
  const [a, b] = p;
  if (a === 10) return true;                          // 10.0.0.0/8
  if (a === 127) return true;                         // loopback
  if (a === 0) return true;                            // 0.0.0.0/8
  if (a === 169 && b === 254) return true;             // link-local + metadata
  if (a === 172 && b >= 16 && b <= 31) return true;    // 172.16.0.0/12
  if (a === 192 && b === 168) return true;             // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true;   // CGNAT 100.64.0.0/10
  if (a >= 224) return true;                           // multicast / reserved
  return false;
}

function isPrivateIPv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "::1" || h === "::") return true;          // loopback / unspecified
  if (h.startsWith("fe80")) return true;               // link-local
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique local fc00::/7
  // IPv4-mapped (e.g. ::ffff:169.254.169.254)
  const v4 = h.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4 && isPrivateIPv4(v4[1])) return true;
  return false;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
]);

export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith(".internal") || h.endsWith(".local")) return true;
  if (isPrivateIPv4(h)) return true;
  if (h.includes(":") && isPrivateIPv6(h)) return true;
  return false;
}

// Validates a URL string and (best effort) its resolved IPs. Throws on anything
// that is not a public http(s) endpoint. Returns the parsed URL when safe.
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http(s) URLs are allowed");
  }
  if (isBlockedHost(url.hostname)) {
    throw new Error("Blocked host");
  }

  // Best-effort DNS check to catch hostnames that point at internal IPs.
  try {
    const resolved: string[] = [];
    // @ts-ignore — Deno is the edge runtime
    if (typeof Deno !== "undefined" && Deno.resolveDns) {
      // @ts-ignore
      const a = await Deno.resolveDns(url.hostname, "A").catch(() => []);
      // @ts-ignore
      const aaaa = await Deno.resolveDns(url.hostname, "AAAA").catch(() => []);
      resolved.push(...a, ...aaaa);
    }
    for (const ip of resolved) {
      if (isPrivateIPv4(ip) || isPrivateIPv6(ip)) throw new Error("Resolves to a private address");
    }
  } catch (e) {
    if (e instanceof Error && /private address/.test(e.message)) throw e;
    // DNS failures are non-fatal: the subsequent fetch will surface real errors.
  }

  return url;
}
