import { Link } from "react-router-dom";
import { MI } from "@/components/site/MaterialIcon";

/**
 * The phone agent, described exactly as it is built.
 *
 * Voice was the biggest thing OctaDezx shipped and it had no section on the
 * marketing site at all: the only mention anywhere was one line in an FAQ.
 *
 * Everything claimed below is implemented. The call runs on a real carrier
 * number through a media server that streams audio both ways, so the caller can
 * cut in mid sentence and the assistant stops; the transcript is written into
 * the same conversation history as the chats; appointments and orders taken on
 * the phone land in the dashboard as requests for the owner to confirm. What is
 * deliberately NOT claimed: that it books a slot into a calendar by itself,
 * that it can text a caller who has never messaged the business, or a latency
 * figure we have not measured in production.
 */

const CAPABILITIES = [
  {
    icon: "record_voice_over",
    title: "You can interrupt it",
    desc: "It listens while it talks. Cut in halfway through and it stops, the same way a person would, instead of finishing its sentence at you.",
  },
  {
    icon: "inventory_2",
    title: "It knows what you sell",
    desc: "The same catalogue, prices, policies and opening hours the chat uses. It is not a separate script that goes stale the day you change a price.",
  },
  {
    icon: "event_available",
    title: "It takes bookings and orders",
    desc: "A caller can book a slot or place an order on the phone. It arrives in your dashboard as a request, waiting for you to confirm it.",
  },
  {
    icon: "support_agent",
    title: "It knows when to stop trying",
    desc: "Ask for a person, or ask something it genuinely cannot answer, and it hands over or takes a message rather than guessing.",
  },
  {
    icon: "voicemail",
    title: "Voicemail you can actually read",
    desc: "Out of hours it takes a message and transcribes it, so the morning starts with text rather than a list of things to listen to.",
  },
  {
    icon: "outgoing_mail",
    title: "It calls out too",
    desc: "Appointment reminders and follow-ups, dialled on a schedule, with an opt out spoken in the opener on every single one.",
  },
];

