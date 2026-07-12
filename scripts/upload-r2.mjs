// Upload web + source assets to the Cloudflare R2 bucket.
//
//   node scripts/upload-r2.mjs            # upload everything
//   node scripts/upload-r2.mjs --dry-run  # list what would upload
//
// Reads credentials from .env (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
// R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE). Nothing here is bundled
// into the site — this is a build-machine tool only.
import { createReadStream, readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── minimal .env loader (no dotenv dependency) ──
for (const file of [".env", ".env.local"]) {
  const p = join(ROOT, file);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*)"?\s*(?:#.*)?$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim();
  }
}

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
const BUCKET = process.env.R2_BUCKET || "octadezx";
const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE || "https://octadezx.com").replace(/\/$/, "");
const DRY = process.argv.includes("--dry-run");

if (!DRY && (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY)) {
  console.error(
    "Missing R2 credentials. Fill R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY in .env\n" +
    "(Account ID: Cloudflare dashboard -> R2 -> right sidebar 'Account ID')."
  );
  process.exit(1);
}

const s3 = DRY ? null : new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const MIME = {
  ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".mp4": "video/mp4", ".svg": "image/svg+xml", ".gif": "image/gif", ".ico": "image/x-icon",
};

/** [local path, bucket key, cache-control] */
const uploads = [];

// Optimized web assets → media/  (immutable: filenames change when content does)
const mediaDir = join(ROOT, "public", "media");
for (const f of readdirSync(mediaDir)) {
  uploads.push([join(mediaDir, f), `media/${f}`, "public, max-age=31536000, immutable"]);
}
uploads.push([join(ROOT, "public", "og-image.png"), "media/og-image.png", "public, max-age=86400"]);

// Marketing masters (R2-only, not shipped with the site)
const r2out = join(ROOT, "New Assets", "r2-out");
if (existsSync(r2out)) {
  for (const f of readdirSync(r2out)) {
    uploads.push([join(r2out, f), `video/${f}`, "public, max-age=31536000"]);
  }
}

// Raw AI-generated originals → source/ (archive for future re-edits)
const srcDir = join(ROOT, "New Assets");
for (const f of readdirSync(srcDir)) {
  const p = join(srcDir, f);
  if (statSync(p).isFile()) uploads.push([p, `source/${f}`, "private, max-age=0"]);
}

const fmt = (n) => (n / 1024 / 1024).toFixed(2) + " MB";
let total = 0;

for (const [path, key, cache] of uploads) {
  const size = statSync(path).size;
  total += size;
  if (DRY) {
    console.log(`would upload  ${key.padEnd(28)} ${fmt(size)}`);
    continue;
  }
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: createReadStream(path),
    ContentType: MIME[extname(path).toLowerCase()] || "application/octet-stream",
    ContentLength: size,
    CacheControl: cache,
  }));
  console.log(`uploaded  ${key.padEnd(28)} ${fmt(size)}  ->  ${PUBLIC_BASE}/${key}`);
}

console.log(`\n${DRY ? "would upload" : "uploaded"} ${uploads.length} files, ${fmt(total)} total`);
if (!DRY) {
  // sanity check one object round-trips
  await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: uploads[0][1] }));
  console.log("verified: first object HEAD ok");
}
