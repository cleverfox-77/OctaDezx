/**
 * The plan ladder, in one place.
 *
 * WHY THIS FILE EXISTS: the previous restructure left the same four numbers
 * copied into PricingSection, SubscriptionLockScreen, Dashboard, DailyUsage,
 * CancelSubscriptionDialog, Affiliates, VoiceCenter, useSubscription and the
 * SEO JSON-LD. They drifted, and a price shown on the pricing page did not
 * match the price shown on the cancel dialog. Everything reads from here now.
 *
 * The DATABASE is still the enforcer. team_plan_limits, voice_plan_limits and
 * check_and_record_usage decide what a customer actually gets; these constants
 * decide what we SHOW. Migration 20260806040000_plan_repricing.sql sets the
 * database side to exactly these numbers. If the two ever disagree the database
 * wins and the customer sees a server error rather than a wrong allowance, so
 * change both together.
 *
 * ---------------------------------------------------------------------------
 * HOW THE ALLOWANCES WERE SIZED
 *
 * The rule: a customer who burns every message AND every voice minute in their
 * plan must still cost us under 40% of what they pay. Sized against the YEARLY
 * effective price (monthly ÷ 12 after the two free months), because that is the
 * lowest revenue per month we ever collect. Sizing against the monthly price
 * would have quietly broken the rule for every yearly customer.
 *
 * Unit costs are list prices as of August 2026, rounded UP:
 *
 *   AI message      $0.0015   Gemini 3.1 Flash Lite at $0.25/1M in and
 *                             $1.50/1M out. A retrieval-slimmed turn is about
 *                             4k in and 250 out, so about $0.0014.
 *   Voice minute    $0.030    Telnyx ~$0.0045 + Deepgram nova-3 streaming STT
 *                             $0.0077 + Aura-2 TTS ~$0.0115 (the assistant
 *                             speaks roughly 45% of a call at $0.030/1k chars)
 *                             + Gemini ~$0.0035. About $0.027 measured.
 *   Fixed per account $1.50   One phone number at $1.15 plus a share of Fly.io
 *                             and Supabase.
 *
 * Worst case per plan, against the yearly effective monthly price:
 *   Starter   $3.75 + $3.00 + $1.50 = $8.25  of $24.17  = 34.1%
 *   Pro      $15.00 + $12.00 + $1.50 = $28.50 of $82.50 = 34.5%
 *   Advanced $33.00 + $27.00 + $1.50 = $61.50 of $165.83 = 37.1%
 *
 * On monthly billing the same usage costs 28% to 31%, so monthly customers are
 * comfortably inside the rule too. planCogs() recomputes all of it from the
 * constants rather than trusting the comment, and the dev-only assertion at the
 * bottom of this file shouts in the console the moment an edit to a price, an
 * allowance or a unit cost pushes any plan past 40%.
 * ---------------------------------------------------------------------------
 */

export type PlanKey =
  | 'free' | 'trial'
  | 'starter' | 'pro' | 'advanced' | 'enterprise'
  | 'legacy_starter' | 'appsumo_ltd';

/** What one unit costs US. Change these and every check below moves with them. */
export const UNIT_COST = {
  /** One AI answer, any channel. */
  message: 0.0015,
  /** One minute of a phone call, carrier and speech and model included. */
  voiceMinute: 0.030,
  /** Per account per month: number rental plus infrastructure share. */
  fixedMonthly: 1.50,
} as const;

/** The margin rule this ladder is built to satisfy. */
export const MAX_COGS_RATIO = 0.40;

