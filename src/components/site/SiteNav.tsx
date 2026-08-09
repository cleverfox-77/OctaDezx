import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { LogoIcon } from "@/components/ui/Logo";
import { MI, DEMO_CHAT_URL } from "./MaterialIcon";
import { MEGA_MENU } from "./siteData";

// Shared marketing header: Zendesk-style mega-menu on desktop, a grouped
// full-height menu on mobile. Used by the home page and every sub-page.
const SiteNav = ({ transparentAtTop = false }: { transparentAtTop?: boolean }) => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.pageYOffset > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Always close (and unlock scroll) when the route changes, so a navigation
  // can never leave the drawer open or the body scroll-locked.
  useEffect(() => { setOpen(false); }, [pathname]);

  const close = () => setOpen(false);
  const solid = scrolled || !transparentAtTop;

  const isActive = (entry: (typeof MEGA_MENU)[number]) => {
    const base = (entry.to ?? entry.groups?.[0]?.items?.[0]?.to ?? "").split("#")[0];
    if (entry.label === "Resources") return pathname.startsWith("/resources") || pathname.startsWith("/customers");
    if (entry.label === "About Us")
      return ["/about", "/careers", "/affiliates", "/blog"].some((p) => pathname.startsWith(p));
    return base && pathname === base;
  };

  return (
    <>
      <nav className={`fixed top-0 left-0 w-full z-[100] transition-all duration-300 ${solid ? "border-b backdrop-blur-2xl" : "border-b border-transparent"}`}
        style={solid
          ? { background: "rgba(255,255,255,0.85)", borderColor: "#e8eaee", boxShadow: "0 1px 3px rgba(16,24,40,0.04)" }
          : { background: "transparent" }}>
        <div className="flex items-center justify-between px-4 sm:px-6 md:px-10 h-[68px] max-w-[1440px] mx-auto">

          <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
            <div className="relative">
              <div className="absolute inset-0 rounded-lg blur-md opacity-50 group-hover:opacity-80 transition-opacity" style={{ background: "#000047" }} />
              <LogoIcon size="md" className="relative" />
            </div>
            <span className="text-[15px] font-bold tracking-[0.07em] uppercase text-slate-900">OctaDezx</span>
          </Link>

          {/* desktop mega-menu (lg and up: five entries need the room) */}
          <div className="hidden lg:flex items-center gap-0.5">
            {MEGA_MENU.map((m) => (
              m.groups ? (
                <div key={m.label} className="relative group">
                  <button className={`nav-link px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 inline-flex items-center gap-1 group-hover:text-slate-900 group-hover:bg-slate-100 ${isActive(m) ? "active text-slate-900" : "text-slate-600"}`}>
                    {m.label}
                    <MI name="expand_more" className="text-[18px] transition-transform duration-200 group-hover:rotate-180" />
                  </button>
                  <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-200 z-50">
                    <div className="rounded-2xl p-3 grid gap-x-3 drop-in"
                      style={{ background: "#ffffff", border: "1px solid #e8eaee", boxShadow: "0 20px 50px rgba(16,24,40,0.16)", gridTemplateColumns: `repeat(${m.groups.length}, minmax(230px, 1fr))` }}>
                      {m.groups.map((g) => (
                        <div key={g.heading}>
                          <div className="label text-[9px] px-3 mt-1 mb-1" style={{ color: "#98a2b3" }}>{g.heading}</div>
                          {g.items.map((it) => (
                            <Link key={it.label} to={it.to}
                              className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,0,71,0.07)" }}>
                                <MI name={it.icon} className="text-lg" style={{ color: "#000047" }} />
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-slate-900 leading-tight">{it.label}</div>
                                <div className="text-xs text-slate-500 leading-snug mt-0.5">{it.desc}</div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <Link key={m.label} to={m.to!}
                  className={`nav-link px-3.5 py-2 rounded-xl text-sm font-medium hover:text-slate-900 hover:bg-slate-100 transition-all duration-200 ${isActive(m) ? "active text-slate-900" : "text-slate-600"}`}>
                  {m.label}
                </Link>
              )
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link to="/auth" className="hidden sm:inline-flex text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors px-3 py-2">
              Sign in
            </Link>
            <Link to="/auth" className="hidden sm:block">
              <button className="btn-cta text-white px-5 py-2.5 rounded-xl text-sm font-bold tracking-tight">Start Free</button>
            </Link>
            <button onClick={() => setOpen((v) => !v)} aria-label="Toggle menu"
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none">
              <MI name={open ? "close" : "menu"} className="text-2xl" />
            </button>
          </div>
        </div>
      </nav>

      {/* mobile menu: portalled to <body> so it escapes the `perspective`
          on .octa-landing (index.css), which otherwise makes this fixed overlay
          size to the whole PAGE height instead of the viewport, so the panel
          runs off-screen and its scroll area never actually scrolls. Outside
          that stacking context, `fixed` + 100dvh resolve against the viewport,
          the inner list scrolls, and it sits above the nav. */}
      {open && createPortal(
        <div className="mobile-menu-portal">
        <div className="fixed left-0 right-0 top-0 z-[200] lg:hidden" style={{ height: "100dvh" }} onClick={close}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div className="absolute top-0 right-0 h-full w-full sm:w-[380px] sm:max-w-[90%] sm:border-l flex flex-col menu-panel"
            style={{ background: "#ffffff", borderColor: "#e8eaee" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 h-[68px] border-b flex-shrink-0" style={{ borderColor: "#e8eaee" }}>
              <Link to="/" onClick={close} className="flex items-center gap-2.5">
                <LogoIcon size="sm" />
                <span className="text-sm font-bold tracking-[0.07em] uppercase text-slate-900">OctaDezx</span>
              </Link>
              <button onClick={close} aria-label="Close menu" className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors">
                <MI name="close" className="text-xl" />
              </button>
            </div>
            <div className="flex-grow overflow-y-auto px-4 py-5 space-y-6"
              style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
              {MEGA_MENU.map((m) => (
                m.groups ? (
                  <div key={m.label}>
                    <div className="label text-[9px] px-2 mb-2" style={{ color: "#98a2b3" }}>{m.label}</div>
                    <div className="space-y-0.5">
                      {m.groups.flatMap((g) => g.items).map((it) => (
                        <Link key={it.label + it.to} to={it.to} onClick={close}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,0,71,0.07)" }}>
                            <MI name={it.icon} className="text-base" style={{ color: "#000047" }} />
                          </div>
                          <span className="text-sm font-medium text-slate-800">{it.label}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Link key={m.label} to={m.to!} onClick={close}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,0,71,0.07)" }}>
                      <MI name="payments" className="text-base" style={{ color: "#000047" }} />
                    </div>
                    <span className="text-sm font-semibold text-slate-900">{m.label}</span>
                  </Link>
                )
              ))}
            </div>
            <div className="px-5 py-5 border-t flex-shrink-0 space-y-2.5" style={{ borderColor: "#e8eaee" }}>
              <Link to="/auth" onClick={close} className="block">
                <button className="w-full btn-cta text-white font-bold py-3.5 rounded-xl text-sm">Start free for 24 hours</button>
              </Link>
              <Link to={DEMO_CHAT_URL} onClick={close} className="block">
                <button className="w-full btn-ghost font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2">
                  <MI name="chat" style={{ color: "#000047" }} /> Try the live demo
                </button>
              </Link>
              <Link to="/auth" onClick={close} className="block text-center pt-1">
                <span className="text-xs font-semibold text-slate-500">Already have an account? <span className="text-slate-900">Sign in</span></span>
              </Link>
            </div>
          </div>
        </div>
        </div>,
        document.body,
      )}
    </>
  );
};

export default SiteNav;
