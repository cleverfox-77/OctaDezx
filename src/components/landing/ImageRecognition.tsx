import { Link } from "react-router-dom";
import { MI, DEMO_CHAT_URL } from "@/components/site/MaterialIcon";

/**
 * Image recognition, described exactly as it is implemented.
 *
 * The customer attaches a photo in the chat, the file is fetched server-side
 * behind an SSRF guard (image content types only, 8MB cap) and passed to the
 * model as inline image data alongside the business's own catalogue. The model
 * is instructed to describe what it sees, match it to the catalogue, show the
 * match with price and details, and say honestly when the business does not
 * sell that thing. Nothing here claims more than that.
 */

const POINTS = [
  {
    icon: "photo_camera",
    title: "They send the picture, not the words",
    desc: "Nobody knows the model name of the tap under their sink or the dress they screenshotted. They know what it looks like. Attaching a photo in the chat is one tap.",
  },
  {
    icon: "visibility",
    title: "It describes what it can see",
    desc: "The photo goes to the AI along with your catalogue, and it starts by saying what is actually in the picture, so the customer knows they were understood.",
  },
  {
    icon: "inventory_2",
    title: "It matches it against your catalogue",
    desc: "If the thing in the photo is something you sell, it shows that product with the price and the details, right there in the conversation.",
  },
  {
    icon: "verified",
    title: "It admits when you do not sell it",
    desc: "This is the part most demos skip. If it is not in your catalogue the AI says so plainly and offers the closest thing you do have, instead of inventing a product you have never stocked.",
  },
];

/**
 * The picture the customer actually sent, shown as it arrives in the thread.
 *
 * This used to be a grey chip reading "photo-2481.jpg", which asked the reader
 * to imagine the one thing the whole section is about. Showing the photo is the
 * proof: you can see what the AI saw and judge its answer against it.
 */
const SentPhoto = ({ src, alt }: { src: string; alt: string }) => (
  <div className="rounded-2xl rounded-br-md overflow-hidden mb-1.5 w-[150px] sm:w-[180px] ml-auto"
    style={{ border: "1px solid #e8eaee", background: "#f2f4f7" }}>
    <img src={src} alt={alt} width={640} height={640}
      loading="lazy" decoding="async" className="w-full block aspect-square object-cover" />
  </div>
);

