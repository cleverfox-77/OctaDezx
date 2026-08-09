import { Link } from "react-router-dom";
import { MI } from "@/components/site/MaterialIcon";

/**
 * "What it actually does for a business like mine", broken down per type.
 *
 * Two rules held this copy honest:
 *  1. Every action listed is something the platform does today, and the same
 *     action appears under several types because it genuinely is one AI.
 *  2. No invented statistics. The efficiency line for each type describes the
 *     shape of the work that changes, which is derivable from an always-on
 *     agent that files what it captures, rather than a measured percentage
 *     nobody ever measured.
 *
 * The dashboard line is not marketing. Those are the real section names a
 * business of that type sees after signup, driven by src/lib/businessTypes.ts,
 * which is why a restaurant reads "Menu" where a store reads "Products".
 *
 * Everything renders as static markup on purpose. Tabs would hide eleven of the
 * twelve breakdowns from anything reading the page without running JavaScript,
 * and being readable is the entire point of this section.
 */

type Breakdown = {
  id: string;
  icon: string;
  label: string;
  lead: string;
  asks: string[];
  acts: string[];
  gain: string;
  dash: string[];
};

// Deliberately not led by e-commerce. The order runs services first, because
// that is the reading the site has to correct.
export const BREAKDOWNS: Breakdown[] = [
  {
    id: "restaurants",
    icon: "restaurant",
    label: "Restaurants and cafes",
    lead: "Menus, food orders and tables, answered while the kitchen is full.",
    asks: ["Are you still open?", "Is the biryani available tonight?", "Table for six on Friday at eight?"],
    acts: [
      "Answers from the menu you uploaded, prices included",
      "Takes the food order in chat and files it with a server-checked total",
      "Books the table around the hours and services you set, then emails you",
      "Replies to the comment under your weekend special, publicly or in their messages",
    ],
    gain: "Nobody puts down a tray to answer a message. The enquiry that arrives at 23:40 is answered at 23:40, and the booking is in your dashboard before the shift ends.",
    dash: ["Menu", "Orders and Reservations", "Appointments"],
  },
  {
    id: "clinics",
    icon: "stethoscope",
    label: "Clinics and healthcare",
    lead: "Services, hours and appointment requests, with clinical questions left to people.",
    asks: ["Do you do root canals?", "What time do you close on Saturday?", "Can I get in this week?"],
    acts: [
      "Answers service, hours and fee questions from what you wrote",
      "Collects the name, the service and the time, then files the appointment request",
      "Refuses to give medical advice or a diagnosis and hands those straight to your team",
      "Takes the same booking over the phone if you give it a number",
    ],
    gain: "Reception stops repeating the same three answers all day, and requests still arrive overnight. The rule about never giving medical advice is written into the AI's instructions, not left to whoever set it up.",
    dash: ["Services", "Appointments", "Escalated / Patients"],
  },
  {
    id: "agencies",
    icon: "work",
    label: "Agencies and professional services",
    lead: "Enquiries qualified and captured before they go cold.",
    asks: ["Do you do brand identity?", "Roughly what does a site like this cost?", "Can we talk this week?"],
    acts: [
      "Explains your services and how you price, in your own words",
      "Qualifies the enquiry and captures the name and contact as a lead",
      "Books the intro call inside the conversation",
      "Re-engages the quiet ones later, following the playbook you wrote in plain English",
    ],
    gain: "A Sunday night enquiry gets qualified on Sunday night, with the whole thread attached, instead of turning into a Monday morning message asking for more details.",
    dash: ["Services", "Leads and Follow-ups", "Escalated / Leads"],
  },
  {
    id: "realestate",
    icon: "home_work",
    label: "Real estate",
    lead: "Listing questions and viewings, handled at the hour people actually browse.",
    asks: ["Is the two bed still available?", "Which areas do you cover?", "Can I view it on Saturday?"],
    acts: [
      "Answers from your listings, service areas and viewing process",
      "Collects requirements and budget, and files the person as a lead",
      "Books the viewing around the hours you set",
      "Passes the enquiry to the right agent with the full conversation attached",
    ],
    gain: "Portal enquiries land at midnight and go cold by breakfast. Answering the first question inside a minute is most of the job.",
    dash: ["Listings", "Appointments", "Escalated / Viewings"],
  },
  {
    id: "local",
    icon: "content_cut",
    label: "Salons, workshops and local services",
    lead: "Quotes and bookings taken while both your hands are busy.",
    asks: ["How much for a full colour?", "Do you have anything at six?", "Do you cover my area?"],
    acts: [
      "Quotes from your service list and prices",
      "Books the slot around your opening hours and the services you offer",
      "Files the booking and emails you the details",
      "Answers the Instagram comment asking for your price list",
    ],
    gain: "The message that used to sit unread until closing is answered on arrival. You stop losing the booking to whoever replied first.",
    dash: ["Catalog", "Appointments", "Leads and Follow-ups"],
  },
  {
    id: "education",
    icon: "school",
    label: "Education and training",
    lead: "Programmes, fees and admissions, in the applicant's own language.",
    asks: ["When is the next intake?", "What is the fee for the evening batch?", "What do I need to apply?"],
    acts: [
      "Explains programmes, fees and intake dates from your own text",
      "Walks an applicant through the admission steps one question at a time",
      "Captures the prospective student as a lead with contact details",
      "Answers in whatever language the applicant writes in, which matters when you recruit abroad",
    ],
    gain: "Admissions questions arrive in bursts around intake dates. The AI takes the whole burst at once instead of your team taking it one message at a time.",
    dash: ["Programs", "Leads and Follow-ups", "Knowledge Base"],
  },
  {
    id: "saas",
    icon: "cloud",
    label: "SaaS and software",
    lead: "Plan questions and first-line support, without pulling engineers in.",
    asks: ["What is the difference between Pro and Starter?", "Does it do single sign-on?", "Can I get a demo?"],
    acts: [
      "Answers plan and feature questions from your pricing and docs",
      "Troubleshoots from the knowledge base you uploaded",
      "Books the demo inside the conversation",
      "Escalates a real bug to a human with the whole transcript attached",
    ],
    gain: "Tier one questions stop reaching engineers, and the ones that should reach them arrive with the steps already written down instead of as a one-line ticket.",
    dash: ["Plans", "Knowledge Base", "Escalated Chats"],
  },
  {
    id: "retail",
    icon: "store",
    label: "Retail stores",
    lead: "Stock, location and hours, answered before somebody drives over.",
    asks: ["Do you have this in a 42?", "Where are you and are you open now?", "Do you take cards?"],
    acts: [
      "Checks the item against your catalogue, including from a photo the customer sends",
      "Gives location, opening hours and payment methods",
      "Books a slot if you take appointments, so the visit is planned",
      "Takes the order in chat when you would rather sell than hold stock",
    ],
    gain: "The do-you-have-it question decides whether somebody makes the trip. Answering it in seconds, from a photo, is the difference between a visit and a scroll.",
    dash: ["Catalog", "Orders", "Appointments"],
  },
  {
    id: "travel",
    icon: "flight",
    label: "Hotels, travel and tourism",
    lead: "Packages, availability and booking terms, across every timezone you sell into.",
    asks: ["What is in the four night package?", "Anything over the holiday week?", "What is the cancellation policy?"],
    acts: [
      "Answers from your packages, prices and cancellation terms",
      "Collects traveller details and files the booking request",
      "Hands your team a confirmation with everything already gathered",
      "Answers in the traveller's own language, whichever market they are in",
    ],
    gain: "Your best enquiries arrive from timezones where the office is shut. That is precisely when the agent is working.",
    dash: ["Packages", "Bookings", "Appointments"],
  },
  {
    id: "finance",
    icon: "account_balance",
    label: "Finance and insurance",
    lead: "Process and eligibility explained, regulated advice left to licensed people.",
    asks: ["What documents do I need?", "Am I eligible?", "How long does approval take?"],
    acts: [
      "Explains services, eligibility and required documents, and nothing beyond that",
      "Never gives personalised financial, investment or tax advice, by instruction",
      "Collects the enquiry and hands it to a licensed team member",
      "Books the consultation slot before handing over",
    ],
    gain: "The endless which-documents-do-I-need traffic disappears from your inbox, and every conversation that has to reach a licensed human still reaches one.",
    dash: ["Services", "Appointments", "Escalated Chats"],
  },
  {
    id: "ecommerce",
    icon: "storefront",
    label: "E-commerce and online stores",
    lead: "Pre-purchase questions, orders and fulfilment in one thread.",
    asks: ["Is this still in stock?", "Where is my order?", "Can I return it?"],
    acts: [
      "Answers from the catalogue you imported by pasting your storefront address",
      "Identifies a product from a photo a customer sends and shows the match",
      "Places the order in chat, with every price recalculated on our servers",
      "Generates the invoice and tracks the shipment from the same dashboard",
    ],
    gain: "Questions get answered at the moment of intent rather than the next morning, and the order is captured in the same conversation instead of a separate checkout the customer has to find.",
    dash: ["Products", "Orders", "Shipments", "Invoices"],
  },
  {
    id: "enterprise",
    icon: "domain",
    label: "Enterprise and multi-department teams",
    lead: "Routing done right on the first message.",
    asks: ["Who handles billing?", "What is happening with my ticket?", "Can I speak to someone?"],
    acts: [
      "Works out which department the customer needs and answers from approved information only",
      "Routes to the right team with the whole conversation attached",
      "Holds to the escalation path and support hours you defined",
      "Exposes the operation to Claude over MCP, so a manager can ask about it in plain language",
    ],
    gain: "Bad routing is the expensive part. Getting it right on the first message removes the transfer, the repeated explanation and the wait behind both.",
    dash: ["Catalog", "Escalated Chats", "Analytics", "Connect to Claude"],
  },
];

