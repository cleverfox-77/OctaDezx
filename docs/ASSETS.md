# Asset pipeline & R2 storage

## Layout

| Location | What | Served from |
|---|---|---|
| `New Assets/` | Raw AI-generated masters (PNG/MP4, ~100 MB) — never shipped | local + R2 `source/` |
| `New Assets/r2-out/` | Marketing-quality videos (sting, promo) | R2 `video/` |
| `public/media/` | Web-optimized WebP/MP4 used by the site | site origin `/media/...` + mirrored to R2 `media/` |
| `public/og-image.png` | Social card (composited from 1e) | site origin |

## Commands

```bash
npm run assets:process     # New Assets/ -> public/media/ (WebP + compressed MP4 + OG composite)
npm run assets:upload:dry  # list what would upload to R2
npm run assets:upload      # upload media/ + video/ + source/ to the octadezx bucket
```

Credentials live in `.env` (gitignored): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE`. No `VITE_` prefix —
they must never reach the browser bundle.

## Serving strategy

The site references `/media/...` **relative to its own origin** (Vercel serves
`public/`). R2 is the distribution copy — for ads, emails, socials, and any
"other assets" that shouldn't live in the repo. This keeps the site working
even if R2 or its custom domain changes.

## ⚠️ Custom domain — action required (decided 2026-07-13)

The R2 bucket's custom domain was initially attached to the **apex
`octadezx.com`**, which took the Vercel site (and its `/auth/callback` +
`/mcp` endpoints) offline. Decision: serve R2 from **`cdn.octadezx.com`**.

Manual steps (Cloudflare dashboard — 2 minutes):
1. R2 → `octadezx` bucket → **Settings → Custom Domains** → remove
   `octadezx.com`, add `cdn.octadezx.com`.
2. DNS → restore the apex record to Vercel: `octadezx.com` → CNAME/ALIAS
   `cname.vercel-dns.com` (or re-add the domain in Vercel → project →
   Domains and follow its prompt).
3. Verify: `octadezx.com` shows the site again;
   `cdn.octadezx.com/media/hero-chat.webp` shows the image.

`R2_PUBLIC_BASE` in `.env` already points at `https://cdn.octadezx.com`.
Uploaded objects don't need re-uploading — the domain switch applies to the
whole bucket.

## Adding new assets later

1. Drop masters into `New Assets/` (any name).
2. Add a line to `scripts/process_assets.py` (target size/name).
3. `npm run assets:process && npm run assets:upload`.
4. Reference `/media/<name>` in code (site origin) or `R2_PUBLIC_BASE/media/<name>` externally.
