// ─────────────────────────────────────────────────────────────────────────────
// Business-type catalogue, single source of truth.
//
// One business_type drives THREE things:
//   1. Onboarding  → which type-specific questions are asked (BusinessSetup)
//   2. AI brain    → the "Train AI" fields + default AI instructions (AiTraining,
//                    server-side prompt in ai-chat-response)
//   3. Dashboard   → which tools/nav sections appear and what they're called
//                    (Dashboard), a restaurant should never see "Shipments".
//
// Keeping all of this in one file means a restaurant, an agency and a SaaS each
// get a dashboard that matches how they actually run their business.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ShoppingBag, Store, Briefcase, Cloud, UtensilsCrossed, Stethoscope,
  GraduationCap, Landmark, Home, Plane, Building2, Sparkles,
  MessageSquare, Users, BarChart2, BookOpen, PlayCircle, Plug,
  Truck, FileText, ReceiptText, AlertTriangle, KeyRound, Brain, Bot, UserPlus,
  CalendarClock, PhoneCall, UsersRound,
  type LucideIcon,
} from "lucide-react";

export interface TypeField {
  name: string;
  label: string;
  placeholder: string;
  rows?: number;
}

export interface BusinessType {
  id: string;
  label: string;
  tagline: string;
  icon: LucideIcon;
  fields: TypeField[];
  descriptionPlaceholder: string;
  policiesLabel: string;
  policiesPlaceholder: string;
}

// ── AI instruction templates ────────────────────────────────────────────────
export const COMMON_AI_RULES = `1. **Stick to the facts:** Only answer from the business information, policies, and knowledge base provided. Never invent offerings, prices, or details.

2. **Be concise:** Keep answers short and conversational, like a helpful human assistant in a text chat.

3. **Language Proficiency:** If a customer writes in a mix of English and another language (e.g., Banglish, Hinglish), respond fluently and ONLY in that language (Banglish → Bengali, Hinglish → Hindi).

4. **Tone:** Be friendly, helpful, and professional.

5. **Hand off when unsure:** If you cannot help or the customer asks for a human, hand the chat to the team rather than guessing.`;

export const TYPE_AI_EXTRAS: Record<string, string> = {
  ecommerce: `6. **Sell helpfully:** Recommend the best product match, mention prices, and guide interested customers to place an order in chat.`,
  retail: `6. **Drive store visits:** Share product availability, store locations, and opening hours; guide customers to visit or reserve items.`,
  agency: `6. **Qualify leads:** Understand what the client needs, share relevant services and process, and collect their name + contact details so the team can follow up with a proposal.`,
  saas: `6. **Support and convert:** Answer product and plan questions, help troubleshoot using the knowledge base, and collect contact details for demos or sales follow-ups.`,
  restaurant: `6. **Take orders & bookings:** Share the menu with prices, take food orders in chat, and collect details for reservations (name, party size, time).`,
  healthcare: `6. **Assist carefully:** Help with services, hours, and appointment requests. NEVER give medical advice or diagnoses, hand those conversations to the team immediately.`,
  education: `6. **Guide applicants:** Explain programs, fees, and admission steps, and collect contact details of prospective students for follow-up.`,
  finance: `6. **Stay compliant:** Explain services and processes only. NEVER give personalised financial, investment, or tax advice, collect contact details and hand off to a licensed team member.`,
  realestate: `6. **Capture viewings:** Share listing and service information, and collect contact details + requirements to arrange viewings with an agent.`,
  travel: `6. **Help them book:** Share packages, availability windows, and booking steps; collect traveller details and hand off to confirm bookings.`,
  enterprise: `6. **Route correctly:** Identify which department or service the customer needs, answer from approved information only, and hand off to the right team with full context when needed.`,
  other: `6. **Capture requests:** Understand what the customer needs, answer from your data, and collect contact details for anything requiring the team.`,
};

export const buildAiInstructions = (typeId: string) =>
  `${COMMON_AI_RULES}\n\n${TYPE_AI_EXTRAS[typeId] ?? TYPE_AI_EXTRAS.other}`;