export interface Plan {
  key: PlanKey;
  /** What customers see. */
  name: string;
  /** null for the metered Enterprise tier. */
  monthly: number | null;
  yearly: number | null;
  desc: string;
  /** AI answers included per calendar month. null means metered. */
  messages: number | null;
  /** Phone minutes included per calendar month. null means metered. */
  voiceMinutes: number | null;
  /** People on the team, the owner counted. */
  seats: number;
  /** Calls the AI can hold at the same time. Mirrors voice_plan_limits. */
  concurrentCalls: number;
  /** Longest single call before the AI winds it down. Minutes. */
  maxCallMinutes: number;
  support: string;
  /** Headline bullets for the card. Kept to five so the cards stay level. */
  features: string[];
  cta: string;
  popular: boolean;
  accent: string;
  /** Lemon Squeezy variant ids, for checkout links. null where none exists. */
  variants: { monthly: string | null; yearly: string | null };
  /**
   * Lemon Squeezy buy links. null on Enterprise, which is invoiced rather than
   * sold self-serve. The buyer's user_id is appended before opening so the
   * webhook can attribute the purchase; see openCheckout in DailyUsage.
   */
  checkout: { monthly: string; yearly: string } | null;
}

/**
 * Metered rates for Enterprise.
 *
 * Deliberately more expensive per unit than any committed tier: buying a plan
 * has to be the cheaper choice or nobody would ever commit. At Advanced's
 * volume this comes to $240 against Advanced's $199. Our cost is 25% of these
 * rates, well inside the rule.
 */
export const PAYG_RATES = {
  perMessage: 0.006,
  perVoiceMinute: 0.12,
  /** Below this, a committed plan is always the better deal. */
  monthlyMinimum: 499,
} as const;

export const PLANS: Plan[] = [
  {
    key: 'starter',
    name: 'Starter',
    monthly: 29,
    yearly: 290,
    desc: 'Small businesses, boutiques and startups finding their feet.',
    messages: 2_500,
    voiceMinutes: 100,
    seats: 3,
    concurrentCalls: 3,
    maxCallMinutes: 10,
    support: 'Email support',
    features: [
      '2,500 AI messages a month',
      '100 phone minutes a month',
      '3 team seats with roles',
      'Every channel and every feature',
      'Email support',
    ],
    cta: 'Get Started',
    popular: false,
    accent: '#000047',
    variants: { monthly: '1130312', yearly: '1927010' },
    checkout: {
      monthly: 'https://octadezx.lemonsqueezy.com/checkout/buy/10570561-d529-4751-92f9-8aaf7d6b1b5e?enabled=1130312',
      yearly: 'https://octadezx.lemonsqueezy.com/checkout/buy/fecdef72-0057-4812-ab7e-55c99a2ed3cf?enabled=1927010',
    },
  },
  {
    key: 'pro',
    name: 'Pro',
    monthly: 99,
    yearly: 990,
    desc: 'Growing businesses, agencies and busy support desks.',
    messages: 10_000,
    voiceMinutes: 400,
    seats: 10,
    concurrentCalls: 10,
    maxCallMinutes: 20,
    support: 'Priority support',
    features: [
      '10,000 AI messages a month',
      '400 phone minutes a month',
      '10 team seats with roles',
      '10 calls answered at once',
      'Priority support',
    ],
    cta: 'Launch Pro',
    popular: true,
    accent: '#000047',
    variants: { monthly: '1926998', yearly: '1530207' },
    checkout: {
      monthly: 'https://octadezx.lemonsqueezy.com/checkout/buy/79e10764-e8cd-4207-91c8-7591dcc5cc06?enabled=1926998',
      yearly: 'https://octadezx.lemonsqueezy.com/checkout/buy/765de369-4c52-4814-aa34-a83983f3ce90?enabled=1530207',
    },
  },
  {
    key: 'advanced',
    name: 'Advanced',
    monthly: 199,
    yearly: 1_990,
    desc: 'High volume operations running several brands or locations.',
    messages: 22_000,
    voiceMinutes: 900,
    seats: 20,
    concurrentCalls: 25,
    maxCallMinutes: 20,
    support: 'Dedicated support channel',
    features: [
      '22,000 AI messages a month',
      '900 phone minutes a month',
      '20 team seats with roles',
      '25 calls answered at once',
      'Dedicated support channel',
    ],
    cta: 'Scale Up',
    popular: false,
    accent: '#7c3aed',
    variants: { monthly: '1926975', yearly: '1926951' },
    checkout: {
      monthly: 'https://octadezx.lemonsqueezy.com/checkout/buy/f7f23d16-dade-4aa2-a765-ddcc3df2ca60?enabled=1926975',
      yearly: 'https://octadezx.lemonsqueezy.com/checkout/buy/289cb7dc-41ba-455a-99c7-1746981ece4e?enabled=1926951',
    },
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    monthly: null,
    yearly: null,
    desc: 'Pay only for what you use, with no ceiling on either meter.',
    messages: null,
    voiceMinutes: null,
    seats: 100,
    concurrentCalls: 50,
    maxCallMinutes: 30,
    support: 'Named success manager and SLA',
    features: [
      '$0.006 per AI message',
      '$0.12 per phone minute',
      'No monthly cap on either meter',
      '100 team seats, more on request',
      'Named success manager and SLA',
    ],
    cta: 'Talk to us',
    popular: false,
    accent: '#7c3aed',
    // Metered billing is invoiced, not a Lemon Squeezy variant. Enterprise
    // goes through the contact form rather than self-serve checkout.
    variants: { monthly: null, yearly: null },
    checkout: null,
  },
];

