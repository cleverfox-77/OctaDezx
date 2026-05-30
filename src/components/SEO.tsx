import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title: string;
    description?: string;
    canonical?: string;
    image?: string;
    type?: string;
    keywords?: string;
    author?: string;
}

export const SEO = ({
    title,
    description = "OctaDezx is an AI customer care platform that answers customer questions, resolves support tickets, and captures orders 24/7 across WhatsApp, Instagram, Facebook and Shopify — the always-on AI customer service agent for modern businesses.",
    canonical = "https://octadezx.com/",
    image = "https://octadezx.com/logo.jpeg",
    type = "website",
    keywords = "customer care, customer care AI, AI customer service, AI customer support, customer support automation, AI support agent, 24/7 customer care, AI chatbot for customer service, order automation, ecommerce customer support",
    author = "OctaDezx"
}: SEOProps) => {
    const siteName = "OctaDezx";
    const fullTitle = title.includes("OctaDezx") ? title : `${title} | ${siteName}`;

    // Search-engine verification codes — paste yours here once you've added the
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
                "width": 512,
                "height": 512
            },
            "description": "AI customer care and customer service platform that answers customers, resolves support requests, and captures orders 24/7.",
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
            ]
        },
        // WebSite Schema with SearchAction for sitelinks search box
        {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "@id": "https://octadezx.com/#website",
            "url": "https://octadezx.com",
            "name": "OctaDezx",
            "description": "AI Customer Care & Customer Service Platform",
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
            "name": "OctaDezx",
            "applicationCategory": "BusinessApplication",
            "operatingSystem": "Web",
            "description": "AI customer care platform that answers customer questions, resolves support requests, and captures orders 24/7 across WhatsApp, Instagram, Facebook and Shopify.",
            "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD",
                "description": "24-hour free trial"
            },
            "featureList": [
                "24/7 AI Customer Service & Support",
                "Automated Order Processing",
                "One-Click Product Import",
                "50+ Platform Integrations",
                "Multilingual AI Support",
                "Real-Time Analytics Dashboard",
                "Enterprise Security"
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
                        "text": "OctaDezx is an AI customer care platform that gives businesses an always-on AI agent to answer customer questions, resolve support requests, and capture orders 24/7 across WhatsApp, Instagram, Facebook, Shopify and more."
                    }
                },
                {
                    "@type": "Question",
                    "name": "Can OctaDezx replace a customer care agent?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "It works as a 24/7 AI customer service agent that instantly answers FAQs, handles product and order questions and resolves common support requests — then escalates to your human team with full context when a conversation needs a person."
                    }
                },
                {
                    "@type": "Question",
                    "name": "Which channels does the AI customer service agent cover?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "WhatsApp, Instagram, Facebook, Shopify and your website widget out of the box, plus 50+ integrations — all answered from one place in your customers' own language."
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
                        "text": "Under 10 minutes — paste a storefront URL to import your catalogue, add your policies and FAQs, connect a channel, and your AI customer care agent is live."
                    }
                },
                {
                    "@type": "Question",
                    "name": "Is there a free trial?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Yes — a 24-hour free trial with full access to every feature. No credit card required."
                    }
                }
            ]
        },
        // SiteNavigationElement for sitelinks
        {
            "@context": "https://schema.org",
            "@type": "SiteNavigationElement",
            "name": "Main Navigation",
            "hasPart": [
                {
                    "@type": "WebPage",
                    "name": "Features",
                    "description": "Explore OctaDezx features including AI order processing, product import, and integrations",
                    "url": "https://octadezx.com/#features"
                },
                {
                    "@type": "WebPage",
                    "name": "Login",
                    "description": "Sign in to your OctaDezx dashboard",
                    "url": "https://octadezx.com/auth"
                },
                {
                    "@type": "WebPage",
                    "name": "Sign Up",
                    "description": "Create a free OctaDezx account and start your 24-hour trial",
                    "url": "https://octadezx.com/auth"
                },
                {
                    "@type": "WebPage",
                    "name": "Integrations",
                    "description": "Connect OctaDezx with 50+ platforms",
                    "url": "https://octadezx.com/#connectors"
                },
                {
                    "@type": "WebPage",
                    "name": "Contact",
                    "description": "Get in touch with OctaDezx support",
                    "url": "https://octadezx.com/#contact"
                }
            ]
        }
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
            <meta name="theme-color" content="#1e3a5f" />
            <meta name="msapplication-TileColor" content="#1e3a5f" />

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
