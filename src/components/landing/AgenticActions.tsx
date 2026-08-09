import { Link } from "react-router-dom";
import { MI } from "@/components/site/MaterialIcon";

/**
 * The agentic positioning section.
 *
 * Every line here describes something the product actually does today. The point
 * of the section is the distinction between replying and acting, so each card
 * names a real action and how it is filed, not a capability in the abstract.
 *
 *   full   → the nine action cards plus the comparison (home page)
 *   strip  → the comparison plus a single row of verbs (platform page), so the
 *            two pages never carry the same paragraphs twice.
 */

const ACTIONS = [
  {
    icon: "shopping_bag",
    title: "Places the order",
    desc: "It takes the order inside the conversation and files it. Every line price and the total are recalculated on our servers from your own catalogue, so the total is never whatever the chat happened to say.",
  },
  {
    icon: "event_available",
    title: "Books the appointment",
    desc: "It collects the name, the service and the time, confirms them back, then files the booking and emails you. It does the same thing on a live phone call.",
  },
  {
    icon: "call",
    title: "Answers the phone",
    desc: "Give it a number and it holds a real conversation, interruptions and all. Out of hours it can take a voicemail, transfer to a person or end the call politely, your choice.",
  },
  {
    icon: "phone_forwarded",
    title: "Calls people back",
    desc: "Outbound calling dials only inside the window you set, in the other person's own local time, and stops the moment somebody asks it to. It is switched off until you turn it on.",
  },
  {
    icon: "reviews",
    title: "Replies to comments",
    desc: "When someone comments on your Facebook or Instagram post it answers under the post, or privately in their messages, or both, using the same knowledge it uses in chat.",
  },
  {
    icon: "image_search",
    title: "Reads photos and voice notes",
    desc: "A customer can send a picture instead of describing something, or record a voice note instead of typing. Both are answered in the same thread.",
  },
  {
    icon: "person_add",
    title: "Follows up the lead",
    desc: "Every customer who shares a name or a contact becomes a lead. Your follow-up playbook is written in plain English and the AI applies it in the conversation, not in a cold email.",
  },
  {
    icon: "support_agent",
    title: "Hands over to a human",
    desc: "When it cannot help, or the customer asks for a person, it stops and escalates with the whole conversation attached rather than guessing an answer.",
  },
  {
    icon: "smart_toy",
    title: "Takes orders from Claude",
    desc: "OctaDezx exposes your business as tools at octadezx.com/mcp, so Claude can list who is waiting, reply, check orders, book appointments and update products in plain language.",
  },
];

const COMPARE = [
  { chatbot: "Answers the question", agent: "Answers, then does the thing" },
  { chatbot: "Leaves you a transcript", agent: "Leaves you a filed order, booking or lead" },
  { chatbot: "Hands the work back to your desk", agent: "Hands you a decision, not a task" },
];

const Compare = () => (
  <div className="grid sm:grid-cols-2 gap-4 sm:gap-5 mb-10 sm:mb-14">
    <div className="rounded-[2rem] p-6 sm:p-8" style={{ background: "#f2f4f7", border: "1px solid #e8eaee" }}>
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(15,23,42,0.06)" }}>
          <MI name="chat_bubble" className="text-base" style={{ color: "#98a2b3" }} />
        </div>
        <span className="label text-[10px]" style={{ color: "#98a2b3" }}>A chatbot</span>
      </div>
      <ul className="space-y-3">
        {COMPARE.map((c) => (
          <li key={c.chatbot} className="flex items-start gap-2.5 text-sm" style={{ color: "#98a2b3" }}>
            <MI name="remove" className="text-base flex-shrink-0 mt-[1px]" />
            {c.chatbot}
          </li>
        ))}
      </ul>
    </div>
    <div className="rounded-[2rem] p-6 sm:p-8" style={{ background: "#ffffff", border: "1px solid rgba(0,0,71,0.18)", boxShadow: "0 2px 6px rgba(16,24,40,0.05), 0 20px 44px rgba(0,0,71,0.10)" }}>
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,0,71,0.08)" }}>
          <MI name="bolt" className="text-base" style={{ color: "#000047" }} />
        </div>
        <span className="label text-[10px]" style={{ color: "#000047" }}>An agent</span>
      </div>
      <ul className="space-y-3">
        {COMPARE.map((c) => (
          <li key={c.agent} className="flex items-start gap-2.5 text-sm font-medium text-slate-700">
            <MI name="check_circle" className="text-base flex-shrink-0 mt-[1px]" style={{ color: "#16a34a" }} />
            {c.agent}
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const AgenticActions = ({ variant = "full" }: { variant?: "full" | "strip" }) => (
  <section id="agentic" className="py-12 sm:py-20 md:py-28 px-4 sm:px-6 max-w-[1440px] mx-auto" style={{ scrollMarginTop: "88px" }}>
    <div className="text-center mb-10 sm:mb-14 reveal">
      <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>Agentic AI</span>
      <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">
        It does not just reply. It acts.
      </h2>
      <p className="max-w-2xl mx-auto text-base" style={{ color: "#667085" }}>
        The difference between a chatbot and an agent is what is on your desk in the morning.
        A chatbot leaves you a conversation to read. OctaDezx leaves you a booking in the diary,
        an order in the system and a lead with the whole thread attached.
      </p>
    </div>

    <div className="reveal-s">
      <Compare />
    </div>

    {variant === "full" ? (
      <div className="stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {ACTIONS.map((a) => (
          <div key={a.title} className="bento rounded-[2rem] p-6 sm:p-7 group" style={{ background: "#ffffff", border: "1px solid #e8eaee" }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(0,0,71,0.08)" }}>
              <MI name={a.icon} className="text-xl transition-transform duration-300 group-hover:scale-110" style={{ color: "#000047" }} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2 tracking-tight">{a.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>{a.desc}</p>
          </div>
        ))}
      </div>
    ) : (
      <div className="stagger flex flex-wrap justify-center gap-2 sm:gap-2.5">
        {ACTIONS.map((a) => (
          <span key={a.title} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold text-slate-700"
            style={{ background: "#ffffff", border: "1px solid #e8eaee" }}>
            <MI name={a.icon} className="text-base" style={{ color: "#000047" }} />
            {a.title}
          </span>
        ))}
      </div>
    )}

    {variant === "full" && (
      <p className="text-center text-sm mt-9" style={{ color: "#667085" }}>
        Every action above runs on the same trained AI.{" "}
        <Link to="/solutions" className="font-bold" style={{ color: "#000047" }}>See what it does for your kind of business</Link>.
      </p>
    )}
  </section>
);

export default AgenticActions;