// Which of the twelve the compact home page version shows: services, software
// and commerce, in that order, so the page never reads as a store-only product.
const COMPACT_IDS = ["restaurants", "clinics", "agencies", "local", "saas", "ecommerce"];

// The gains that are true no matter what the business sells.
const UNIVERSAL = [
  { icon: "schedule", title: "It answers at 3am", desc: "There is no queue, no shift and no out-of-office. The first reply lands whenever the message does." },
  { icon: "translate", title: "It answers in their language", desc: "It replies in whatever language the customer writes in, including mixed writing like Banglish or Hinglish." },
  { icon: "repeat", title: "It answers the 400th time as well as the first", desc: "The same tired question gets the same accurate answer, from your policies rather than from memory." },
  { icon: "front_hand", title: "It only interrupts you when it should", desc: "If it cannot help, it stops and hands the conversation over with the full context, instead of guessing." },
];

const PHOTOS = [
  { src: "/media/biz-restaurant.webp", label: "Restaurants", alt: "Owner behind the counter of a small bistro in the evening" },
  { src: "/media/biz-clinic.webp", label: "Clinics", alt: "Receptionist at the front desk of a bright modern clinic" },
  { src: "/media/biz-salon.webp", label: "Salons", alt: "Stylist working with a client in a small modern salon" },
  { src: "/media/biz-realestate.webp", label: "Real estate", alt: "Estate agent holding a phone in the doorway of an empty apartment" },
  { src: "/media/biz-workshop.webp", label: "Workshops", alt: "Mechanic working beside a car on a lift in a clean auto workshop" },
];