export const planByKey = (key: string): Plan | undefined =>
  PLANS.find((p) => p.key === key);

/**
 * What a plan costs US if the customer uses every last unit of it, and what
 * share of revenue that is. Yearly is the number that matters: two free months
 * make it the thinnest revenue per month we ever see.
 */
export function planCogs(plan: Plan) {
  if (plan.messages == null || plan.voiceMinutes == null || plan.monthly == null || plan.yearly == null) {
    return null;   // metered: cost tracks revenue by construction
  }
  const cost =
    plan.messages * UNIT_COST.message +
    plan.voiceMinutes * UNIT_COST.voiceMinute +
    UNIT_COST.fixedMonthly;
  return {
    cost,
    monthlyRatio: cost / plan.monthly,
    yearlyRatio: cost / (plan.yearly / 12),
  };
}

/** Seats included, falling back to a single seat for anything unrecognised. */
export const seatsFor = (plan: string | null | undefined): number =>
  planByKey(plan ?? '')?.seats ?? LEGACY_PLANS[(plan ?? '') as PlanKey]?.seats ?? 1;

/**
 * Plans nobody can buy any more but people are still paying for.
 *
 * The $9 Starter was withdrawn in the August 2026 repricing. Three accounts
 * were live on it. They keep paying $9 and keep working, on a key of their own
 * so that nothing about the new $29 Starter silently changes what they get.
 * 2,000 messages costs us $3.00 of their $9, which holds the margin rule.
 */
export const LEGACY_PLANS: Partial<Record<PlanKey, {
  name: string; monthly: number; messages: number; voiceMinutes: number; seats: number;
}>> = {
  legacy_starter: { name: 'Starter (legacy)', monthly: 9, messages: 2_000, voiceMinutes: 0, seats: 1 },
};

/** Every plan that can place or answer a phone call. Mirrors voice_plan_limits. */
export const VOICE_PLANS: PlanKey[] = ['starter', 'pro', 'advanced', 'enterprise'];

/** Included minutes by plan key, for dashboard meters. Metered plans return null. */
export const voiceMinutesFor = (plan: string | null | undefined): number | null => {
  const p = planByKey(plan ?? '');
  if (p) return p.voiceMinutes;
  return LEGACY_PLANS[(plan ?? '') as PlanKey]?.voiceMinutes ?? 0;
};

/** Included messages by plan key. null means metered, 0 means no allowance. */
export const messagesFor = (plan: string | null | undefined): number | null => {
  const p = planByKey(plan ?? '');
  if (p) return p.messages;
  return LEGACY_PLANS[(plan ?? '') as PlanKey]?.messages ?? 0;
};

/**
 * Where the dashboard's upgrade button points, per plan the customer is on.
 *
 * Anyone not yet paying, and anyone on the withdrawn $9 tier, is pointed at
 * Starter. Advanced is pointed at Enterprise, which has no checkout, so it
 * returns the contact route instead of a Lemon Squeezy link.
 */
