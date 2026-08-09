// Company, careers and affiliate-program content for the marketing site.
// Kept in one place so the About, Careers and Affiliates pages, the nav, the
// footer and the JSON-LD all read from the same source of truth.

export const COMPANY = {
  name: "OctaDezx",
  parent: "DezxCorp",
  sibling: "Zeriotic",
  zerioticUrl: "https://zeriotic.com/",
  email: "kevin@octadezx.com",
  careersEmail: "careers@octadezx.com",
  affiliateEmail: "partners@octadezx.com",
};

export type GroupBrand = {
  id: string;
  name: string;
  role: string;
  icon: string;
  blurb: string;
  points: string[];
  href?: string;     // external site, when the brand has its own
};

// The three brands and how they relate. DezxCorp is the holding company that
// owns both teams, Zeriotic is the studio, OctaDezx is the product.
export const GROUP: GroupBrand[] = [
  {
    id: "dezxcorp",
    name: "DezxCorp",
    role: "The holding company",
    icon: "account_balance",
    blurb:
      "DezxCorp is the holding company that owns both Zeriotic and OctaDezx. It sets one roadmap, one engineering culture and one standard for the work that leaves the building, and it holds the product for the long term so the studio and the platform pull in the same direction instead of competing for attention.",
    points: ["Owns Zeriotic and OctaDezx", "One roadmap across both teams", "Long horizon, patient ownership"],
  },
  {
    id: "zeriotic",
    name: "Zeriotic",
    role: "The web development studio",
    icon: "code",
    href: "https://zeriotic.com/",
    blurb:
      "Zeriotic is a web development studio that designs and builds storefronts, web apps and product experiences for founders. It is the engineering muscle behind OctaDezx: the same people who ship client work ship the platform, which is why the product moves fast and holds together.",
    points: ["Storefronts and web apps", "Design plus engineering in one team", "Builds and backs OctaDezx"],
  },
  {
    id: "octadezx",
    name: "OctaDezx",
    role: "The agentic AI product",
    icon: "smart_toy",
    blurb:
      "OctaDezx is an agentic AI platform for customer operations. It does not only reply: it places orders with server verified prices, books appointments, answers and makes phone calls, reads photos customers send, follows up on leads and hands over to a person when it should. It runs on WhatsApp, Instagram, Facebook, Telegram, Shopify and your own site, in 50+ languages, for any kind of business, trained only on your real information.",
    points: ["Takes actions, not just messages", "Any business, not just shops", "Live in under 10 minutes"],
  },
];

export const VALUES = [
  {
    icon: "storefront",
    title: "Build for the owner, not the demo",
    desc: "Every feature has to survive a real shop on a busy day. If it only looks good in a walkthrough, it does not ship.",
  },
  {
    icon: "verified",
    title: "Answer from real information",
    desc: "The AI speaks only from your catalogue, policies and knowledge base. No invented prices, no invented promises, no guessing.",
  },
  {
    icon: "bolt",
    title: "Self serve, always",
    desc: "Sign up, connect a channel, go live. No sales call, no onboarding fee, no waiting on a human to unlock what you paid for.",
  },
  {
    icon: "payments",
    title: "Every message is revenue",
    desc: "A support question is a sales conversation that has not been recognised yet. We treat the inbox as the top of the funnel.",
  },
  {
    icon: "shield_lock",
    title: "Earn the trust once",
    desc: "Server side price verification, role based access and encrypted data. Customer conversations are not training material for anyone else.",
  },
  {
    icon: "diversity_3",
    title: "Small team, high leverage",
    desc: "A studio sized team shipping platform sized work. Fewer people, tighter loops, decisions made the same day they come up.",
  },
];

