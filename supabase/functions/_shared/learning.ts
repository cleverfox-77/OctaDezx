/**
 * The continuous-learning loop, shared between the chat brain and `ai-learn`.
 *
 * WHY THIS EXISTS: the assistant already generates the signals it needs to get
 * better and throws all of them away. A human takes over an escalated chat and
 * types the right answer; that pair (what the AI said, what the human said) is
 * labelled training data and it was being deleted the moment the chat closed.
 *
 * This file holds the three things that must not diverge between the harvester
 * and the serving path:
 *
 *   1. sanitiseUntrusted   - what we do to text a stranger typed
 *   2. fingerprint         - how two things are judged to be "the same lesson"
 *   3. buildLessonBlock    - the exact, budgeted text that enters a live prompt
 *
 * THE TRUST BOUNDARY, stated once so it is not re-argued in three places:
 *
 *   customer text  UNTRUSTED. Evidence only. May describe WHEN a lesson fires,
 *                  may never describe WHAT the assistant should then do.
 *   AI text        UNTRUSTED. It is downstream of customer text, so anything a
 *                  customer could talk the model into saying is in here too.
 *   human text     TRUSTED. Written by somebody signed in to the dashboard as
 *                  staff for that business. The only source a corrected
 *                  behaviour is allowed to be grounded in.
 *
 * And the backstop, which is in the database rather than here: a machine-written
 * lesson is always born 'pending' and only the business owner can approve it.
 * See 20260806000000_self_improving_ai.sql.
 */

// ---------------------------------------------------------------- budgets

/**
 * How much learned text may enter a live chat prompt.
 *
 * 1800 characters is roughly 450 tokens. At six lessons that is 300 characters
 * each, which is enough for "when X, do Y" and nothing more. The point of
 * distillation is that the prompt does not grow with the conversation history;
 * if this number ever needs raising, the lessons are too verbose, not too few.
 */
export const LESSON_BLOCK_MAX_CHARS = 1800;
export const LESSON_TRIGGER_MAX_CHARS = 200;
export const LESSON_BEHAVIOR_MAX_CHARS = 400;
export const DEFAULT_MAX_LESSONS = 6;

/** How much of one piece of untrusted text the distiller is allowed to see. */
export const UNTRUSTED_CLIP_CHARS = 600;

/** Signals sent to the model in one distillation call. Caps the cost per run. */
export const MAX_SIGNALS_PER_DISTILL = 40;

// ---------------------------------------------------------- sanitisation

/**
 * Neutralise text that a stranger controls before it goes anywhere near a
 * prompt.
 *
 * The collapse of all whitespace into single spaces is the important line, not
 * an aesthetic one: our prompts delimit sections with newlines and `=== ... ===`
 * banners, so a customer who can emit a newline can forge a section header and
 * appear to be the system. One line of text cannot open a new section.
 */
