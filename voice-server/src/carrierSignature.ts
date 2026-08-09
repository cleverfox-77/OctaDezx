/**
 * Telnyx webhook signature verification.
 *
 * Without this, anyone who learns the URL can make this server answer and drive
 * calls, and can point a caller at a business that is not theirs.
 *
 * Telnyx signs `{timestamp}|{raw body}` with Ed25519 and sends the signature in
 * `telnyx-signature-ed25519` with the timestamp in `telnyx-timestamp`. Two
 * consequences worth knowing:
 *
 *  - The signature covers the BODY, not the URL. The previous Twilio scheme
 *    signed the URL, which meant a proxy rewriting the host silently broke
 *    verification and needed a list of candidate URLs to work around. None of
 *    that applies here, so it is gone.
 *
 *  - Verification uses a PUBLIC key. TELNYX_PUBLIC_KEY is not a secret and
 *    cannot sign anything, so this process no longer needs to hold a Telnyx
 *    credential at all.
 */
import { webcrypto } from "node:crypto";
import { config } from "./config.js";

/** Telnyx will not resend a webhook older than this, and nor should we accept one. */
const MAX_AGE_SECONDS = 300;

const b64ToBytes = (b64: string): Uint8Array =>
  Uint8Array.from(Buffer.from(b64, "base64"));

// Taken from webcrypto rather than the global CryptoKey, which is not in this
// project's lib and moved between @types/node versions.
type ImportedKey = Awaited<ReturnType<typeof webcrypto.subtle.importKey>>;

/** Imported once. Key import is not free and this runs on every webhook. */
let keyPromise: Promise<ImportedKey> | null = null;

function publicKey(): Promise<ImportedKey> {
  if (!keyPromise) {
    keyPromise = webcrypto.subtle.importKey(
      "raw",
      b64ToBytes(config.telnyx.publicKey),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
  }
  return keyPromise;
}

export async function verifyCarrierRequest(
  signatureB64: string | undefined,
  timestamp: string | undefined,
  rawBody: string,
): Promise<boolean> {
  if (!config.telnyx.validateSignatures) return true;   // local development only

  if (!config.telnyx.publicKey) {
    console.error("[signature] TELNYX_PUBLIC_KEY not set, refusing request");
    return false;
  }
  if (!signatureB64 || !timestamp) return false;

  // Reject stale signatures before spending a verification on them. Without
  // this, a webhook captured off the wire stays replayable forever.
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_AGE_SECONDS) {
    console.warn("[signature] timestamp outside tolerance:", timestamp);
    return false;
  }

  try {
    return await webcrypto.subtle.verify(
      { name: "Ed25519" },
      await publicKey(),
      b64ToBytes(signatureB64),
      new TextEncoder().encode(`${timestamp}|${rawBody}`),
    );
  } catch (err) {
    console.error("[signature] verification threw:", err);
    return false;
  }
}