export const MILESTONES = [
  { year: "Zeriotic", title: "The studio comes first", desc: "Years of building storefronts and web apps for founders, watching the same problem show up in every project: the site converts, then the messages pile up overnight." },
  { year: "The gap", title: "Traffic without answers", desc: "Owners were paying for traffic they could not serve. Questions went unanswered until morning, and by then the customer had bought somewhere else." },
  { year: "OctaDezx", title: "An agent that never sleeps", desc: "We built the thing we kept wishing our clients had: an AI trained on their own catalogue and policies that answers instantly, in any language, and hands over to a human when it should." },
  { year: "Today", title: "One platform, every channel", desc: "Support, orders, appointments, comment replies, follow ups and analytics in one dashboard, plus a native Claude MCP server so owners can run the whole business in plain language." },
];

// ── Careers ─────────────────────────────────────────────────────────────────
export type Role = {
  slug: string;
  title: string;
  team: string;
  type: string;
  location: string;
  icon: string;
  summary: string;
  comp: string;
  responsibilities: string[];
  requirements: string[];
  bonus: string[];
};

export const ROLES: Role[] = [
  {
    slug: "client-acquisition",
    title: "Client Acquisition Executive",
    team: "Revenue",
    type: "Full time or commission only",
    location: "Remote, any timezone",
    icon: "handshake",
    summary:
      "Bring OctaDezx to the businesses that need it most. You find store owners, agencies and service businesses that are drowning in customer messages, show them what an always on agent does to their response time, and sign them up. This is the role for someone who would rather be measured on accounts landed than on hours logged.",
    comp: "Uncapped commission on every account you land, paid monthly for as long as that customer stays with us, with a base available for full time candidates.",
    responsibilities: [
      "Build and work your own pipeline of e-commerce stores, agencies and local service businesses",
      "Run short, honest product walkthroughs using the live demo and a trial account",
      "Turn free trials into paying accounts and keep those accounts alive through the first month",
      "Own outreach end to end: research, first message, follow up, close",
      "Feed real objections back to the product team so we fix the reason, not the symptom",
    ],
    requirements: [
      "You have sold something before and can point at what you closed",
      "Written English that a business owner will actually reply to",
      "Comfortable working a pipeline without anyone chasing you for updates",
      "You understand small business operations well enough to be useful in the conversation",
      "Self directed, remote ready, and honest about your numbers",
    ],
    bonus: [
      "Existing network in e-commerce, retail or agencies",
      "Experience selling SaaS or subscription products",
      "A second language your market speaks",
    ],
  },
  {
    slug: "growth-marketer",
    title: "Growth Marketer",
    team: "Growth",
    type: "Full time or contract",
    location: "Remote, any timezone",
    icon: "trending_up",
    summary:
      "Own the top of the funnel. Content, organic social, paid experiments and lifecycle email, all pointed at one number: trials that turn into activated accounts. You will have real freedom over channel choice and a product that demos itself, so the work is finding the people who already have the problem.",
    comp: "Competitive remote salary or contract rate, plus performance bonuses tied to activated accounts.",
    responsibilities: [
      "Own acquisition across content, SEO, paid social and lifecycle email",
      "Ship landing pages and campaigns for specific industries and use cases",
      "Run paid experiments with a small budget and kill what does not work quickly",
      "Write and publish content that ranks for customer care and support automation searches",
      "Report honestly on cost per trial, activation rate and retention, weekly",
    ],
    requirements: [
      "You have grown a product or a brand and can show the numbers",
      "Strong writing, because most of this job is words",
      "Hands on with analytics: you can set up tracking and read it yourself",
      "Comfortable with SEO fundamentals and modern AI search visibility",
      "You can design a test, run it, and admit when it failed",
    ],
    bonus: [
      "B2B SaaS or e-commerce tooling experience",
      "Video and short form content skills",
      "You have run an affiliate or partner programme before",
    ],
  },
];

