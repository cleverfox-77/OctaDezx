/**
 * The public integrations directory.
 *
 * GENERATED FROM THE REAL THING. Every name below is a platform the dashboard
 * can actually connect, read out of PLATFORMS and COURIER_DEFS in
 * src/components/PlatformIntegrations.tsx. That file is the source of truth and
 * it is deliberately NOT imported here: it is seventeen hundred lines of
 * credential forms and inline SVG, and pulling it into the marketing bundle to
 * render a list of names would cost every visitor the whole dashboard.
 *
 * If you add an integration there, add it here. Nothing breaks if you forget,
 * which is exactly why this comment exists.
 */

export interface IntegrationEntry {
  id: string;
  name: string;
  blurb: string;
}

export interface IntegrationGroup {
  slug: string;
  title: string;
  intro: string;
  items: IntegrationEntry[];
}

export const INTEGRATION_GROUPS: IntegrationGroup[] = [
  {
    slug: "built-in",
    title: "Built in",
    intro: "Channels that are part of OctaDezx. Nothing to connect, they work the moment you sign up.",
    items: [
      { id: "widget", name: "Website chat widget", blurb: "A script tag on your site. The AI answers there with your catalogue and policies." },
      { id: "chatlink", name: "Shareable chat link", blurb: "A public page you can send any customer, or put in a bio. No install, no widget." },
      { id: "phone", name: "Phone number", blurb: "Your own number, answered in real time by the AI. Calls in and out, voicemail with transcripts." },
      { id: "mcp", name: "Claude and MCP", blurb: "Connect OctaDezx to Claude and run your customer care from a conversation." },
      { id: "api", name: "REST API", blurb: "Every object in the dashboard, reachable with an API key." },
      { id: "webhooks", name: "Webhooks", blurb: "Get told when an order, a booking or an escalation happens." },
    ],
  },
  {
    slug: "messaging",
    title: "Messaging and social",
    intro: "Your customers keep using the app they already have. The AI answers in the same thread.",
    items: [
      { id: "whatsapp", name: "WhatsApp", blurb: "Serve 2B+ users directly in WhatsApp" },
      { id: "facebook", name: "Facebook Messenger", blurb: "Automate conversations on your Facebook Page" },
      { id: "instagram", name: "Instagram DM", blurb: "Reply to Instagram Direct Messages with AI" },
      { id: "telegram", name: "Telegram", blurb: "Deploy an AI-powered Telegram bot in minutes" },
      { id: "viber", name: "Viber", blurb: "Reach Viber's 1B+ users with AI chat" },
      { id: "line", name: "LINE", blurb: "Connect with LINE's 200M+ users in Asia" },
      { id: "twitter", name: "Twitter / X DM", blurb: "Auto-reply to Twitter/X Direct Messages" },
      { id: "wechat", name: "WeChat", blurb: "Automate WeChat Official Account messages" },
      { id: "discord", name: "Discord", blurb: "AI-powered slash commands for your Discord server" },
      { id: "slack", name: "Slack", blurb: "Deploy AI in your Slack workspace" },
    ],
  },
  {
    slug: "e-commerce",
    title: "E-commerce",
    intro: "Your catalogue, prices and stock, synced in so the AI answers from what you really sell.",
    items: [
      { id: "shopify", name: "Shopify", blurb: "Sync products, orders and customers from Shopify" },
      { id: "woocommerce", name: "WooCommerce", blurb: "Connect your WordPress/WooCommerce store" },
      { id: "amazon", name: "Amazon Seller", blurb: "Sync Amazon listings, orders and FBA inventory" },
      { id: "etsy", name: "Etsy", blurb: "Manage your Etsy shop orders and listings" },
      { id: "ebay", name: "eBay", blurb: "Sync eBay listings and orders automatically" },
      { id: "bigcommerce", name: "BigCommerce", blurb: "Connect your BigCommerce storefront" },
      { id: "magento", name: "Magento / Adobe Commerce", blurb: "Sync your Magento store catalogue and orders" },
      { id: "lazada", name: "Lazada", blurb: "Manage Lazada orders across Southeast Asia" },
      { id: "shopee", name: "Shopee", blurb: "Automate Shopee store management and chat" },
      { id: "tokopedia", name: "Tokopedia", blurb: "Connect your Tokopedia seller account" },
    ],
  },
  {
    slug: "crm-helpdesk",
    title: "CRM and helpdesk",
    intro: "Conversations, contacts and tickets flow into the system your team already lives in.",
    items: [
      { id: "hubspot", name: "HubSpot", blurb: "Sync contacts, deals and support tickets" },
      { id: "salesforce", name: "Salesforce CRM", blurb: "Connect your Salesforce org for full CRM sync" },
      { id: "zoho", name: "Zoho CRM", blurb: "Sync leads, contacts and deals from Zoho CRM" },
      { id: "zendesk", name: "Zendesk", blurb: "Create and update support tickets automatically" },
      { id: "freshdesk", name: "Freshdesk", blurb: "Manage support tickets through Freshdesk" },
      { id: "intercom", name: "Intercom", blurb: "Sync Intercom conversations and contacts" },
    ],
  },
  {
    slug: "payments",
    title: "Payments",
    intro: "The AI knows when a payment landed, was refunded or was disputed.",
    items: [
      { id: "stripe", name: "Stripe", blurb: "Track payments, refunds and subscription events" },
      { id: "paypal", name: "PayPal", blurb: "Receive PayPal payment and dispute notifications" },
      { id: "square", name: "Square", blurb: "Sync Square POS orders and payment events" },
    ],
  },
  {
    slug: "shipping",
    title: "Shipping and couriers",
    intro: "Book a pickup, print a label and answer 'where is my order' with a real tracking status, worldwide.",
    items: [
      { id: "easypost", name: "EasyPost", blurb: "100+ couriers worldwide via one API" },
      { id: "shippo", name: "Shippo", blurb: "US-focused shipping aggregator" },
      { id: "aftership", name: "AfterShip", blurb: "Universal tracker, 1000+ carriers" },
      { id: "shiprocket", name: "ShipRocket", blurb: "India aggregator, 17+ couriers" },
      { id: "pathao", name: "Pathao Courier", blurb: "Bangladesh's leading delivery network" },
      { id: "steadfast", name: "SteadFast Courier", blurb: "BD courier with COD support" },
      { id: "redx", name: "RedX", blurb: "Tech-driven BD logistics" },
      { id: "paperfly", name: "Paperfly", blurb: "Pan-Bangladesh distribution" },
      { id: "ecourier", name: "eCourier", blurb: "Bangladesh nationwide delivery" },
      { id: "sundarban", name: "Sundarban Courier", blurb: "Long-standing BD logistics provider" },
      { id: "delhivery", name: "Delhivery", blurb: "India's largest supply chain network" },
      { id: "bluedart", name: "Blue Dart", blurb: "Premium courier for India and SAARC" },
      { id: "dtdc", name: "DTDC", blurb: "Pan-India express services" },
      { id: "ekart", name: "Ekart Logistics", blurb: "Flipkart's logistics arm" },
      { id: "xpressbees", name: "Xpressbees", blurb: "Fast-growing Indian logistics" },
      { id: "tcs", name: "TCS Courier", blurb: "Pakistan's premier courier" },
      { id: "leopards", name: "Leopards Courier", blurb: "Pakistan nationwide delivery" },
      { id: "mnp", name: "M&P Express", blurb: "Pakistan logistics and cargo" },
      { id: "ninjavan", name: "Ninja Van", blurb: "Tech-enabled SEA logistics" },
      { id: "jtexpress", name: "J&T Express", blurb: "Asia-wide express delivery" },
      { id: "lalamove", name: "Lalamove", blurb: "On-demand same-day delivery" },
      { id: "lbc", name: "LBC Express", blurb: "Philippines #1 courier" },
      { id: "kerry", name: "Kerry Express", blurb: "Thailand and SEA delivery network" },
      { id: "poslaju", name: "Pos Laju", blurb: "Malaysia's national courier" },
      { id: "sfexpress", name: "SF Express", blurb: "China's premium express" },
      { id: "cainiao", name: "Cainiao", blurb: "Alibaba's logistics network" },
      { id: "zto", name: "ZTO Express", blurb: "Major Chinese courier" },
      { id: "yto", name: "YTO Express", blurb: "China nationwide delivery" },
      { id: "yamato", name: "Yamato Transport", blurb: "Japan's largest courier (Kuroneko)" },
      { id: "cjlogistics", name: "CJ Logistics", blurb: "South Korea's leading logistics" },
      { id: "dhl", name: "DHL Express", blurb: "Global express shipping" },
      { id: "fedex", name: "FedEx", blurb: "Worldwide overnight and express" },
      { id: "ups", name: "UPS", blurb: "Global package delivery" },
      { id: "usps", name: "USPS", blurb: "United States Postal Service" },
      { id: "tnt", name: "TNT (FedEx)", blurb: "European express network" },
      { id: "gls", name: "GLS", blurb: "European parcel logistics" },
      { id: "postnl", name: "PostNL", blurb: "Netherlands postal and parcels" },
      { id: "dpd", name: "DPD", blurb: "European road network parcels" },
      { id: "hermes", name: "Evri (Hermes)", blurb: "UK consumer parcels" },
      { id: "royalmail", name: "Royal Mail", blurb: "UK national postal service" },
      { id: "colissimo", name: "Colissimo", blurb: "La Poste France parcels" },
      { id: "bpost", name: "Bpost", blurb: "Belgium's national post" },
      { id: "deutschepost", name: "Deutsche Post / DHL Paket", blurb: "Germany's national post" },
      { id: "correos", name: "Correos", blurb: "Spain's postal service" },
      { id: "posteitaliane", name: "Poste Italiane", blurb: "Italy's national post" },
      { id: "canadapost", name: "Canada Post", blurb: "Canada's national postal service" },
      { id: "correios", name: "Correios", blurb: "Brazil's national postal service" },
      { id: "estafeta", name: "Estafeta", blurb: "Mexico's express courier" },
      { id: "ontrac", name: "OnTrac", blurb: "US West Coast express delivery" },
      { id: "dhlecommerce", name: "DHL eCommerce", blurb: "Global e-commerce logistics" },
      { id: "auspost", name: "Australia Post", blurb: "Australia's postal and parcels" },
      { id: "startrack", name: "StarTrack", blurb: "Australia premium express" },
      { id: "aramex_au", name: "Aramex Australia", blurb: "Australia road express" },
      { id: "nzpost", name: "NZ Post", blurb: "New Zealand postal service" },
      { id: "aramex", name: "Aramex", blurb: "Middle East and global logistics" },
      { id: "naqel", name: "Naqel Express", blurb: "Saudi Arabia and Gulf delivery" },
      { id: "smsa", name: "SMSA Express", blurb: "Saudi Arabia express courier" },
      { id: "dpd_africa", name: "DPD Africa", blurb: "African road network parcels" },
      { id: "postnet", name: "PostNet", blurb: "Africa and USA pack-and-ship" },
      { id: "cdek", name: "CDEK", blurb: "Russia and CIS express delivery" },
      { id: "russianpost", name: "Russian Post", blurb: "Russia's national postal service" },
    ],
  },
];


/** Everything, flattened. Used by the search box and the count in the heading. */
export const ALL_INTEGRATIONS = INTEGRATION_GROUPS.flatMap((g) =>
  g.items.map((i) => ({ ...i, group: g.title })),
);

export const INTEGRATION_COUNT = ALL_INTEGRATIONS.length;
