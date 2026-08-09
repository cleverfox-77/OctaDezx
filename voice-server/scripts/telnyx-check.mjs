#!/usr/bin/env node
/**
 * Ask Telnyx directly what is wrong with the account.
 *
 * The dashboard's number search goes through an edge function, which turns any
 * carrier failure into one line of toast text. When that line is unhelpful, run
 * this: it makes the same calls with the same parameters and prints Telnyx's
 * full answer, so the difference between a bad key, an unfunded account and a
 * country with no stock is visible rather than guessed at.
 *
 *   TELNYX_API_KEY=KEY... node scripts/telnyx-check.mjs
 *   TELNYX_API_KEY=KEY... node scripts/telnyx-check.mjs --country BD
 *
 * The key is read from the environment and never printed. It is the same key
 * held in Supabase secrets; nothing here writes or buys anything.
 */

const API = "https://api.telnyx.com/v2";
const key = process.env.TELNYX_API_KEY ?? "";
const appId = process.env.TELNYX_TEXML_APP_ID ?? "";

// Accept both "--country BD" and a bare "BD". Requiring the flag meant a bare
// code was ignored and the script searched US while printing that it had, which
// is a worse failure than refusing the argument outright.
const args = process.argv.slice(2);
const flagAt = args.indexOf("--country");
const positional = args.find((a) => /^[A-Za-z]{2}$/.test(a));
const country = (flagAt >= 0 ? args[flagAt + 1] : positional ?? "US").toUpperCase();

const stray = args.filter((a, i) => a !== country && a !== "--country" && i !== flagAt + 1);
if (stray.length) {
  console.log(`Ignoring unrecognised argument(s): ${stray.join(" ")}\n`);
}

if (!key) {
  console.error("TELNYX_API_KEY is not set in this shell.\n");
  console.error("PowerShell:  $env:TELNYX_API_KEY = 'KEY...'; node scripts/telnyx-check.mjs");
  console.error("bash:        TELNYX_API_KEY=KEY... node scripts/telnyx-check.mjs");
  process.exit(2);
}

// A placeholder that reached the secret store is the single most common cause
// of this whole class of failure, so name it before spending a request on it.
const looksPlaceholder = key === "..." || /^(your|the)[-_]/i.test(key) || key.length < 20;
console.log(`API key: ${key.length} characters, ends "${key.slice(-4)}"`);
if (looksPlaceholder) {
  console.log("  ^ this does not look like a real Telnyx key (they start with KEY and are ~50 chars)");
}
console.log(`TeXML application id: ${appId ? appId : "not set in this shell"}`);
// Angle brackets and quotes survive a copy from documentation and are then sent
// verbatim to the carrier, which reports the whole thing as an invalid id. This
// has already happened once on this project with a different secret, so it gets
// named rather than left to be deduced from the API's echo of the bad value.
if (appId && /[<>"'\s]/.test(appId)) {
  console.log("  ^ contains brackets, quotes or spaces. The id should be digits only.");
  console.log(`    stripped, it would be: ${appId.replace(/[<>"'\s]/g, "")}`);
}
console.log("");

async function call(label, path) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const body = await res.json().catch(() => ({}));
  const ok = res.ok ? "OK " : "ERR";
  console.log(`[${ok}] ${label}  ->  HTTP ${res.status}`);

  if (!res.ok) {
    for (const e of body?.errors ?? []) {
      console.log(`      ${e.code ?? "?"}: ${e.title ?? ""}`);
      if (e.detail) console.log(`      ${e.detail}`);
    }
    if (!body?.errors) console.log(`      ${JSON.stringify(body).slice(0, 400)}`);
  }
  return { res, body };
}

console.log("1. Is the key accepted at all?");
const balance = await call("GET /balance", "/balance");
if (balance.res.ok) {
  const d = balance.body?.data ?? {};
  console.log(`      balance ${d.balance ?? "?"} ${d.currency ?? ""}, credit limit ${d.credit_limit ?? "?"}`);
  console.log(`      available to spend: ${d.available_credit ?? "?"}`);
}
console.log("");