// ── The catalogue ───────────────────────────────────────────────────────────
export const BUSINESS_TYPES: BusinessType[] = [
  {
    id: "ecommerce",
    label: "E-commerce / Online Store",
    tagline: "Sell products online",
    icon: ShoppingBag,
    descriptionPlaceholder: "What do you sell, who are your customers, what makes your store special...",
    policiesLabel: "Store Policies",
    policiesPlaceholder: "Return policy, shipping times and costs, payment methods, warranty details...",
    fields: [
      { name: "shipping_info", label: "Shipping & Delivery", placeholder: "Regions you ship to, delivery times, costs, couriers used..." },
      { name: "payment_methods", label: "Payment Methods", placeholder: "Cash on delivery, cards, bKash/Nagad, PayPal, bank transfer..." },
      { name: "order_requirements", label: "Info to Collect Before an Order", placeholder: "e.g. phone number, delivery address, size/colour preference..." },
    ],
  },
  {
    id: "retail",
    label: "Retail / Physical Store",
    tagline: "Brick-and-mortar shop",
    icon: Store,
    descriptionPlaceholder: "What you sell, your neighbourhood, what makes your store worth visiting...",
    policiesLabel: "Store Policies",
    policiesPlaceholder: "Returns/exchanges, payment options, holiday hours...",
    fields: [
      { name: "store_locations", label: "Store Location(s)", placeholder: "Addresses, landmarks, parking info..." },
      { name: "opening_hours", label: "Opening Hours", placeholder: "Mon to Fri 9am to 8pm, Sat 10am to 6pm, closed Sundays..." },
      { name: "payment_methods", label: "Payment Methods", placeholder: "Cash, cards, mobile payments..." },
    ],
  },
  {
    id: "agency",
    label: "Agency / Professional Services",
    tagline: "Marketing, design, consulting, legal…",
    icon: Briefcase,
    descriptionPlaceholder: "What services you provide, industries you serve, notable results or clients...",
    policiesLabel: "Engagement Terms",
    policiesPlaceholder: "Payment terms, revision policy, project timelines, refund/cancellation terms...",
    fields: [
      { name: "services_offered", label: "Services Offered", placeholder: "Web design, SEO, branding, consulting... with starting prices if you share them", rows: 3 },
      { name: "pricing_model", label: "Pricing Model", placeholder: "Hourly, fixed-price projects, monthly retainers, custom quotes..." },
      { name: "booking_process", label: "How Clients Get Started", placeholder: "Free consultation call, intake form, proposal within 48 hours..." },
    ],
  },
  {
    id: "saas",
    label: "SaaS / Software",
    tagline: "Apps, platforms, software products",
    icon: Cloud,
    descriptionPlaceholder: "What your product does, who it's for, key features...",
    policiesLabel: "Terms & Policies",
    policiesPlaceholder: "Refund policy, trial terms, SLA, data/privacy highlights...",
    fields: [
      { name: "pricing_plans", label: "Plans & Pricing", placeholder: "Free tier, Starter $X/mo, Pro $Y/mo... what each includes", rows: 3 },
      { name: "support_channels", label: "Support Channels & Hours", placeholder: "Email support 24/7, live chat 9 to 5 EST, docs at..." },
      { name: "demo_process", label: "Trials & Demos", placeholder: "14-day free trial, book a demo at..., onboarding included on annual plans..." },
    ],
  },
  {
    id: "restaurant",
    label: "Restaurant / Food",
    tagline: "Restaurants, cafés, cloud kitchens",
    icon: UtensilsCrossed,
    descriptionPlaceholder: "Cuisine, vibe, specialities, what you're known for...",
    policiesLabel: "Policies",
    policiesPlaceholder: "Reservation policy, delivery zones, allergen handling, cancellation rules...",
    fields: [
      { name: "menu_highlights", label: "Menu Highlights", placeholder: "Signature dishes with prices (full menu can go in Menu/Knowledge Base)", rows: 3 },
      { name: "opening_hours", label: "Opening Hours", placeholder: "Daily 11am to 11pm, kitchen closes 10:30pm..." },
      { name: "delivery_options", label: "Delivery, Pickup & Reservations", placeholder: "Own delivery within 5km, also on FoodPanda/UberEats, reservations by chat or phone..." },
    ],
  },
  {
    id: "healthcare",
    label: "Healthcare / Clinic",
    tagline: "Clinics, dental, wellness, pharmacies",
    icon: Stethoscope,
    descriptionPlaceholder: "Specialities, practitioners, what patients come to you for...",
    policiesLabel: "Patient Policies",
    policiesPlaceholder: "Appointment cancellation policy, insurance, privacy practices...",
    fields: [
      { name: "services_offered", label: "Services & Specialities", placeholder: "General checkups, dental cleaning, physiotherapy... with fees if public", rows: 3 },
      { name: "appointment_booking", label: "Appointment Booking Process", placeholder: "Book via chat (we collect name + phone), walk-ins till 6pm, emergency line..." },
      { name: "insurance_accepted", label: "Insurance / Payment", placeholder: "Insurances accepted, self-pay rates, payment options..." },
    ],
  },
  {
    id: "education",
    label: "Education / Training",
    tagline: "Schools, courses, coaching centres",
    icon: GraduationCap,
    descriptionPlaceholder: "What you teach, age groups/levels, outcomes students achieve...",
    policiesLabel: "Policies",
    policiesPlaceholder: "Refund policy, attendance rules, certificate conditions...",
    fields: [
      { name: "programs_offered", label: "Programs & Courses", placeholder: "Course names, durations, fees, online/in-person...", rows: 3 },
      { name: "admission_process", label: "Admission / Enrolment Process", placeholder: "How to apply, requirements, intake dates, trial classes..." },
      { name: "schedule_info", label: "Schedules & Batches", placeholder: "Weekday evening batches, weekend batches, class timings..." },
    ],
  },
  {
    id: "finance",
    label: "Finance / Insurance",
    tagline: "Advisory, lending, insurance, fintech",
    icon: Landmark,
    descriptionPlaceholder: "Services you provide, licences/registrations, who you serve...",
    policiesLabel: "Compliance & Policies",
    policiesPlaceholder: "Regulatory disclaimers, required disclosures, complaint process...",
    fields: [
      { name: "services_offered", label: "Services Offered", placeholder: "Personal loans, life insurance, tax filing, bookkeeping...", rows: 3 },
      { name: "eligibility_requirements", label: "Eligibility / Required Documents", placeholder: "Minimum income, documents needed, age requirements..." },
      { name: "consultation_process", label: "Consultation Process", placeholder: "Free 15-min call, in-branch appointments, response within 1 business day..." },
    ],
  },
  {
    id: "realestate",
    label: "Real Estate",
    tagline: "Brokerage, property management, rentals",
    icon: Home,
    descriptionPlaceholder: "Areas you cover, property types, buyer/seller/renter focus...",
    policiesLabel: "Terms",
    policiesPlaceholder: "Commission structure, viewing policy, documentation requirements...",
    fields: [
      { name: "service_areas", label: "Service Areas", placeholder: "Neighbourhoods/cities you cover..." },
      { name: "listings_focus", label: "Property Types & Listings", placeholder: "Apartments, commercial, land... where to see current listings" },
      { name: "viewing_process", label: "Viewing & Buying Process", placeholder: "How viewings are arranged, what to bring, typical timelines..." },
    ],
  },
  {
    id: "travel",
    label: "Travel / Hospitality",
    tagline: "Agencies, hotels, tours, rentals",
    icon: Plane,
    descriptionPlaceholder: "Destinations, packages, what kind of travellers you serve...",
    policiesLabel: "Booking Policies",
    policiesPlaceholder: "Cancellation/refund policy, payment schedule, visa support terms...",
    fields: [
      { name: "packages_destinations", label: "Packages & Destinations", placeholder: "Popular packages with prices and durations...", rows: 3 },
      { name: "booking_process", label: "Booking Process", placeholder: "Deposit required, documents needed, how far in advance to book..." },
      { name: "cancellation_policy", label: "Changes & Cancellations", placeholder: "Free cancellation up to X days, rebooking rules..." },
    ],
  },
  {
    id: "enterprise",
    label: "Enterprise / Corporation",
    tagline: "Large organisations, multiple departments",
    icon: Building2,
    descriptionPlaceholder: "What the organisation does, divisions, markets served...",
    policiesLabel: "Customer Service Policies",
    policiesPlaceholder: "SLAs, complaint escalation procedure, service standards, compliance notes...",
    fields: [
      { name: "departments", label: "Departments / Service Lines", placeholder: "Sales, Billing, Technical Support, Returns... and what each handles", rows: 3 },
      { name: "escalation_contacts", label: "Escalation Path", placeholder: "Which issues go to which team, response time commitments..." },
      { name: "support_hours", label: "Support Hours & Channels", placeholder: "24/7 chat, phone 9 to 6, regional support contacts..." },
    ],
  },
  {
    id: "other",
    label: "Other",
    tagline: "Anything else, we'll adapt",
    icon: Sparkles,
    descriptionPlaceholder: "Describe what your business does, your services, target customers...",
    policiesLabel: "Business Policies",
    policiesPlaceholder: "Any rules, terms, or policies your customers should know...",
    fields: [
      { name: "key_services", label: "Key Products / Services", placeholder: "What customers can get from you, with prices if applicable", rows: 3 },
      { name: "common_questions", label: "Common Customer Questions", placeholder: "The questions you get asked most, and their answers" },
      { name: "contact_process", label: "How Customers Reach the Team", placeholder: "When and how a human follows up (phone, email, visit)..." },
    ],
  },
];

