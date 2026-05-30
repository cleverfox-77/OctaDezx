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
  { sender: "customer", text: "Yes please — Size M.", action: "processing" },
  { sender: "ai",       text: "Perfect! Share your name, delivery address and phone to confirm. 📦" },
  { sender: "customer", text: "John Doe, 42 Maple Street, NYC. 646XXXXXXXX" },
  { sender: "ai",       text: "✅ Confirmed! Size M ships in 3–5 days. Order #OD-20482. Thanks, John! 🎉", action: "confirmed" },
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
  { label: "Pricing",      href: "#pricing"   },
  { label: "Live Demo",    href: "#demo"      },
  { label: "Support",      href: "#contact"   },
];

const DEMO_BUSINESS_ID = "a9a0d41a-6651-4d59-9e66-a8b15ba068f1";
const DEMO_CHAT_URL    = `/chat/${DEMO_BUSINESS_ID}`;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* ════════════════════════════════════════════════════════════════
   Index
════════════════════════════════════════════════════════════════ */
const Index = () => {
  const navigate = useNavigate();

  /* CTA email capture — the input used to be ignored; now we persist it and
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

  /* Bento 3D tilt — pointer devices only, no mobile CPU cost */
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
  const [orderName,   setOrderName]   = useState("—");
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
        setChatIndex(0); setOrderStatus("idle"); setOrderName("—"); setSuccessGlow(false);
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
    <div className="octa-landing grain min-h-screen" style={{ background: "#080a12" }}>
      <SEO
        title="OctaDezx — AI Sales Assistant | Sell More, Work Less"
        description="Always-on AI that answers customers, captures orders and syncs your catalogue across WhatsApp, Instagram, Facebook & Shopify. 24-hour free trial."
        canonical="https://octadezx.com/"
      />

      {/* ══ NAV ══ */}
      <nav
        className={`fixed top-0 left-0 w-full z-[100] transition-all duration-500 ${
          navScrolled
            ? "border-b backdrop-blur-2xl"
            : "border-b border-transparent"
        }`}
        style={navScrolled
          ? { background: "rgba(8,10,18,0.88)", borderColor: "rgba(255,255,255,0.06)", boxShadow: "0 1px 0 rgba(76,215,246,0.05)" }
          : { background: "transparent" }
        }
      >
        <div className="flex items-center justify-between px-4 sm:px-6 md:px-10 h-[68px] max-w-[1440px] mx-auto">

          <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
            <div className="relative">
              <div className="absolute inset-0 rounded-lg blur-md opacity-50 group-hover:opacity-80 transition-opacity" style={{ background: "#2563eb" }} />
              <LogoIcon size="md" className="relative" />
            </div>
            <span className="text-[15px] font-bold tracking-[0.07em] uppercase text-white">OctaDezx</span>
          </Link>

          <div className="hidden md:flex items-center gap-0.5">
            {NAV_LINKS.map((l) => (
              <a key={l.label} href={l.href}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200">
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Notif */}
            <div ref={notifRef} className="relative hidden lg:block">
              <button onClick={openNotif} aria-label="Notifications"
                className="relative text-slate-400 hover:text-white hover:bg-white/6 transition-all p-2 rounded-xl focus:outline-none">
                <MI name="notifications" />
                {notifDot && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full status-pulse"
                    style={{ background: "#4cd7f6", boxShadow: "0 0 0 2px #080a12" }} />
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 glass rounded-2xl shadow-2xl overflow-hidden z-50 drop-in">
                  <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <span className="text-sm font-semibold text-white">Notifications</span>
                    <span className="label text-slate-500">Mark all read</span>
                  </div>
                  <div className="px-5 py-6 flex flex-col items-center text-center gap-3">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: "rgba(76,215,246,0.08)" }}>
                      <MI name="notifications_active" className="text-xl" style={{ color: "#4cd7f6" }} />
                    </div>
                    <p className="text-sm font-medium text-white">Stay in the loop</p>
                    <p className="text-xs text-slate-400 leading-relaxed">Sign in to receive live order alerts, revenue updates and AI performance reports.</p>
                    <Link to="/auth" onClick={() => setNotifOpen(false)}>
                      <button className="btn-cta text-white text-xs font-bold px-5 py-2.5 rounded-xl w-full mt-1">
                        Sign in to enable alerts
                      </button>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Settings */}
            <div ref={settingsRef} className="relative hidden lg:block">
              <button onClick={openSettings} aria-label="Settings"
                className="text-slate-400 hover:text-white hover:bg-white/6 transition-all p-2 rounded-xl focus:outline-none">
                <MI name="settings" className={settingsOpen ? "animate-spin" : ""} />
              </button>
              {settingsOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 glass rounded-2xl shadow-2xl overflow-hidden z-50 drop-in">
                  <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <span className="label text-slate-500">Quick navigation</span>
                  </div>
                  <div className="py-2">
                    {NAV_LINKS.map((l) => (
                      <a key={l.label} href={l.href} onClick={() => setSettingsOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors">
                        <MI name={l.label === "Features" ? "bolt" : l.label === "How it Works" ? "route" : l.label === "Pricing" ? "payments" : l.label === "Live Demo" ? "chat" : "support_agent"}
                          className="text-base flex-shrink-0" style={{ color: "#b4c5ff" }} />
                        {l.label}
                      </a>
                    ))}
                  </div>
                  <div className="px-4 py-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <Link to="/auth" onClick={() => setSettingsOpen(false)}>
                      <button className="w-full btn-cta text-white text-xs font-bold px-4 py-2.5 rounded-xl">Sign In / Dashboard</button>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <Link to="/auth" className="hidden sm:block">
              <button className="btn-cta text-white px-5 py-2.5 rounded-xl text-sm font-bold tracking-tight">
                Start Free
              </button>
            </Link>

            <button onClick={() => setMobileMenuOpen(v => !v)} aria-label="Toggle menu"
              className="md:hidden p-2 rounded-xl text-slate-300 hover:bg-white/6 transition-colors focus:outline-none">
              {mobileMenuOpen ? <MI name="close" className="text-2xl" /> : <MI name="menu" className="text-2xl" />}
            </button>
          </div>
        </div>
      </nav>

      {/* ══ MOBILE MENU ══ */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[99] md:hidden" onClick={closeMobileMenu}>
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
          <div className="absolute top-0 right-0 h-full w-72 border-l flex flex-col menu-panel"
            style={{ background: "#0c0e1e", borderColor: "rgba(255,255,255,0.07)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 h-[68px] border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              <span className="text-sm font-bold uppercase tracking-widest text-white">Menu</span>
              <button onClick={closeMobileMenu} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/6 transition-colors">
                <MI name="close" className="text-xl" />
              </button>
            </div>
            <nav className="flex flex-col px-4 py-4 gap-1 flex-grow">
              {NAV_LINKS.map((l) => (
                <a key={l.label} href={l.href} onClick={closeMobileMenu}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/6 transition-colors">
                  <MI name={l.label === "Features" ? "bolt" : l.label === "How it Works" ? "route" : l.label === "Pricing" ? "payments" : l.label === "Live Demo" ? "chat" : "support_agent"}
                    className="text-lg flex-shrink-0" style={{ color: "#b4c5ff" }} />
                  {l.label}
                </a>
              ))}
            </nav>
            <div className="px-5 py-6 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              <Link to="/auth" onClick={closeMobileMenu}>
                <button className="w-full btn-cta text-white font-bold py-3 rounded-xl text-sm">Start Free — 24hr Trial</button>
              </Link>
              <p className="text-center text-[10px] text-slate-600 mt-3">No credit card · Full access</p>
            </div>
          </div>
        </div>
      )}

      {/* ══ BACKGROUND ══ */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 grid-bg" />
        <div className="orb w-[650px] h-[650px] opacity-[0.14]" style={{ top: "-15%", left: "-8%", background: "#2563eb", animationDuration: "16s" }} />
        <div className="orb w-[550px] h-[550px] opacity-[0.10]" style={{ bottom: "5%", right: "-6%", background: "#7c3aed", animationDuration: "20s", animationDelay: "-7s" }} />
        <div className="orb w-[320px] h-[320px] opacity-[0.07]" style={{ top: "38%", right: "22%", background: "#4cd7f6", animationDuration: "12s", animationDelay: "-3s" }} />
      </div>

      <main className="relative pt-[68px]">

        {/* ══ HERO ══ */}
        <section ref={heroRef} className="relative min-h-[calc(100svh-68px)] flex flex-col items-center justify-center px-4 sm:px-6 py-16 overflow-hidden">
          <div className="max-w-[1320px] w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">

            {/* Left */}
            <div className="z-10 text-center lg:text-left">
              <span className="label inline-block mb-4 px-3 py-1.5 rounded-full text-[10px]"
                style={{ color: "#4cd7f6", background: "rgba(76,215,246,0.08)", border: "1px solid rgba(76,215,246,0.18)" }}>
                24/7 AI Customer Care &amp; Support Agent
              </span>
              <h1 className="text-[2.2rem] sm:text-[3.5rem] md:text-[5rem] lg:text-[5.5rem] xl:text-[6rem] font-black text-white leading-[1.05] tracking-[-0.03em] mb-5 sm:mb-8">
                <span className="word-in block">AI Customer Care,</span>
                <span className="word-in block grad-cyan">That Sells.</span>
              </h1>

              <p className="text-sm sm:text-lg font-normal max-w-[520px] mb-7 sm:mb-11 leading-relaxed mx-auto lg:mx-0"
                style={{ color: "#8b9abf" }}>
                OctaDezx is your always-on AI customer service agent — it answers customer
                questions, resolves support requests and captures orders across WhatsApp,
                Instagram, Facebook and Shopify, 24/7 while you sleep.
              </p>

              {/* CTAs — stacked on mobile, single row on sm+ */}
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center lg:justify-start items-stretch sm:items-center">
                <Link to="/auth" className="w-full sm:w-auto">
                  <button className="btn-cta text-white px-8 py-4 rounded-2xl text-sm sm:text-base font-bold w-full sm:w-auto whitespace-nowrap">
                    Try Free for 24 Hours
                  </button>
                </Link>
                <Link to={DEMO_CHAT_URL} className="w-full sm:w-auto">
                  <button className="btn-ghost text-white px-7 py-4 rounded-2xl text-sm sm:text-base font-bold flex items-center justify-center gap-2 w-full sm:w-auto whitespace-nowrap"
                    style={{ borderColor: "rgba(76,215,246,0.35)", background: "rgba(76,215,246,0.06)" }}>
                    <MI name="chat" style={{ color: "#4cd7f6" }} />
                    <span>Live Demo</span>
                  </button>
                </Link>
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="btn-ghost text-white px-7 py-4 rounded-2xl text-sm sm:text-base font-bold flex items-center justify-center gap-2 w-full sm:w-auto whitespace-nowrap">
                      <MI name="play_circle" style={{ color: "#4cd7f6" }} />
                      <span>See It in Action</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="w-[95vw] sm:max-w-[820px] p-0 overflow-hidden"
                    style={{ background: "#080a12", borderColor: "rgba(255,255,255,0.08)" }}>
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
                <MI name="check_circle" className="text-sm flex-shrink-0" style={{ color: "#4cd7f6" }} />
                No credit card · Full access · Cancel anytime
              </p>
            </div>

            {/* Right — chat widget */}
            <div className="relative hidden lg:flex items-center justify-center h-[580px]">

              {/* Floating badges */}
              <div className="badge-float absolute top-10 left-2 glass px-4 py-3 rounded-2xl flex items-center gap-3 z-20"
                style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.45)" }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(34,197,94,0.15)" }}>
                  <MI name="trending_up" className="text-base" style={{ color: "#22c55e" }} />
                </div>
                <div>
                  <div className="label text-[9px] text-slate-500">Orders today</div>
                  <div className="text-sm font-bold text-white">+248 <span className="text-green-400 text-xs font-semibold">+12%</span></div>
                </div>
              </div>

              <div className="badge-float-2 absolute top-20 right-2 glass px-4 py-3 rounded-2xl flex items-center gap-3 z-20"
                style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.45)" }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(76,215,246,0.12)" }}>
                  <MI name="bolt" className="text-base" style={{ color: "#4cd7f6" }} />
                </div>
                <div>
                  <div className="label text-[9px] text-slate-500">Response time</div>
                  <div className="text-sm font-bold text-white">&lt;1.2s</div>
                </div>
              </div>

              <div className="badge-float-3 absolute bottom-14 right-2 glass px-4 py-3 rounded-2xl flex items-center gap-3 z-20"
                style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.45)" }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(180,197,255,0.12)" }}>
                  <MI name="language" className="text-base" style={{ color: "#b4c5ff" }} />
                </div>
                <div>
                  <div className="label text-[9px] text-slate-500">Languages</div>
                  <div className="text-sm font-bold text-white">50+</div>
                </div>
              </div>

              {/* Main chat window */}
              <div className="chat-win rounded-[2rem] w-full max-w-[400px] h-[490px] flex flex-col relative overflow-hidden"
                style={{ transform: "perspective(1100px) rotateY(-3.5deg) rotateX(1.5deg)" }}>

                {/* Window chrome */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b flex-shrink-0"
                  style={{ borderColor: "rgba(76,215,246,0.1)", background: "rgba(255,255,255,0.02)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "linear-gradient(135deg,#2563eb,#4cd7f6)" }}>
                      <MI name="smart_toy" className="text-sm text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">OctaDezx AI</div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 status-pulse" />
                        <span className="label text-[9px] text-slate-500">Online · Handling 14 chats</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {["bg-red-500/50","bg-yellow-500/50","bg-green-500/50"].map((c,i) => (
                      <span key={i} className={`w-2.5 h-2.5 rounded-full ${c}`} />
                    ))}
                  </div>
                </div>

                {/* Messages */}
                <div ref={chatScrollRef} className="flex-grow px-4 py-4 space-y-3 overflow-y-auto transition-opacity duration-500"
                  style={{ scrollbarWidth: "none" }}>
                  {visibleSteps.map((s, i) => (
                    <div key={i} className={`msg-in flex ${s.sender === "ai" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs font-medium leading-relaxed ${
                        s.sender === "ai" ? "bubble-ai text-white rounded-tr-none" : "bubble-user text-slate-200 rounded-tl-none"
                      }`}>{s.text}</div>
                    </div>
                  ))}
                </div>

                {/* Status bar */}
                <div className="px-4 pb-4 flex-shrink-0">
                  <div className="rounded-xl px-3.5 py-2.5 flex items-center justify-between"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center gap-2">
                      <MI name="shopping_cart" className="text-sm" style={{ color: "#b4c5ff" }} />
                      <span className="text-[10px] text-slate-400 font-medium">{orderName}</span>
                    </div>
                    <span className="label text-[9px] px-2.5 py-0.5 rounded-full font-semibold" style={
                      orderStatus === "idle"       ? { background: "rgba(76,215,246,0.1)",  color: "#4cd7f6"  } :
                      orderStatus === "processing" ? { background: "rgba(234,179,8,0.1)",   color: "#eab308" } :
                                                     { background: "rgba(34,197,94,0.12)",  color: "#22c55e" }
                    }>
                      {orderStatus === "idle" ? "● Listening" : orderStatus === "processing" ? "⟳ Processing" : "✓ Confirmed"}
                    </span>
                  </div>
                </div>

                {/* Bottom glow */}
                <div className="absolute bottom-0 left-0 right-0 h-[2px] transition-all duration-700"
                  style={{ background: successGlow
                    ? "linear-gradient(90deg,transparent,#22c55e,transparent)"
                    : "linear-gradient(90deg,transparent,#4cd7f6,transparent)" }} />
              </div>
            </div>
          </div>

          {/* Mobile chat preview — upgraded with header + status bar */}
          <div className="lg:hidden w-full max-w-sm mx-auto mt-8">
            <div className="chat-win rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
                style={{ borderColor: "rgba(76,215,246,0.1)", background: "rgba(255,255,255,0.02)" }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#2563eb,#4cd7f6)" }}>
                    <MI name="smart_toy" className="text-xs text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">OctaDezx AI</div>
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 status-pulse" />
                      <span className="label text-[9px] text-slate-500">Live</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  {["bg-red-500/40","bg-yellow-500/40","bg-green-500/40"].map((c,i) => (
                    <span key={i} className={`w-2 h-2 rounded-full ${c}`} />
                  ))}
                </div>
              </div>
              {/* Messages */}
              <div className="px-4 py-3 space-y-2.5 max-h-52 overflow-hidden">
                {visibleSteps.slice(-5).map((s, i) => (
                  <div key={i} className={`msg-in flex ${s.sender === "ai" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[82%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                      s.sender === "ai" ? "bubble-ai text-white" : "bubble-user text-slate-200"
                    }`}>{s.text}</div>
                  </div>
                ))}
              </div>
              {/* Status bar */}
              <div className="px-4 pb-3 flex-shrink-0">
                <div className="rounded-lg px-3 py-2 flex items-center justify-between"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center gap-1.5">
                    <MI name="shopping_cart" className="text-xs" style={{ color: "#b4c5ff" }} />
                    <span className="text-[10px] text-slate-400 font-medium">{orderName}</span>
                  </div>
                  <span className="label text-[9px] px-2 py-0.5 rounded-full font-semibold" style={
                    orderStatus === "idle"       ? { background: "rgba(76,215,246,0.1)",  color: "#4cd7f6"  } :
                    orderStatus === "processing" ? { background: "rgba(234,179,8,0.1)",   color: "#eab308" } :
                                                   { background: "rgba(34,197,94,0.12)",  color: "#22c55e" }
                  }>
                    {orderStatus === "idle" ? "● Listening" : orderStatus === "processing" ? "⟳ Processing" : "✓ Confirmed"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Scroll cue */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-35">
            <span className="label text-[9px] text-slate-600">Scroll</span>
            <div className="w-px h-10" style={{ background: "linear-gradient(to bottom,rgba(76,215,246,0.6),transparent)" }} />
          </div>
        </section>



        {/* ══ STATS ══ */}
        <section className="py-10 sm:py-14 px-4 sm:px-6 max-w-[1320px] mx-auto">
          <div className="stagger grid grid-cols-2 lg:grid-cols-4 gap-px"
            style={{ background: "rgba(255,255,255,0.05)", borderRadius: "20px", overflow: "hidden" }}>
            {[
              { value: "24/7",  label: "Always Online",      sub: "Zero downtime, every timezone"  },
              { value: "<10s",  label: "Product Onboarding", sub: "Paste URL, go live instantly"    },
              { value: "50+",   label: "Integrations",       sub: "Every major sales channel"       },
              { value: "99.9%", label: "Uptime SLA",         sub: "Enterprise reliability built in" },
            ].map((s,i) => (
              <div key={i} className="flex flex-col items-center justify-center py-10 px-5 text-center"
                style={{ background: "#080a12" }}>
                <div className="stat-num text-white mb-1.5 cursor-default">{s.value}</div>
                <div className="text-sm font-semibold text-white mb-1">{s.label}</div>
                <div className="label text-[9px] text-slate-600">{s.sub}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="divider max-w-[1320px] mx-auto" />

        {/* ══ FEATURES ══ */}
        <section id="features" className="py-12 sm:py-20 md:py-28 px-4 sm:px-6 max-w-[1320px] mx-auto">
          <div className="text-center mb-10 sm:mb-14 reveal">
            <span className="label text-[10px] mb-4 block" style={{ color: "#b4c5ff" }}>Capabilities</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">Customer care and sales, fully automated</h2>
            <p className="max-w-2xl mx-auto text-base" style={{ color: "#8b9abf" }}>
              One AI platform that handles customer support, answers product questions and closes orders —
              across every channel, running non-stop while you focus on what matters.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">

            {/* Wide card */}
            <div className="sm:col-span-2 bento glass rounded-[2rem] p-7 sm:p-10 relative overflow-hidden reveal-l" style={{ minHeight: 290 }}>
              <div className="bento-glow absolute inset-0 rounded-[2rem]" />
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-5"
                    style={{ background: "rgba(76,215,246,0.1)" }}>
                    <MI name="dynamic_feed" className="text-xl" style={{ color: "#4cd7f6" }} />
                  </div>
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white mb-3 tracking-tight">Autonomous order processing</h3>
                  <p className="text-sm sm:text-base leading-relaxed max-w-md" style={{ color: "#8b9abf" }}>
                    From first message to confirmed shipment — verifies payments, reserves stock, notifies your team, sends branded confirmations. Continuously, in every timezone.
                  </p>
                </div>
                <div className="mt-8 flex flex-wrap gap-2">
                  {["Stock Sync","Auto-Ship","Payments","Refunds"].map((t) => (
                    <span key={t} className="px-3 py-1 rounded-full label text-[10px] text-slate-400"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>{t}</span>
                  ))}
                </div>
              </div>
              <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full opacity-10 pointer-events-none"
                style={{ background: "radial-gradient(circle,#2563eb 0%,transparent 65%)" }} />
            </div>

            {/* Small cards */}
            {[
              { icon: "translate",   color: "#d2bbff", bg: "rgba(210,187,255,0.1)", title: "Speak any language",       desc: "Native-quality responses across 50+ languages, auto-detected per customer.", hover: "group-hover:rotate-12" },
              { icon: "bolt",        color: "#b4c5ff", bg: "rgba(180,197,255,0.1)", title: "Instant, on-brand replies", desc: "Trained on your catalogue, policies and voice — sounds like you, not a bot.", hover: "group-hover:scale-125" },
              { icon: "insights",    color: "#4cd7f6", bg: "rgba(76,215,246,0.1)",  title: "Revenue-grade analytics",  desc: "Conversion, AOV, resolution time and top products — live in one dashboard.", hover: "group-hover:scale-110" },
              { icon: "shield_lock", color: "#d2bbff", bg: "rgba(210,187,255,0.1)", title: "Enterprise security",       desc: "End-to-end encryption, role-based access, GDPR-ready infrastructure.", hover: "group-hover:rotate-6" },
              { icon: "target",      color: "#b4c5ff", bg: "rgba(180,197,255,0.1)", title: "Smart lead scoring",        desc: "High-intent conversations auto-routed to your sales team with full context.", hover: "group-hover:scale-110" },
            ].map((card, i) => (
              <div key={card.title}
                className={`bento rounded-[2rem] p-7 flex flex-col justify-between group ${["reveal-r","reveal","reveal-l","reveal","reveal-r"][i]}`}
                style={{ background: "#0d0f1e", border: "1px solid rgba(255,255,255,0.06)", minHeight: 220 }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: card.bg }}>
                  <MI name={card.icon} className={`text-xl transition-transform duration-300 ${card.hover}`} style={{ color: card.color }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2 tracking-tight">{card.title}</h3>
                  <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "#8b9abf" }}>{card.desc}</p>
                </div>
              </div>
            ))}

            {/* Wide — URL import */}
            <div className="sm:col-span-2 bento glass rounded-[2rem] p-7 sm:p-10 relative overflow-hidden reveal-l" style={{ minHeight: 240 }}>
              <div className="bento-glow absolute inset-0 rounded-[2rem]" />
              <div className="relative z-10 flex flex-col h-full justify-center">
                <span className="label text-[10px] mb-2" style={{ color: "#4cd7f6" }}>One-click import</span>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white mb-3 tracking-tight">Paste a URL. Launch a catalogue.</h3>
                <p className="max-w-lg mb-8 text-sm sm:text-base leading-relaxed" style={{ color: "#8b9abf" }}>
                  Pulls product titles, variants, pricing and media from any storefront in under 10 seconds.
                </p>
                <div className="flex -space-x-2.5">
                  {[{icon:"link",bg:"#1a2336"},{icon:"database",bg:"#1a2030"},{icon:"cloud_upload",bg:"#18223a"},{icon:"verified",bg:"#182870"}].map((b) => (
                    <div key={b.icon} className="w-10 h-10 rounded-full flex items-center justify-center hover:-translate-y-2 transition-transform"
                      style={{ background: b.bg, border: "3px solid #080a12" }}>
                      <MI name={b.icon} className="text-sm text-white" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute top-0 right-0 w-2/5 h-full pointer-events-none"
                style={{ background: "linear-gradient(to left,rgba(76,215,246,0.04),transparent)" }} />
            </div>

          </div>
        </section>

        <div className="divider max-w-[1320px] mx-auto" />

        {/* ══ HOW IT WORKS ══ */}
        <section id="how" className="py-12 sm:py-20 md:py-28 px-4 sm:px-6 max-w-[1100px] mx-auto">
          <div className="text-center mb-10 sm:mb-14 reveal">
            <span className="label text-[10px] mb-4 block" style={{ color: "#4cd7f6" }}>Quick Start</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">Live in under 10 minutes</h2>
            <p className="max-w-xl mx-auto text-base" style={{ color: "#8b9abf" }}>No developers, no integration team. Three steps.</p>
          </div>
          <div className="stagger grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
            {[
              { step: "01", title: "Import your catalogue", desc: "Paste any storefront URL or upload a CSV. Titles, variants, pricing and media structured automatically.", icon: "upload_file" },
              { step: "02", title: "Train your AI",         desc: "Drop in policies, FAQs and brand voice. Adapts to how you answer — not a generic chatbot.",              icon: "psychology"   },
              { step: "03", title: "Connect & go live",     desc: "Plug WhatsApp, Instagram, Facebook or your web widget. Orders start flowing in, 24/7.",                  icon: "rocket_launch" },
            ].map((s) => (
              <div key={s.step} className="step-card rounded-[2rem] p-7 sm:p-8 relative overflow-hidden">
                <div className="flex items-start justify-between mb-6">
                  <span className="text-5xl font-black leading-none select-none" style={{ color: "rgba(255,255,255,0.05)" }}>{s.step}</span>
                  <div className="p-2.5 rounded-xl" style={{ background: "rgba(180,197,255,0.08)" }}>
                    <MI name={s.icon} className="text-xl" style={{ color: "#b4c5ff" }} />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white mb-2.5 tracking-tight">{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#8b9abf" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ══ INTEGRATIONS ══ */}
        <section id="integrations" className="py-12 sm:py-20 relative overflow-hidden"
          style={{ background: "rgba(13,15,28,0.7)" }}>
          <div className="max-w-[1320px] mx-auto px-4 sm:px-6 text-center">
            <span className="label text-[10px] mb-4 block reveal" style={{ color: "#b4c5ff" }}>Everything Connected</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4 tracking-tight reveal">Find customers everywhere</h2>
            <p className="max-w-2xl mx-auto mb-10 sm:mb-14 text-base reveal" style={{ color: "#8b9abf" }}>
              Native integrations across messaging, e-commerce and productivity — synced in real time.
            </p>

            {/* Orbital */}
            <div className="relative h-[460px] items-center justify-center hidden sm:flex reveal-s">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full flex items-center justify-center relative z-20 hover:scale-105 transition-transform"
                style={{ background: "linear-gradient(135deg,#2563eb,#4cd7f6)", boxShadow: "0 0 70px rgba(37,99,235,0.65),0 0 120px rgba(76,215,246,0.2)" }}>
                <MI name="hub" className="text-white" style={{ fontSize: "2.4rem" }} />
              </div>
              <div className="absolute rounded-full" style={{ width: 320, height: 320, border: "1px solid rgba(76,215,246,0.07)", transform: "rotateX(62deg)" }} />
              <div className="absolute rounded-full" style={{ width: 500, height: 500, border: "1px solid rgba(76,215,246,0.04)", transform: "rotateX(62deg)" }} />
              <div className="absolute w-full h-full flex items-center justify-center">
                {INTEGRATIONS.map((it, i) => (
                  <div key={it.name} className="orbit-item glass px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl flex items-center gap-2 cursor-pointer hover:bg-white/10 transition-colors"
                    style={{ ["--rot" as string]: `${it.rot}deg`, animationDelay: `${-i * 3.3}s` } as React.CSSProperties}>
                    <MI name={it.icon} style={{ color: it.color }} />
                    <span className="text-xs font-semibold text-white">{it.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile grid */}
            <div className="grid grid-cols-2 gap-3 sm:hidden mb-8">
              {INTEGRATIONS.map((it) => (
                <div key={it.name} className="glass rounded-2xl px-4 py-3.5 flex items-center gap-3">
                  <MI name={it.icon} className="text-xl flex-shrink-0" style={{ color: it.color }} />
                  <span className="text-sm font-semibold text-white">{it.name}</span>
                </div>
              ))}
            </div>

            <button className="glass text-white px-6 py-3 rounded-xl font-semibold hover:bg-white/8 transition-all inline-flex items-center gap-2 text-sm reveal">
              View all 50+ integrations <MI name="arrow_forward" />
            </button>
          </div>
        </section>

        <div className="divider max-w-[1320px] mx-auto" />

        {/* ══ PRICING ══ */}
        <section id="pricing" className="py-12 sm:py-20 md:py-28 px-4 sm:px-6 max-w-[1100px] mx-auto">
          <div className="text-center mb-10 sm:mb-14 reveal">
            <span className="label text-[10px] mb-4 block" style={{ color: "#4cd7f6" }}>Simple Pricing</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">Plans for every stage</h2>
            <p className="text-slate-500 max-w-xl mx-auto text-base">Start free for 24 hours. No credit card required.</p>
          </div>

          <div className="stagger grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 items-start">

            <div className="glass rounded-[2rem] p-7 sm:p-9 flex flex-col hover:-translate-y-2 transition-transform duration-300">
              <div className="mb-7">
                <div className="label text-slate-500 mb-2">Starter</div>
                <div className="text-4xl font-black text-white tracking-tight">$9<span className="text-lg text-slate-600 font-medium">/mo</span></div>
                <p className="text-sm text-slate-400 mt-2">Small businesses, boutiques, and startups.</p>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                {["300 unique customers / day","Essential automation tools","Core integrations","Email support"].map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-slate-400">
                    <MI name="check_circle" className="text-sm mt-0.5 flex-shrink-0" style={{ color: "#4cd7f6" }} />{f}
                  </li>
                ))}
              </ul>
              <Link to="/auth">
                <button className="w-full py-3.5 rounded-xl glass text-white font-bold hover:bg-white/8 transition-all text-sm">Get Started</button>
              </Link>
            </div>

            <div className="relative group md:-mt-6">
              <div className="absolute -inset-[1px] rounded-[2rem] opacity-50 blur-sm"
                style={{ background: "linear-gradient(135deg,#2563eb,#4cd7f6)" }} />
              <div className="relative pricing-pro rounded-[2rem] p-7 sm:p-9 flex flex-col overflow-hidden">
                <div className="absolute top-0 right-6 px-3 py-1 label text-[9px] text-white rounded-b-xl"
                  style={{ background: "linear-gradient(135deg,#2563eb,#4cd7f6)" }}>Most Popular</div>
                <div className="mb-7">
                  <div className="label mb-2" style={{ color: "#4cd7f6" }}>Pro Business</div>
                  <div className="text-4xl font-black text-white tracking-tight">$29<span className="text-lg text-slate-500 font-medium">/mo</span></div>
                  <p className="text-sm text-slate-300 mt-2">Growing businesses and marketing agencies.</p>
                </div>
                <ul className="space-y-3 mb-8 flex-grow">
                  {["1,000 unique customers / day","Whitelabel branding","Priority processing","Advanced analytics & reporting"].map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm text-white">
                      <MI name="check_circle" className="text-sm mt-0.5 flex-shrink-0" style={{ color: "#4cd7f6" }} />{f}
                    </li>
                  ))}
                </ul>
                <Link to="/auth">
                  <button className="w-full py-3.5 rounded-xl btn-cta text-white font-bold text-sm">Launch Pro</button>
                </Link>
              </div>
            </div>

            <div className="glass rounded-[2rem] p-7 sm:p-9 flex flex-col hover:-translate-y-2 transition-transform duration-300">
              <div className="mb-7">
                <div className="label text-slate-500 mb-2">Enterprise</div>
                <div className="text-4xl font-black text-white tracking-tight">$99<span className="text-lg text-slate-600 font-medium">/mo</span></div>
                <p className="text-sm text-slate-400 mt-2">Large-scale operations and expanding platforms.</p>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                {["Unlimited daily customers","100,000 messages / month","Dedicated success manager","Priority SLA & onboarding"].map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-slate-400">
                    <MI name="check_circle" className="text-sm mt-0.5 flex-shrink-0" style={{ color: "#d2bbff" }} />{f}
                  </li>
                ))}
              </ul>
              <Link to="/auth">
                <button className="w-full py-3.5 rounded-xl glass text-white font-bold hover:bg-white/8 transition-all text-sm">Contact Sales</button>
              </Link>
            </div>
          </div>

          <p className="text-center text-sm text-slate-500 mt-9 flex items-center justify-center gap-2">
            <MI name="check_circle" className="text-sm flex-shrink-0" style={{ color: "#22c55e" }} />
            All plans include a 24-hour free trial — no credit card required
          </p>
        </section>

        {/* ══ LIVE DEMO ══ */}
        <section id="demo" className="py-12 sm:py-20 md:py-28 px-4 sm:px-6 max-w-[1100px] mx-auto">
          <div className="text-center mb-12 sm:mb-16 reveal">
            <span className="label text-[10px] mb-4 flex items-center justify-center gap-2" style={{ color: "#22c55e" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 status-pulse inline-block" />
              Live &amp; Working — No Account Needed
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
              Try it yourself, right now
            </h2>
            <p className="max-w-xl mx-auto text-base" style={{ color: "#8b9abf" }}>
              Chat with <strong className="text-white">Merrell</strong> — a real premium leather shoe store powered by OctaDezx.
              Ask about products, prices, or place an order. It all works.
            </p>
          </div>

          <div className="reveal-s max-w-[700px] mx-auto">
            {/* Demo card */}
            <div className="relative rounded-[2rem] overflow-hidden"
              style={{ background: "rgba(10,12,22,0.96)", border: "1px solid rgba(76,215,246,0.2)", boxShadow: "0 0 60px rgba(37,99,235,0.15), 0 32px 80px rgba(0,0,0,0.6)" }}>

              {/* Chat header */}
              <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
                style={{ borderColor: "rgba(76,215,246,0.1)", background: "rgba(255,255,255,0.02)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>M</div>
                  <div>
                    <div className="text-sm font-semibold text-white">Merrell</div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 status-pulse" />
                      <span className="label text-[9px] text-slate-500">Online · AI-powered by OctaDezx</span>
                    </div>
                  </div>
                </div>
                <span className="label text-[9px] px-2.5 py-1 rounded-full" style={{ background: "rgba(76,215,246,0.08)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.15)" }}>
                  Premium Leather Shoes
                </span>
              </div>

              {/* Preview messages */}
              <div className="px-5 py-5 space-y-3 pointer-events-none select-none"
                style={{ background: "rgba(8,10,18,0.7)" }}>
                {[
                  { sender: "ai",       text: "Hello! 👋 Welcome to Merrell — your destination for premium leather shoes. How can I help you today?" },
                  { sender: "customer", text: "Do you have leather loafers for men?" },
                  { sender: "ai",       text: "Yes! We carry several premium leather loafers. Our best seller is the Merrell Classic Oxford in full-grain leather, available in sizes 7–13. Would you like to see the collection with prices? 👞" },
                  { sender: "customer", text: "Sure, what's the price range?" },
                  { sender: "ai",       text: "Our loafers range from $89 to $199 depending on the leather grade. Free shipping on orders over $100. Want me to show you specific styles?" },
                ].map((m, i) => (
                  <div key={i} className={`flex ${m.sender === "customer" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed font-medium ${
                      m.sender === "customer"
                        ? "text-white rounded-br-sm"
                        : "text-white rounded-bl-sm"
                    }`} style={m.sender === "customer"
                      ? { background: "linear-gradient(135deg,#2563eb,#1d4ed8)", boxShadow: "0 4px 16px rgba(37,99,235,0.35)" }
                      : { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.09)" }
                    }>{m.text}</div>
                  </div>
                ))}
                {/* Typing hint */}
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1 items-center"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.09)" }}>
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>

              {/* CTA overlay */}
              <div className="relative px-5 pb-5 pt-2" style={{ background: "rgba(8,10,18,0.95)" }}>
                <div className="absolute top-0 left-0 right-0 h-12 pointer-events-none"
                  style={{ background: "linear-gradient(to bottom, rgba(8,10,18,0), rgba(8,10,18,0.95))", marginTop: "-48px" }} />
                <Link to={DEMO_CHAT_URL}>
                  <button className="w-full btn-cta text-white py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5">
                    <MI name="chat" className="text-xl" />
                    Start Chatting with Merrell →
                  </button>
                </Link>
                <p className="text-center text-xs text-slate-600 mt-3">
                  No sign-up · Anonymous · Fully functional AI assistant
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
                <span key={t.text} className="flex items-center gap-1.5 text-xs" style={{ color: "#8b9abf" }}>
                  <MI name={t.icon} className="text-sm flex-shrink-0" style={{ color: "#4cd7f6" }} />
                  {t.text}
                </span>
              ))}
            </div>
          </div>
        </section>

        <div className="divider max-w-[1320px] mx-auto" />

        {/* ══ FAQ ══ */}
        <section id="faq" className="py-12 sm:py-20 md:py-28 px-4 sm:px-6 max-w-[900px] mx-auto">
          <div className="text-center mb-10 sm:mb-14 reveal">
            <span className="label text-[10px] mb-4 block" style={{ color: "#b4c5ff" }}>FAQ</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">AI customer care questions, answered</h2>
            <p className="max-w-xl mx-auto text-base" style={{ color: "#8b9abf" }}>
              Everything you need to know about running customer support and sales on OctaDezx.
            </p>
          </div>
          <div className="stagger grid sm:grid-cols-2 gap-4 sm:gap-5">
            {[
              { q: "What is OctaDezx?", a: "OctaDezx is an AI customer care platform that gives your business an always-on AI agent to answer customer questions, resolve support requests and capture orders 24/7 across WhatsApp, Instagram, Facebook, Shopify and more." },
              { q: "Can OctaDezx replace a customer care agent?", a: "It works as a 24/7 AI customer service agent that instantly answers FAQs, handles product and order questions and resolves common support requests — then escalates to your human team with full context when a conversation needs a person." },
              { q: "Which channels does the AI customer service agent cover?", a: "WhatsApp, Instagram, Facebook, Shopify and your website widget out of the box, plus 50+ integrations — all answered from one place in your customers' own language." },
              { q: "Does it take orders, not just answer questions?", a: "Yes. Beyond support, OctaDezx confirms and places orders for you. Every price and total is verified on our servers against your catalogue, so customers are always charged the correct amount." },
              { q: "How fast can I go live?", a: "Under 10 minutes — paste a storefront URL to import your catalogue, add your policies and FAQs, connect a channel, and your AI customer care agent is live." },
              { q: "Is there a free trial?", a: "Yes — a 24-hour free trial with full access to every feature. No credit card required." },
            ].map((f) => (
              <div key={f.q} className="glass rounded-2xl p-6">
                <h3 className="text-base font-bold text-white mb-2 tracking-tight">{f.q}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#8b9abf" }}>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="divider max-w-[1320px] mx-auto" />

        {/* ══ CTA ══ */}
        <section className="py-12 sm:py-20 md:py-28 relative overflow-hidden px-4 sm:px-6">
          <div className="max-w-[900px] mx-auto reveal-s">
            <div className="cta-card relative rounded-[2.5rem] p-8 sm:p-14 md:p-20 text-center overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full opacity-20 pointer-events-none"
                style={{ background: "radial-gradient(circle,#2563eb,transparent 65%)", filter: "blur(50px)" }} />
              <div className="absolute bottom-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
                style={{ background: "radial-gradient(circle,#7c3aed,transparent 65%)", filter: "blur(40px)" }} />
              <div className="relative z-10">
                <span className="label text-[10px] mb-5 block" style={{ color: "#4cd7f6" }}>Get Started Today</span>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4 sm:mb-6 tracking-tight">Ready to automate?</h2>
                <p className="mb-9 sm:mb-11 text-base sm:text-lg" style={{ color: "#8b9abf" }}>
                  Put your customer care and sales on autopilot with OctaDezx — answer every
                  customer and capture every order, 24/7.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                  <input type="email" placeholder="Enter your work email"
                    value={ctaEmail}
                    onChange={(e) => setCtaEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCtaStart(); }}
                    aria-label="Work email"
                    className="rounded-2xl px-5 py-4 w-full sm:w-80 text-white placeholder-slate-600 focus:outline-none focus:ring-2 border text-sm"
                    style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)", focusRingColor: "#4cd7f6" } as React.CSSProperties} />
                  <button onClick={handleCtaStart} className="btn-cta px-9 py-4 rounded-2xl font-bold text-white w-full sm:w-auto sm:flex-shrink-0 text-sm">Start Now →</button>
                </div>
                <p className="text-sm text-slate-600 mt-6 flex items-center justify-center gap-2">
                  <MI name="lock" className="text-sm" /> Secure · GDPR compliant · Cancel anytime
                </p>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ══ FOOTER ══ */}
      <footer id="contact" className="w-full py-14 px-4 sm:px-6 md:px-12 border-t"
        style={{ background: "#06080f", borderColor: "rgba(255,255,255,0.05)" }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 max-w-[1320px] mx-auto">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 mb-5 group w-fit">
              <div className="relative">
                <div className="absolute inset-0 rounded-lg blur-md opacity-30 group-hover:opacity-60 transition-opacity bg-blue-600" />
                <LogoIcon size="md" className="relative" />
              </div>
              <span className="text-base font-bold tracking-[0.07em] uppercase text-white">OctaDezx</span>
            </Link>
            <p className="text-slate-600 label text-[10px] leading-relaxed">
              © {new Date().getFullYear()} OctaDezx.<br className="hidden sm:block" /> Making shop life easier.
            </p>
            <p className="text-slate-700 label text-[9px] mt-2">Secure &amp; GDPR Compliant</p>
            <div className="flex items-center gap-2.5 mt-5">
              <a href="https://www.facebook.com/profile.php?id=61586165043647" target="_blank" rel="noopener noreferrer" aria-label="Facebook"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 hover:text-white hover:bg-blue-600/30 transition-all"
                style={{ background: "rgba(255,255,255,0.03)" }}><FacebookSVG /></a>
              <a href="https://www.instagram.com/octadezx_" target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 hover:text-pink-300 hover:bg-pink-600/20 transition-all"
                style={{ background: "rgba(255,255,255,0.03)" }}><InstagramSVG /></a>
              <a href="mailto:kevin@octadezx.com" aria-label="Email"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 hover:text-red-300 hover:bg-red-500/20 transition-all"
                style={{ background: "rgba(255,255,255,0.03)" }}><MailSVG /></a>
            </div>
          </div>

          <div>
            <h4 className="text-white text-xs font-bold mb-5 uppercase tracking-[0.14em]">Product</h4>
            <ul className="space-y-3.5">
              {[{label:"Core Features",href:"#features"},{label:"Integrations",href:"#integrations"},{label:"Pricing",href:"#pricing"}].map((l) => (
                <li key={l.label}><a href={l.href} className="label text-[11px] text-slate-600 hover:text-slate-300 transition-colors">{l.label}</a></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white text-xs font-bold mb-5 uppercase tracking-[0.14em]">Community</h4>
            <ul className="space-y-3.5">
              <li><a href="mailto:kevin@octadezx.com" className="label text-[11px] text-slate-600 hover:text-slate-300 transition-colors">Help Center</a></li>
              <li><a href="#faq" className="label text-[11px] text-slate-600 hover:text-slate-300 transition-colors">FAQ</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white text-xs font-bold mb-5 uppercase tracking-[0.14em]">Legal</h4>
            <ul className="space-y-3.5">
              <li><Link to="/privacy" className="label text-[11px] text-slate-600 hover:text-slate-300 transition-colors">Privacy Policy</Link></li>
              {/* TODO: replace with dedicated /terms and /cookies pages once written; routed to privacy for now so links aren't dead */}
              <li><Link to="/privacy" className="label text-[11px] text-slate-600 hover:text-slate-300 transition-colors">Terms of Service</Link></li>
              <li><Link to="/privacy" className="label text-[11px] text-slate-600 hover:text-slate-300 transition-colors">Cookie Policy</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
