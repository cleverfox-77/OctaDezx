/**
 * Imports a plain-data TypeScript module from the build scripts.
 *
 * Content modules like src/content/blogPosts.ts and src/components/site/
 * companyData.ts hold the real copy the React pages render. Reading them here,
 * rather than restating any of it in the build scripts, is what keeps the
 * prerendered HTML, the sitemap and llms.txt from drifting away from the site.
 *
 * Only works on modules with no runtime imports of app code, which is true of
 * the data modules by design. esbuild transpiles to a temp .mjs that Node can
 * import; the temp file is always cleaned up.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import esbuild from "esbuild";

export async function loadTsModule(root, relPath) {
  const entry = path.join(root, relPath);
  let res;
  try {
    res = await esbuild.build({
      entryPoints: [entry], bundle: true, write: false, format: "esm", platform: "node", logLevel: "silent",
    });
  } catch (err) {
    throw new Error(`[load-ts] could not transpile ${relPath}: ${err.message}`);
  }
  const tmp = path.join(os.tmpdir(), `octadezx-${path.basename(relPath, ".ts")}-${Date.now()}.mjs`);
  await fs.writeFile(tmp, res.outputFiles[0].text);
  try {
    return await import(pathToFileURL(tmp).href);
  } finally {
    await fs.rm(tmp, { force: true });
  }
}
