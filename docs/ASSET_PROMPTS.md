# OctaDezx — AI Asset Generation Prompts

Ready-to-paste prompts for **Nano Banana** (images) and **Veo** (video).
Brand constants to keep every asset on-system:

- **Deep navy:** `#000047` (primary) · **Indigo:** `#4F46E5` · **Violet:** `#7C3AED`
- **Surfaces:** white `#FFFFFF`, cool grey `#F4F5F7`
- **Type feel:** Inter (bold geometric sans) + Instrument Serif italic accents
- **Logo:** navy octagon containing a white chat bubble
- **Tone:** calm, precise, enterprise-trustworthy — *never* neon, glitchy or "crypto"

---

## 1 · Hero / landing imagery (Nano Banana)

### 1a. Hero product shot (replaces/augments the CSS chat widget)
> A pristine 3D render of a floating glassmorphic chat interface window, soft white
> frosted glass panels with a deep navy (#000047) header bar, chat bubbles in navy
> and light grey, one bubble showing a green "Order confirmed ✓" state. Floating
> around it: small translucent cards showing a rising sales graph and a
> "Response time <1.2s" stat chip. Studio lighting, soft shadows on a clean
> light-grey background (#F4F5F7), subtle indigo rim light from the left,
> shallow depth of field, octagonal bokeh highlights. Premium enterprise SaaS
> aesthetic, Zendesk-meets-Linear, 8K, isometric three-quarter view.

### 1b. Abstract brand background (hero/CTA band)
> Minimal abstract background: a vast light-grey (#F4F5F7) field with a fine
> architectural grid, one enormous soft gradient orb in deep navy (#000047)
> fading to indigo (#4F46E5) in the top right corner, extremely subtle paper
> grain, a few thin luminous lines converging toward an octagonal shape.
> Calm, spacious, enterprise-grade. No text, no logos. 21:9 aspect ratio.

### 1c. "Every channel, one inbox" illustration
> Clean editorial 3D illustration: six floating app icons (chat, camera,
> thumbs-up, shopping bag, tag, mail — generic, not trademarked) orbiting a
> central glowing navy octagon on thin elliptical orbit rings, connected by
> delicate light threads. White background, soft studio light, matte plastic
> and frosted glass materials, brand palette navy #000047 / indigo #4F46E5 /
> violet #7C3AED accents only. Squarish 4:5 crop, generous negative space.

### 1d. Testimonial/case-study header
> Warm documentary-style photograph of a small boutique owner at a wooden
> counter looking relaxed while a tablet beside them shows a subtle navy chat
> dashboard glowing softly; evening golden light, shallow depth of field,
> candid, aspirational but honest small-business energy. No visible brand
> text. 3:2 aspect ratio.

### 1e. OG / social card
> Bold minimal social banner: deep navy (#000047) background, giant white
> headline area left empty for overlay text, right third occupied by a
> floating glass chat window with a green confirmed-order bubble, octagonal
> accent shapes, thin indigo gradient line across the bottom. Flat, crisp,
> enterprise SaaS. 1200×630.

---

## 2 · Dashboard & feature section imagery (Nano Banana)

### 2a. Analytics feature card
> Close-up macro render of a floating analytics panel: white card, rounded
> corners, navy-to-indigo gradient bar chart rising left to right, a "94%
> resolution rate" stat chip, soft drop shadow on light grey. Minimal,
> crisp, no text besides numbers. 1:1.

### 2b. AI training feature card
> Conceptual render: a stack of paper documents dissolving into a stream of
> glowing indigo particles that flow into a navy octagonal core, white
> background, elegant motion trails, premium minimalism. 1:1.

### 2c. Security band
> Ultra-minimal render of a navy octagonal shield with a subtle keyhole of
> light at its center, resting on brushed light-grey metal, single soft
> spotlight, enterprise security aesthetic, calm and unthreatening. 16:9.

---

## 3 · Video prompts (Veo)

### 3a. 8s hero loop (background video, muted, autoplay)
> Slow cinematic dolly across a minimal light-grey studio space. In the
> center, a frosted-glass chat window gently floats and rotates 5 degrees;
> chat bubbles in deep navy (#000047) appear one by one with soft pops of
> light; the final bubble turns green with a check mark. Fine dust motes in
> soft volumetric light, indigo rim lighting, octagonal bokeh. Seamless loop,
> no text, no people, 8 seconds, 4K, tripod-steady with a slow 10% push-in.

### 3b. 15s "How it works" explainer beat
> Three quick scenes, clean match cuts: (1) a cursor pastes a store URL into
> a minimal white input field, the field ripples and product cards cascade
> out in a neat grid; (2) a paper document folds itself into a paper plane
> and flies into a glowing navy octagon which pulses as it "learns"; (3) six
> messaging app icons snap onto orbit rings around the octagon and a stream
> of chat bubbles begins flowing, ending on a green "Order #OD-2048
> confirmed" card. Light-grey studio world, navy/indigo/violet accents,
> smooth eased motion, soft shadows, no camera shake, no text overlays
> (titles added in post). 15 seconds.

### 3c. 6s logo sting (end card)
> Hundreds of tiny chat bubbles in navy and indigo fly inward from all edges
> of frame and assemble into an octagon; the octagon's center opens into a
> clean white chat-bubble cutout (logo reveal); one gentle pulse of indigo
> light, then everything settles to stillness on a white background.
> Elegant, precise, 6 seconds, 60fps, subtle whoosh-to-silence sound design.

### 3d. 30s founder-style promo (voiceover bed)
> A day-to-night time-lapse inside a small e-commerce studio: parcels get
> packed, light changes, the owner leaves and turns off the lights — but a
> laptop on the desk keeps glowing softly navy, chat bubbles rising from its
> screen like fireflies all night; sunrise returns and a stack of new
> shipping labels prints out. Warm, human, quietly magical. Realistic
> cinematography, 30 seconds, gentle ambient score.

---

## 4 · Usage map

| Asset | Target slot |
|---|---|
| 1a hero shot | `Index.tsx` hero right column (or keep CSS widget, use in ads) |
| 1b background | CTA card background / pricing band |
| 1c channels illo | Integrations section (mobile fallback image) |
| 1d photo | Testimonials header / case-study pages |
| 1e OG card | `public/og-image.png` replacement |
| 2a–2c cards | Feature bento cards (swap icon tiles for imagery) |
| 3a loop | Hero `<video>` background (poster = 1a, `prefers-reduced-motion` → static) |
| 3b explainer | "How it works" section / YouTube pre-roll |
| 3c sting | End of demo video `1V-H3lsAXNc`'s successor |
| 3d promo | Homepage dialog video / paid social |

**Tips:** generate at 2× target resolution and downscale for crispness; ask for
"no text" and overlay real HTML text instead (keeps copy editable + SEO-safe);
regenerate any asset that drifts off the navy `#000047` — brand consistency is
the trust signal.

---

## 5 · Blog cover art (Nano Banana)

Covers for the omnichannel blog series at `/blog`. **One cohesive set** — same
clean editorial 3D-render aesthetic, light cool-grey background, deep navy
`#000047` with indigo/cyan accents, generous negative space, soft studio
shadows. **Landscape 16:9, ~1600×900, absolutely no text, no logos, no
watermarks.** Save each into `public/media/` under the exact filename below (or
hand me any format and I will convert to WebP). These currently ship with
placeholder art copied from existing covers, so the blog works today; dropping
these in replaces them with no code change.

### 5a. `blog-omnichannel-basics.webp` — "What omnichannel customer service actually means"
> A single glowing customer figure at the centre, made of soft navy (#000047)
> light, with five thin luminous threads flowing out to five small floating
> channel tiles (chat bubble, envelope, phone, Instagram-style camera glyph,
> WhatsApp-style speech mark) that all curve back and merge into one unified
> panel behind them. One conversation, many doors. Clean light-grey (#F4F5F7)
> studio background, indigo rim light, shallow depth of field, premium SaaS
> render, no text.

### 5b. `blog-multichannel-vs-omnichannel.webp` — "Multichannel and omnichannel are not the same"
> A clean split-composition concept: on the left, several separate floating
> boxes disconnected from each other, each an isolated island with a faint grey
> gap between them; on the right, the same boxes fused into one continuous
> glowing navy (#000047) surface with light flowing through them. Visual
> contrast between fragmentation and unity. Light-grey background, soft shadows,
> indigo accents, minimal, editorial 3D render, no text, no labels.

### 5c. `blog-unified-inbox.webp` — "Why customers hate repeating themselves"
> A calm 3D render of one unified inbox panel viewed three-quarter, showing a
> single continuous conversation thread with small channel icons (chat, email,
> social) stitched inline along one timeline, and a soft navy (#000047) memory
> ribbon threading through every message. A faint second, greyed-out duplicate
> panel dissolves away in the background to suggest "no more starting over".
> Light-grey studio background, indigo rim light, premium, no text.

### 5d. `blog-social-complaints.webp` — "How to handle complaints on social media"
> A single social-media comment card floating in the centre, slightly warm/red
> tension around one comment bubble, being met calmly by a navy (#000047)
> response bubble that visibly cools the tone to a soft blue. Around them, faint
> translucent silhouettes of many onlooker faces watching, out of focus. The
> feeling of composure under a public audience. Clean light background, soft
> shadows, editorial 3D render, no text, no real faces, no logos.

### 5e. `blog-response-time.webp` — "How to cut response time across every channel"
> A minimal 3D render of a sleek stopwatch or speed dial in deep navy (#000047)
> and chrome, with a fast navy light-streak arcing from an incoming message
> bubble straight to a green "answered" checkmark bubble. A faint clock face in
> the background subtly split into a bright daytime half and a dark night half,
> both covered by the same glowing arc. Light-grey studio background, indigo
> accents, shallow depth of field, no text.

### 5f. `blog-transition-omnichannel.webp` — "How to move your support to omnichannel"
> A clean render of several scattered channel tiles being drawn along glowing
> guide-rails into one central unified spine/hub in deep navy (#000047), shown
> as an orderly step-by-step assembly rather than chaos — like a calm, safe
> migration in progress. A soft path of stepping-stone platforms leads toward
> the hub. Light-grey background, soft shadows, indigo rim light, premium
> editorial 3D, no text, no arrows-with-labels.

### 5g. `blog-cost-of-fragmented.webp` — "The real cost of fragmented customer service"
> A conceptual render of coins or soft light-drops quietly leaking away through
> the gaps between several disconnected floating channel boxes, falling into
> shadow below — value slipping through the cracks of a siloed setup. Muted,
> slightly sombre but still clean and premium, deep navy (#000047) boxes on a
> light-grey background, one faint indigo glow. Editorial 3D render, no text, no
> literal currency symbols.

**Placement:** each maps 1:1 to a `cover` field in `src/content/blogPosts.ts`.
Keep the whole set visually consistent so the `/blog` index reads as one
designed series rather than seven unrelated stock images.

> **§5 status (done):** the seven omnichannel covers above have been generated and
> shipped as real WebP art. Raw masters live in `New Assets/Blog assets/`.

---

## 6 · Blog cover art, batch 2 — AI customer engagement (Nano Banana)

Covers for the second blog batch (buyer-decision and objection-handling posts).
**Same cohesive set style as §5:** clean editorial 3D render, light cool-grey
(#F4F5F7) background, deep navy `#000047` with indigo/cyan accents, generous
negative space, soft studio shadows. **Landscape 16:9, ~1600×900, no text, no
logos, no watermarks.** Save each into `public/media/` under the exact filename
below (any format is fine, I convert to WebP). These currently ship with
placeholder art copied from existing covers, so the blog works today; dropping
these in replaces them with no code change.

> Note from §5: nano-banana returned one image portrait (1024×1536) which had to
> be centre-cropped. For these, prompt explicitly for a **wide 16:9 landscape**
> composition so nothing important sits near the top or bottom edge.

### 6a. `blog-hire-or-ai.webp` — "Should you hire a person or use AI for support?"
> A balanced-scale / fork-in-the-road concept: on one side a warm human support
> figure made of soft light, on the other a glowing navy (#000047) AI node, with
> a stream of message bubbles flowing in and being sorted between the two paths.
> Not a competition, a division of labour. Wide 16:9 landscape, clean light-grey
> (#F4F5F7) studio background, indigo rim light, premium editorial 3D render, no
> text, no faces in detail.

### 6b. `blog-ai-cost-roi.webp` — "What AI customer service actually costs"
> A minimal 3D render of a balance or seesaw: on one pan a small stack of coins
> (the subscription), on the other a much larger glowing navy (#000047) volume of
> message bubbles and a rising graph (the value returned), tipping clearly toward
> value. Calm and analytical, not flashy. Wide 16:9 landscape, light-grey
> background, indigo accents, soft shadows, no text, no literal currency symbols.

### 6c. `blog-chatbot-vs-agent.webp` — "AI chatbot or AI agent?"
> A clean side-by-side contrast: on the left a rigid flowchart / decision-tree of
> grey boxes and fixed branches (the scripted chatbot); on the right a single
> smooth glowing navy (#000047) orb of understanding with free-flowing connections
> reading a natural-language message. Rigid versus fluid. Wide 16:9 landscape,
> light-grey background, indigo rim light, editorial 3D render, no text, no labels.

### 6d. `blog-will-ai-annoy-customers.webp` — "Will AI annoy your customers?"
> A single customer figure of soft light with a subtly satisfied, calm posture,
> receiving a clear helpful navy (#000047) response bubble with a green checkmark,
> while a faint greyed-out tangled loop (the bad-bot maze) dissolves behind them.
> Relief, not frustration. Wide 16:9 landscape, clean light-grey background,
> indigo accents, soft shadows, premium 3D render, no text, no detailed face.

### 6e. `blog-ai-angry-customers.webp` — "Can AI handle angry customers?"
> A conceptual render of a hot, red-tinged agitated message bubble being met by a
> calm navy (#000047) response that visibly cools it to blue, with a soft handoff
> arc passing the conversation to a human figure of warm light standing ready.
> De-escalation and handover. Wide 16:9 landscape, light-grey background, one
> controlled warm accent cooling to navy/indigo, editorial 3D render, no text.

### 6f. `blog-no-code-setup.webp` — "Set up AI customer service without technical skills"
> A friendly, approachable 3D render of simple building blocks or toggle cards
> clicking together into a working navy (#000047) chat panel, guided by a single
> soft hand of light, with no code or terminals in sight, just clean tactile
> pieces. Effortless assembly. Wide 16:9 landscape, light-grey background, indigo
> rim light, soft shadows, premium editorial render, no text, no code snippets.

### 6g. `blog-customer-data-ai.webp` — "What happens to your customer data with AI?"
> A calm trust-and-security concept: a glowing navy (#000047) shield or vault
> softly enclosing a small cluster of customer data cards and message bubbles,
> one clean lock motif, light rays suggesting protection rather than
> surveillance. Reassuring, not ominous. Wide 16:9 landscape, light-grey
> background, indigo accents, soft studio shadows, editorial 3D render, no text,
> no literal padlock clichés overdone.

**Placement:** each maps 1:1 to a `cover` field in `src/content/blogPosts.ts`
(batch 2, the seven AI-engagement posts). Keep consistent with §5 so all 14 blog
covers read as one designed series.

## 7 · Blog cover art, batch 3 — competitor comparisons (Nano Banana)

Nine covers for the comparison cluster. **These must not show any competitor's
logo, brand colours, wordmark or recognisable UI.** Using another company's marks
on a page arguing against them is the one thing in this cluster that could draw a
complaint, and it is trivially avoidable: every prompt below is deliberately
abstract. No text of any kind in the image.

Keep the whole set consistent with §5 and §6 so all 23 blog covers read as one
series: soft light background, indigo `#000047` accents, editorial 3D render,
generous negative space, **wide 16:9**.

**7a · `blog-vs-roundup.webp`** (the hub post)
> Nine abstract pricing meters of different shapes standing in a row on a soft
> light surface, each measuring something different, one of them a simple flat
> bar while the others climb, wide 16:9 editorial 3D render, indigo accents,
> no text, no logos.

**7b · `blog-vs-zendesk.webp`**
> A row of identical seat icons multiplying across a surface while a single flat
> tile sits apart from them, conveying per seat cost versus one price, wide 16:9,
> soft light background, indigo accents, no text, no logos.

**7c · `blog-vs-intercom.webp`**
> A meter whose counter climbs higher as a success indicator rises beside it,
> showing cost increasing with performance, next to a flat unchanging block,
> wide 16:9 editorial 3D render, indigo accents, no text, no logos.

**7d · `blog-vs-gorgias.webp`**
> Stacked ticket shapes filling a container that gets more expensive as it fills,
> beside a fixed size container holding the same volume, shopping bag motif in the
> background, wide 16:9, indigo accents, no text, no logos.

**7e · `blog-vs-freshdesk.webp`**
> Two cost columns side by side, one built from many small stacked blocks
> (seats plus session packs), one a single solid block, wide 16:9, soft light
> background, indigo accents, no text, no logos.

**7f · `blog-vs-tidio.webp`**
> A small allowance jar nearly empty next to an open channel flowing freely,
> suggesting a capped quota versus included capacity, wide 16:9 editorial 3D
> render, indigo accents, no text, no logos.

**7g · `blog-vs-crisp.webp`**
> Many small human seat figures arranged cheaply on one side and a large AI core
> handling a stream of conversations on the other, balanced scales composition,
> wide 16:9, indigo accents, no text, no logos.

**7h · `blog-vs-wati.webp`**
> A single deep channel pipe versus four channels converging into one brain
> shape, green messaging accent kept subtle and generic, wide 16:9, soft light
> background, indigo accents, no text, no logos.

**7i · `blog-vs-manychat.webp`**
> A rigid branching flowchart tree on the left dead ending at an unexpected
> question mark, and on the right an open conversational core answering freely,
> wide 16:9 editorial 3D render, indigo accents, no text, no logos.

**Placement:** each maps 1:1 to a `cover` field in `src/content/blogPosts.ts`
(batch 3, the nine comparison posts). **Delivered 26 July 2026** and live in
`public/media`; masters archived to `New Assets/Blog assets`.

Three first came back dark (`blog-vs-crisp`, `blog-vs-intercom`,
`blog-vs-manychat`, mean luma 55 to 59 against 160 to 205 for the rest of the
series): the generator read the subject matter as moody and ignored a light
background instruction placed at the end of the prompt. **Regenerated and fixed
on 26 July 2026** at luma 185, 175 and 181, same compositions, relit. Keep the
lesson: lead with the background rather than ending on it, for example:

> **Bright, light grey studio background, high key lighting, pale and airy.**
> [subject], soft studio shadows, wide 16:9 editorial 3D render, indigo `#000047`
> accents only, no text, no logos. Not dark, not moody, not a night scene.

Two checks before shipping any regenerated art, both scripted during batch 3:
mean luma should land above 150, and the bottom-right corner must be free of the
generator's sparkle watermark (that mark shipped undetected in batch 2 on
`blog-multichannel-vs-omnichannel`). Note the watermark test also fires on
artwork containing bright glowing particles, so always look at the image before
editing it.
