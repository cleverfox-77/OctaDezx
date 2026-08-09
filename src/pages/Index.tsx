import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { VideoPlayer } from "@/components/VideoPlayer";
import { SEO } from "@/components/SEO";
import { LogoIcon } from "@/components/ui/Logo";
import Preloader from "@/components/landing/Preloader";
import ParticleField from "@/components/landing/ParticleField";
import Magnetic from "@/components/landing/Magnetic";
import ProductTour from "@/components/landing/ProductTour";
import AmbientVideo from "@/components/landing/AmbientVideo";
import AgenticActions from "@/components/landing/AgenticActions";
import ImageRecognition from "@/components/landing/ImageRecognition";
import VoiceSection from "@/components/landing/VoiceSection";
import BusinessBreakdown from "@/components/landing/BusinessBreakdown";
import { useCountUp } from "@/hooks/useCountUp";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PricingSection from "@/components/site/PricingSection";
import { INTEGRATION_COUNT } from "@/components/site/integrationsData";
import CtaSection from "@/components/site/CtaSection";
import LaunchListWidget from "@/components/site/LaunchListWidget";
import "../styles/landing.css";

/* ── Material Symbol ── */
const MI = ({ name, className = "", style }: { name: string; className?: string; style?: React.CSSProperties }) => (
  <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>
);


/* ── Social icons ── */
const FacebookSVG = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);
const InstagramSVG = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);
const MailSVG = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
  </svg>
);

/* ── Data ── */
type ChatStep = { sender: "ai" | "customer"; text: string; action?: "processing" | "confirmed" };

const CHAT_STEPS: ChatStep[] = [
  { sender: "customer", text: "Hey, is this still available?" },
  { sender: "ai",       text: "Yes! Available in sizes S, M, L and XL. Which would you like? 👟" },
  { sender: "customer", text: "What's the price?" },
  { sender: "ai",       text: "$49 with free delivery on orders above $30. Want to order? 🛍️" },
  { sender: "customer", text: "Yes please, Size M.", action: "processing" },
  { sender: "ai",       text: "Perfect! Share your name, delivery address and phone to confirm. 📦" },
  { sender: "customer", text: "John Doe, 42 Maple Street, NYC. 646XXXXXXXX" },
  { sender: "ai",       text: "✅ Confirmed! Size M ships in 3 to 5 days. Order #OD-20482. Thanks, John! 🎉", action: "confirmed" },
];

const INTEGRATIONS = [
  { name: "WhatsApp",  icon: "chat",         color: "#22c55e", rot: 0   },
  { name: "Facebook",  icon: "thumb_up",     color: "#3b82f6", rot: 60  },
  { name: "Instagram", icon: "photo_camera", color: "#ec4899", rot: 120 },
  { name: "Shopify",   icon: "shopping_bag", color: "#10b981", rot: 180 },
  { name: "Slack",     icon: "tag",          color: "#a855f7", rot: 240 },
  { name: "Gmail",     icon: "mail",         color: "#f87171", rot: 300 },
];

const NAV_LINKS = [
  { label: "Features",     href: "#features" },
  { label: "How it Works", href: "#how"       },
  { label: "Claude MCP",   href: "#claude"    },
  { label: "Pricing",      href: "#pricing"   },
  { label: "Live Demo",    href: "#demo"      },
  { label: "Support",      href: "#contact"   },
];

// Mega-menu structure for the header (desktop dropdowns + mobile grouped menu).
// Every item points at a real section on the page.
type MegaItem = { label: string; desc: string; href: string; icon: string };
type MegaEntry = { label: string; href?: string; groups?: { heading: string; items: MegaItem[] }[] };
const MEGA_MENU: MegaEntry[] = [
  {
    label: "Product",
    groups: [
      { heading: "Platform", items: [
        { label: "Capabilities",       desc: "Support and sales, automated",   href: "#features",     icon: "bolt" },
        { label: "How it works",       desc: "Live in under 10 minutes",       href: "#how",          icon: "route" },
        { label: "Inside the product", desc: "A tour of the workspace",        href: "#tour",         icon: "dashboard" },
      ] },
      { heading: "Built in", items: [
        { label: "Claude MCP",         desc: "Run your business from Claude",  href: "#claude",       icon: "smart_toy" },
        { label: "Integrations",       desc: "WhatsApp, Instagram, Shopify",   href: "#integrations", icon: "hub" },
        { label: "Follow-ups & leads", desc: "Re-engage every lead",           href: "#followups",    icon: "person_add" },
      ] },
    ],
  },
  {
    label: "Solutions",
    groups: [
      { heading: "By need", items: [
        { label: "Customer support",   desc: "Answer every customer 24/7",     href: "#features",     icon: "support_agent" },
        { label: "Appointments",       desc: "Book slots right in chat",       href: "#capabilities", icon: "event_available" },
        { label: "Comment replies",    desc: "Reply on Facebook & Instagram",  href: "#capabilities", icon: "reviews" },
      ] },
      { heading: "By business", items: [
        { label: "Every industry",     desc: "Retail, restaurants, agencies",  href: "#solutions",    icon: "storefront" },
        { label: "File training",      desc: "Teach the AI from your files",   href: "#capabilities", icon: "upload_file" },
        { label: "Growth via Claude",  desc: "Analyse ads, publish posts",     href: "#claude",       icon: "rocket_launch" },
      ] },
    ],
  },
  {
    label: "Resources",
    groups: [
      { heading: "Explore", items: [
        { label: "Live demo",          desc: "Try it yourself, no signup",     href: "#demo",         icon: "chat" },
        { label: "Customer stories",   desc: "Leaders who grew with us",       href: "#stories",      icon: "format_quote" },
        { label: "FAQ",                desc: "Everything you need to know",     href: "#faq",          icon: "help" },
      ] },
    ],
  },
  { label: "Pricing", href: "#pricing" },
];