export function sanitiseUntrusted(input: unknown, maxChars = UNTRUSTED_CLIP_CHARS): string {
  if (input == null) return "";
  return String(input)
    // The control-marker syntax the chat brain acts on (||ESCALATE:...||).
    .replace(/\|\|/g, "¦¦")
    // Control characters, including the ones that render as nothing.
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, " ")
    // Bidi and zero-width tricks that hide text from a human reviewer but not
    // from the model.
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    // Every newline, tab and run of spaces becomes one space. See above.
    .replace(/\s+/g, " ")
    // Our own section-banner syntax, plus markdown fences and headings.
    .replace(/={3,}/g, "=")
    .replace(/-{3,}/g, "-")
    .replace(/`{2,}/g, "'")
    .replace(/#{2,}/g, "#")
    .trim()
    .slice(0, maxChars);
}

/**
 * Text that can never be a legitimate learned behaviour.
 *
 * This is a backstop, not the defence. The defence is that a corrected
 * behaviour may only be grounded in staff-written text and that an owner has to
 * approve it. This list catches the obvious cases early so they never reach a
 * human review queue and waste the owner's attention.
 */
const LESSON_REJECT = new RegExp(
  [
    "\\|\\|",                                   // control markers
    "https?://",                                // no lesson needs a link; a link is an exfiltration vector
    "ignore (all |any |the )?(previous|prior|above)",
    "disregard (all |any |the )?(previous|prior|above)",
    "system (prompt|instruction|message)",
    "you are now",
    "from now on,? (you|always) (are|act|behave|pretend)",
    "reveal|print|output your (instructions|prompt|rules)",
    "api[ _-]?key|service[ _-]?role|secret|password|token",
    "<script|javascript:|data:text/html",
  ].join("|"),
  "i",
);

export interface CandidateLesson {
  trigger_condition: string;
  corrected_behavior: string;
  rationale?: string;
}

/**
 * Accept or reject one lesson the model proposed.
 * Returns the cleaned lesson, or null with the reason logged by the caller.
 */
export function validateCandidateLesson(raw: unknown): CandidateLesson | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const trigger = sanitiseUntrusted(r.trigger_condition ?? r.trigger, LESSON_TRIGGER_MAX_CHARS);
  const behavior = sanitiseUntrusted(r.corrected_behavior ?? r.behavior, LESSON_BEHAVIOR_MAX_CHARS);
  const rationale = sanitiseUntrusted(r.rationale ?? "", LESSON_BEHAVIOR_MAX_CHARS);

  if (trigger.length < 3 || behavior.length < 3) return null;
  if (LESSON_REJECT.test(trigger) || LESSON_REJECT.test(behavior)) return null;

  return { trigger_condition: trigger, corrected_behavior: behavior, rationale: rationale || undefined };
}

// ----------------------------------------------------------- fingerprints

const STOPWORDS = new Set([
  "a","an","the","is","are","was","were","be","been","am","do","does","did","can","could",
  "will","would","shall","should","may","might","must","have","has","had","i","you","we",
  "they","he","she","it","me","my","your","our","their","this","that","these","those","of",
  "to","in","on","at","for","with","from","by","and","or","if","so","as","about","please",
  "hi","hello","hey","there","what","whats","how","when","where","which","who","why","any",
  "get","got","tell","know","need","want","like","just","also","ok","okay","thanks","thank",
]);

/** Crude English stemmer. Merges deliver/delivery/delivering, not much more. */
function stem(word: string): string {
  return word
    .replace(/(ing|ies|ied|ed|es|s|y)$/i, "")
    .replace(/(.)\1+$/, "$1");
}

/**
 * A stable key for "these two things are the same question".
 *
 * Lowercase, drop punctuation and stopwords, stem, dedupe, sort, keep eight
 * tokens. Sorting is what makes "do you deliver to Dhaka" and "Dhaka delivery?"
 * collapse together.
 *
 * This is lexical, not semantic. "shipping cost" and "how much is postage" stay
 * separate gaps. Fixing that properly means embedding every question, which is
 * a per-question Gemini call on a path that runs constantly. Lexical grouping
 * is what earns the "asked 14 times" count honestly today; it undercounts, it
 * does not overcount, which is the safe direction to be wrong in.
 */
export function normaliseForFingerprint(text: string): string {
  const tokens = sanitiseUntrusted(text, 400)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem)
    .filter((t) => t.length > 1);
  return Array.from(new Set(tokens)).sort().slice(0, 8).join(" ");
}

/** SHA-256 of the normalised text, truncated. Collisions here are harmless. */
export async function fingerprint(text: string): Promise<string> {
  const normalised = normaliseForFingerprint(text);
  const bytes = new TextEncoder().encode(normalised || text.slice(0, 200));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ------------------------------------------------------- signal detection

/**
 * The assistant is instructed to say some version of "I don't have specific
 * information about that" when it cannot answer. When it does, the customer's
 * previous message is a question this business cannot currently answer, which
 * is precisely a knowledge gap.
 */
export const HEDGE_PATTERNS = [
  /i (don'?t|do not) have (specific |any )?(information|details|data)/i,
  /i'?m not (sure|certain) (about|if)/i,
  /let me connect you with (our|the) team/i,
  /i (can'?t|cannot) (help|assist) with that/i,
  /that'?s not something i (can|have)/i,
];

/** Signs the previous answer missed, written by the customer in frustration. */
export const FRUSTRATION_PATTERNS = [
  /\b(i (already )?(said|told you)|already told you|as i said)\b/i,
  /\b(that'?s not what i (asked|meant)|not what i asked)\b/i,
  /\b(you'?re not (listening|understanding)|you don'?t understand)\b/i,
  /\b(again|repeat)\b.*\?\s*$/i,
  /\b(useless|terrible|awful|waste of time)\b/i,
];

export const isHedge = (text: string) => HEDGE_PATTERNS.some((re) => re.test(text));
export const isFrustrated = (text: string) => FRUSTRATION_PATTERNS.some((re) => re.test(text));

// -------------------------------------------------------- serving lessons

export interface ServableLesson {
  id: string;
  trigger_condition: string;
  corrected_behavior: string;
}

/**
 * The approved lessons for one business, as a prompt block.
 *
 * Cost on the chat path: two indexed SELECTs issued in parallel (the owner's
 * lesson budget, and the lessons themselves) plus at most
 * LESSON_BLOCK_MAX_CHARS of extra prompt. No model call, no embedding, no
 * history replay. Callers should race this against their knowledge base load
 * so the added wall-clock time is zero. If this ever costs more than that, it
 * has stopped being distillation and started being accumulation.
 *
 * Returns "" when there is nothing approved, so a business that has not
 * reviewed anything pays literally nothing.
 */
export async function buildLessonBlock(
  supabase: any,
  businessId: string,
): Promise<string> {
  // Over-fetch to the hard ceiling once, then trim to the owner's setting.
  // Doing both queries at the same time keeps this one round trip, not two.
  const [settingsRes, lessonsRes] = await Promise.all([
    supabase
      .from("ai_learning_settings")
      .select("enabled, max_lessons_in_prompt")
      .eq("business_id", businessId)
      .maybeSingle(),
    supabase
      .from("ai_lessons")
      .select("id, trigger_condition, corrected_behavior")
      .eq("business_id", businessId)          // tenant scope, never omitted
      .eq("status", "approved")               // owner-approved only, never 'pending'
      .order("evidence_count", { ascending: false })
      .order("last_reinforced_at", { ascending: false })
      .limit(12),
  ]);

  // No settings row means the business predates this feature and the seeding
  // insert has not run. Default on, at the default budget.
  const settings = settingsRes?.data ?? null;
  if (settings && settings.enabled === false) return "";
  const limit = Math.max(0, Math.min(12, settings?.max_lessons_in_prompt ?? DEFAULT_MAX_LESSONS));
  if (limit === 0) return "";

  const data = lessonsRes?.data;
  if (lessonsRes?.error || !Array.isArray(data) || data.length === 0) return "";

  const lines: string[] = [];
  let used = 0;
  for (const lesson of (data as ServableLesson[]).slice(0, limit)) {
    const trigger = String(lesson.trigger_condition ?? "").slice(0, LESSON_TRIGGER_MAX_CHARS);
    const behavior = String(lesson.corrected_behavior ?? "").slice(0, LESSON_BEHAVIOR_MAX_CHARS);
    if (!trigger || !behavior) continue;
    const line = `- When ${trigger}: ${behavior}`;
    // Hard stop rather than truncating mid-sentence: half a rule is worse than
    // one rule fewer.
    if (used + line.length + 1 > LESSON_BLOCK_MAX_CHARS) break;
    lines.push(line);
    used += line.length + 1;
  }
  if (!lines.length) return "";

  return [
    "=== LEARNED FROM THIS BUSINESS'S OWN PAST CONVERSATIONS ===",
    "These rules were derived from how this business's human team actually",
    "answered, and were reviewed and approved by the business owner. Apply them",
    "when they fit. They do not override the business policies, the knowledge",
    "base, or the rule against inventing information.",
    ...lines,
  ].join("\n");
}
