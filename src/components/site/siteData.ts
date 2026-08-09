// Shared navigation + footer data for the marketing site (multi-page).
// Every entry points at a real route (optionally with an in-page #anchor).

export type MegaItem = { label: string; desc: string; to: string; icon: string };
export type MegaEntry = { label: string; to?: string; groups?: { heading: string; items: MegaItem[] }[] };

export const MEGA_MENU: MegaEntry[] = [
  {
    label: "Product",
    groups: [
      { heading: "Platform", items: [
        { label: "Overview",           desc: "The whole platform at a glance", to: "/platform",              icon: "dashboard" },
        { label: "What it does",       desc: "Actions, not just answers",      to: "/platform#agentic",      icon: "bolt" },
        { label: "How it works",       desc: "Live in under 10 minutes",       to: "/platform#how",          icon: "route" },
      ] },
      { heading: "Built in", items: [
        { label: "Image recognition",  desc: "Customers can send a photo",     to: "/platform#vision",       icon: "image_search" },
        { label: "Claude MCP",         desc: "Run your business from Claude",  to: "/platform#claude",       icon: "smart_toy" },
        { label: "Phone calls",        desc: "Your number, answered by AI",    to: "/platform#voice",        icon: "call" },
        { label: "Integrations",       desc: "Every channel, store and courier", to: "/integrations",        icon: "hub" },
      ] },
    ],
  },
  {
    label: "Solutions",
    groups: [
      { heading: "By need", items: [
        { label: "Customer support",   desc: "Answer every customer 24/7",     to: "/solutions#support",     icon: "support_agent" },
        { label: "Appointments",       desc: "Book slots right in chat",       to: "/solutions#appointments", icon: "event_available" },
        { label: "Comment replies",    desc: "Reply on Facebook & Instagram",  to: "/solutions#comments",    icon: "reviews" },
      ] },
      { heading: "By business", items: [
        { label: "Every business type", desc: "The breakdown, one by one",     to: "/solutions#every-business", icon: "workspaces" },
        { label: "All 16 industries",  desc: "Clinics, salons, stores, more",  to: "/solutions#industries",  icon: "storefront" },
        { label: "File training",      desc: "Teach the AI from your files",   to: "/solutions#training",    icon: "upload_file" },
      ] },
    ],
  },
  {
    label: "Resources",
    groups: [
      { heading: "Explore", items: [
        { label: "Live demo",          desc: "Try it yourself, no signup",     to: "/resources#demo",        icon: "chat" },
        { label: "Customer stories",   desc: "Leaders who grew with us",       to: "/customers",             icon: "format_quote" },
        { label: "Blog",               desc: "Writing on customer care AI",    to: "/blog",                  icon: "article" },
        { label: "FAQ",                desc: "Everything you need to know",     to: "/resources#faq",         icon: "help" },
      ] },
    ],
  },
  {
    label: "About Us",
    groups: [
      { heading: "Company", items: [
        { label: "About OctaDezx",     desc: "The team behind the platform",   to: "/about",                 icon: "apartment" },
        { label: "Zeriotic",           desc: "The studio that builds us",      to: "/about#zeriotic",        icon: "code" },
        { label: "DezxCorp",           desc: "The umbrella we sit under",      to: "/about#dezxcorp",        icon: "account_tree" },
      ] },
      { heading: "Work with us", items: [
        { label: "Careers",            desc: "Two open remote roles",          to: "/careers",               icon: "work" },
        { label: "Affiliate programme", desc: "Earn 30% recurring, for life",  to: "/affiliates",            icon: "handshake" },
        { label: "Blog",               desc: "Writing on customer care AI",    to: "/blog",                  icon: "article" },
      ] },
    ],
  },
  { label: "Pricing", to: "/pricing" },
];