/* Footer link columns, every entry resolves to a real section anchor or route */
type FooterLink = { label: string; href?: string; to?: string };
const FOOTER_COLS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features",     href: "#features" },
      { label: "How it works", href: "#how" },
      { label: "Integrations", href: "#integrations" },
      { label: "Claude MCP",   href: "#claude" },
      { label: "Live demo",    href: "#demo" },
      { label: "Pricing",      href: "#pricing" },
    ],
  },
  {
    title: "Use cases",
    links: [
      { label: "Customer support", href: "#features" },
      { label: "Sales & orders",   href: "#features" },
      { label: "Lead follow-ups",  href: "#followups" },
      { label: "Appointments",     href: "#capabilities" },
      { label: "Comment replies",  href: "#capabilities" },
      { label: "File training",    href: "#capabilities" },
    ],
  },
  {
    title: "Industries",
    links: [
      { label: "E-commerce",     href: "#solutions" },
      { label: "Retail & stores", href: "#solutions" },
      { label: "Restaurants",    href: "#solutions" },
      { label: "Agencies",       href: "#solutions" },
      { label: "Real estate",    href: "#solutions" },
      { label: "All industries", href: "#solutions" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Customer stories", href: "#stories" },
      { label: "FAQ",              href: "#faq" },
      { label: "Contact us",       href: "mailto:kevin@octadezx.com" },
      { label: "Start free trial", to: "/auth" },
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

const clientLogos = [
  { name: "alo",         src: "/clients/alo.png"        },
  { name: "Clarks",      src: "/clients/clarks.png"     },
  { name: "Dr. Martens", src: "/clients/dr-martens.png" },
  { name: "Cole Haan",   src: "/clients/cole-haan.png"  },
  { name: "Gymshark",    src: "/clients/gymshark.png"   },
  { name: "Nothing",     src: "/clients/nothing.png"    },
  { name: "Anker",       src: "/clients/anker.webp"     },
  { name: "Timberland",  src: "/clients/timberland.jpg" },
  { name: "Logitech",    src: "/clients/logitech.png"   },
  { name: "Pini Parma",  src: "/clients/pini-parma.jpg" },
  { name: "Price & Pierce", src: "/clients/price-pierce.png" },
];

const testimonials = [
  {
    quote:
      "Before OctaDezx, our team was drowning in repetitive questions about sizing, fabrics and shipping. Now the AI handles every customer conversation in their own language, around the clock. Our response time went from hours to seconds and our online sales have grown without us adding a single new hire.",
    name: "Thomas Pini",
    role: "CEO, Pini Parma",
    photo: "/clients/thomas-pini.jpg",
    logo: "/clients/pini-parma.jpg",
  },
  {
    quote:
      "We deal with complex client enquiries across multiple markets, and OctaDezx understood our catalogue almost instantly. It resolves the routine questions on its own and escalates only what truly needs a human. Our customers feel looked after 24/7, and that reliability has directly helped us grow our accounts.",
    name: "Tim Shave",
    role: "CEO, Price & Pierce",
    photo: "/clients/tim-shave.jpg",
    logo: "/clients/price-pierce.png",
  },
];

const DEMO_BUSINESS_ID = "a9a0d41a-6651-4d59-9e66-a8b15ba068f1";
const DEMO_CHAT_URL    = `/chat/${DEMO_BUSINESS_ID}`;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* CSS vignettes for feature cards without renders, keeps every card in the
   grid on the same icon → visual → text rhythm, no extra image bytes */
const LanguageViz = () => (
  <div className="h-full w-full flex flex-col justify-center gap-2 px-4"
    style={{ background: "#f7f8fa", border: "1px solid #eef0f3", borderRadius: "0.75rem" }}>
    {[
      ["¡Hola! ¿En qué puedo ayudarte?", "ES", "self-start"],
      ["Bonjour ! Comment puis-je aider ?", "FR", "self-end"],
      ["こんにちは！ご用件をどうぞ", "JA", "self-start"],
    ].map(([txt, lang, align]) => (
      <div key={lang} className={`flex items-center gap-2 ${align}`}>
        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium text-slate-700 bg-white whitespace-nowrap"
          style={{ border: "1px solid #e8eaee", boxShadow: "0 1px 2px rgba(16,24,40,0.05)" }}>{txt}</span>
        <span className="label text-[8px] text-slate-400">{lang}</span>
      </div>
    ))}
  </div>
);

const LeadScoreViz = () => (
  <div className="h-full w-full flex flex-col justify-center gap-3 px-4"
    style={{ background: "#f7f8fa", border: "1px solid #eef0f3", borderRadius: "0.75rem" }}>
    {[
      { name: "Sofia: asking for bulk pricing", score: 92, tone: "#16a34a", tag: "Hot lead" },
      { name: "James: comparing two models", score: 74, tone: "#d97706", tag: "Warm" },
    ].map((l) => (
      <div key={l.name}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-slate-700 truncate pr-2">{l.name}</span>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ color: l.tone, background: `${l.tone}14` }}>{l.tag} · {l.score}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#e8eaee" }}>
          <div className="h-full rounded-full" style={{ width: `${l.score}%`, background: `linear-gradient(90deg, #000047, ${l.tone})` }} />
        </div>
      </div>
    ))}
  </div>
);

/* On-brand replies: sources feeding one polished answer */
const TrainingViz = () => (
  <div className="h-full w-full flex flex-col justify-center gap-2 px-4"
    style={{ background: "#f7f8fa", border: "1px solid #eef0f3", borderRadius: "0.75rem" }}>
    <div className="flex flex-wrap gap-1.5">
      {["Catalogue", "Policies", "Brand voice"].map((s) => (
        <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold text-slate-600 bg-white"
          style={{ border: "1px solid #e8eaee" }}>
          <span className="w-1 h-1 rounded-full" style={{ background: "#000047" }} />{s}
        </span>
      ))}
    </div>
    <div className="self-center text-slate-300 text-xs leading-none">↓</div>
    <div className="self-start max-w-[94%] px-2.5 py-1.5 rounded-xl rounded-bl-sm text-[10px] font-medium text-white leading-snug"
      style={{ background: "#000047" }}>
      Hi! The Oxford runs true to size, and yes, we ship to Dhaka in 2 days.
    </div>
  </div>
);

/* Analytics: crafted bar chart with a live resolution badge */
const AnalyticsViz = () => (
  <div className="h-full w-full flex items-end gap-1.5 px-4 pb-4 pt-3 relative"
    style={{ background: "#f7f8fa", border: "1px solid #eef0f3", borderRadius: "0.75rem" }}>
    <span className="absolute top-2.5 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full z-10"
      style={{ color: "#16a34a", background: "rgba(22,163,74,0.1)" }}>94% resolved</span>
    {[38, 52, 44, 63, 71, 85, 100].map((h, i) => (
      <div key={i} className="flex-1 rounded-t-[3px]" style={{ height: `${h}%`, background: "linear-gradient(180deg,#4f46e5,#000047)", opacity: 0.42 + i * 0.083 }} />
    ))}
  </div>
);

/* Security: crafted shield with plain-language guarantees */
const SecurityViz = () => (
  <div className="h-full w-full flex items-center gap-3 px-4"
    style={{ background: "#f7f8fa", border: "1px solid #eef0f3", borderRadius: "0.75rem" }}>
    <svg width="44" height="50" viewBox="0 0 44 50" className="flex-shrink-0">
      <defs>
        <linearGradient id="shieldg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4f46e5" /><stop offset="1" stopColor="#000047" />
        </linearGradient>
      </defs>
      <path d="M22 2 40 9V25C40 37 32 45 22 48 12 45 4 37 4 25V9Z" fill="url(#shieldg)" />
      <circle cx="22" cy="21" r="4.5" fill="none" stroke="#fff" strokeWidth="2" />
      <rect x="20.4" y="23" width="3.2" height="8" rx="1.6" fill="#fff" />
    </svg>
    <div className="flex flex-col gap-1.5">
      {["End to end encrypted", "Role based access", "GDPR ready"].map((t) => (
        <span key={t} className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600">
          <MI name="check_circle" className="text-[13px]" style={{ color: "#16a34a" }} />{t}
        </span>
      ))}
    </div>
  </div>
);

/* ── How-it-works step mockups (brand-styled to match the real product UI) ── */
const mockCard = "w-full rounded-2xl p-5 sm:p-6";
const mockShadow = { background: "#ffffff", border: "1px solid #e8eaee", boxShadow: "0 2px 6px rgba(16,24,40,0.05), 0 24px 50px rgba(16,24,40,0.10)" };
const mockPill = (label: string, tone = "#16a34a", pulse = false) => (
  <span className="label text-[8px] px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ color: tone, background: `${tone}1a` }}>
    <span className={`w-1 h-1 rounded-full ${pulse ? "status-pulse" : ""}`} style={{ background: tone }} />{label}
  </span>
);

/* Step 01, import a catalogue from a URL or CSV */
const HowImportMock = () => (
  <div className={mockCard} style={mockShadow}>
    <div className="flex items-center justify-between mb-4">
      <span className="text-sm font-bold text-slate-900">Import catalogue</span>
      {mockPill("Done")}
    </div>
    <div className="label text-[8px] text-slate-400 mb-1.5">Storefront URL</div>
    <div className="flex items-center gap-2 rounded-xl pl-3 pr-1.5 py-1.5 mb-4" style={{ background: "#f7f8fa", border: "1px solid #e8eaee" }}>
      <MI name="link" className="text-sm flex-shrink-0" style={{ color: "#98a2b3" }} />
      <span className="text-[11px] text-slate-500 font-medium truncate">yourstore.com/collections/all</span>
      <span className="ml-auto flex-shrink-0 text-[10px] font-bold text-white px-3 py-1.5 rounded-lg" style={{ background: "#000047" }}>Import</span>
    </div>
    <div className="space-y-1.5">
      {[["Oxford Boot", "3 variants"], ["Chelsea Boot", "5 variants"], ["Suede Loafer", "4 variants"]].map(([n, v]) => (
        <div key={n} className="flex items-center gap-2.5 rounded-lg px-3 py-2" style={{ background: "#f7f8fa" }}>
          <MI name="check_circle" className="text-sm flex-shrink-0" style={{ color: "#16a34a" }} />
          <span className="text-[11px] font-semibold text-slate-700">{n}</span>
          <span className="text-[10px] text-slate-400 ml-auto">{v}</span>
        </div>
      ))}
    </div>
    <div className="text-[11px] font-semibold text-slate-500 mt-3 text-center">142 products structured automatically</div>
  </div>
);

/* Step 02, set the agent's personality in plain language */
const HowTrainMock = () => (
  <div className={mockCard} style={mockShadow}>
    <div className="flex items-center justify-between mb-4">
      <span className="text-sm font-bold text-slate-900">Agent personality</span>
      {mockPill("Saved")}
    </div>
    <div className="label text-[8px] text-slate-400 mb-1.5">AI employee name</div>
    <div className="flex items-center rounded-xl px-3 py-2 mb-4" style={{ background: "#f7f8fa", border: "1px solid #e8eaee" }}>
      <span className="text-sm font-semibold text-slate-800">Ava</span>
      <MI name="auto_awesome" className="text-sm ml-auto" style={{ color: "#7c3aed" }} />
    </div>
    <div className="label text-[8px] text-slate-400 mb-1.5">Tone</div>
    <div className="flex flex-wrap gap-1.5 mb-4">
      {([["Friendly & warm", true], ["Concise", true], ["Formal", false]] as [string, boolean][]).map(([t, on]) => (
        <span key={t} className="px-2.5 py-1 rounded-full text-[10px] font-semibold"
          style={on ? { color: "#000047", background: "rgba(0,0,71,0.08)", border: "1px solid rgba(0,0,71,0.2)" } : { color: "#98a2b3", background: "#f7f8fa", border: "1px solid #e8eaee" }}>{t}</span>
      ))}
    </div>
    <div className="label text-[8px] text-slate-400 mb-1.5">Behaviour</div>
    <div className="rounded-xl px-3 py-2.5 space-y-1" style={{ background: "#f7f8fa", border: "1px solid #e8eaee" }}>
      <div className="text-[10px] mono text-slate-600"><span className="font-bold text-slate-800">Role</span> · qualify leads, one question at a time</div>
      <div className="text-[10px] mono text-slate-500">1. Greet and identify the intent</div>
      <div className="text-[10px] mono text-slate-500">2. If in stock, offer to place the order</div>
      <div className="text-[10px] mono text-slate-500">3. Escalate refunds to a human</div>
    </div>
  </div>
);

/* Step 03, flip on the channels and go live */
const HowLaunchMock = () => (
  <div className={mockCard} style={mockShadow}>
    <div className="flex items-center justify-between mb-4">
      <span className="text-sm font-bold text-slate-900">Channels &amp; tools</span>
      {mockPill("Live", "#16a34a", true)}
    </div>
    <div className="space-y-2">
      {([["WhatsApp", "chat", "#22c55e"], ["Instagram", "photo_camera", "#ec4899"], ["Facebook", "thumb_up", "#3b82f6"], ["Web widget", "language", "#4f46e5"]] as [string, string, string][]).map(([n, ic, col]) => (
        <div key={n} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "#f7f8fa", border: "1px solid #e8eaee" }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${col}1a` }}>
            <MI name={ic} className="text-sm" style={{ color: col }} />
          </div>
          <span className="text-xs font-semibold text-slate-700">{n}</span>
          <span className="ml-auto w-9 h-5 rounded-full relative flex-shrink-0" style={{ background: "#000047" }}>
            <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-white" />
          </span>
        </div>
      ))}
    </div>
    <div className="flex items-center gap-2 mt-3">
      <span className="w-1.5 h-1.5 rounded-full status-pulse" style={{ background: "#16a34a" }} />
      <span className="text-[11px] font-semibold text-slate-500">Live across every channel in seconds</span>
    </div>
  </div>
);

const HOW_STEPS = [
  {
    n: "01",
    eyebrow: "Step one · Import",
    title: "Bring in your catalogue.",
    desc: "Paste any storefront URL or drop a CSV. Titles, variants, pricing and images are structured for you automatically. No manual data entry, no spreadsheets.",
    checks: ["Works with any storefront URL or CSV", "Variants & pricing verified server-side", "Ready in seconds, not days"],
    mock: <HowImportMock />,
  },
  {
    n: "02",
    eyebrow: "Step two · Train",
    title: "Tell it how to behave.",
    desc: "Set tone, goals and escalation rules in plain language, then drop in your policies, FAQs and brand voice. No decision trees, no scripts, no engineers.",
    checks: ["Learns policies, FAQs & tone instantly", "Set escalation rules in plain English", "Sounds like you, not a generic bot"],
    mock: <HowTrainMock />,
  },
  {
    n: "03",
    eyebrow: "Step three · Launch",
    title: "Plug it in. Go live.",
    desc: "Connect WhatsApp, Instagram, Facebook, your web widget and more. One agent answers on every channel the same minute you switch it on.",
    checks: ["One agent on every channel", "Connects to your existing tools", "Live in minutes, no migration required"],
    mock: <HowLaunchMock />,
  },
];

/* Stat cell with count-up on first scroll into view */
const StatCell = ({ value, label, sub }: { value: string; label: string; sub: string }) => {
  const { ref, text } = useCountUp(value);
  return (
    <div className="flex flex-col items-center justify-center py-10 px-5 text-center" style={{ background: "#ffffff" }}>
      <div ref={ref as React.RefObject<HTMLDivElement>} className="stat-num mb-1.5 cursor-default">{text}</div>
      <div className="text-sm font-semibold text-slate-900 mb-1">{label}</div>
      <div className="label text-[9px] text-slate-400">{sub}</div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   Index
════════════════════════════════════════════════════════════════ */
const Index = () => {
  const navigate = useNavigate();

  /* CTA email capture, the input used to be ignored; now we persist it and
     carry it into the signup flow so warm leads aren't lost. */
  const [ctaEmail, setCtaEmail] = useState("");
  const handleCtaStart = () => {
    const email = ctaEmail.trim();
    if (email) localStorage.setItem("octadezx_signup_email", email);
    navigate(email ? `/auth?email=${encodeURIComponent(email)}` : "/auth");
  };

  /* Referral */
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) localStorage.setItem("octadezx_ref", ref.toUpperCase().trim());
  }, []);

  /* Scroll-reveal */
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(
      ".reveal,.reveal-l,.reveal-r,.reveal-s,.stagger"
    ));
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("visible"); obs.unobserve(e.target); }
      }),
      { threshold: 0.1, rootMargin: "0px 0px -36px 0px" }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  /* Nav */
  const [navScrolled,    setNavScrolled]    = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen,      setNotifOpen]      = useState(false);
  const [settingsOpen,   setSettingsOpen]   = useState(false);
  const [notifDot,       setNotifDot]       = useState(true);
  const notifRef    = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (notifRef.current    && !notifRef.current.contains(e.target as Node))    setNotifOpen(false);
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.pageYOffset > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Scroll progress bar, synchronous transform write in a passive listener.
     A scaleX write never invalidates layout, so this stays cheap even at
     scroll-event frequency (and survives rAF throttling in embedded views). */
  const progressRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${max > 0 ? h.scrollTop / max : 0})`;
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);

  /* Highlight the nav link of whichever section crosses mid-viewport */
  const [activeNav, setActiveNav] = useState("");
  useEffect(() => {
    const ids = ["features", "followups", "how", "tour", "claude", "solutions", "pricing", "demo", "contact"];
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActiveNav(`#${e.target.id}`); }),
      { rootMargin: "-45% 0px -45% 0px" }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  /* GSAP scroll parallax, loaded lazily so it never delays first paint.
     Targets wrapper elements only (never elements that own CSS keyframe
     transforms, which would fight over the same property). */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let revert: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled || !heroRef.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const ctx = gsap.context(() => {
        const st = { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: 0.6 } as const;
        gsap.to(".hero-visual", { y: -60, ease: "none", scrollTrigger: { ...st } });
        gsap.to(".hero-copy",   { y: -24, opacity: 0.55, ease: "none", scrollTrigger: { ...st } });
      });
      revert = () => ctx.revert();
    })();
    return () => { cancelled = true; revert?.(); };
  }, []);

  /* Bento 3D tilt, pointer devices only, no mobile CPU cost */
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const cards = Array.from(document.querySelectorAll<HTMLElement>(".bento"));
    const listeners = cards.map((c) => {
      const mv = (e: MouseEvent) => {
        const r = c.getBoundingClientRect();
        const rx = ((e.clientY - r.top)  / r.height - 0.5) *  9;
        const ry = ((e.clientX - r.left) / r.width  - 0.5) * -9;
        c.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(8px)`;
      };
      const lv = () => { c.style.transform = ""; };
      c.addEventListener("mousemove", mv);
      c.addEventListener("mouseleave", lv);
      return { c, mv, lv };
    });
    return () => listeners.forEach(({ c, mv, lv }) => {
      c.removeEventListener("mousemove", mv);
      c.removeEventListener("mouseleave", lv);
    });
  }, []);

  /* Chat animation */
  const [chatIndex,   setChatIndex]   = useState(0);
  const [orderStatus, setOrderStatus] = useState<"idle" | "processing" | "confirmed">("idle");
  const [orderName,   setOrderName]   = useState("No order yet");
  const [successGlow, setSuccessGlow] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const heroRef       = useRef<HTMLElement>(null);
  const heroVisible   = useRef(true);

  /* Track hero visibility to pause chat animation when scrolled away */
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { heroVisible.current = e.isIntersecting; },
      { threshold: 0 }
    );
    if (heroRef.current) obs.observe(heroRef.current);
    return () => obs.disconnect();
  }, []);

  const scrollChat = useCallback(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  useEffect(() => { scrollChat(); }, [chatIndex, scrollChat]);

  useEffect(() => {
    let alive = true;
    (async () => {
      while (alive) {
        if (!heroVisible.current) { await delay(500); continue; }
        setChatIndex(0); setOrderStatus("idle"); setOrderName("No order yet"); setSuccessGlow(false);
        await delay(700);
        for (let i = 0; i < CHAT_STEPS.length && alive; i++) {
          if (!heroVisible.current) { await delay(500); i--; continue; }
          setChatIndex(i + 1);
          if (CHAT_STEPS[i].action === "processing") { setOrderStatus("processing"); setOrderName("John Doe"); }
          if (CHAT_STEPS[i].action === "confirmed")  { setOrderStatus("confirmed");  setSuccessGlow(true); }
          await delay(2000);
        }
        await delay(3500);
        if (chatScrollRef.current) chatScrollRef.current.style.opacity = "0";
        await delay(500);
        if (chatScrollRef.current) chatScrollRef.current.style.opacity = "1";
      }
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line

  const visibleSteps = CHAT_STEPS.slice(0, chatIndex);

  const openNotif    = () => { setNotifDot(false); setSettingsOpen(false); setNotifOpen(v => !v); };
  const openSettings = () => { setNotifOpen(false); setSettingsOpen(v => !v); };

  /* ─────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────── */
  return (
    <div className="octa-landing min-h-screen overflow-x-clip" style={{ background: "#f4f5f7", color: "#0f172a" }}>
      {/* title must match the <title> in index.html: crawlers read the static one
          and users see this one, so a mismatch means they judge different pages.
          Plain "&" here, not the entity, because scripts/lib/routes.mjs reads this
          string as text and escapes it on the way into the prerendered HTML. */}
      <SEO
        title="OctaDezx | Agentic AI Agents for Every Business"
        description="Agentic AI that answers customers, takes orders and bookings, handles phone calls and reads the photos customers send. For shops, restaurants, clinics, trades and every other business. 24-hour free trial."
        canonical="https://octadezx.com/"
      />

      <Preloader />
      <div ref={progressRef} className="scroll-progress" aria-hidden="true" />

      <SiteNav transparentAtTop />

      {/* ══ BACKGROUND ══ */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 grid-bg" />
      </div>

      <main className="relative pt-[68px]">

        {/* ══ HERO ══ */}
        <section ref={heroRef} className="relative min-h-[calc(100svh-68px)] flex flex-col items-center justify-center px-4 sm:px-6 py-16 overflow-hidden">
          <ParticleField />
          <div className="hero-aurora absolute -top-32 left-1/2 -translate-x-1/2" aria-hidden="true" />
          <div className="max-w-[1440px] w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">

            {/* Left */}
            <div className="hero-copy z-10 text-center lg:text-left">
              <span className="label inline-block mb-4 px-3 py-1.5 rounded-full text-[10px]"
                style={{ color: "#000047", background: "rgba(0,0,71,0.08)", border: "1px solid rgba(0,0,71,0.18)" }}>
                Agentic AI Customer Care, For Every Business
              </span>
              <h1 className="text-[2.2rem] sm:text-[3.5rem] md:text-[5rem] lg:text-[5.5rem] xl:text-[6rem] font-black text-slate-900 leading-[1.05] tracking-[-0.03em] mb-5 sm:mb-8">
                <span className="word-in block">AI Customer Care,</span>
                <span className="word-in block grad-cyan">That Takes Action.</span>
              </h1>

              <p className="text-sm sm:text-lg font-normal max-w-[520px] mb-7 sm:mb-11 leading-relaxed mx-auto lg:mx-0"
                style={{ color: "#667085" }}>
                A restaurant, a clinic, an agency, a salon, a store: OctaDezx gives any business an
                always-on AI agent that answers customers and then does the work. It books the
                appointment, places the order, answers the phone and follows up the lead, on
                WhatsApp, Instagram, Facebook, Telegram, your website and by phone.
              </p>

              {/* CTAs, two primary actions in one row, video as a quiet link below */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start items-stretch sm:items-center">
                <Magnetic className="w-full sm:w-auto">
                  <Link to="/auth" className="w-full sm:w-auto block">
                    <button className="btn-cta text-white px-8 py-4 rounded-2xl text-sm sm:text-base font-bold w-full sm:w-auto whitespace-nowrap">
                      Try Free for 24 Hours
                    </button>
                  </Link>
                </Magnetic>
                <Magnetic className="w-full sm:w-auto">
                  <Link to={DEMO_CHAT_URL} className="w-full sm:w-auto block">
                    <button className="btn-ghost px-7 py-4 rounded-2xl text-sm sm:text-base font-bold flex items-center justify-center gap-2 w-full sm:w-auto whitespace-nowrap">
                      <MI name="chat" style={{ color: "#000047" }} />
                      <span>Live Demo</span>
                    </button>
                  </Link>
                </Magnetic>
              </div>

              <div className="flex justify-center lg:justify-start mt-4">
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors">
                      <MI name="play_circle" className="text-xl" style={{ color: "#000047" }} />
                      <span>See it in action</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="w-[95vw] sm:max-w-[820px] p-0 overflow-hidden"
                    style={{ background: "#ffffff", borderColor: "#e8eaee" }}>
                    <DialogHeader className="sr-only">
                      <DialogTitle>OctaDezx Demo</DialogTitle>
                      <DialogDescription>See OctaDezx in action</DialogDescription>
                    </DialogHeader>
                    <div className="aspect-video w-full">
                      <VideoPlayer videoId="1V-H3lsAXNc" title="OctaDezx Demo" />
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <p className="text-xs mt-6 flex items-center gap-2 text-slate-500 justify-center lg:justify-start">
                <MI name="check_circle" className="text-sm flex-shrink-0" style={{ color: "#000047" }} />
                No credit card, full access, cancel anytime
              </p>
            </div>

            {/* Right, chat widget */}
            <div className="hero-visual relative hidden lg:flex items-center justify-center h-[580px]">

              {/* Floating badges */}
              <div className="badge-float absolute top-10 left-2 glass px-4 py-3 rounded-2xl flex items-center gap-3 z-20"
                style={{ boxShadow: "0 12px 30px rgba(16,24,40,0.12)" }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(34,197,94,0.12)" }}>
                  <MI name="trending_up" className="text-base" style={{ color: "#16a34a" }} />
                </div>
                <div>
                  <div className="label text-[9px] text-slate-400">Orders today</div>
                  <div className="text-sm font-bold text-slate-900">+248 <span className="text-green-600 text-xs font-semibold">+12%</span></div>
                </div>
              </div>

              <div className="badge-float-2 absolute top-40 -right-1 glass px-4 py-3 rounded-2xl flex items-center gap-3 z-20"
                style={{ boxShadow: "0 12px 30px rgba(16,24,40,0.12)" }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,0,71,0.10)" }}>
                  <MI name="bolt" className="text-base" style={{ color: "#000047" }} />
                </div>
                <div>
                  <div className="label text-[9px] text-slate-400">Response time</div>
                  <div className="text-sm font-bold text-slate-900">&lt;1.2s</div>
                </div>
              </div>

              <div className="badge-float-3 absolute bottom-2 right-6 glass px-4 py-3 rounded-2xl flex items-center gap-3 z-20"
                style={{ boxShadow: "0 12px 30px rgba(16,24,40,0.12)" }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(79,70,229,0.10)" }}>
                  <MI name="language" className="text-base" style={{ color: "#4f46e5" }} />
                </div>
                <div>
                  <div className="label text-[9px] text-slate-400">Languages</div>
                  <div className="text-sm font-bold text-slate-900">50+</div>
                </div>
              </div>

              {/* Main chat window */}
              <div className="chat-win rounded-[2rem] w-full max-w-[400px] h-[490px] flex flex-col relative overflow-hidden"
                style={{ transform: "perspective(1100px) rotateY(-3.5deg) rotateX(1.5deg)" }}>

                {/* Window chrome */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b flex-shrink-0"
                  style={{ borderColor: "#eef0f3", background: "#f9fafb" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "linear-gradient(135deg,#000047,#4f46e5)" }}>
                      <MI name="smart_toy" className="text-sm text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900">OctaDezx AI</div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 status-pulse" />
                        <span className="label text-[9px] text-slate-500">Online · Handling 14 chats</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {["bg-red-400","bg-yellow-400","bg-green-400"].map((c,i) => (
                      <span key={i} className={`w-2.5 h-2.5 rounded-full ${c}`} />
                    ))}
                  </div>
                </div>

                {/* Messages */}
                <div ref={chatScrollRef} className="flex-grow px-4 py-4 space-y-3 overflow-y-auto transition-opacity duration-500"
                  style={{ scrollbarWidth: "none", background: "#fbfcfd" }}>
                  {visibleSteps.map((s, i) => (
                    <div key={i} className={`msg-in flex ${s.sender === "ai" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs font-medium leading-relaxed ${
                        s.sender === "ai" ? "bubble-ai text-white rounded-tr-none" : "bubble-user text-slate-800 rounded-tl-none"
                      }`}>{s.text}</div>
                    </div>
                  ))}
                </div>

                {/* Status bar */}
                <div className="px-4 pb-4 flex-shrink-0" style={{ background: "#fbfcfd" }}>
                  <div className="rounded-xl px-3.5 py-2.5 flex items-center justify-between"
                    style={{ background: "#f2f4f7", border: "1px solid #e8eaee" }}>
                    <div className="flex items-center gap-2">
                      <MI name="shopping_cart" className="text-sm" style={{ color: "#4f46e5" }} />
                      <span className="text-[10px] text-slate-600 font-medium">{orderName}</span>
                    </div>
                    <span className="label text-[9px] px-2.5 py-0.5 rounded-full font-semibold" style={
                      orderStatus === "idle"       ? { background: "rgba(0,0,71,0.1)",  color: "#000047"  } :
                      orderStatus === "processing" ? { background: "rgba(234,179,8,0.14)",  color: "#b45309" } :
                                                     { background: "rgba(34,197,94,0.14)",  color: "#15803d" }
                    }>
                      {orderStatus === "idle" ? "● Listening" : orderStatus === "processing" ? "⟳ Processing" : "✓ Confirmed"}
                    </span>
                  </div>
                </div>

                {/* Bottom glow */}
                <div className="absolute bottom-0 left-0 right-0 h-[2px] transition-all duration-700"
                  style={{ background: successGlow
                    ? "linear-gradient(90deg,transparent,#22c55e,transparent)"
                    : "linear-gradient(90deg,transparent,#000047,transparent)" }} />
              </div>
            </div>
          </div>

          {/* Mobile chat preview, upgraded with header + status bar */}
          <div className="lg:hidden w-full max-w-sm mx-auto mt-8">
            <div className="chat-win rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
                style={{ borderColor: "#eef0f3", background: "#f9fafb" }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#000047,#4f46e5)" }}>
                    <MI name="smart_toy" className="text-xs text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900">OctaDezx AI</div>
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 status-pulse" />
                      <span className="label text-[9px] text-slate-500">Live</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  {["bg-red-400","bg-yellow-400","bg-green-400"].map((c,i) => (
                    <span key={i} className={`w-2 h-2 rounded-full ${c}`} />
                  ))}
                </div>
              </div>
              {/* Messages */}
              <div className="px-4 py-3 space-y-2.5 max-h-52 overflow-hidden" style={{ background: "#fbfcfd" }}>
                {visibleSteps.slice(-5).map((s, i) => (
                  <div key={i} className={`msg-in flex ${s.sender === "ai" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[82%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                      s.sender === "ai" ? "bubble-ai text-white" : "bubble-user text-slate-800"
                    }`}>{s.text}</div>
                  </div>
                ))}
              </div>
              {/* Status bar */}
              <div className="px-4 pb-3 flex-shrink-0" style={{ background: "#fbfcfd" }}>
                <div className="rounded-lg px-3 py-2 flex items-center justify-between"
                  style={{ background: "#f2f4f7", border: "1px solid #e8eaee" }}>
                  <div className="flex items-center gap-1.5">
                    <MI name="shopping_cart" className="text-xs" style={{ color: "#4f46e5" }} />
                    <span className="text-[10px] text-slate-600 font-medium">{orderName}</span>
                  </div>
                  <span className="label text-[9px] px-2 py-0.5 rounded-full font-semibold" style={
                    orderStatus === "idle"       ? { background: "rgba(0,0,71,0.1)",  color: "#000047"  } :
                    orderStatus === "processing" ? { background: "rgba(234,179,8,0.14)",  color: "#b45309" } :
                                                   { background: "rgba(34,197,94,0.14)",  color: "#15803d" }
                  }>
                    {orderStatus === "idle" ? "● Listening" : orderStatus === "processing" ? "⟳ Processing" : "✓ Confirmed"}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </section>



        {/* ══ STATS ══ */}
        <section className="py-10 sm:py-14 px-4 sm:px-6 max-w-[1440px] mx-auto">
          <div className="stagger grid grid-cols-2 lg:grid-cols-4 gap-px"
            style={{ background: "#e8eaee", borderRadius: "20px", overflow: "hidden", border: "1px solid #e8eaee" }}>
            {[
              { value: "24/7",  label: "Always Online",   sub: "Zero downtime, every timezone"    },
              { value: "12",    label: "Business Types",  sub: "Each with its own dashboard"      },
              { value: "50+",   label: "Integrations",    sub: "Chat, social, commerce and phone" },
              { value: "99.9%", label: "Uptime SLA",      sub: "Enterprise reliability built in"  },
            ].map((s) => (
              <StatCell key={s.label} value={s.value} label={s.label} sub={s.sub} />
            ))}
          </div>
        </section>

        <div className="divider max-w-[1440px] mx-auto" />

        {/* ══ CLIENTS ══ */}
        <section className="py-10 sm:py-14 overflow-hidden">
          <div className="text-center mb-8 reveal px-4">
            <span className="label text-[10px]" style={{ color: "#667085" }}>Trusted by leading brands</span>
          </div>
          <div className="marquee-mask overflow-hidden">
            <div className="animate-marquee flex w-max items-center gap-6 sm:gap-8">
              {[...clientLogos, ...clientLogos].map((c, i) => (
                <div
                  key={i}
                  title={c.name}
                  className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white flex items-center justify-center p-3 sm:p-4 grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
                  style={{ boxShadow: "0 2px 10px rgba(16,24,40,0.08)", border: "1px solid #eceef2" }}
                >
                  <img
                    src={c.src}
                    alt={c.name}
                    loading="lazy"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="divider max-w-[1440px] mx-auto" />

        <AgenticActions variant="strip" />

        <div className="divider max-w-[1440px] mx-auto" />

        {/* ══ TESTIMONIALS ══ */}
        <section id="stories" className="py-12 sm:py-20 md:py-28 px-4 sm:px-6 max-w-[1440px] mx-auto">
          <div className="text-center mb-10 sm:mb-14 reveal">
            <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>Customer stories</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">Leaders who grew with OctaDezx</h2>
            <p className="max-w-2xl mx-auto text-base" style={{ color: "#667085" }}>
              Hear how founders use OctaDezx to look after every customer and scale their business without scaling their support team.
            </p>
          </div>

          {/* Case-study banner */}
          <div className="reveal-s relative rounded-[2rem] overflow-hidden mb-6 sm:mb-8"
            style={{ boxShadow: "0 2px 6px rgba(16,24,40,0.06), 0 24px 60px rgba(16,24,40,0.14)" }}>
            <img src="/media/store-owner.webp" alt="Boutique owner chatting with a customer while OctaDezx handles store messages on a tablet"
              loading="lazy" decoding="async" className="w-full h-[240px] sm:h-[340px] object-cover" />
            <div className="absolute inset-0 flex items-end"
              style={{ background: "linear-gradient(to top, rgba(2,6,23,0.72) 0%, rgba(2,6,23,0.12) 45%, transparent 70%)" }}>
              <div className="p-6 sm:p-9">
                <p className="text-white text-lg sm:text-2xl font-black tracking-tight mb-1">
                  Real stores. Real customers. Zero missed messages.
                </p>
                <p className="text-white/75 text-xs sm:text-sm">While owners run the shop floor, OctaDezx runs the inbox.</p>
              </div>
            </div>
          </div>

          <div className="stagger grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            {testimonials.map((t, i) => (
              <figure
                key={i}
                className="glass rounded-3xl p-7 sm:p-9 flex flex-col"
              >
                <MI name="format_quote" className="text-4xl mb-4" style={{ color: "#000047" }} />
                <blockquote className="text-base sm:text-lg leading-relaxed text-slate-700 flex-grow">
                  “{t.quote}”
                </blockquote>
                <figcaption className="flex items-center gap-4 mt-7 pt-6" style={{ borderTop: "1px solid #e8eaee" }}>
                  <img
                    src={t.photo}
                    alt={t.name}
                    loading="lazy"
                    className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                    style={{ boxShadow: "0 4px 14px rgba(16,24,40,0.12)" }}
                  />
                  <div className="min-w-0">
                    <div className="text-slate-900 font-semibold leading-tight">{t.name}</div>
                    <div className="text-sm text-slate-500">{t.role}</div>
                  </div>
                  <div className="ml-auto w-12 h-12 rounded-full bg-white flex items-center justify-center p-2 flex-shrink-0" style={{ border: "1px solid #eceef2" }}>
                    <img src={t.logo} alt={t.role} loading="lazy" className="max-w-full max-h-full object-contain" />
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <div className="divider max-w-[1440px] mx-auto" />

        {/* ══ FEATURES ══ */}
        <section id="features" className="py-12 sm:py-20 md:py-28 px-4 sm:px-6 max-w-[1440px] mx-auto">
          <div className="text-center mb-10 sm:mb-14 reveal">
            <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>Capabilities</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">Customer care and sales, fully automated</h2>
            <p className="max-w-2xl mx-auto text-base" style={{ color: "#667085" }}>
              One AI platform that handles customer support, answers product questions and closes orders
              across every channel, running non-stop while you focus on what matters.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">

            {/* Wide card */}
            <div className="sm:col-span-2 bento glass rounded-[2rem] p-7 sm:p-10 relative overflow-hidden reveal-l" style={{ minHeight: 290 }}>
              <div className="bento-glow absolute inset-0 rounded-[2rem]" />
              <div className="relative z-10 flex flex-col h-full justify-between md:max-w-[55%]">
                <div>
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-5"
                    style={{ background: "rgba(0,0,71,0.1)" }}>
                    <MI name="dynamic_feed" className="text-xl" style={{ color: "#000047" }} />
                  </div>
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 mb-3 tracking-tight">Autonomous order processing</h3>
                  <p className="text-sm sm:text-base leading-relaxed max-w-md" style={{ color: "#667085" }}>
                    From first message to confirmed shipment. It verifies payments, reserves stock, notifies your team, sends branded confirmations. Continuously, in every timezone.
                  </p>
                </div>
                <div className="mt-8 flex flex-wrap gap-2">
                  {["Stock Sync","Auto-Ship","Payments","Refunds"].map((t) => (
                    <span key={t} className="px-3 py-1 rounded-full label text-[10px] text-slate-600"
                      style={{ background: "#f2f4f7", border: "1px solid #e8eaee" }}>{t}</span>
                  ))}
                </div>
              </div>
              {/* Product render, soft-masked into the card's right half */}
              <img src="/media/hero-chat.webp" alt="OctaDezx support chat confirming an order with live sales stats"
                loading="lazy" decoding="async"
                className="hidden md:block absolute right-0 top-0 h-full w-[52%] object-cover object-left pointer-events-none transition-transform duration-700 group-hover:scale-[1.02]"
                style={{ maskImage: "linear-gradient(to right, transparent, #000 22%)", WebkitMaskImage: "linear-gradient(to right, transparent, #000 22%)" }} />
            </div>

            {/* Small cards, identical rhythm: icon, visual (image or vignette), text */}
            {[
              { icon: "translate",   color: "#7c3aed", bg: "rgba(124,58,237,0.1)", title: "Speak any language",       desc: "Native-quality responses across 50+ languages, auto-detected per customer.", hover: "group-hover:rotate-12", viz: <LanguageViz /> },
              { icon: "bolt",        color: "#000047", bg: "rgba(0,0,71,0.1)",  title: "Instant, on-brand replies", desc: "Trained on your catalogue, policies and voice, so it sounds like you, not a bot.", hover: "group-hover:scale-125", viz: <TrainingViz /> },
              { icon: "insights",    color: "#000047", bg: "rgba(0,0,71,0.1)", title: "Revenue-grade analytics",  desc: "Conversion, resolution time and top products, live in one dashboard.", hover: "group-hover:scale-110", viz: <AnalyticsViz /> },
              { icon: "shield_lock", color: "#4f46e5", bg: "rgba(79,70,229,0.1)",  title: "Enterprise security",       desc: "End to end encryption, role based access and GDPR ready infrastructure.", hover: "group-hover:rotate-6", viz: <SecurityViz /> },
              { icon: "target",      color: "#000047", bg: "rgba(0,0,71,0.1)",  title: "Leads, captured & followed up", desc: "Every contact becomes a lead. The AI follows your playbook to re-engage them, and you can reach out with one click.", hover: "group-hover:scale-110", viz: <LeadScoreViz /> },
            ].map((card, i) => (
              <div key={card.title}
                className={`bento rounded-[2rem] p-7 flex flex-col group overflow-hidden ${["reveal-r","reveal","reveal-l","reveal","reveal-r"][i]}`}
                style={{ background: "#ffffff", border: "1px solid #e8eaee", minHeight: 220 }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mb-4" style={{ background: card.bg }}>
                  <MI name={card.icon} className={`text-xl transition-transform duration-300 ${card.hover}`} style={{ color: card.color }} />
                </div>
                <div className="h-32 flex-shrink-0 rounded-xl overflow-hidden">
                  {card.viz}
                </div>
                <div className="pt-5">
                  <h3 className="text-lg font-bold text-slate-900 mb-2 tracking-tight">{card.title}</h3>
                  <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "#667085" }}>{card.desc}</p>
                </div>
              </div>
            ))}

            {/* Wide, URL import */}
            <div className="sm:col-span-2 bento glass rounded-[2rem] p-7 sm:p-10 relative overflow-hidden reveal-l" style={{ minHeight: 240 }}>
              <div className="bento-glow absolute inset-0 rounded-[2rem]" />
              <div className="relative z-10 flex flex-col h-full justify-center">
                <span className="label text-[10px] mb-2" style={{ color: "#000047" }}>One-click import</span>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 mb-3 tracking-tight">Paste a URL. Launch a catalogue.</h3>
                <p className="max-w-lg mb-7 text-sm sm:text-base leading-relaxed" style={{ color: "#667085" }}>
                  Pulls product titles, variants, pricing and media from any storefront in under 10 seconds.
                </p>
                {/* Mock import bar */}
                <div className="flex items-center gap-2.5 max-w-md rounded-xl pl-4 pr-1.5 py-1.5"
                  style={{ background: "#ffffff", border: "1px solid #e8eaee", boxShadow: "0 1px 3px rgba(16,24,40,0.06)" }}>
                  <MI name="link" className="text-base flex-shrink-0" style={{ color: "#98a2b3" }} />
                  <span className="text-xs sm:text-sm text-slate-500 font-medium truncate">https://yourstore.com/collections/all</span>
                  <span className="ml-auto flex-shrink-0 text-[11px] font-bold text-white px-4 py-2 rounded-lg" style={{ background: "#000047" }}>
                    Import
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-3 max-w-md">
                  <MI name="check_circle" className="text-sm flex-shrink-0" style={{ color: "#16a34a" }} />
                  <span className="text-[11px] font-medium text-slate-500">Shopify · WooCommerce · Wix · any public catalogue</span>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-2/5 h-full pointer-events-none"
                style={{ background: "linear-gradient(to left,rgba(0,0,71,0.04),transparent)" }} />
            </div>

          </div>
        </section>

        <div className="divider max-w-[1440px] mx-auto" />

        <ImageRecognition />

        <div className="divider max-w-[1440px] mx-auto" />

        <VoiceSection />

        <div className="divider max-w-[1440px] mx-auto" />

        {/* ══ MORE CAPABILITIES ══ */}
        <section id="capabilities" className="py-12 sm:py-20 md:py-28 px-4 sm:px-6 max-w-[1440px] mx-auto">
          <div className="text-center mb-10 sm:mb-14 reveal">
            <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>More than a chatbot</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">
              It works where your customers already are
            </h2>
            <p className="max-w-2xl mx-auto text-base" style={{ color: "#667085" }}>
              Chat is only the start. OctaDezx answers your comments, books appointments, learns from your files,
              and lets you run growth from inside Claude.
            </p>
          </div>
          <div className="stagger grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { icon: "reviews", tag: "Facebook & Instagram", title: "Answers comments, in public", desc: "When someone comments on your post, the AI replies right there, or privately in their DMs, using the same knowledge it uses in chat. It never talks over itself." },
              { icon: "event_available", tag: "Appointments", title: "Books slots while you sleep", desc: "Customers pick a time in the conversation and the AI books it around the hours and services you set. Confirmed bookings land in your dashboard." },
              { icon: "upload_file", tag: "Training", title: "Learns from your files", desc: "Upload a PDF, CSV, price list or a photo of your menu. OctaDezx reads it straight into its knowledge and answers from it within seconds." },
              { icon: "rocket_launch", tag: "Growth via Claude", title: "Runs your marketing from Claude", desc: "Connect Claude and ask it to analyse your ads, study competitor creative, and draft or publish posts, all through the native OctaDezx MCP server." },
            ].map((c) => (
              <div key={c.title} className="reveal group rounded-[2rem] p-7 sm:p-8 transition-all hover:-translate-y-1 hover:shadow-lg"
                style={{ background: "#ffffff", border: "1px solid #e8eaee" }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,0,71,0.08)" }}>
                    <MI name={c.icon} className="text-xl transition-transform duration-300 group-hover:scale-110" style={{ color: "#000047" }} />
                  </div>
                  <span className="label text-[9px]" style={{ color: "#98a2b3" }}>{c.tag}</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 tracking-tight">{c.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="divider max-w-[1440px] mx-auto" />

        {/* ══ FOLLOW-UPS & LEAD OUTREACH ══ */}
        <section id="followups" className="py-12 sm:py-20 md:py-28 px-4 sm:px-6 max-w-[1440px] mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            {/* Copy */}
            <div className="reveal-l">
              <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>Follow-ups &amp; lead outreach</span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-5 tracking-tight">
                The sale isn't over when the chat goes quiet
              </h2>
              <p className="text-base leading-relaxed mb-6" style={{ color: "#667085" }}>
                Most interested customers don't buy on the first message. They compare, get
                distracted, and forget. OctaDezx captures every lead automatically and follows
                up the way <strong className="text-slate-900">you</strong> would.
              </p>
              <ul className="space-y-4">
                {[
                  ["playbook", "menu_book", "Your follow-up playbook", "Write plain-language rules like “if someone abandons mid-order, remind them their size is reserved” and the AI applies them in every conversation, in the customer's language."],
                  ["capture", "person_add", "Automatic lead capture", "Every customer who shares a name or email becomes a lead in your dashboard, with the full conversation attached."],
                  ["outreach", "send", "One-click outreach", "Re-engage quiet leads from the dashboard. Your message lands directly in their existing chat thread, not a cold email they'll ignore."],
                ].map(([key, icon, title, desc]) => (
                  <li key={key} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,0,71,0.08)" }}>
                      <MI name={icon} className="text-lg" style={{ color: "#000047" }} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm sm:text-base mb-1">{title}</div>
                      <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Timeline vignette */}
            <div className="reveal-r">
              <div className="glass-strong rounded-[2rem] p-6 sm:p-8 space-y-4">
                <div className="label text-[9px] text-slate-400 mb-2">A lead's journey, on autopilot</div>
                {[
                  { time: "Tue 10:42", icon: "chat", tone: "#1d4ed8", text: "Diego asks about Chelsea boots, size 44, but doesn't order." },
                  { time: "Tue 10:44", icon: "person_add", tone: "#7c3aed", text: "Lead captured: Diego L. · diego@… now visible in your dashboard." },
                  { time: "Wed 09:00", icon: "send", tone: "#000047", text: "Follow-up per your playbook: “Still interested? Your size is reserved until Friday.”" },
                  { time: "Wed 11:12", icon: "check_circle", tone: "#16a34a", text: "Order #OD-2051 confirmed: $189, payment verified." },
                ].map((step, i, arr) => (
                  <div key={step.time} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: `${step.tone}14` }}>
                        <MI name={step.icon} className="text-base" style={{ color: step.tone }} />
                      </div>
                      {i < arr.length - 1 && <div className="w-px flex-1 my-1" style={{ background: "#e8eaee" }} />}
                    </div>
                    <div className="pb-5">
                      <div className="label text-[9px] text-slate-400 mb-1">{step.time}</div>
                      <p className="text-sm text-slate-700 leading-relaxed">{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="divider max-w-[1440px] mx-auto" />

        {/* ══ HOW IT WORKS ══ */}
        <section id="how" className="py-12 sm:py-20 md:py-28 px-4 sm:px-6 max-w-[1180px] mx-auto">
          <div className="text-center mb-12 sm:mb-20 reveal">
            <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>Quick Start</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">Live in under 10 minutes</h2>
            <p className="max-w-xl mx-auto text-base" style={{ color: "#667085" }}>
              No developers, no integration team, no migration. Three steps and your AI is answering customers.
            </p>
          </div>

          <div className="relative">
            {/* center rail (desktop only) */}
            <div className="hidden lg:block absolute top-4 bottom-4 left-1/2 -translate-x-1/2 w-px" aria-hidden="true"
              style={{ background: "linear-gradient(180deg, transparent, #d7dae1 6%, #d7dae1 94%, transparent)" }} />

            <div className="space-y-14 sm:space-y-16 lg:space-y-28">
              {HOW_STEPS.map((s, i) => {
                const flip = i % 2 === 1; // step 02 puts the mockup on the left
                return (
                  <div key={s.n} className="relative lg:grid lg:grid-cols-2 lg:gap-20 lg:items-center">
                    {/* node on the rail (desktop) */}
                    <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-14 h-14 rounded-full items-center justify-center text-white font-black text-sm"
                      style={{ background: "linear-gradient(135deg,#000047,#4f46e5)", boxShadow: "0 8px 24px rgba(0,0,71,0.35), 0 0 0 6px #f4f5f7" }}>
                      {s.n}
                    </div>

                    {/* copy */}
                    <div className={`${flip ? "reveal-r lg:order-2 lg:pl-14" : "reveal-l lg:order-1 lg:pr-14"}`}>
                      <div className="flex items-center gap-3 mb-4">
                        <span className="lg:hidden w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-xs flex-shrink-0"
                          style={{ background: "linear-gradient(135deg,#000047,#4f46e5)" }}>{s.n}</span>
                        <span className="label text-[10px] inline-block relative pb-1.5" style={{ color: "#000047" }}>
                          {s.eyebrow}
                          <span className="absolute left-0 bottom-0 w-7 h-[2px] rounded-full" style={{ background: "#000047" }} />
                        </span>
                      </div>
                      <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 mb-3 tracking-tight">{s.title}</h3>
                      <p className="text-sm sm:text-base leading-relaxed mb-6" style={{ color: "#667085" }}>{s.desc}</p>
                      <ul className="space-y-2.5">
                        {s.checks.map((c) => (
                          <li key={c} className="flex items-start gap-2.5 text-sm font-medium text-slate-700">
                            <MI name="check_circle" className="text-base flex-shrink-0 mt-[1px]" style={{ color: "#16a34a" }} />
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* mockup */}
                    <div className={`mt-8 lg:mt-0 ${flip ? "reveal-l lg:order-1 lg:pr-14" : "reveal-r lg:order-2 lg:pl-14"}`}>
                      {s.mock}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <div className="divider max-w-[1440px] mx-auto" />

        {/* ══ PRODUCT TOUR ══ */}
        <section id="tour" className="relative py-12 sm:py-20 md:py-28 px-4 sm:px-6 max-w-[1440px] mx-auto">
          <img src="/media/bg-grid-orb.webp" alt="" aria-hidden="true" loading="lazy" decoding="async"
            className="absolute inset-x-0 top-0 w-full h-full object-cover opacity-60 pointer-events-none select-none"
            style={{ maskImage: "linear-gradient(to bottom, #000 0%, transparent 85%)", WebkitMaskImage: "linear-gradient(to bottom, #000 0%, transparent 85%)" }} />
          <div className="relative text-center mb-8 sm:mb-10 reveal">
            <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>Inside the product</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">
              A workspace your team will actually enjoy
            </h2>
            <p className="max-w-2xl mx-auto text-base" style={{ color: "#667085" }}>
              This is the exact dashboard you get after sign-up: conversations, orders,
              analytics and AI training, all in one calm place.
            </p>
          </div>
          <div className="relative reveal-s">
            <ProductTour />
          </div>
        </section>

        {/* ══ CLAUDE MCP ══ */}
        <section id="claude" className="py-12 sm:py-20 md:py-28 relative overflow-hidden"
          style={{ background: "linear-gradient(180deg, #0b0b2e 0%, #000047 100%)" }}>
          <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
            style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />
          <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

            {/* Copy */}
            <div className="reveal-l">
              <span className="label text-[10px] mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{ color: "#b4c5ff", background: "rgba(180,197,255,0.1)", border: "1px solid rgba(180,197,255,0.25)" }}>
                <MI name="smart_toy" className="text-sm" /> Native MCP server · Model Context Protocol
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-5 tracking-tight">
                Run your business from inside Claude
              </h2>
              <p className="text-base leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.75)" }}>
                OctaDezx ships a native <strong className="text-white">MCP (Model Context Protocol) server</strong>.
                Connect Claude to your business at <a href="/mcp" target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-1 rounded-md hover:underline" style={{ background: "rgba(255,255,255,0.1)", color: "#b4c5ff" }}>octadezx.com/mcp</a> and
                manage everything in plain language. No dashboard tab required.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "“Any customers waiting on us?” and Claude lists escalated chats with context",
                  "“Reply to Sofia that her refund was processed” goes straight into the live conversation",
                  "“How are my ads doing, and what are competitors running?” with insights and Ad Library creative",
                  "“Draft a post about the weekend sale and publish it to Instagram” from the same chat",
                  "Check orders, book appointments, reply to comments and teach the knowledge base, all from Claude",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3 text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
                    <MI name="check_circle" className="text-base flex-shrink-0 mt-[1px]" style={{ color: "#4ade80" }} />
                    {t}
                  </li>
                ))}
              </ul>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                Works with claude.ai connectors and Claude Code · Secured with OAuth, you approve access and can revoke anytime ·
                Included in the free trial, a subscription keeps it active afterwards
              </p>
            </div>

            {/* Claude conversation vignette */}
            <div className="reveal-r">
              <div className="rounded-[1.5rem] overflow-hidden"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(10px)" }}>
                <div className="flex items-center gap-2.5 px-5 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#d97757" }} />
                  <span className="text-xs font-semibold text-white/80">Claude</span>
                  <span className="label text-[8px] ml-auto px-2 py-0.5 rounded-full" style={{ color: "#b4c5ff", background: "rgba(180,197,255,0.1)" }}>
                    OctaDezx connected
                  </span>
                </div>
                <div className="p-5 space-y-3.5">
                  <div className="flex justify-end">
                    <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md text-sm text-white" style={{ background: "rgba(255,255,255,0.12)" }}>
                      Any customers waiting on us?
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                    <MI name="build" className="text-xs" />
                    <span className="font-mono">list_escalated_chats</span> · OctaDezx MCP
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[90%] px-4 py-3 rounded-2xl rounded-bl-md text-sm leading-relaxed" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.85)" }}>
                      Two customers are waiting: <strong className="text-white">Sofia</strong> has a refund question
                      (12 min) and <strong className="text-white">James</strong> asked about bulk pricing (34 min).
                      Want me to draft replies?
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md text-sm text-white" style={{ background: "rgba(255,255,255,0.12)" }}>
                      Tell Sofia her refund went out today.
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                    <MI name="build" className="text-xs" />
                    <span className="font-mono">reply_to_customer</span>
                    <MI name="check_circle" className="text-xs" style={{ color: "#4ade80" }} />
                    <span style={{ color: "#4ade80" }}>Sent to Sofia's chat</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ INTEGRATIONS ══ */}
        <section id="integrations" className="py-12 sm:py-20 relative overflow-hidden"
          style={{ background: "#ebedf1" }}>
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 text-center">
            <span className="label text-[10px] mb-4 block reveal" style={{ color: "#000047" }}>Everything Connected</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight reveal">Find customers everywhere</h2>
            <p className="max-w-2xl mx-auto mb-10 sm:mb-14 text-base reveal" style={{ color: "#667085" }}>
              Native integrations across messaging, e-commerce and productivity, synced in real time.
            </p>

            {/* Orbital */}
            <div className="relative h-[460px] items-center justify-center hidden sm:flex reveal-s">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full flex items-center justify-center relative z-20 hover:scale-105 transition-transform"
                style={{ background: "linear-gradient(135deg,#000047,#4f46e5)", boxShadow: "0 18px 50px rgba(0,0,71,0.35)" }}>
                <MI name="hub" className="text-white" style={{ fontSize: "2.4rem" }} />
              </div>
              <div className="absolute rounded-full" style={{ width: 320, height: 320, border: "1px solid rgba(0,0,71,0.12)", transform: "rotateX(62deg)" }} />
              <div className="absolute rounded-full" style={{ width: 500, height: 500, border: "1px solid rgba(0,0,71,0.07)", transform: "rotateX(62deg)" }} />
              <div className="absolute w-full h-full flex items-center justify-center">
                {INTEGRATIONS.map((it, i) => (
                  <div key={it.name} className="orbit-item glass px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl flex items-center gap-2 cursor-pointer hover:-translate-y-0.5 transition-transform"
                    style={{ ["--rot" as string]: `${it.rot}deg`, animationDelay: `${-i * 3.3}s` } as React.CSSProperties}>
                    <MI name={it.icon} style={{ color: it.color }} />
                    <span className="text-xs font-semibold text-slate-800">{it.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile: orbit render + grid */}
            <div className="sm:hidden mb-6">
              <img src="/media/channels-orbit.webp" alt="Messaging, social and commerce channels orbiting the OctaDezx core"
                loading="lazy" decoding="async"
                className="w-full max-w-[300px] mx-auto rounded-3xl mb-6" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:hidden mb-8">
              {INTEGRATIONS.map((it) => (
                <div key={it.name} className="glass rounded-2xl px-4 py-3.5 flex items-center gap-3">
                  <MI name={it.icon} className="text-xl flex-shrink-0" style={{ color: it.color }} />
                  <span className="text-sm font-semibold text-slate-800">{it.name}</span>
                </div>
              ))}
            </div>

            <Link to="/integrations"
              className="glass text-slate-800 px-6 py-3 rounded-xl font-semibold hover:bg-slate-50 transition-all inline-flex items-center gap-2 text-sm reveal">
              View all {INTEGRATION_COUNT} integrations <MI name="arrow_forward" />
            </Link>
          </div>
        </section>

        <div className="divider max-w-[1440px] mx-auto" />

        <BusinessBreakdown variant="compact" />

        <div className="divider max-w-[1440px] mx-auto" />

        {/* ══ FOR EVERY BUSINESS ══ */}
        <section id="solutions" className="py-12 sm:py-20 md:py-28 px-4 sm:px-6 max-w-[1440px] mx-auto">
          <div className="text-center mb-10 sm:mb-14 reveal">
            <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>Built for every business</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">
              From solo founders to enterprise teams
            </h2>
            <p className="max-w-2xl mx-auto text-base" style={{ color: "#667085" }}>
              The dashboard adapts to how your business actually works. A restaurant gets menus
              and reservations, an agency gets lead capture, a store gets orders and shipments.
              A restaurant never sees "Shipments". Same 10-minute setup for everyone.
            </p>
          </div>
          <div className="stagger grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { icon: "storefront",        label: "E-commerce",           desc: "Catalogue, orders, shipments & invoices" },
              { icon: "store",             label: "Retail stores",        desc: "Stock questions, locations & hours" },
              { icon: "restaurant",        label: "Restaurants",          desc: "Menus, food orders & reservations" },
              { icon: "work",              label: "Agencies",             desc: "Service enquiries & lead qualification" },
              { icon: "cloud",             label: "SaaS & software",      desc: "Plan questions, support & demos" },
              { icon: "stethoscope",       label: "Clinics & healthcare", desc: "Services, hours & appointment requests" },
              { icon: "school",            label: "Education",            desc: "Programs, fees & admissions" },
              { icon: "account_balance",   label: "Banks & finance",      desc: "Compliant service info & secure hand-offs" },
              { icon: "home_work",         label: "Real estate agencies", desc: "Listings, valuations & viewing requests" },
              { icon: "flight",            label: "Travel & tourism",     desc: "Packages, bookings & itineraries" },
              { icon: "domain",            label: "Enterprise",           desc: "Multi-department routing at scale" },
              { icon: "handyman",          label: "Local services",       desc: "Quotes, service areas & scheduling" },
              { icon: "hotel",             label: "Hotels & hospitality", desc: "Rooms, rates & reservation requests" },
              { icon: "directions_car",    label: "Automotive",           desc: "Vehicle stock, test drives & servicing" },
              { icon: "local_shipping",    label: "Logistics & couriers", desc: "Tracking, coverage & delivery quotes" },
              { icon: "content_cut",       label: "Beauty & salons",      desc: "Services, prices & appointment booking" },
            ].map((b) => (
              <div key={b.label} className="glass rounded-2xl p-5 transition-all hover:-translate-y-1 hover:shadow-lg">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(0,0,71,0.08)" }}>
                  <MI name={b.icon} className="text-lg" style={{ color: "#000047" }} />
                </div>
                <div className="font-bold text-slate-900 text-sm mb-1">{b.label}</div>
                <p className="text-xs leading-relaxed" style={{ color: "#667085" }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="divider max-w-[1440px] mx-auto" />

        {/* ══ PRICING ══ */}
        <PricingSection />

        {/* ══ LIVE DEMO ══ */}
        <section id="demo" className="py-12 sm:py-20 md:py-28 px-4 sm:px-6 max-w-[1440px] mx-auto">
          <div className="text-center mb-12 sm:mb-16 reveal">
            <span className="label text-[10px] mb-4 flex items-center justify-center gap-2" style={{ color: "#16a34a" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 status-pulse inline-block" />
              Live &amp; Working, No Account Needed
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">
              Try it yourself, right now
            </h2>
            <p className="max-w-xl mx-auto text-base" style={{ color: "#667085" }}>
              Chat with <strong className="text-slate-900">Merrell</strong>, a real premium leather shoe store powered by OctaDezx.
              Ask about products, prices, or place an order. It all works.
            </p>
            <p className="max-w-xl mx-auto text-sm mt-3" style={{ color: "#98a2b3" }}>
              Business owners: after setup you get the same kind of link as your own
              test drive. Open it any time to see exactly how your AI handles customers.
            </p>
          </div>

          <div className="reveal-s max-w-[700px] lg:max-w-[1180px] mx-auto lg:grid lg:grid-cols-2 lg:gap-8 lg:items-stretch">
            {/* Ambient product loop (desktop) */}
            <div className="hidden lg:block relative rounded-[2rem] overflow-hidden"
              style={{ border: "1px solid #e8eaee", boxShadow: "0 2px 6px rgba(16,24,40,0.06), 0 24px 60px rgba(16,24,40,0.14)" }}>
              <AmbientVideo
                src="/media/loop-hero.mp4"
                poster="/media/hero-chat.webp"
                label="OctaDezx support chat resolving and confirming an order, in motion"
                className="w-full h-full object-cover absolute inset-0"
              />
              <div className="absolute bottom-0 left-0 right-0 p-5"
                style={{ background: "linear-gradient(to top, rgba(2,6,23,0.55), transparent)" }}>
                <p className="text-white text-sm font-semibold">This is what your customers see: instant, polite, always on.</p>
              </div>
            </div>

            <div>
            {/* Demo card */}
            <div className="relative rounded-[2rem] overflow-hidden"
              style={{ background: "#ffffff", border: "1px solid #e8eaee", boxShadow: "0 2px 6px rgba(16,24,40,0.06), 0 24px 60px rgba(16,24,40,0.14)" }}>

              {/* Chat header */}
              <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
                style={{ borderColor: "#eef0f3", background: "#f9fafb" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#000047,#7c3aed)" }}>M</div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Merrell</div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 status-pulse" />
                      <span className="label text-[9px] text-slate-500">Online · AI-powered by OctaDezx</span>
                    </div>
                  </div>
                </div>
                <span className="label text-[9px] px-2.5 py-1 rounded-full" style={{ background: "rgba(0,0,71,0.08)", color: "#000047", border: "1px solid rgba(0,0,71,0.15)" }}>
                  Premium Leather Shoes
                </span>
              </div>

              {/* Preview messages */}
              <div className="px-5 py-5 space-y-3 pointer-events-none select-none"
                style={{ background: "#f7f8fa" }}>
                {[
                  { sender: "ai",       text: "Hello! 👋 Welcome to Merrell, your destination for premium leather shoes. How can I help you today?" },
                  { sender: "customer", text: "Do you have leather loafers for men?" },
                  { sender: "ai",       text: "Yes! We carry several premium leather loafers. Our best seller is the Merrell Classic Oxford in full-grain leather, available in sizes 7 to 13. Would you like to see the collection with prices? 👞" },
                  { sender: "customer", text: "Sure, what's the price range?" },
                  { sender: "ai",       text: "Our loafers range from $89 to $199 depending on the leather grade. Free shipping on orders over $100. Want me to show you specific styles?" },
                ].map((m, i) => (
                  <div key={i} className={`flex ${m.sender === "customer" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed font-medium ${
                      m.sender === "customer"
                        ? "text-white rounded-br-sm"
                        : "text-slate-800 rounded-bl-sm"
                    }`} style={m.sender === "customer"
                      ? { background: "linear-gradient(135deg,#000047,#1d4ed8)", boxShadow: "0 4px 16px rgba(0,0,71,0.30)" }
                      : { background: "#ffffff", border: "1px solid #e8eaee" }
                    }>{m.text}</div>
                  </div>
                ))}
                {/* Typing hint */}
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1 items-center"
                    style={{ background: "#ffffff", border: "1px solid #e8eaee" }}>
                    <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>

              {/* CTA overlay */}
              <div className="relative px-5 pb-5 pt-2" style={{ background: "#ffffff" }}>
                <div className="absolute top-0 left-0 right-0 h-12 pointer-events-none"
                  style={{ background: "linear-gradient(to bottom, rgba(247,248,250,0), #ffffff)", marginTop: "-48px" }} />
                <Link to={DEMO_CHAT_URL}>
                  <button className="w-full btn-cta text-white py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5">
                    <MI name="chat" className="text-xl" />
                    Start Chatting with Merrell →
                  </button>
                </Link>
                <p className="text-center text-xs text-slate-500 mt-3">
                  No sign-up, anonymous, fully functional AI assistant
                </p>
              </div>
            </div>

            {/* Trust notes */}
            <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2">
              {[
                { icon: "lock", text: "Anonymous session" },
                { icon: "bolt", text: "Real AI responses" },
                { icon: "shopping_bag", text: "Actual product catalog" },
              ].map((t) => (
                <span key={t.text} className="flex items-center gap-1.5 text-xs" style={{ color: "#667085" }}>
                  <MI name={t.icon} className="text-sm flex-shrink-0" style={{ color: "#000047" }} />
                  {t.text}
                </span>
              ))}
            </div>
            </div>
          </div>
        </section>

        <div className="divider max-w-[1440px] mx-auto" />

        {/* ══ FAQ ══ */}
        <section id="faq" className="py-12 sm:py-20 md:py-28 px-4 sm:px-6 max-w-[1440px] mx-auto">
          <div className="text-center mb-10 sm:mb-14 reveal">
            <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>FAQ</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">AI customer care questions, answered</h2>
            <p className="max-w-xl mx-auto text-base" style={{ color: "#667085" }}>
              Everything you need to know about running customer support and sales on OctaDezx.
            </p>
          </div>
          <div className="stagger grid sm:grid-cols-2 gap-4 sm:gap-5">
            {[
              { q: "What is OctaDezx?", a: "OctaDezx is an AI customer care platform that gives your business an always-on AI agent to answer customer questions, resolve support requests and capture orders 24/7 across WhatsApp, Instagram, Facebook, Shopify and more." },
              { q: "Can OctaDezx replace a customer care agent?", a: "It works as a 24/7 AI customer service agent that instantly answers FAQs, handles product and order questions and resolves common support requests, then escalates to your human team with full context when a conversation needs a person." },
              { q: "Which channels does the AI customer service agent cover?", a: "WhatsApp, Instagram, Facebook, Shopify and your website widget out of the box, plus inbound and outbound phone calls and 90+ integrations covering stores, CRMs, payments and couriers, all answered from one place in your customers' own language." },
              { q: "Does it take orders, not just answer questions?", a: "Yes. Beyond support, OctaDezx confirms and places orders for you. Every price and total is verified on our servers against your catalogue, so customers are always charged the correct amount." },
              { q: "How fast can I go live?", a: "Under 10 minutes. Paste a storefront URL to import your catalogue, add your policies and FAQs, connect a channel, and your AI customer care agent is live." },
              { q: "Can OctaDezx follow up with customers and leads?", a: "Yes. Every customer who shares contact details becomes a lead in your dashboard. You write a follow-up playbook in plain language and the AI applies it in every conversation. You can also send one-click follow-ups that land directly in the customer's existing chat thread." },
              { q: "What is the OctaDezx MCP server for Claude?", a: "OctaDezx ships a native Model Context Protocol (MCP) server at octadezx.com/mcp. Connect it to Claude and manage your business in plain language: list escalated chats, read conversations, reply to customers, check orders, update products and teach the knowledge base. Secured with OAuth, and included in the free trial." },
              { q: "What types and sizes of business does it work for?", a: "Everything from solo founders to enterprise teams: e-commerce, retail, restaurants, agencies, SaaS, clinics, banks and finance, education, real estate agencies, travel, hotels and local services. The dashboard adapts to each type, so a restaurant gets menus and reservations while a store gets orders and shipments." },
              { q: "Is there a free trial?", a: "Yes, a 24-hour free trial with full access to every feature. No credit card required." },
            ].map((f) => (
              <div key={f.q} className="glass rounded-2xl p-6">
                <h3 className="text-base font-bold text-slate-900 mb-2 tracking-tight">{f.q}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="divider max-w-[1440px] mx-auto" />

        {/* Waitlist signup. Sits just before the closing call to action so the
            page still ends on the trial, which is the stronger ask for anyone
            ready to buy today. Move the section, not the component, to relocate it. */}
        <section id="waitlist" className="px-6 py-20">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-3">
              Get the next release first
            </h2>
            <p className="text-sm leading-relaxed mb-8" style={{ color: "#667085" }}>
              Join the list and we will let you know as new channels and features go live.
            </p>
            <LaunchListWidget keyId="pGsPeb" />
          </div>
        </section>

        <div className="divider max-w-[1440px] mx-auto" />

        <CtaSection />
      </main>

      <SiteFooter />
    </div>
  );
};

export default Index;
