import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MI } from "./MaterialIcon";

// The bold closing CTA reused at the bottom of every marketing page.
const CtaSection = ({
  eyebrow = "Get started today",
  title = "Ready to automate?",
  sub = "Put your customer care and sales on autopilot with OctaDezx. Answer every customer and capture every order, 24/7.",
}: { eyebrow?: string; title?: string; sub?: string }) => {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();
  const start = () => {
    const e = email.trim();
    if (e) localStorage.setItem("octadezx_signup_email", e);
    navigate(e ? `/auth?email=${encodeURIComponent(e)}` : "/auth");
  };

  return (
    <section className="py-12 sm:py-20 md:py-28 relative overflow-hidden px-4 sm:px-6">
      <div className="max-w-[900px] mx-auto reveal-s">
        <div className="cta-card relative rounded-[2.5rem] p-8 sm:p-14 md:p-20 text-center overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full opacity-20 pointer-events-none"
            style={{ background: "radial-gradient(circle,#ffffff,transparent 65%)", filter: "blur(50px)" }} />
          <div className="relative z-10">
            <span className="label text-[10px] mb-5 block" style={{ color: "rgba(255,255,255,0.8)" }}>{eyebrow}</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4 sm:mb-6 tracking-tight">{title}</h2>
            <p className="mb-9 sm:mb-11 text-base sm:text-lg" style={{ color: "rgba(255,255,255,0.88)" }}>{sub}</p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <input type="email" placeholder="Enter your work email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") start(); }}
                aria-label="Work email"
                className="rounded-2xl px-5 py-4 w-full sm:w-80 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40 border text-sm"
                style={{ background: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.25)" }} />
              <button onClick={start} className="px-9 py-4 rounded-2xl font-bold w-full sm:w-auto sm:flex-shrink-0 text-sm transition-transform hover:-translate-y-0.5"
                style={{ background: "#ffffff", color: "#000047" }}>Start Now →</button>
            </div>
            <p className="text-sm mt-6 flex items-center justify-center gap-2" style={{ color: "rgba(255,255,255,0.75)" }}>
              <MI name="lock" className="text-sm" /> Secure, GDPR compliant, cancel anytime
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CtaSection;
