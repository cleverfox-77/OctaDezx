import { useRef, type ReactNode, type MouseEvent } from "react";

/* Magnetic hover + click ripple wrapper for primary CTAs.
   Pointer-fine only; the transform is tiny (max ~5px) so it reads as
   responsiveness, not gimmick. Ripple ink is appended per-click and
   self-removes after its animation. */
export const Magnetic = ({
  children,
  strength = 0.18,
  className = "",
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const fine = typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!fine || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * strength;
    const y = (e.clientY - r.top - r.height / 2) * strength;
    ref.current.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  };

  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const btn = (e.target as HTMLElement).closest("button, a");
    if (!btn || !(btn instanceof HTMLElement)) return;
    btn.classList.add("btn-ripple");
    const r = btn.getBoundingClientRect();
    const size = Math.max(r.width, r.height);
    const ink = document.createElement("span");
    ink.className = "ripple";
    ink.style.width = ink.style.height = `${size}px`;
    ink.style.left = `${e.clientX - r.left - size / 2}px`;
    ink.style.top = `${e.clientY - r.top - size / 2}px`;
    btn.appendChild(ink);
    setTimeout(() => ink.remove(), 600);
  };

  return (
    <div
      ref={ref}
      className={`magnetic inline-block transition-transform duration-200 ease-out ${className}`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClickCapture={onClick}
    >
      {children}
    </div>
  );
};

export default Magnetic;