console.log(`2. The exact search the dashboard runs (country ${country}):`);
const qs = new URLSearchParams();
qs.set("filter[country_code]", country);
qs.set("filter[features][]", "voice");
qs.set("filter[limit]", "20");
const search = await call("GET /available_phone_numbers", `/available_phone_numbers?${qs}`);
if (search.res.ok) {
  const rows = search.body?.data ?? [];
  console.log(`      ${rows.length} number(s) offered`);

  // Price is the thing people query, so print the whole cost record rather than
  // one field: a low monthly with a large upfront reads as cheap until the
  // invoice arrives, and the currency is not always dollars.
  for (const n of rows.slice(0, 8)) {
    const c = n.cost_information ?? {};
    const cur = c.currency ?? "?";
    const monthly = c.monthly_cost != null ? `${Number(c.monthly_cost).toFixed(2)} ${cur}/mo` : "no monthly quoted";
    const upfront = c.upfront_cost != null && Number(c.upfront_cost) > 0
      ? `, ${Number(c.upfront_cost).toFixed(2)} ${cur} once` : "";
    console.log(`      ${n.phone_number}  [${n.phone_number_type ?? "type?"}]  ${monthly}${upfront}`);
  }

  // Grouping by type is the answer to "why is this country so expensive": an
  // unfiltered search mixes local, national and mobile, which are priced
  // nothing like each other.
  const byType = {};
  for (const n of rows) {
    const t = n.phone_number_type ?? "unknown";
    const m = Number(n.cost_information?.monthly_cost ?? 0);
    (byType[t] ??= []).push(m);
  }
  const types = Object.entries(byType);
  if (types.length > 1 || rows.length > 8) {
    console.log("      --- monthly cost by number type ---");
    for (const [t, costs] of types) {
      const lo = Math.min(...costs).toFixed(2);
      const hi = Math.max(...costs).toFixed(2);
      console.log(`      ${t}: ${costs.length} number(s), ${lo} to ${hi}`);
    }
  }

  if (rows.length === 0) {
    console.log("      Telnyx has no voice-capable stock for that country right now.");
    console.log("      That is an inventory answer, not a fault: try another country.");
    console.log("      Some countries (India, for one) Telnyx does not sell at all.");
  }
}
console.log("");

console.log("3. Numbers already on the account:");
const owned = await call("GET /phone_numbers", "/phone_numbers?page[size]=5");
if (owned.res.ok) {
  const rows = owned.body?.data ?? [];
  console.log(`      ${rows.length} owned`);
  for (const n of rows) console.log(`      ${n.phone_number}  connection ${n.connection_id ?? "none"}`);
}
console.log("");

// TeXML applications are their own resource and do NOT appear under
// /connections, so an id missing from this list proves nothing. Listed only for
// completeness; step 5 is the one that decides.
console.log("4. SIP connections on the account (TeXML apps are listed separately, in step 5):");
const conns = await call("GET /connections", "/connections?page[size]=25");
if (conns.res.ok) {
  const rows = conns.body?.data ?? [];
  if (!rows.length) console.log("      none");
  for (const c of rows) {
    console.log(`      ${c.id}  ${c.connection_name ?? c.record_type ?? ""}`);
  }
}
console.log("");

if (appId) {
  const clean = appId.replace(/[<>"'\s]/g, "");
  console.log("5. Is the configured id a real TeXML application?");
  await call(`GET /texml_applications/${clean}`, `/texml_applications/${clean}`);
  console.log("");
}

console.log("Reading the result:");
console.log("  401 / 'Authentication failed'  -> the key in Supabase secrets is wrong or a placeholder.");
console.log("  403 / 'not permitted'          -> the account is still trial; upgrade it in the portal.");
console.log("  200 with 0 numbers             -> the key is fine, that country simply has no stock.");
console.log("  step 5 returns 200             -> the id is a real TeXML application and is fine to use.");
console.log("  'Invalid Connection ID' anyway -> the copy stored in Supabase differs from the one");
console.log("                                    tested here, usually wrapping brackets or quotes.");