export const getBusinessType = (typeId: string | null | undefined): BusinessType =>
  BUSINESS_TYPES.find((t) => t.id === typeId) ?? BUSINESS_TYPES[BUSINESS_TYPES.length - 1];

// ── Dashboard navigation, per business type ─────────────────────────────────
export type SectionId =
  | "overview" | "train" | "analytics" | "products" | "chats" | "voice" | "escalated" | "leads"
  | "appointments" | "orders" | "shipments" | "invoices" | "invoice-settings"
  | "integrations" | "team" | "api-keys" | "claude-mcp" | "knowledge-base" | "tutorial";

export interface NavItem {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  isNew?: boolean;
}

// Default label + icon for every section. Per-type overrides (below) only need
// to restate the label when the wording differs (e.g. "Products" → "Menu").
const SECTION_META: Record<SectionId, { label: string; icon: LucideIcon; isNew?: boolean }> = {
  overview: { label: "Overview", icon: MessageSquare },
  train: { label: "Train AI", icon: Brain, isNew: true },
  products: { label: "Products", icon: ShoppingBag },
  chats: { label: "Chat Sessions", icon: Users },
  voice: { label: "Voice", icon: PhoneCall, isNew: true },
  escalated: { label: "Escalated Chats", icon: AlertTriangle },
  leads: { label: "Leads & Follow-ups", icon: UserPlus, isNew: true },
  appointments: { label: "Appointments", icon: CalendarClock, isNew: true },
  orders: { label: "Orders", icon: ShoppingBag },
  shipments: { label: "Shipments", icon: Truck },
  invoices: { label: "Invoices", icon: FileText },
  "invoice-settings": { label: "Invoice Settings", icon: ReceiptText },
  "knowledge-base": { label: "Knowledge Base", icon: BookOpen },
  analytics: { label: "Analytics", icon: BarChart2 },
  integrations: { label: "Integrations", icon: Plug },
  team: { label: "Team", icon: UsersRound, isNew: true },
  "api-keys": { label: "API Keys", icon: KeyRound },
  "claude-mcp": { label: "Connect to Claude", icon: Bot, isNew: true },
  tutorial: { label: "Tutorial", icon: PlayCircle },
};

