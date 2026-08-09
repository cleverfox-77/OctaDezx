/**
 * Telnyx helpers for the Supabase-side voice webhooks.
 *
 * Replaces the previous Twilio module. Two differences matter beyond the
 * vendor name:
 *
 * 1. Signatures are Ed25519 over `{timestamp}|{raw body}`, not HMAC-SHA1 over
 *    the URL plus sorted parameters. That means the raw body has to be kept
 *    verbatim, so every caller reads the request once via readTelnyxRequest and
 *    gets both the parsed parameters and the exact bytes that were signed. It
 *    also means the old candidateUrls dance is gone: Telnyx never signs the URL,
 *    so a proxy rewriting the host can no longer break verification.
 *
 * 2. Verification uses a PUBLIC key, so TELNYX_PUBLIC_KEY is not a secret and
 *    cannot be used to forge anything. Placing calls needs TELNYX_API_KEY, which
 *    very much is one.
 *
 * Verifying is not optional. An unverified endpoint lets anyone who learns the
 * URL inject fake recordings and call events into a customer's history.
 */

const API = "https://api.telnyx.com/v2";

/** Telnyx rejects webhooks older than this. Also bounds replay of a captured one. */
const MAX_SIGNATURE_AGE_SECONDS = 300;

const env = (name: string): string => Deno.env.get(name) ?? "";

/**
 * Read an identifier, tolerating the wrapper characters that come with copying
 * a value out of documentation or a portal.
 *
 * Angle brackets, quotes and stray whitespace are never part of a Telnyx id, so
 * removing them cannot change a good value. It has already cost this project
 * two debugging sessions: once on a cron secret, once on this application id,
 * where the carrier reported only "Invalid Connection ID" and echoed the
 * brackets back. Fixing it at the read makes the mistake unable to reach the
 * wire at all, which is better than documenting it and hoping.
 */
