import { useEffect, useRef, useState } from "react";

/* Counts a stat up from 0 the first time it scrolls into view.
   Accepts display strings like "24/7", "<10s", "50+", "99.9%": the first
   number animates, everything around it is preserved verbatim. */
export const useCountUp = (display: string, durationMs = 1400) => {
  const ref = useRef<HTMLElement | null>(null);
  const [text, setText] = useState(display);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setText(display);
      return;
    }

    const m = display.match(/(\d+(?:\.\d+)?)/);
    if (!m || m.index === undefined) { setText(display); return; }
    const target = parseFloat(m[1]);
    const decimals = m[1].includes(".") ? m[1].split(".")[1].length : 0;
    const prefix = display.slice(0, m.index);
    const suffix = display.slice(m.index + m[1].length);

    setText(`${prefix}${(0).toFixed(decimals)}${suffix}`);

    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / durationMs);
          const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
          setText(`${prefix}${(target * eased).toFixed(decimals)}${suffix}`);
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [display, durationMs]);

  return { ref, text };
};

export default useCountUp;