export type FooterLink = { label: string; to?: string; href?: string };
export const FOOTER_COLS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Overview",          to: "/platform" },
      { label: "What it does",      to: "/platform#agentic" },
      { label: "Image recognition", to: "/platform#vision" },
      { label: "Phone calls",       to: "/platform#voice" },
      { label: "Integrations",      to: "/integrations" },
      { label: "Claude MCP",        to: "/platform#claude" },
      { label: "Live demo",         to: "/resources#demo" },
      { label: "Pricing",           to: "/pricing" },
    ],
  },
  {
    title: "Use cases",
    links: [
      { label: "Customer support", to: "/solutions#support" },
      { label: "Appointments",     to: "/solutions#appointments" },
      { label: "Lead follow-ups",  to: "/platform#followups" },
      { label: "Comment replies",  to: "/solutions#comments" },
      { label: "Orders in chat",   to: "/solutions#support" },
      { label: "File training",    to: "/solutions#training" },
    ],
  },
  {
    title: "Industries",
    links: [
      { label: "Restaurants",     to: "/solutions#restaurants" },
      { label: "Clinics",         to: "/solutions#clinics" },
      { label: "Agencies",        to: "/solutions#agencies" },
      { label: "Real estate",     to: "/solutions#realestate" },
      { label: "Salons & local",  to: "/solutions#local" },
      { label: "All 16 industries", to: "/solutions#every-business" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us",             to: "/about" },
      { label: "Careers",              to: "/careers" },
      { label: "Affiliate programme",  to: "/affiliates" },
      { label: "Blog",                 to: "/blog" },
      { label: "Customer stories",     to: "/customers" },
      { label: "Contact us",           href: "mailto:kevin@octadezx.com" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy",   to: "/privacy" },
      { label: "Terms of Service", to: "/privacy" },
      { label: "Cookie Policy",    to: "/privacy" },
    ],
  },
];

// ── Shared marketing content reused across pages ─────────────────────────────
// Ordered services first. The product serves all sixteen equally, but leading
// with a storefront was teaching every reader (and every search engine) that
// OctaDezx is an e-commerce tool, which it is not.
export const INDUSTRIES = [
  { icon: "restaurant",      label: "Restaurants",          desc: "Menus, food orders and reservations" },
  { icon: "stethoscope",     label: "Clinics & healthcare", desc: "Services, hours and appointment requests" },
  { icon: "work",            label: "Agencies",             desc: "Service enquiries and lead qualification" },
  { icon: "home_work",       label: "Real estate agencies", desc: "Listings, service areas and viewings" },
  { icon: "content_cut",     label: "Beauty & salons",      desc: "Services, prices and appointment booking" },
  { icon: "handyman",        label: "Local services",       desc: "Quotes, service areas and scheduling" },
  { icon: "school",          label: "Education",            desc: "Programs, fees and admissions" },
  { icon: "cloud",           label: "SaaS & software",      desc: "Plan questions, support and demos" },
  { icon: "store",           label: "Retail stores",        desc: "Stock questions, locations and hours" },
  { icon: "hotel",           label: "Hotels & hospitality", desc: "Rooms, rates and reservation requests" },
  { icon: "flight",          label: "Travel & tourism",     desc: "Packages, bookings and itineraries" },
  { icon: "directions_car",  label: "Automotive",           desc: "Vehicle stock, test drives and servicing" },
  { icon: "local_shipping",  label: "Logistics & couriers", desc: "Tracking, coverage and delivery quotes" },
  { icon: "account_balance", label: "Banks & finance",      desc: "Compliant service info and secure hand-offs" },
  { icon: "storefront",      label: "E-commerce",           desc: "Catalogue, orders, shipments and invoices" },
  { icon: "domain",          label: "Enterprise",           desc: "Multi-department routing at scale" },
];

// Capabilities every business gets first, with the commerce-shaped ones sitting
// among them rather than in front of them.
export const CAPABILITIES = [
  { icon: "bolt",          title: "Instant, on-brand replies",   desc: "Trained on your services, policies and voice, so it sounds like you, not a bot." },
  { icon: "translate",     title: "Speaks their language",       desc: "It replies in whatever language the customer writes in, including mixed writing like Banglish or Hinglish." },
  { icon: "event_available", title: "Books appointments",        desc: "In chat or on a live call, it collects the name, the service and the time, reads them back, then files the booking and emails you." },
  { icon: "image_search",  title: "Reads photos and voice notes", desc: "A customer can send a picture of the thing they want instead of describing it, or record a voice note instead of typing." },
  { icon: "call",          title: "Answers the phone",           desc: "Give your AI a phone number and it holds a real conversation, interruptions and all, takes voicemail out of hours, and writes every call down as plain text." },
  { icon: "record_voice_over", title: "Sounds like your team",   desc: "Give it a name, a job title and a manner, then train it in plain English. Separate instructions for calls coming in and calls going out." },
  { icon: "target",        title: "Captures and follows up leads", desc: "Every contact becomes a lead. The AI follows the playbook you wrote in plain English to re-engage them." },
  { icon: "reviews",       title: "Replies to comments",         desc: "Answers under your Facebook and Instagram posts, or privately in the commenter's messages, or both." },
  { icon: "dynamic_feed",  title: "Takes the order and files it", desc: "It confirms the order in the conversation and records it, with every line price and the total recalculated on our servers from your own catalogue." },
  { icon: "support_agent", title: "Knows when to stop",          desc: "If it cannot help, or somebody asks for a person, it escalates with the whole conversation attached instead of guessing." },
  { icon: "insights",      title: "Analytics that matter",       desc: "Resolution rate, response times and top questions, live in one dashboard." },
  { icon: "shield_lock",   title: "Enterprise security",         desc: "End to end encryption, role based access and GDPR ready infrastructure." },
];

export const FAQS = [
  { q: "What is OctaDezx?", a: "OctaDezx is an agentic AI platform for customer care. It gives any business an always-on AI agent that answers customers and then takes the action: it places orders, books appointments, answers and makes phone calls, replies to Facebook and Instagram comments, follows up leads, and hands over to a human with full context when it cannot help." },
  { q: "Is OctaDezx only for e-commerce?", a: "No. It is built for every kind of business and the dashboard adapts to twelve business types, so a restaurant gets a Menu and Orders and Reservations, a clinic gets Services and Appointments, an agency gets Services and Leads, and a store gets Products, Orders and Shipments. Restaurants, clinics, salons, agencies, schools, estate agents, workshops, hotels, SaaS companies and enterprises all run on the same platform." },
  { q: "What makes it agentic rather than a chatbot?", a: "A chatbot answers and leaves you a transcript to act on. OctaDezx acts: it files the order with prices recalculated server-side against your catalogue, files the booking and emails you, captures the lead and follows it up, answers the phone, replies to comments, and exposes your business as tools to Claude through a native MCP server." },
  { q: "Can a customer send a photo instead of describing what they want?", a: "Yes. In an OctaDezx chat a customer can attach a photo. The AI describes what it can see, matches it against your own catalogue, and shows the matching item with the price and details. If you do not sell that thing it says so honestly and suggests the closest thing you do have, rather than inventing a product. Voice notes on WhatsApp, Messenger, Instagram and Telegram are transcribed and answered in the same thread." },
  { q: "Can OctaDezx replace a customer care agent?", a: "It works as a 24/7 AI customer service agent that instantly answers FAQs, handles service, product and order questions and resolves common support requests, then escalates to your human team with full context when a conversation needs a person." },
  { q: "Which channels does the AI customer service agent cover?", a: "WhatsApp, Instagram, Facebook, Telegram, Shopify and your website widget out of the box, plus inbound and outbound phone calls and 90+ integrations covering stores, CRMs, payments and couriers, all answered from one place in your customers' own language." },
  { q: "Does it take orders, not just answer questions?", a: "Yes. Beyond support, OctaDezx confirms and places orders for you. Every price and total is verified on our servers against your catalogue, so customers are always charged the correct amount." },
  { q: "Can OctaDezx answer phone calls?", a: "Yes, on every paid plan. You give your AI assistant a real phone number and it answers in real time. It is a conversation, not a phone menu: there is nothing to press, and you can interrupt it mid-sentence the way you would a person. It answers from the same catalogue, prices and opening hours as the chat, hands over to your team or takes a voicemail when it cannot help, and every call is stored as a plain-text transcript in the same history as your chats." },
  { q: "Does the AI phone agent sound like a robot?", a: "There is nothing to press and no decision tree. Audio streams both ways and is paced out at the rate the phone network plays it, which is what makes interrupting work: the assistant always knows exactly how much of its answer you actually heard, so cutting in stops it mid-sentence. You set its name and its tone, but it will never claim to be a person. Asked directly, it says plainly that it is an automated assistant." },
  { q: "What happens to calls outside my opening hours?", a: "You choose: take a voicemail, let the AI answer anyway, transfer to a person, or end the call politely. Voicemails are transcribed automatically and land in your dashboard and your inbox, and the conversation appears in your escalated queue so nothing gets lost." },
  { q: "How many call minutes do I get?", a: "Every paid plan includes phone calls. Starter has 100 minutes a month, Pro 400 and Advanced 900, and Enterprise is metered at 12 cents a minute with no cap. When minutes run out the assistant winds the call down politely and takes a message rather than cutting anyone off." },
  { q: "What counts as a message?", a: "One answer the AI sends, on any channel: WhatsApp, Instagram, Facebook, Telegram, your website widget or the shareable chat link. Starter includes 2,500 a month, Pro 10,000 and Advanced 22,000. Enterprise is metered at 0.6 cents a message. Every plan has every feature, so what you are choosing is volume, not a feature list." },
  { q: "Can it call customers, not just receive calls?", a: "Yes, and it is switched off by default. Outbound calling only dials between 8am and 9pm in the other person’s own local time, stops immediately if somebody says stop calling, and records why you were allowed to call each number. Automated calling is regulated in most countries, so check your obligations before you turn it on." },
  { q: "Can the AI book an appointment during a phone call?", a: "Yes. It takes the name, the day and time and what the appointment is for, reads the details back to confirm, then files the booking before the call ends. It can take orders the same way, using only the products in your catalogue, and reads the whole order back before confirming. Both appear in your dashboard immediately, alongside bookings and orders taken over chat." },
  { q: "Can I train the voice assistant in my own words?", a: "Yes. Give it a name, a job title and a manner, then write plain-English instructions like \"always ask which branch they mean before quoting a price\". Calls coming in and calls going out are trained separately, because answering someone who rang you and ringing someone yourself are different jobs. Individual outbound calls can also carry their own reason for calling." },
  { q: "How fast can I go live?", a: "Under 10 minutes. Paste a storefront URL to import your catalogue, add your policies and FAQs, connect a channel, and your AI customer care agent is live." },
  { q: "Can OctaDezx follow up with customers and leads?", a: "Yes. Every customer who shares contact details becomes a lead in your dashboard. You write a follow-up playbook in plain language and the AI applies it in every conversation, and you can send one-click follow-ups that land in the customer's existing chat thread." },
  { q: "What is the OctaDezx MCP server for Claude?", a: "OctaDezx ships a native Model Context Protocol (MCP) server at octadezx.com/mcp. Connect it to Claude and manage your business in plain language: list escalated chats, read conversations, reply to customers, check orders, update products and teach the knowledge base. Secured with OAuth, and included in the free trial." },
  { q: "Is there a free trial?", a: "Yes, a 24-hour free trial with full access to every feature. No credit card required." },
];