const envId = (name: string): string => env(name).replace(/[<>"'\s]/g, "");

function authHeader(): string {
  return `Bearer ${env("TELNYX_API_KEY")}`;
}

// ---------------------------------------------------------------- signatures

const b64ToBytes = (b64: string): Uint8Array =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/**
 * Imported once per isolate. Key import is not free and this runs on every
 * webhook, of which a busy call produces several.
 */
let publicKeyPromise: Promise<CryptoKey> | null = null;

function publicKey(): Promise<CryptoKey> {
  if (!publicKeyPromise) {
    publicKeyPromise = crypto.subtle.importKey(
      "raw",
      b64ToBytes(env("TELNYX_PUBLIC_KEY")),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
  }
  return publicKeyPromise;
}

export async function verifyTelnyxSignature(
  signatureB64: string | null,
  timestamp: string | null,
  rawBody: string,
): Promise<boolean> {
  if (!env("TELNYX_PUBLIC_KEY")) {
    console.error("[telnyx] TELNYX_PUBLIC_KEY not set, refusing request");
    return false;
  }
  if (!signatureB64 || !timestamp) return false;

  // Reject stale signatures before spending a verification on them. Without
  // this, a webhook captured off the wire stays replayable forever.
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_SIGNATURE_AGE_SECONDS) {
    console.warn("[telnyx] signature timestamp outside tolerance:", timestamp);
    return false;
  }

  try {
    return await crypto.subtle.verify(
      { name: "Ed25519" },
      await publicKey(),
      b64ToBytes(signatureB64),
      new TextEncoder().encode(`${timestamp}|${rawBody}`),
    );
  } catch (err) {
    console.error("[telnyx] signature verification threw:", err);
    return false;
  }
}

export interface SignedRequest {
  ok: boolean;
  params: Record<string, string>;
  raw: string;
}

/**
 * Read a Telnyx webhook once, verify it, and hand back its parameters.
 *
 * TeXML webhooks are form-encoded with Twilio-compatible names (CallSid, From,
 * To, RecordingUrl and so on), which is why the handlers downstream barely
 * changed. The body can only be read once, hence returning everything together
 * rather than offering a verify(req) that would need to read it again.
 */
export async function readTelnyxRequest(req: Request): Promise<SignedRequest> {
  const raw = await req.text();
  const ok = await verifyTelnyxSignature(
    req.headers.get("telnyx-signature-ed25519"),
    req.headers.get("telnyx-timestamp"),
    raw,
  );
  return { ok, params: Object.fromEntries(new URLSearchParams(raw)), raw };
}

// ---------------------------------------------------------------- recordings

/**
 * Fetch a recording's bytes.
 *
 * The Authorization header is attached only for Telnyx's own hosts. Recording
 * URLs can point at object storage, and blindly sending the API key to whatever
 * host arrived in a webhook would hand it to anyone who could forge one.
 */
export async function fetchRecording(recordingUrl: string): Promise<Uint8Array | null> {
  let host = "";
  try {
    host = new URL(recordingUrl).hostname;
  } catch {
    console.error("[telnyx] recording url is not a url");
    return null;
  }
  const trusted = host === "telnyx.com" || host.endsWith(".telnyx.com");

  const res = await fetch(recordingUrl, {
    headers: trusted ? { Authorization: authHeader() } : {},
  });
  if (!res.ok) {
    console.error("[telnyx] recording fetch failed:", res.status);
    return null;
  }
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Delete the carrier-side copy once it is safely in our own storage.
 * Two reasons: we stop paying to store it twice, and a deletion request from
 * the caller does not have to chase copies across two vendors.
 */
export async function deleteRecording(recordingId: string): Promise<void> {
  if (!recordingId) return;
  const res = await fetch(`${API}/recordings/${encodeURIComponent(recordingId)}`, {
    method: "DELETE",
    headers: { Authorization: authHeader() },
  });
  if (!res.ok && res.status !== 404) {
    console.error("[telnyx] recording delete failed:", res.status);
  }
}

// --------------------------------------------------------------------- calls

/**
 * Place an outbound call.
 *
 * Addressed by connection id, not account id. The older
 * `/texml/Accounts/{account_sid}/Calls` form is deprecated and needed a Telnyx
 * account UUID that appears nowhere in this system's configuration, so a wrong
 * value there produced a bare "Resource not found" with nothing to point at.
 * This form reuses the TeXML application id that inbound routing already
 * depends on, which means one less secret to get wrong and one that is verified
 * the moment any call works at all.
 *
 * Form encoded, matching the documented contract for this endpoint and Twilio's
 * convention that the TeXML dialect follows.
 */
export async function createCall(opts: {
  to: string;
  from: string;
  url: string;
  statusCallback?: string;
  amd?: boolean;
  amdStatusCallback?: string;
}): Promise<{ sid: string } | { error: string }> {
  const application = envId("TELNYX_TEXML_APP_ID");
  if (!application) return { error: "TELNYX_TEXML_APP_ID not configured" };

  const body = new URLSearchParams({
    To: opts.to,
    From: opts.from,
    Url: opts.url,
  });

  if (opts.statusCallback) {
    body.set("StatusCallback", opts.statusCallback);
    body.set("StatusCallbackMethod", "POST");
  }
  if (opts.amd) {
    // DetectMessageEnd waits for the beep, which is what makes leaving a
    // message possible at all. Async so a human is not held in dead air for
    // several seconds while detection runs.
    body.set("MachineDetection", "DetectMessageEnd");
    // MILLISECONDS, range 500 to 60000. Twilio's identically named parameter is
    // in seconds, so the obvious value of 30 is not a shorter timeout here, it
    // is below the minimum and the whole call is rejected. The TeXML markup is
    // genuinely Twilio-compatible; this REST layer is Telnyx's own and does not
    // share its units. 30000 is also the documented default, and dropping it
    // much lower makes DetectMessageEnd report "unknown" because the timer
    // fires before an answering machine greeting has finished.
    body.set("MachineDetectionTimeout", "30000");
    body.set("AsyncAmd", "true");
    if (opts.amdStatusCallback) {
      body.set("AsyncAmdStatusCallback", opts.amdStatusCallback);
      body.set("AsyncAmdStatusCallbackMethod", "POST");
    }
  }

  const res = await fetch(`${API}/texml/calls/${encodeURIComponent(application)}`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = json?.errors?.[0]?.detail ?? json?.message ?? `telnyx ${res.status}`;
    // A 404 here is the connection id, not the number being dialled, and the
    // carrier's wording does not make that remotely clear.
    if (res.status === 404) {
      return {
        error: `${detail} (the TeXML application ${application} was not found on this ` +
               `Telnyx account, check TELNYX_TEXML_APP_ID)`,
      };
    }
    // A portal step, not a code or credential problem. Telnyx names the missing
    // object but not where to create it, and nothing in this system can set it,
    // so the fix travels with the error.
    if (/outbound (voice )?profile/i.test(detail)) {
      return {
        error: "Telnyx will not place outbound calls until an Outbound Voice Profile is " +
               "attached to the TeXML application. In the Telnyx portal go to Voice, then " +
               "Outbound Voice Profiles, create or open one, and use 'Add connections/apps " +
               "to profile' to tick your TeXML application. Check the profile's allowed " +
               "destinations too: calling a country it does not cover fails separately. " +
               "Inbound calls are unaffected and work without this.",
      };
    }
    return { error: detail };
  }
  // Telnyx answered 2xx, so the call is being placed. Reading the id back is
  // best effort on top of that and must never turn into a reported failure:
  // the dispatcher retries failures, so an unrecognised success body made it
  // dial a real person again. On a feature regulated precisely on repeat calls,
  // a missing id is by far the lesser problem. Accepted means placed.
  const sid =
    json?.sid ?? json?.call_sid ?? json?.CallSid ??
    json?.data?.sid ?? json?.data?.call_sid ??
    json?.data?.call_control_id ?? json?.data?.id ?? "";

  if (!sid) {
    // Names only, so a call id or callback URL is not copied into the logs.
    console.error(
      "[telnyx] call accepted but no id in the response. Top level keys:",
      Object.keys(json ?? {}).join(", ") || "(none)",
    );
  }
  return { sid: String(sid) };
}

// ------------------------------------------------------------------- numbers

export interface AvailableNumber {
  e164: string;
  country: string;
  locality: string | null;
  monthlyCostCents: number | null;
  upfrontCostCents: number | null;
  currency: string | null;
  numberType: string | null;
  features: string[];
}

/**
 * Money as Telnyx sends it: a decimal string in major units ("0.00000",
 * "125.00"), alongside the currency it is denominated in. Storing cents keeps
 * the wire format out of the rest of the code, but the currency has to travel
 * with it. The account here is USD today; hardcoding a dollar sign downstream
 * would quietly misprice everything the day that changes.
 */
const toCents = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

/**
 * Search purchasable numbers.
 *
 * Filtered to voice-capable numbers, because a number that cannot take a call
 * is worse than no result at all: the buy would succeed and the first caller
 * would fail.
 *
 * phoneNumberType is worth passing when the caller has a preference. Countries
 * offer local, national, toll-free, shared cost and mobile numbers at wildly
 * different rates, and an unfiltered search mixes them, which is why one country
 * can appear to cost a hundred times more than another.
 */
export async function searchNumbers(opts: {
  country: string;
  areaCode?: string;
  contains?: string;
  numberType?: string;
  limit?: number;
}): Promise<AvailableNumber[] | { error: string }> {
  const qs = new URLSearchParams();
  qs.set("filter[country_code]", opts.country.toUpperCase());
  qs.set("filter[features][]", "voice");
  qs.set("filter[limit]", String(Math.min(opts.limit ?? 10, 25)));
  if (opts.areaCode) qs.set("filter[national_destination_code]", opts.areaCode);
  if (opts.contains) qs.set("filter[phone_number][contains]", opts.contains);
  if (opts.numberType) qs.set("filter[phone_number_type]", opts.numberType);

  const res = await fetch(`${API}/available_phone_numbers?${qs}`, {
    headers: { Authorization: authHeader() },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: json?.errors?.[0]?.detail ?? `telnyx ${res.status}` };
  }

  return (json?.data ?? []).map((n: Record<string, any>) => ({
    e164: n.phone_number,
    country: n.region_information?.find((r: any) => r.region_type === "country_code")?.region_name
      ?? opts.country.toUpperCase(),
    locality: n.region_information?.find((r: any) => r.region_type === "locality")?.region_name ?? null,
    monthlyCostCents: toCents(n.cost_information?.monthly_cost),
    // A one time set up fee is invisible until the invoice arrives unless it is
    // carried through here, and on international numbers it is often the larger
    // of the two charges.
    upfrontCostCents: toCents(n.cost_information?.upfront_cost),
    currency: n.cost_information?.currency ?? null,
    numberType: n.phone_number_type ?? null,
    features: (n.features ?? []).map((f: any) => f?.name).filter(Boolean),
  }));
}

/**
 * Buy a number and attach it to the TeXML application.
 *
 * connection_id is what actually routes inbound calls. Telnyx sets the voice
 * webhook on the application rather than per number, which is a real difference
 * from Twilio: one URL serves every business, and the handler identifies the
 * business from the dialled number. That was already how the inbound handler
 * worked, so nothing downstream changes.
 */
export async function orderNumber(e164: string): Promise<{ orderId: string } | { error: string }> {
  const application = envId("TELNYX_TEXML_APP_ID");
  if (!application) return { error: "TELNYX_TEXML_APP_ID not configured" };

  const res = await fetch(`${API}/number_orders`, {
    method: "POST",
    headers: { Authorization: authHeader(), "content-type": "application/json" },
    body: JSON.stringify({
      phone_numbers: [{ phone_number: e164 }],
      connection_id: application,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = json?.errors?.[0]?.detail ?? `telnyx ${res.status}`;
    // The carrier names the value but not the setting it came from, which is
    // useless to whoever has to fix it.
    if (/connection id/i.test(detail)) {
      return {
        error: `${detail}. This is the TELNYX_TEXML_APP_ID secret: it must be the ` +
               `id of a TeXML Application on this Telnyx account, digits only.`,
      };
    }
    return { error: detail };
  }
  return { orderId: json?.data?.id ?? "" };
}

/**
 * The phone number resource id, which is not the id returned by the order.
 *
 * An order returns order-scoped ids; releasing and reconfiguring need the
 * number's own record. Looking it up by E.164 is the only stable way across
 * both, and it is also how a number that was bought in the portal rather than
 * through this code can still be managed here.
 */
export async function findNumberId(e164: string): Promise<string | null> {
  const qs = new URLSearchParams({ "filter[phone_number]": e164 });
  const res = await fetch(`${API}/phone_numbers?${qs}`, {
    headers: { Authorization: authHeader() },
  });
  if (!res.ok) {
    console.error("[telnyx] phone number lookup failed:", res.status);
    return null;
  }
  const json = await res.json().catch(() => ({}));
  return json?.data?.[0]?.id ?? null;
}

/** Give the number back so the account stops being billed for it. */
export async function releaseNumber(e164: string): Promise<{ ok: true } | { error: string }> {
  const id = await findNumberId(e164);
  if (!id) return { error: "number not found on the Telnyx account" };

  const res = await fetch(`${API}/phone_numbers/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: authHeader() },
  });
  if (!res.ok && res.status !== 404) {
    const json = await res.json().catch(() => ({}));
    return { error: json?.errors?.[0]?.detail ?? `telnyx ${res.status}` };
  }
  return { ok: true };
}