// One-line purpose shown under every section title, keeps the whole dashboard
// self-explanatory instead of a bare heading over a wall of widgets.
export const SECTION_DESCRIPTIONS: Record<SectionId, string> = {
  overview: "Your business at a glance, live stats, setup progress and quick actions.",
  train: "Teach the AI your services, policies and tone so it answers exactly like your team would.",
  products: "Everything the AI can talk about and sell, import from a URL, CSV or add items manually.",
  chats: "Every customer conversation across all channels, with full transcripts. Jump in any time.",
  voice: "Phone calls your AI answers and places, with transcripts, voicemail and your calling hours.",
  escalated: "Conversations the AI handed to your team, each one arrives with full context.",
  leads: "Customers who shared contact details, follow up, re-engage and close them, right from here.",
  appointments: "Bookings your AI captured, plus the hours and services it books around.",
  orders: "Orders the AI captured and confirmed, with server-verified pricing.",
  shipments: "Track fulfilment status for every confirmed order.",
  invoices: "Invoices generated from confirmed orders, download, resend or void.",
  "invoice-settings": "Numbering, logo and footer details that appear on every invoice.",
  "knowledge-base": "Articles the AI answers from, the more you add, the fewer escalations you get.",
  analytics: "Resolution rate, response times, revenue and top products, live, not last week.",
  integrations: "Connect WhatsApp, Instagram, Facebook, Shopify and more to answer everywhere.",
  team: "Invite the people who work this inbox with you, and decide what each of them can do.",
  "api-keys": "Programmatic access for developers, create, rotate and revoke keys.",
  "claude-mcp": "Manage your business from inside Claude, orders, replies and training via MCP.",
  tutorial: "A guided tour of everything OctaDezx can do for your business.",
};