const ImageRecognition = () => (
  <section id="vision" className="py-12 sm:py-20 md:py-28 px-4 sm:px-6" style={{ background: "#ebedf1", scrollMarginTop: "68px" }}>
    <div className="max-w-[1440px] mx-auto">

      <div className="text-center mb-10 sm:mb-14 reveal">
        <span className="label text-[10px] mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{ color: "#7c3aed", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.22)" }}>
          <MI name="image_search" className="text-sm" /> Image recognition
        </span>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">
          A customer can just send a photo
        </h2>
        <p className="max-w-2xl mx-auto text-base" style={{ color: "#667085" }}>
          The hardest question in any shop is the one that starts with "the thing that looks like this".
          Your AI can see the picture, tell the customer what it is looking at, and check it against
          what you actually sell.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center mb-8 sm:mb-12">
        <div className="reveal-l rounded-[2rem] overflow-hidden"
          style={{ border: "1px solid #e0e3e9", boxShadow: "0 2px 6px rgba(16,24,40,0.06), 0 24px 60px rgba(16,24,40,0.12)" }}>
          <img
            src="/media/feature-vision.webp"
            alt="A customer photographing a pair of shoes on a shop shelf with a phone, to send the picture into chat"
            width={1280}
            height={853}
            loading="lazy"
            decoding="async"
            className="w-full block"
          />
        </div>

        <ul className="reveal-r space-y-5 sm:space-y-6">
          {POINTS.map((p) => (
            <li key={p.title} className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,0,71,0.08)" }}>
                <MI name={p.icon} className="text-lg" style={{ color: "#000047" }} />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm sm:text-base mb-1">{p.title}</div>
                <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>{p.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* The two outcomes, side by side. The honest miss matters as much as the hit. */}
      <div className="stagger grid lg:grid-cols-2 gap-4 sm:gap-5">

        <div className="rounded-[2rem] p-5 sm:p-7" style={{ background: "#ffffff", border: "1px solid #e8eaee" }}>
          <div className="flex items-center gap-2 mb-5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#16a34a" }} />
            <span className="label text-[9px]" style={{ color: "#98a2b3" }}>When you do sell it</span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-end">
              <div className="max-w-[85%]">
                <SentPhoto
                  src="/media/vision-sent-boot.webp"
                  alt="Photo a customer sent in chat: a tan leather Chelsea boot on a shop shelf"
                />
                <div className="px-3.5 py-2.5 rounded-2xl rounded-br-md text-xs sm:text-sm font-medium text-white"
                  style={{ background: "linear-gradient(135deg,#000047,#1d4ed8)" }}>
                  Do you have this one?
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px]" style={{ color: "#98a2b3" }}>
              <MI name="visibility" className="text-xs" />
              <span className="mono">reading the image</span>
            </div>
            <div className="flex justify-start">
              <div className="max-w-[90%] px-3.5 py-3 rounded-2xl rounded-bl-md text-xs sm:text-sm leading-relaxed text-slate-800"
                style={{ background: "#f7f8fa", border: "1px solid #e8eaee" }}>
                That is a tan leather Chelsea boot with elastic side panels. We carry it: the{" "}
                <strong className="text-slate-900">Oxford Chelsea in tan</strong>, $149, sizes 7 to 13.
                Want me to check your size?
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] p-5 sm:p-7" style={{ background: "#ffffff", border: "1px solid #e8eaee" }}>
          <div className="flex items-center gap-2 mb-5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#d97706" }} />
            <span className="label text-[9px]" style={{ color: "#98a2b3" }}>When you do not</span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-end">
              <div className="max-w-[85%]">
                <SentPhoto
                  src="/media/vision-sent-trainer.webp"
                  alt="Photo a customer sent in chat: a grey knitted running trainer on a wooden floor"
                />
                <div className="px-3.5 py-2.5 rounded-2xl rounded-br-md text-xs sm:text-sm font-medium text-white"
                  style={{ background: "linear-gradient(135deg,#000047,#1d4ed8)" }}>
                  And this one?
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px]" style={{ color: "#98a2b3" }}>
              <MI name="visibility" className="text-xs" />
              <span className="mono">reading the image</span>
            </div>
            <div className="flex justify-start">
              <div className="max-w-[90%] px-3.5 py-3 rounded-2xl rounded-bl-md text-xs sm:text-sm leading-relaxed text-slate-800"
                style={{ background: "#f7f8fa", border: "1px solid #e8eaee" }}>
                That looks like a knitted running trainer. We do not carry running shoes, we are
                leather footwear only. The closest thing we have is the{" "}
                <strong className="text-slate-900">Suede Derby</strong> if you want something lighter.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scope and safety, stated plainly rather than implied. */}
      <div className="mt-8 sm:mt-10 rounded-[2rem] p-6 sm:p-8 grid sm:grid-cols-3 gap-6 reveal-s"
        style={{ background: "#ffffff", border: "1px solid #e8eaee" }}>
        {[
          { icon: "chat", title: "Where it works", desc: "In the OctaDezx chat: your website widget and the shareable chat link you can send any customer." },
          { icon: "mic", title: "Voice notes too", desc: "On WhatsApp, Messenger, Instagram and Telegram a recorded voice note is transcribed and answered in the same thread." },
          { icon: "shield_lock", title: "Handled safely", desc: "Images are fetched over public web addresses only, capped at 8MB, and anything that is not really an image is refused." },
        ].map((s) => (
          <div key={s.title}>
            <div className="flex items-center gap-2.5 mb-2">
              <MI name={s.icon} className="text-lg" style={{ color: "#000047" }} />
              <span className="font-bold text-slate-900 text-sm">{s.title}</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "#667085" }}>{s.desc}</p>
          </div>
        ))}
      </div>

      <p className="text-center text-sm mt-8" style={{ color: "#667085" }}>
        <Link to={DEMO_CHAT_URL} className="font-bold" style={{ color: "#000047" }}>Open the live demo</Link>
        {" "}and send it a photo of a shoe. No signup, nothing to install.
      </p>
    </div>
  </section>
);

export default ImageRecognition;
