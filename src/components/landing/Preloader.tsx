import { useEffect, useState } from "react";
import { LogoIcon } from "@/components/ui/Logo";

/* Branded first-load curtain. Shows once per browser session, stays under a
   second, and never blocks interaction after fade-out (visibility: hidden). */
const SESSION_KEY = "octadezx_preloaded";

export const Preloader = () => {
  const [show] = useState(() => {
    if (typeof window === "undefined") return false;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return !sessionStorage.getItem(SESSION_KEY);
  });
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!show) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    const t = setTimeout(() => setDone(true), 950);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;

  return (
    <div className={`preloader ${done ? "done" : ""}`} aria-hidden="true">
      <div className="preloader-logo">
        <LogoIcon size="xl" />
      </div>
      <span className="preloader-word">OctaDezx</span>
      <div className="preloader-bar"><span /></div>
    </div>
  );
};

export default Preloader;