interface TypeNav {
  // Ordered list of business sections this type sees.
  sections: SectionId[];
  // Optional label overrides (e.g. restaurant: products → "Menu").
  labels?: Partial<Record<SectionId, string>>;
}

// Sections every business gets, in a sensible order around the type-specific ones.
const COMMERCE_FULL: SectionId[] = [
  "overview", "train", "products", "chats", "voice", "escalated", "leads", "appointments",
  "orders", "shipments", "invoices", "invoice-settings",
  "knowledge-base", "integrations", "analytics", "team", "api-keys", "claude-mcp", "tutorial",
];

// Service businesses: no physical fulfilment (orders/shipments/invoices), they
// run on conversations, lead capture and a knowledge base instead.
const SERVICE_BASE: SectionId[] = [
  "overview", "train", "products", "chats", "voice", "escalated", "leads", "appointments",
  "knowledge-base", "integrations", "analytics", "team", "api-keys", "claude-mcp", "tutorial",
];

const TYPE_NAV: Record<string, TypeNav> = {
  ecommerce: { sections: COMMERCE_FULL },
  enterprise: { sections: COMMERCE_FULL, labels: { products: "Catalog" } },
  retail: {
    sections: ["overview", "train", "products", "chats", "voice", "escalated", "leads", "appointments", "orders", "invoices", "knowledge-base", "integrations", "analytics", "team", "api-keys", "claude-mcp", "tutorial"],
    labels: { products: "Catalog" },
  },
  restaurant: {
    sections: ["overview", "train", "products", "chats", "voice", "escalated", "leads", "appointments", "orders", "invoices", "knowledge-base", "integrations", "analytics", "team", "api-keys", "claude-mcp", "tutorial"],
    labels: { products: "Menu", orders: "Orders & Reservations" },
  },
  travel: {
    sections: ["overview", "train", "products", "chats", "voice", "escalated", "leads", "appointments", "orders", "invoices", "knowledge-base", "integrations", "analytics", "team", "api-keys", "claude-mcp", "tutorial"],
    labels: { products: "Packages", orders: "Bookings" },
  },
  agency: { sections: SERVICE_BASE, labels: { products: "Services", escalated: "Escalated / Leads" } },
  saas: { sections: SERVICE_BASE, labels: { products: "Plans" } },
  healthcare: { sections: SERVICE_BASE, labels: { products: "Services", escalated: "Escalated / Patients" } },
  education: { sections: SERVICE_BASE, labels: { products: "Programs" } },
  finance: { sections: SERVICE_BASE, labels: { products: "Services" } },
  realestate: { sections: SERVICE_BASE, labels: { products: "Listings", escalated: "Escalated / Viewings" } },
  other: {
    sections: ["overview", "train", "products", "chats", "voice", "escalated", "leads", "appointments", "orders", "knowledge-base", "integrations", "analytics", "team", "api-keys", "claude-mcp", "tutorial"],
    labels: { products: "Catalog" },
  },
};

