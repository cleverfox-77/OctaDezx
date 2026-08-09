import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title: string;
    description?: string;
    canonical?: string;
    image?: string;
    type?: string;
    keywords?: string;
    author?: string;
    /** Page-specific structured data appended to the site-wide graph
     *  (e.g. JobPosting on /careers, Article on a blog post). */
    jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export const SEO = ({
    title,
    description = "OctaDezx is an agentic AI platform for every kind of business. Its AI agent answers customers, takes orders and bookings, handles phone calls and reads photos customers send, 24/7 across WhatsApp, Instagram, Facebook, Telegram and Shopify.",
    canonical = "https://octadezx.com/",
    image = "https://octadezx.com/og-image.png",
    type = "website",
    // "for every business" and "agentic" are load-bearing here, not filler: the
    // site was being read as an e-commerce-only chatbot, which is wrong on both
    // counts and is what people saw when they searched the brand.
    keywords = "agentic AI, AI agent for business, AI customer service, AI customer support, customer support automation, AI support agent, AI phone agent, AI image recognition for customer service, 24/7 customer care, AI for restaurants, AI for clinics, AI for real estate, AI for service businesses, order automation",
    author = "OctaDezx",
    jsonLd
}: SEOProps) => {
    const siteName = "OctaDezx";
    const fullTitle = title.includes("OctaDezx") ? title : `${title} | ${siteName}`;

    // Search-engine verification codes, paste yours here once you've added the
    // property in Google Search Console / Bing Webmaster Tools, then redeploy.
    const GOOGLE_SITE_VERIFICATION = "";
    const BING_SITE_VERIFICATION = "";

    // Comprehensive Schema.org structured data
    const schemaOrgJSONLD = [
        // Organization Schema
        {
            "@context": "https://schema.org",
            "@type": "Organization",
            "@id": "https://octadezx.com/#organization",
            "name": "OctaDezx",
            "url": "https://octadezx.com",
            "logo": {
                "@type": "ImageObject",
                "url": "https://octadezx.com/logo.jpeg",
                "width": 2048,
                "height": 2048
            },
            "description": "Agentic AI company. Its platform gives any business an AI agent that answers customers, takes orders and bookings, handles phone calls and reads photos customers send, 24/7.",
            "foundingDate": "2024",
            "contactPoint": {
                "@type": "ContactPoint",
                "contactType": "customer service",
                "email": "kevin@octadezx.com",
                "availableLanguage": ["English"]
            },
            "sameAs": [
                "https://www.facebook.com/profile.php?id=61586165043647",
                "https://www.instagram.com/octadezx_"
            ],
            // OctaDezx is built and backed by Zeriotic, a web development
            // studio. Both are owned by DezxCorp, the holding company.
            "parentOrganization": {
                "@type": "Organization",
                "name": "DezxCorp",
                "description": "Holding company that owns OctaDezx and Zeriotic.",
                "subOrganization": [
                    {
                        "@type": "Organization",
                        "name": "Zeriotic",
                        "url": "https://zeriotic.com",
                        "sameAs": "https://zeriotic.com",
                        "description": "Web development studio that designs and builds storefronts, web apps and product experiences, and builds OctaDezx."
                    },
                    {
                        "@id": "https://octadezx.com/#organization"
                    }
                ]
            }
        },
        // WebSite Schema with SearchAction for sitelinks search box
        {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "@id": "https://octadezx.com/#website",
            "url": "https://octadezx.com",
            "name": "OctaDezx",
            "description": "Agentic AI for customer operations, for every kind of business",
            "publisher": {
                "@id": "https://octadezx.com/#organization"
            },
            "potentialAction": {
                "@type": "SearchAction",
                "target": {
                    "@type": "EntryPoint",
                    "urlTemplate": "https://octadezx.com/search?q={search_term_string}"
                },
                "query-input": "required name=search_term_string"
            }
        },
        // SoftwareApplication Schema
        {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            // Stable @id so other nodes (notably BlogPosting.about on every blog
            // post) can point at this exact entity instead of describing a
            // separate, unconnected copy of the product.
            "@id": "https://octadezx.com/#software",
            "name": "OctaDezx",
            "applicationCategory": "BusinessApplication",
            "operatingSystem": "Web",
            "description": "Agentic AI platform for every kind of business. Its AI agent answers customers, takes orders and bookings, handles phone calls and reads photos customers send, 24/7 across WhatsApp, Instagram, Facebook, Telegram and Shopify.",
            "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD",
                "description": "24-hour free trial"
            },
            // Keep in step with the static copy of this node in index.html. The
            // list is the answer to "what can it actually do", which is what
            // answer engines quote, so it leads with actions rather than nouns.
            "featureList": [
                "24/7 AI customer service and support for any business type",
                "Image recognition: customers send a photo and the AI identifies it against the catalogue",
                "Automated order processing with server-verified pricing",
                "Appointment booking in chat and on the phone, filed into the dashboard for the owner",
                "Real-time AI phone calls with interruptible speech, voicemail and transcripts",
                "Voice notes on WhatsApp, Messenger, Instagram and Telegram transcribed and answered",
                "Automatic lead capture with owner-defined follow-up playbooks",
                "Facebook and Instagram comment auto-replies",
                "Native Model Context Protocol (MCP) server for Claude",
                "One-click catalogue import from any storefront URL",
                "90+ platform integrations",
                "Multilingual support in 50+ languages",
                "Type-adaptive dashboards for retail, restaurants, clinics, agencies, real estate, trades and more",
                "Real-time analytics dashboard",
                "Human escalation with full conversation context",
                "Enterprise security, GDPR-ready"
            ]
        },
        // WebPage Schema with breadcrumbs
        {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "@id": canonical,
            "url": canonical,
            "name": fullTitle,
            "description": description,
            "primaryImageOfPage": {
                "@type": "ImageObject",
                "url": image,
                "caption": `${siteName}, 24/7 AI customer care agent`
            },
            "image": image,
            "isPartOf": {
                "@id": "https://octadezx.com/#website"
            },
            "about": {
                "@id": "https://octadezx.com/#organization"
            },
            "breadcrumb": {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://octadezx.com"
                    }
                ]
            }
        },
        // FAQ Schema for rich results
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": "What is OctaDezx?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "OctaDezx is an agentic AI platform that gives any business an always-on AI agent. It answers customer questions, places orders with server-verified pricing, books appointments, answers and makes phone calls, reads photos customers send and follows up on leads, 24/7 across WhatsApp, Instagram, Facebook, Telegram, Shopify and the web."
                    }
                },
                {
                    "@type": "Question",
                    "name": "Is OctaDezx only for e-commerce businesses?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "No. OctaDezx is built for every kind of business. Restaurants, clinics, salons, law and accountancy practices, real estate agencies, schools, repair and trade services, automotive, hotels, logistics companies, SaaS products and agencies all use it, alongside retailers and online stores. A product catalogue is optional, and the dashboard adapts to the business type: a restaurant gets menus and reservations, a clinic gets appointments, a workshop gets jobs and quotes."
                    }
                },
                {
                    "@type": "Question",
                    "name": "Can OctaDezx understand images that customers send?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Yes. A customer can photograph an item instead of describing it. The AI looks at the image, describes what it sees, matches it against the business's own catalogue and replies with the matching product, its price and its details. If the business does not sell what is in the photo, it says so honestly and suggests the closest thing it does have."
                    }
                },
                {
                    "@type": "Question",
                    "name": "Can OctaDezx answer phone calls?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Yes, on every paid plan. The business gets its own real phone number and the AI agent answers it in real time, holding an ordinary spoken conversation rather than a phone menu. A caller can interrupt it mid-sentence and it stops and listens. It answers from the same catalogue, prices and opening hours the chat uses, takes orders and appointment requests on the call, hands over to a person or takes a transcribed voicemail when it cannot help, and writes every call into the conversation history as plain text."
                    }
                },
                {
                    "@type": "Question",
                    "name": "Does the AI phone agent sound like a robot or a menu?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Neither. There is nothing to press and no decision tree. Audio streams in both directions and is paced out at the rate the phone network plays it, which is what makes interrupting work: the assistant always knows exactly how much of its answer the caller actually heard, so cutting in stops it mid-sentence the way it would stop a person. The business sets its name and its tone, but it will never claim to be a human being."
                    }
                },
                {
                    "@type": "Question",
                    "name": "How many phone minutes are included?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Starter includes 100 minutes a month, Pro 400 and Advanced 900. Enterprise is metered at $0.12 a minute with no cap. Inbound and outbound calls draw on the same pool. When minutes run out the assistant winds the call down politely and takes a message rather than cutting anyone off."
                    }
                },
                {
                    "@type": "Question",
                    "name": "What makes OctaDezx agentic rather than a chatbot?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "A chatbot produces text and leaves the work to a person. An OctaDezx agent completes the task: it files the order with every price recomputed on the server, takes the appointment, reads the details back to confirm, and files the booking request into the dashboard with the owner notified, answers or places the phone call, transcribes the voicemail, reads the photo, replies to the Facebook or Instagram comment, creates the lead and escalates to a person with the full conversation attached."
                    }
                },
                {
                    "@type": "Question",
                    "name": "Can OctaDezx replace a customer care agent?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "It works as a 24/7 AI customer service agent that instantly answers FAQs, handles product and order questions and resolves common support requests, then escalates to your human team with full context when a conversation needs a person."
                    }
                },
                {
                    "@type": "Question",
                    "name": "Which channels does the AI customer service agent cover?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "WhatsApp, Instagram, Facebook, Telegram, Shopify and your website widget out of the box, plus inbound and outbound phone calls and 90+ integrations covering stores, CRMs, payments and couriers, all answered from one place in your customers' own language."
                    }
                },
                {
                    "@type": "Question",
                    "name": "Does OctaDezx take orders, not just answer questions?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Yes. Beyond support, OctaDezx confirms and places orders for you. Every price and total is verified on our servers against your catalogue, so customers are always charged the correct amount."
                    }
                },
                {
                    "@type": "Question",
                    "name": "How fast can I go live?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Under 10 minutes, paste a storefront URL to import your catalogue, add your policies and FAQs, connect a channel, and your AI customer care agent is live."
                    }
                },
                {
                    "@type": "Question",
                    "name": "Is there a free trial?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Yes, a 24-hour free trial with full access to every feature. No credit card required."
                    }
                }
            ]
        },
        // SiteNavigationElement: the real top-level pages, as candidates for
        // Google sitelinks under the brand result. Sitelinks are algorithmic and
        // cannot be forced, but a clear, crawlable navigation of distinct pages is
        // the strongest signal. Keep these in sync with the header nav, the footer
        // and sitemap.xml. (/auth is intentionally omitted: robots.txt disallows it.)
        {
            "@context": "https://schema.org",
            "@type": "SiteNavigationElement",
            "name": "Main Navigation",
            "hasPart": [
                {
                    "@type": "WebPage",
                    "name": "Platform",
                    "description": "How the OctaDezx AI customer care agent works: grounded answers, order taking, escalation and integrations",
                    "url": "https://octadezx.com/platform"
                },
                {
                    "@type": "WebPage",
                    "name": "Solutions",
                    "description": "OctaDezx for restaurants, clinics, salons, trades, real estate, agencies, SaaS, retail and every other kind of business",
                    "url": "https://octadezx.com/solutions"
                },
                {
                    "@type": "WebPage",
                    "name": "Pricing",
                    "description": "OctaDezx pricing: a 24-hour free trial, then Starter at $29, Pro at $99, Advanced at $199 a month, or Enterprise pay as you go. Every plan includes every feature",
                    "url": "https://octadezx.com/pricing"
                },
                {
                    "@type": "WebPage",
                    "name": "Resources",
                    "description": "Guides, the live demo and the developer and MCP documentation for OctaDezx",
                    "url": "https://octadezx.com/resources"
                },
                {
                    "@type": "WebPage",
                    "name": "Blog",
                    "description": "Practical writing on AI customer care and omnichannel support",
                    "url": "https://octadezx.com/blog"
                },
                {
                    "@type": "WebPage",
                    "name": "About",
                    "description": "About OctaDezx, built by Zeriotic and owned by the DezxCorp holding company",
                    "url": "https://octadezx.com/about"
                },
                {
                    "@type": "WebPage",
                    "name": "Careers",
                    "description": "Open remote roles at OctaDezx and how to apply",
                    "url": "https://octadezx.com/careers"
                }
            ]
        },
        // Page-specific schema (JobPosting, Article, AboutPage, ...)
        ...(jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [])
    ];

    return (
        <Helmet>
            {/* Primary Meta Tags */}
            <title>{fullTitle}</title>
            <meta name="title" content={fullTitle} />
            <meta name="description" content={description} />
            <meta name="keywords" content={keywords} />
            <meta name="author" content={author} />
            <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
            <meta name="googlebot" content="index, follow" />
            <link rel="canonical" href={canonical} />

            {/* Language and Locale */}
            <meta httpEquiv="content-language" content="en" />
            <meta name="language" content="English" />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content={type} />
            <meta property="og:url" content={canonical} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={image} />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:image:alt" content={`${siteName}, 24/7 AI customer care agent`} />
            <meta property="og:site_name" content={siteName} />
            <meta property="og:locale" content="en_US" />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:url" content={canonical} />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={image} />
            <meta name="twitter:creator" content="@octadezx" />
            <meta name="twitter:site" content="@octadezx" />

            {/* Additional SEO */}
            <meta name="application-name" content="OctaDezx" />
            <meta name="apple-mobile-web-app-title" content="OctaDezx" />
            <meta name="theme-color" content="#000047" />
            <meta name="msapplication-TileColor" content="#000047" />

            {/* Search-engine verification (codes set at the top of this component) */}
            {GOOGLE_SITE_VERIFICATION && <meta name="google-site-verification" content={GOOGLE_SITE_VERIFICATION} />}
            {BING_SITE_VERIFICATION && <meta name="msvalidate.01" content={BING_SITE_VERIFICATION} />}

            {/* Schema.org JSON-LD */}
            <script type="application/ld+json">
                {JSON.stringify(schemaOrgJSONLD)}
            </script>
        </Helmet>
    );
};