export const PERKS = [
  { icon: "public", title: "Fully remote", desc: "Work from wherever you are productive. We care about output, not chairs." },
  { icon: "schedule", title: "Own your hours", desc: "No standups at dawn. Async by default, with a short overlap window that suits your timezone." },
  { icon: "rocket_launch", title: "Real ownership", desc: "A small team means your work is visible, shipped and credited, not buried in a committee." },
  { icon: "payments", title: "Paid on results", desc: "Commission and bonuses that keep paying while the customers you brought in stay." },
  { icon: "smart_toy", title: "Best tools, no arguments", desc: "The AI tooling you need to do the job properly is covered, including the platform itself." },
  { icon: "school", title: "Learn the whole stack", desc: "Sit close to a studio that builds real products. You will leave knowing more than you arrived with." },
];

// ── Affiliate programme ─────────────────────────────────────────────────────
export const AFFILIATE = {
  rate: 30,
  cookieDays: 60,
  minPayout: 50,
  audienceDiscount: 10,
};

export const AFFILIATE_PERKS = [
  { icon: "autorenew", title: "30% recurring, for life", desc: "Not a one off bounty. You earn 30% of every payment your referral makes, every month, for as long as they stay a customer." },
  { icon: "local_offer", title: "A real offer for your audience", desc: "Your personal code gives them 10% off, so you are sharing a discount, not just a link. Warm intros convert." },
  { icon: "trending_up", title: "Bonus tiers on top", desc: "Cash bonuses stack on top of commission as your active referrals grow. Nothing is capped at any level." },
  { icon: "cookie", title: "60 day attribution", desc: "Two full months of cookie window, so slow deciders still count as yours when they finally sign up." },
  { icon: "account_balance_wallet", title: "Paid monthly", desc: "Payouts every month once you clear $50. Track clicks, trials and live accounts from your dashboard." },
  { icon: "handshake", title: "No exclusivity, no catch", desc: "Promote what you like alongside us. No minimum volume, no lock in, no clawback on healthy accounts." },
];

export const AFFILIATE_TIERS = [
  { active: "10 active accounts", bonus: "$100", note: "One off bonus, paid the month you hit it" },
  { active: "25 active accounts", bonus: "$350", note: "Plus a listing on our partners page" },
  { active: "50 active accounts", bonus: "$1,000", note: "Plus a custom landing page for your audience" },
];

export const AFFILIATE_STEPS = [
  { icon: "edit_note", title: "Apply in two minutes", desc: "Tell us who your audience is and where you will share OctaDezx. We review every application by hand and reply within two working days." },
  { icon: "link", title: "Get your link and code", desc: "You receive a tracked referral link and a discount code that takes 10% off for anyone who uses it." },
  { icon: "campaign", title: "Share it honestly", desc: "Newsletter, YouTube, an agency client list, a community. Anywhere business owners are already asking how to keep up with messages." },
  { icon: "payments", title: "Get paid every month", desc: "30% of every payment lands in your balance while your referrals stay subscribed. Withdraw once you pass $50." },
];

export const AFFILIATE_FAQS = [
  { q: "Who can join the affiliate programme?", a: "Creators, agencies, consultants, developers and anyone with an audience of business owners. You do not need to be an OctaDezx customer to apply, though it helps you speak about it honestly." },
  { q: "How much can I actually earn?", a: "30% of every payment, recurring. Ten Starter accounts at $29 a month is $87 a month, and it keeps paying while they stay. Ten Advanced accounts at $199 a month is $597 a month. There is no cap at any level." },
  { q: "When and how do I get paid?", a: "Balances are settled monthly once you pass $50. Commission accrues on every successful payment your referrals make, not just the first one." },
  { q: "What happens if my referral cancels?", a: "Commission simply stops with their last payment. We do not claw back anything you have already earned on healthy accounts." },
  { q: "Do you allow paid ads on your brand terms?", a: "Not on OctaDezx brand keywords, because we would be bidding against ourselves. Paid traffic on your own content, category terms and audiences is welcome." },
  { q: "Can I offer my audience something extra?", a: "Yes. Every partner gets a code that takes 10% off for the people who use it, so you are handing over a genuine discount rather than a bare referral link." },
];
