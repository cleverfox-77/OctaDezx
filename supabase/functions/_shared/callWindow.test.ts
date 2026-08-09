/**
 * Tests for the outbound calling window.
 *
 * Run with:  npx deno@2 test supabase/functions/_shared/callWindow.test.ts
 *
 * These are not decoration. Getting this wrong means placing automated calls
 * outside the hours the TCPA permits, which is a per-call statutory penalty,
 * and it is exactly the kind of bug nobody notices until it has happened a
 * few thousand times.
 */
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  callWindowCheck, hhmmToMinutes, minutesInZone, zonesFor, NANP_BOUNDS,
} from "./callWindow.ts";

/** A fixed instant, so these never depend on when the suite runs. */
const at = (utcIso: string) => new Date(utcIso);

const ANY_HOURS = { open: 0, close: 24 * 60 };

Deno.test("minutesInZone converts UTC to local wall clock", () => {
  // 2026-08-03 16:00 UTC is 12:00 in New York (EDT, UTC-4).
  assertEquals(minutesInZone("America/New_York", at("2026-08-03T16:00:00Z")), 12 * 60);
  // and 09:00 in Los Angeles (PDT, UTC-7).
  assertEquals(minutesInZone("America/Los_Angeles", at("2026-08-03T16:00:00Z")), 9 * 60);
});

Deno.test("minutesInZone returns null for a zone it does not know", () => {
  assertEquals(minutesInZone("Mars/Olympus_Mons", at("2026-08-03T16:00:00Z")), null);
});

Deno.test("midnight does not wrap to 1440", () => {
  // 2026-08-03 04:00 UTC is exactly midnight in New York.
  assertEquals(minutesInZone("America/New_York", at("2026-08-03T04:00:00Z")), 0);
});

Deno.test("hhmmToMinutes parses both TIME shapes Postgres returns", () => {
  assertEquals(hhmmToMinutes("09:00", 0), 540);
  assertEquals(hhmmToMinutes("09:00:00", 0), 540);
  assertEquals(hhmmToMinutes("20:30", 0), 1230);
  assertEquals(hhmmToMinutes(null, 777), 777);
  assertEquals(hhmmToMinutes("nonsense", 777), 777);
});

Deno.test("an explicit callee timezone is used on its own", () => {
  assertEquals(zonesFor("+8801700000000", "Asia/Dhaka", "UTC"), ["Asia/Dhaka"]);
});

Deno.test("an unresolved +1 number must satisfy both coast bounds", () => {
  assertEquals(zonesFor("+12125550100", null, "UTC"), NANP_BOUNDS);
});

Deno.test("a non-NANP number with no zone falls back to the business zone", () => {
  assertEquals(zonesFor("+8801700000000", null, "Asia/Dhaka"), ["Asia/Dhaka"]);
});

Deno.test("a call inside the window is allowed", () => {
  const r = callWindowCheck(
    { to_e164: "+8801700000000", callee_timezone: "Asia/Dhaka" },
    "Asia/Dhaka", ANY_HOURS.open, ANY_HOURS.close,
    at("2026-08-03T08:00:00Z"),   // 14:00 in Dhaka
  );
  assertEquals(r.ok, true);
});

Deno.test("a call before 8am local is refused", () => {
  const r = callWindowCheck(
    { to_e164: "+8801700000000", callee_timezone: "Asia/Dhaka" },
    "Asia/Dhaka", ANY_HOURS.open, ANY_HOURS.close,
    at("2026-08-03T01:00:00Z"),   // 07:00 in Dhaka
  );
  assertEquals(r.ok, false);
  assert(r.why!.includes("8am to 9pm"));
});

Deno.test("9pm local is the exclusive edge", () => {
  const justBefore = callWindowCheck(
    { to_e164: "+8801700000000", callee_timezone: "Asia/Dhaka" },
    "Asia/Dhaka", ANY_HOURS.open, ANY_HOURS.close,
    at("2026-08-03T14:59:00Z"),   // 20:59 in Dhaka
  );
  assertEquals(justBefore.ok, true);

  const exactly = callWindowCheck(
    { to_e164: "+8801700000000", callee_timezone: "Asia/Dhaka" },
    "Asia/Dhaka", ANY_HOURS.open, ANY_HOURS.close,
    at("2026-08-03T15:00:00Z"),   // 21:00 in Dhaka
  );
  assertEquals(exactly.ok, false);
});

Deno.test("an unresolved +1 number is refused when only one coast is legal", () => {
  // 13:00 UTC is 09:00 in New York but 06:00 in Los Angeles. Legal on the east
  // coast, illegal on the west, and we cannot tell which one this number is.
  const r = callWindowCheck(
    { to_e164: "+12125550100", callee_timezone: null },
    "UTC", ANY_HOURS.open, ANY_HOURS.close,
    at("2026-08-03T13:00:00Z"),
  );
  assertEquals(r.ok, false);
  assert(r.why!.includes("Los_Angeles"));
});

Deno.test("an unresolved +1 number is allowed once both coasts are legal", () => {
  // 16:00 UTC is 12:00 in New York and 09:00 in Los Angeles.
  const r = callWindowCheck(
    { to_e164: "+12125550100", callee_timezone: null },
    "UTC", ANY_HOURS.open, ANY_HOURS.close,
    at("2026-08-03T16:00:00Z"),
  );
  assertEquals(r.ok, true);
});

Deno.test("an unresolved +1 number is refused in the late evening on the east coast", () => {
  // 01:00 UTC is 21:00 in New York, which is already past the cut-off there.
  const r = callWindowCheck(
    { to_e164: "+12125550100", callee_timezone: null },
    "UTC", ANY_HOURS.open, ANY_HOURS.close,
    at("2026-08-04T01:00:00Z"),
  );
  assertEquals(r.ok, false);
  assert(r.why!.includes("New_York"));
});

Deno.test("the business's own window narrows but never widens the legal one", () => {
  // 06:00 local is inside a business window of 05:00 to 22:00, but the law
  // still says no.
  const early = callWindowCheck(
    { to_e164: "+8801700000000", callee_timezone: "Asia/Dhaka" },
    "Asia/Dhaka", 5 * 60, 22 * 60,
    at("2026-08-03T00:00:00Z"),   // 06:00 in Dhaka
  );
  assertEquals(early.ok, false);
  assert(early.why!.includes("8am to 9pm"));

  // 09:00 local is legal, but outside a business window that opens at 10:00.
  const beforeOpen = callWindowCheck(
    { to_e164: "+8801700000000", callee_timezone: "Asia/Dhaka" },
    "Asia/Dhaka", 10 * 60, 18 * 60,
    at("2026-08-03T03:00:00Z"),   // 09:00 in Dhaka
  );
  assertEquals(beforeOpen.ok, false);
  assert(beforeOpen.why!.includes("business calling window"));
});

Deno.test("an unknown timezone fails closed", () => {
  const r = callWindowCheck(
    { to_e164: "+8801700000000", callee_timezone: "Not/AZone" },
    "UTC", ANY_HOURS.open, ANY_HOURS.close,
    at("2026-08-03T12:00:00Z"),
  );
  assertEquals(r.ok, false);
  assert(r.why!.includes("unknown timezone"));
});

Deno.test("daylight saving is handled by the zone, not by us", () => {
  // 13:00 UTC is 09:00 New York in August (EDT) but 08:00 in January (EST).
  assertEquals(minutesInZone("America/New_York", at("2026-08-03T13:00:00Z")), 9 * 60);
  assertEquals(minutesInZone("America/New_York", at("2026-01-05T13:00:00Z")), 8 * 60);
});