const PhotoBand = () => (
  <div className="stagger grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-10 sm:mb-14">
    {PHOTOS.map((p, i) => (
      <figure key={p.src}
        className={`relative rounded-2xl overflow-hidden ${i === PHOTOS.length - 1 ? "col-span-2 sm:col-span-1" : ""}`}
        style={{ border: "1px solid #e0e3e9" }}>
        <img src={p.src} alt={p.alt} width={1280} height={853} loading="lazy" decoding="async"
          className="w-full h-full object-cover aspect-[3/2]" />
        <figcaption className="absolute inset-x-0 bottom-0 px-3 py-2.5"
          style={{ background: "linear-gradient(to top, rgba(2,6,23,0.72), transparent)" }}>
          <span className="label text-[9px] text-white">{p.label}</span>
        </figcaption>
      </figure>
    ))}
  </div>
);

const FullCard = ({ b }: { b: Breakdown }) => (
  <article id={b.id} className="rounded-[2rem] p-6 sm:p-8" style={{ background: "#ffffff", border: "1px solid #e8eaee", scrollMarginTop: "88px" }}>
    <div className="flex items-start gap-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,0,71,0.08)" }}>
        <MI name={b.icon} className="text-xl" style={{ color: "#000047" }} />
      </div>
      <div>
        <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight mb-1">{b.label}</h3>
        <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>{b.lead}</p>
      </div>
    </div>

    <div className="grid md:grid-cols-3 gap-6 sm:gap-8 mt-6 pt-6" style={{ borderTop: "1px solid #eef0f3" }}>
      <div>
        <div className="label text-[9px] mb-3" style={{ color: "#98a2b3" }}>What they ask</div>
        <ul className="space-y-2">
          {b.asks.map((a) => (
            <li key={a} className="text-sm leading-relaxed italic" style={{ color: "#667085" }}>"{a}"</li>
          ))}
        </ul>
      </div>

      <div>
        <div className="label text-[9px] mb-3" style={{ color: "#000047" }}>What the agent does</div>
        <ul className="space-y-2.5">
          {b.acts.map((a) => (
            <li key={a} className="flex items-start gap-2 text-sm leading-relaxed text-slate-700">
              <MI name="check_circle" className="text-base flex-shrink-0 mt-[1px]" style={{ color: "#16a34a" }} />
              {a}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="label text-[9px] mb-3" style={{ color: "#7c3aed" }}>What changes</div>
        <p className="text-sm leading-relaxed mb-4" style={{ color: "#667085" }}>{b.gain}</p>
        <div className="label text-[8px] mb-2" style={{ color: "#98a2b3" }}>Your dashboard shows</div>
        <div className="flex flex-wrap gap-1.5">
          {b.dash.map((d) => (
            <span key={d} className="px-2.5 py-1 rounded-full text-[10px] font-semibold text-slate-600"
              style={{ background: "#f2f4f7", border: "1px solid #e8eaee" }}>{d}</span>
          ))}
        </div>
      </div>
    </div>
  </article>
);

const CompactCard = ({ b }: { b: Breakdown }) => (
  <div className="glass rounded-[2rem] p-6 sm:p-7 flex flex-col">
    <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(0,0,71,0.08)" }}>
      <MI name={b.icon} className="text-xl" style={{ color: "#000047" }} />
    </div>
    <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-2 tracking-tight">{b.label}</h3>
    <p className="text-sm leading-relaxed mb-4" style={{ color: "#667085" }}>{b.lead}</p>
    <div className="mt-auto pt-4" style={{ borderTop: "1px solid #e8eaee" }}>
      <div className="label text-[9px] mb-2" style={{ color: "#7c3aed" }}>What changes</div>
      <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>{b.gain}</p>
    </div>
  </div>
);

const BusinessBreakdown = ({ variant = "full" }: { variant?: "full" | "compact" }) => {
  const items = variant === "compact"
    ? COMPACT_IDS.map((id) => BREAKDOWNS.find((b) => b.id === id)!).filter(Boolean)
    : BREAKDOWNS;

  return (
    <section id="every-business" className="py-12 sm:py-20 md:py-28 px-4 sm:px-6 max-w-[1440px] mx-auto" style={{ scrollMarginTop: "88px" }}>
      <div className="text-center mb-10 sm:mb-14 reveal">
        <span className="label text-[10px] mb-4 block" style={{ color: "#000047" }}>Every business, broken down</span>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">
          What it actually does for a business like yours
        </h2>
        <p className="max-w-2xl mx-auto text-base" style={{ color: "#667085" }}>
          One AI, shaped by the kind of business you run. Below is the honest version for each:
          what your customers ask, what the agent does about it, and what changes on your side.
        </p>
      </div>

      <PhotoBand />

      {/* The four gains that hold for everyone, before the type-specific detail. */}
      <div className="stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10 sm:mb-14">
        {UNIVERSAL.map((u) => (
          <div key={u.title} className="rounded-2xl p-5 sm:p-6" style={{ background: "#ffffff", border: "1px solid #e8eaee" }}>
            <MI name={u.icon} className="text-xl mb-3 block" style={{ color: "#000047" }} />
            <div className="font-bold text-slate-900 text-sm mb-1.5">{u.title}</div>
            <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>{u.desc}</p>
          </div>
        ))}
      </div>

      {variant === "compact" ? (
        <>
          <div className="stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {items.map((b) => <CompactCard key={b.id} b={b} />)}
          </div>
          <p className="text-center text-sm mt-9" style={{ color: "#667085" }}>
            Six of twelve.{" "}
            <Link to="/solutions#every-business" className="font-bold" style={{ color: "#000047" }}>
              See the full breakdown for all twelve business types
            </Link>
            , including retail, education, travel, finance, real estate and enterprise.
          </p>
        </>
      ) : (
        <>
          <div className="stagger space-y-4 sm:space-y-5">
            {items.map((b) => <FullCard key={b.id} b={b} />)}
          </div>
          <p className="text-center text-sm mt-9" style={{ color: "#667085" }}>
            Not on the list? Pick "Other" during setup and describe the business in your own words.
            The AI is trained from what you write, not from a template.
          </p>
        </>
      )}
    </section>
  );
};

export default BusinessBreakdown;