/** The ordered business-tool nav for a given business type. */
export function navForType(typeId: string | null | undefined): NavItem[] {
  const cfg = TYPE_NAV[typeId ?? ""] ?? TYPE_NAV.other;
  return cfg.sections.map((id) => ({
    id,
    label: cfg.labels?.[id] ?? SECTION_META[id].label,
    icon: SECTION_META[id].icon,
    isNew: SECTION_META[id].isNew,
  }));
}

/** Label for a single section under a given type (used for page titles). */
export function sectionLabel(typeId: string | null | undefined, id: SectionId): string {
  const cfg = TYPE_NAV[typeId ?? ""] ?? TYPE_NAV.other;
  return cfg.labels?.[id] ?? SECTION_META[id].label;
}

// ── Feature selection (owner chooses which tools appear) ─────────────────────
// Core sections are always shown, they are the AI's control room. The rest are
// optional and picked during onboarding (and editable later from the dashboard).
export const CORE_SECTIONS: SectionId[] = [
  "overview", "train", "chats", "analytics", "team", "api-keys", "claude-mcp", "tutorial",
];

// Optional, owner-selectable tools, in the order they appear in the picker.
export const OPTIONAL_SECTIONS: SectionId[] = [
  "products", "voice", "escalated", "leads", "appointments",
  "orders", "shipments", "invoices", "invoice-settings",
  "knowledge-base", "integrations",
];

export interface FeatureOption {
  id: SectionId;
  label: string;
  description: string;
  icon: LucideIcon;
  isNew?: boolean;
}

/** Every optional feature, labelled for the given business type, for the picker. */
export function featureOptions(typeId: string | null | undefined): FeatureOption[] {
  const cfg = TYPE_NAV[typeId ?? ""] ?? TYPE_NAV.other;
  return OPTIONAL_SECTIONS.map((id) => ({
    id,
    label: cfg.labels?.[id] ?? SECTION_META[id].label,
    description: SECTION_DESCRIPTIONS[id],
    icon: SECTION_META[id].icon,
    isNew: SECTION_META[id].isNew,
  }));
}

/** Sensible pre-selection: the optional sections this business type shows by default. */
export function defaultFeatures(typeId: string | null | undefined): SectionId[] {
  const shown = new Set(navForType(typeId).map((n) => n.id));
  return OPTIONAL_SECTIONS.filter((id) => shown.has(id));
}

/**
 * The dashboard nav for a business, honouring its chosen features.
 * enabledFeatures null/undefined ⇒ legacy business ⇒ show the full type nav.
 * Otherwise: core sections always, plus the optional ones the owner enabled,
 * ordered by the canonical superset order and labelled for the type.
 */
export function navForBusiness(
  typeId: string | null | undefined,
  enabledFeatures: string[] | null | undefined,
): NavItem[] {
  if (!enabledFeatures) return navForType(typeId);
  const cfg = TYPE_NAV[typeId ?? ""] ?? TYPE_NAV.other;
  const enabled = new Set(enabledFeatures);
  return COMMERCE_FULL
    .filter((id) => CORE_SECTIONS.includes(id) || enabled.has(id))
    .map((id) => ({
      id,
      label: cfg.labels?.[id] ?? SECTION_META[id].label,
      icon: SECTION_META[id].icon,
      isNew: SECTION_META[id].isNew,
    }));
}