const VoiceSection = ({ id = "voice" }: { id?: string }) => (
  <section id={id} className="py-12 sm:py-20 md:py-28 px-4 sm:px-6" style={{ scrollMarginTop: "68px" }}>
    <div className="max-w-[1440px] mx-auto">

      <div className="text-center mb-10 sm:mb-14 reveal">
        <span className="label text-[10px] mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{ color: "#000047", background: "rgba(0,0,71,0.08)", border: "1px solid rgba(0,0,71,0.18)" }}>
          <MI name="call" className="text-sm" /> AI phone calls
        </span>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">
          It answers the phone
        </h2>
        <p className="max-w-2xl mx-auto text-base" style={{ color: "#667085" }}>
          Not a menu. Not "press 1 for opening hours". A real number that a real person rings,
          answered by something that talks back, listens while it is talking, and knows what
          you sell.
        </p>
      </div>

      <div className="reveal-s rounded-[2rem] overflow-hidden mb-8 sm:mb-12 max-h-[420px]"
        style={{ border: "1px solid #e0e3e9", boxShadow: "0 2px 6px rgba(16,24,40,0.06), 0 24px 60px rgba(16,24,40,0.12)" }}>
        <img
          src="/media/feature-voice.webp"
          alt="A shop owner standing in her doorway at dusk, taking a call"
          width={1280}
          height={964}
          loading="lazy"
          decoding="async"
          className="w-full block object-cover"
          style={{ maxHeight: 420, objectPosition: "center 35%" }}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center mb-10 sm:mb-14">

        {/* A call, as it actually goes */}
        <div className="reveal-l rounded-[2rem] p-5 sm:p-7"
          style={{ background: "#ffffff", border: "1px solid #e8eaee", boxShadow: "0 2px 6px rgba(16,24,40,0.06), 0 24px 60px rgba(16,24,40,0.10)" }}>
          <div className="flex items-center gap-2.5 mb-5 pb-4" style={{ borderBottom: "1px solid #f0f1f4" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: "#16a34a" }} />
            <span className="label text-[9px]" style={{ color: "#98a2b3" }}>Incoming call, 0:00</span>
            <span className="ml-auto text-[11px] font-medium" style={{ color: "#98a2b3" }}>Live transcript</span>
          </div>

          <div className="space-y-3.5">
            {[
              { who: "ai", text: "Good afternoon, Merrell Footwear, this is the automated assistant. How can I help?" },
              { who: "caller", text: "Yeah hi, do you have the tan Chelsea boots in a nine?" },
              { who: "ai", text: "We do, the Oxford Chelsea in tan, one forty nine. Nine is in stock. Would you like me to put a pair aside?" },
              { who: "caller", text: "Actually wait, what time do you..." },
              { who: "ai", text: "We close at six today, and we are open ten to four on Sunday.", note: "cut in at 0:31, stopped mid sentence" },
              { who: "caller", text: "Perfect. Can you hold them under Wathan?" },
              { who: "ai", text: "Held under Wathan until close tomorrow. Anything else?", note: "logged in the dashboard for you to confirm" },
            ].map((t, i) => (
              <div key={i}>
                <div className={`flex ${t.who === "caller" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed ${
                    t.who === "caller"
                      ? "rounded-2xl rounded-br-md font-medium text-white"
                      : "rounded-2xl rounded-bl-md text-slate-800"}`}
                    style={t.who === "caller"
                      ? { background: "linear-gradient(135deg,#000047,#1d4ed8)" }
                      : { background: "#f7f8fa", border: "1px solid #e8eaee" }}>
                    {t.text}
                  </div>
                </div>
                {t.note && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-[11px]" style={{ color: "#98a2b3" }}>
                    <MI name="bolt" className="text-xs" />
                    <span className="mono">{t.note}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <ul className="reveal-r grid sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-5 sm:gap-6">
          {CAPABILITIES.map((c) => (
            <li key={c.title} className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,0,71,0.08)" }}>
                <MI name={c.icon} className="text-lg" style={{ color: "#000047" }} />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm sm:text-base mb-1">{c.title}</div>
                <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>{c.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Why it does not feel like a robot, and what it will not do */}
      <div className="stagger grid lg:grid-cols-3 gap-4 sm:gap-5">
        <div className="rounded-[2rem] p-6 sm:p-7" style={{ background: "#ffffff", border: "1px solid #e8eaee" }}>
          <div className="flex items-center gap-2.5 mb-3">
            <MI name="graphic_eq" className="text-lg" style={{ color: "#000047" }} />
            <span className="font-bold text-slate-900 text-sm">Why it does not lag</span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>
            Audio is streamed both ways and paced out at the exact rate the phone
            network plays it, so the assistant never runs ahead of the caller. That is
            what makes interrupting work: it always knows precisely how much of its
            answer you have actually heard.
          </p>
        </div>

        <div className="rounded-[2rem] p-6 sm:p-7" style={{ background: "#ffffff", border: "1px solid #e8eaee" }}>
          <div className="flex items-center gap-2.5 mb-3">
            <MI name="history_edu" className="text-lg" style={{ color: "#000047" }} />
            <span className="font-bold text-slate-900 text-sm">Every call, in writing</span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>
            The transcript lands in the same conversation history as your WhatsApp
            and Instagram threads. If the caller had messaged you on WhatsApp within
            the last day, it can send them a link or the details afterwards.
          </p>
        </div>

        <div className="rounded-[2rem] p-6 sm:p-7" style={{ background: "#ffffff", border: "1px solid #e8eaee" }}>
          <div className="flex items-center gap-2.5 mb-3">
            <MI name="verified_user" className="text-lg" style={{ color: "#000047" }} />
            <span className="font-bold text-slate-900 text-sm">It says what it is</span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>
            You can name it and set its tone, but it will never claim to be a person.
            Asked twice, it says plainly that it is an automated assistant. You can
            change the wording, not the fact.
          </p>
        </div>
      </div>

      <p className="text-center text-sm mt-8" style={{ color: "#667085" }}>
        Phone calls are on every paid plan.{" "}
        <Link to="/pricing" className="font-bold" style={{ color: "#000047" }}>See the minutes each one includes</Link>.
      </p>
    </div>
  </section>
);

export default VoiceSection;
