import { useEffect } from "react";

// Adds `.visible` to any `.reveal*`/`.stagger` element as it scrolls into view.
// Shared by every marketing page so the entrance animations work everywhere.
// `dep` lets a page re-run the observer after its content changes.
//
// Three layers, because any single one has a failure mode that leaves content
// stuck at opacity 0:
//   1. A SYNCHRONOUS initial sweep on mount reveals whatever is already in or
//      above the viewport. This must not be deferred to a frame: on a fresh
//      page load (or client-side navigation) the hero is above the fold and has
//      to be visible immediately, even if the first animation frame is delayed.
//   2. IntersectionObserver reveals elements as they enter the viewport.
//   3. A scroll listener re-sweeps, catching elements that jump from below the
//      viewport to above it in one step (fast wheel, hash link, restored
//      scroll), which IntersectionObserver never reports as intersecting.
export function useScrollReveal(dep?: unknown) {
  useEffect(() => {
    const pending = new Set(
      document.querySelectorAll<HTMLElement>(".reveal,.reveal-l,.reveal-r,.reveal-s,.stagger"),
    );

    const show = (el: Element) => {
      el.classList.add("visible");
      pending.delete(el as HTMLElement);
      obs.unobserve(el);
    };

    // Reveal anything whose top has reached the bottom of the viewport.
    const sweep = () => {
      pending.forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight) show(el);
      });
      if (!pending.size) window.removeEventListener("scroll", onScroll);
    };

    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; sweep(); });
    };

    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && show(e.target)),
      { threshold: 0.1, rootMargin: "0px 0px -36px 0px" },
    );
    pending.forEach((el) => obs.observe(el));

    window.addEventListener("scroll", onScroll, { passive: true });
    sweep(); // synchronous: above-the-fold content shows without waiting for a frame

    return () => {
      obs.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [dep]);
}
