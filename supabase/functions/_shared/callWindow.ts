/**
 * When an automated call is allowed to go out.
 *
 * Split out of voice-jobs so it can be tested directly. This is the single
 * highest-risk piece of logic in the voice feature: under the FCC's 2024
 * ruling an AI voice is an "artificial voice" for TCPA purposes, and a call
 * placed outside the permitted hours is a statutory violation per call.
 * Everything here fails closed.
 */

// TCPA: 8am to 9pm in the CALLED party's local time.
export const TCPA_START_MIN = 8 * 60;
export const TCPA_END_MIN = 21 * 60;

/**
 * North America spans five time zones and area codes do not reliably map to
 * one: overlays, ports and the Indiana and Arizona exceptions all break it. A
 * lookup table would be confidently wrong, so an unresolved +1 number must
 * instead satisfy the window in BOTH the earliest and latest continental
 * zones at once. That narrows dialling to roughly 11am to 9pm Eastern:
 * stricter than the law requires, and never on the wrong side of it.
 */
export const NANP_BOUNDS = ["America/New_York", "America/Los_Angeles"];

/** Local wall-clock minutes since midnight in an IANA zone, or null if unknown. */
export function minutesInZone(zone: string, at: Date = new Date()): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(at);
    const h = Number(parts.find((p) => p.type === "hour")?.value);
    const m = Number(parts.find((p) => p.type === "minute")?.value);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return (h % 24) * 60 + m;
  } catch {
    return null;
  }
}

/** "09:00" or "09:00:00" to minutes since midnight. */
export function hhmmToMinutes(value: string | null | undefined, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(value ?? "");
  if (!m) return fallback;
  const mins = Number(m[1]) * 60 + Number(m[2]);
  return Number.isFinite(mins) ? mins : fallback;
}

/** Which zones this call has to be inside the window for. */
export function zonesFor(toE164: string, calleeTimezone: string | null, businessTimezone: string): string[] {
  if (calleeTimezone) return [calleeTimezone];
  if (toE164.startsWith("+1")) return NANP_BOUNDS;
  return [businessTimezone];
}

export interface WindowResult { ok: boolean; why?: string; }

/**
 * May we dial this number right now?
 *
 * @param openMin  the business's own earliest calling minute, applied on top
 *                 of the legal window (never instead of it)
 */
export function callWindowCheck(
  job: { to_e164: string; callee_timezone: string | null },
  businessTimezone: string,
  openMin: number,
  closeMin: number,
  now: Date = new Date(),
): WindowResult {
  for (const zone of zonesFor(job.to_e164, job.callee_timezone, businessTimezone)) {
    const mins = minutesInZone(zone, now);
    // An unrecognised zone name means we cannot prove the call is legal.
    if (mins === null) return { ok: false, why: `unknown timezone "${zone}"` };
    if (mins < TCPA_START_MIN || mins >= TCPA_END_MIN) {
      return { ok: false, why: `outside 8am to 9pm in ${zone}` };
    }
    if (mins < openMin || mins >= closeMin) {
      return { ok: false, why: `outside the business calling window in ${zone}` };
    }
  }
  return { ok: true };
}