export function upgradeFor(plan: string | null | undefined):
  { label: string; url: string; external: boolean } | null {
  const next: Record<string, PlanKey> = {
    free: 'starter', trial: 'starter', appsumo_ltd: 'starter', legacy_starter: 'starter',
    starter: 'pro', pro: 'advanced', advanced: 'enterprise',
  };
  const target = next[plan ?? 'free'];
  if (!target) return null;                        // already on Enterprise
  const p = planByKey(target);
  if (!p) return null;
  return p.checkout
    ? { label: `Upgrade to ${p.name}`, url: p.checkout.monthly, external: true }
    : { label: 'Talk to us about Enterprise', url: '/pricing#contact', external: false };
}

/** Short label for a plan key, including the ones no longer sold. */
export const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  trial: 'Trial',
  starter: 'Starter',
  pro: 'Pro',
  advanced: 'Advanced',
  enterprise: 'Enterprise',
  legacy_starter: 'Starter (legacy)',
  appsumo_ltd: 'Lifetime',
};

/** Price label for a plan key. Metered and free plans say so rather than $0. */
export const priceLabel = (plan: string | null | undefined): string => {
  const p = planByKey(plan ?? '');
  if (p?.monthly != null) return `$${p.monthly}/month`;
  if (p?.key === 'enterprise') return 'Metered, billed monthly';
  const legacy = LEGACY_PLANS[(plan ?? '') as PlanKey];
  if (legacy) return `$${legacy.monthly}/month`;
  return '';
};

/**
 * The full capability list, and which plans have it.
 *
 * Almost every row is on every plan, and that is the honest and the better
 * story: you are choosing a volume, not unlocking the product a slice at a
 * time. Only rows that are genuinely enforced somewhere appear as limited.
 *
 * Nothing here is aspirational. If a row claims a plan has something, that
 * something exists in the code today.
 */
export interface FeatureRow {
  group: string;
  label: string;
  detail?: string;
  /** Per plan key: true, false, or the specific value that plan gets. */
  values: Record<'starter' | 'pro' | 'advanced' | 'enterprise', string | boolean>;
}

