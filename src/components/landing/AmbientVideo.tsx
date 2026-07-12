import { useEffect, useRef } from "react";

/* Decorative autoplay loop that behaves: nothing downloads until the element
   nears the viewport, playback pauses the moment it scrolls away, and
   reduced-motion users get the poster image instead of any video at all. */
const AmbientVideo = ({
  src,
  poster,
  className = "",
  label,
}: {
  src: string;
  poster: string;
  className?: string;
  label?: string;
}) => {
  const ref = useRef<HTMLVideoElement>(null);
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!el.src) el.src = src; // first approach: attach source
          el.play().catch(() => {}); // autoplay can be blocked; poster remains
        } else {
          el.pause();
        }
      },
      { rootMargin: "200px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src, reduced]);

  if (reduced) {
    return <img src={poster} alt={label ?? ""} loading="lazy" className={className} />;
  }

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload="none"
      poster={poster}
      aria-label={label}
      className={className}
    />
  );
};

export default AmbientVideo;
