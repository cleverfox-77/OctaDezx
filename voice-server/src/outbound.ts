/**
 * Rules that only apply because a machine is making the call.
 *
 * Kept in their own module, free of sockets and database calls, because they
 * carry the legal weight of the outbound feature and need to be testable
 * without standing up a call.
 */

/**
 * Phrases that end the call and take the number off the list.
 *
 * Matched before the model ever sees the turn. An opt-out is a legal
 * instruction, not a conversational one, and honouring it must not depend on
 * whether the LLM felt cooperative on this particular reply.
 */
export const OPT_OUT_PATTERN =
  /\b(stop calling|stop these calls|don'?t call me|do not call|take me off|remove me from your|unsubscribe|opt me out|never call)\b/i;

export const isOptOut = (text: string): boolean => OPT_OUT_PATTERN.test(text);

export interface OpenerInput {
  /** The OUTBOUND greeting. Passing the inbound one here is the bug this fixes. */
  greeting: string;
  businessName?: string;
  personaName?: string | null;
  purpose?: string;
  payload?: Record<string, unknown>;
  /** Owner setting. Off by default; see the migration note on include_opt_out. */
  includeOptOut?: boolean;
  /** Owner setting. When on, the call says up front that it is automated. */
  discloseAi?: boolean;
}

/**
 * Substitute the two placeholders an owner can use in a greeting.
 *
 * Deliberately just these two. A greeting is read aloud to a stranger, so a
 * template language with fallbacks and conditionals is a way to get a caller
 * hearing "undefined". Anything unrecognised is left exactly as typed.
 */
export function fillPlaceholders(
  text: string,
  vars: { business?: string; name?: string | null },
): string {
  return text
    .replace(/\{\{\s*business\s*\}\}/gi, vars.business ?? "")
    .replace(/\{\{\s*name\s*\}\}/gi, vars.name ?? "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * What an outbound call says first.
 *
 * Previously this took the INBOUND greeting, so a call we placed opened with
 * "you have reached our team", which makes no sense to the person picking up.
 * It also always appended an opt-out line and identified itself as automated.
 *
 * Both of those are now owner settings, defaulted off, because the owner asked
 * for a caller-indistinguishable assistant after being told what each control
 * covers. They remain here rather than in the prompt because a model can be
 * talked out of saying something; a string concatenation cannot.
 */
export function outboundOpener({
  greeting, businessName, personaName, purpose, payload, includeOptOut, discloseAi,
}: OpenerInput): string {
  const opener = fillPlaceholders(greeting ?? "", { business: businessName, name: personaName });

  const reason =
    purpose === "appointment_reminder"
      ? `I'm calling about your upcoming ${String(payload?.service ?? "appointment")}.`
      : "";

  return [
    opener,
    discloseAi ? "Just so you know, I'm an automated assistant." : "",
    reason,
    includeOptOut ? "If you would rather not get these calls, just say stop calling." : "",
  ].filter(Boolean).join(" ");
}