export const FEATURE_MATRIX: FeatureRow[] = [
  // ── Volume ────────────────────────────────────────────────────────────────
  {
    group: 'Volume',
    label: 'AI messages a month',
    detail: 'One message is one answer the AI sends, on any channel.',
    values: { starter: '2,500', pro: '10,000', advanced: '22,000', enterprise: '$0.006 each' },
  },
  {
    group: 'Volume',
    label: 'Phone minutes a month',
    detail: 'Inbound and outbound calls both draw on the same pool.',
    values: { starter: '100', pro: '400', advanced: '900', enterprise: '$0.12 each' },
  },
  {
    group: 'Volume',
    label: 'Calls answered at once',
    values: { starter: '3', pro: '10', advanced: '25', enterprise: '50' },
  },
  {
    group: 'Volume',
    label: 'Longest single call',
    values: { starter: '10 min', pro: '20 min', advanced: '20 min', enterprise: '30 min' },
  },
  {
    group: 'Volume',
    label: 'Team seats',
    detail: 'The owner counts as one seat.',
    values: { starter: '3', pro: '10', advanced: '20', enterprise: '100+' },
  },

  // ── Channels ──────────────────────────────────────────────────────────────
  {
    group: 'Channels',
    label: 'WhatsApp, Instagram, Facebook, Telegram',
    values: { starter: true, pro: true, advanced: true, enterprise: true },
  },
  {
    group: 'Channels',
    label: 'Website chat widget and shareable chat link',
    values: { starter: true, pro: true, advanced: true, enterprise: true },
  },
  {
    group: 'Channels',
    label: 'Shopify and WooCommerce catalogue sync',
    values: { starter: true, pro: true, advanced: true, enterprise: true },
  },
  {
    group: 'Channels',
    label: 'Phone calls in and out',
    detail: 'Your own number, answered in under a second, interruptible.',
    values: { starter: true, pro: true, advanced: true, enterprise: true },
  },
  {
    group: 'Channels',
    label: 'Voicemail with transcripts',
    values: { starter: true, pro: true, advanced: true, enterprise: true },
  },
  {
    group: 'Channels',
    label: 'Facebook and Instagram comment replies',
    values: { starter: true, pro: true, advanced: true, enterprise: true },
  },

  // ── What the AI does ─────────────────────────────────────────────────────
  {
    group: 'What the AI does',
    label: 'Image recognition',
    detail: 'A customer sends a photo and the AI matches it to your catalogue.',
    values: { starter: true, pro: true, advanced: true, enterprise: true },
  },
  {
    group: 'What the AI does',
    label: 'Voice notes transcribed and answered',
    values: { starter: true, pro: true, advanced: true, enterprise: true },
  },
  {
    group: 'What the AI does',
    label: 'Places orders with server verified prices',
    values: { starter: true, pro: true, advanced: true, enterprise: true },
  },
  {
    group: 'What the AI does',
    label: 'Books appointments against your hours',
    values: { starter: true, pro: true, advanced: true, enterprise: true },
  },
  {
    group: 'What the AI does',
    label: 'Sends details through your connected apps',
    detail: 'Follows a call up on WhatsApp when the caller can be reached there.',
    values: { starter: true, pro: true, advanced: true, enterprise: true },
  },
  {
    group: 'What the AI does',
    label: 'Hands over to a person with full context',
    values: { starter: true, pro: true, advanced: true, enterprise: true },
  },
  {
    group: 'What the AI does',
    label: 'Answers in 50+ languages',
    values: { starter: true, pro: true, advanced: true, enterprise: true },
  },
  {
    group: 'What the AI does',
    label: 'Learns from corrections you approve',
    detail: 'Every lesson waits for a human yes before the AI is allowed to use it.',
    values: { starter: true, pro: true, advanced: true, enterprise: true },
  },

  // ── Running it ───────────────────────────────────────────────────────────
  {
    group: 'Running it',
    label: 'Train it on files, links and your own writing',
    values: { starter: true, pro: true, advanced: true, enterprise: true },
  },
  {
    group: 'Running it',
    label: 'Analytics and full conversation history',
    values: { starter: true, pro: true, advanced: true, enterprise: true },
  },
  {
    group: 'Running it',
    label: 'Claude and MCP connection',
    detail: 'Run your customer care from Claude itself.',
    values: { starter: true, pro: true, advanced: true, enterprise: true },
  },
  {
    group: 'Running it',
    label: 'REST API and webhooks',
    values: { starter: true, pro: true, advanced: true, enterprise: true },
  },
  {
    group: 'Running it',
    label: 'Roles and permissions for teammates',
    values: { starter: true, pro: true, advanced: true, enterprise: true },
  },

  // ── Support ──────────────────────────────────────────────────────────────
  {
    group: 'Support',
    label: 'Support',
    values: { starter: 'Email', pro: 'Priority', advanced: 'Dedicated channel', enterprise: 'Named manager' },
  },
  {
    group: 'Support',
    label: 'Onboarding help',
    values: { starter: 'Guides', pro: 'Guided setup', advanced: 'Guided setup', enterprise: 'Hands on' },
  },
  {
    group: 'Support',
    label: 'Uptime commitment in writing',
    values: { starter: false, pro: false, advanced: false, enterprise: true },
  },
];

export const FEATURE_GROUPS = Array.from(new Set(FEATURE_MATRIX.map((f) => f.group)));

/**
 * The margin rule, checked rather than asserted in a comment.
 *
 * Development only. A pricing page that refuses to render because a plan is a
 * percentage point over would be a far worse outcome than a thin margin, so
 * production never throws; this exists to catch the edit that breaks the rule
 * at the moment somebody makes it.
 */
// The cast is because tsconfig.app.json does not reference vite/client, so
// import.meta.env is untyped. Vite still substitutes it at build time.
if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
  for (const plan of PLANS) {
    const c = planCogs(plan);
    if (c && c.yearlyRatio > MAX_COGS_RATIO) {
      console.error(
        `[plans] ${plan.name} costs ${(c.yearlyRatio * 100).toFixed(1)}% of yearly revenue at full use, ` +
        `over the ${MAX_COGS_RATIO * 100}% ceiling. Cut the allowance or raise the price.`,
      );
    }
  }
}
