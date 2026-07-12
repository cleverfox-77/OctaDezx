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
