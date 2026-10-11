// Every copy of the SDK client in this repository is the SDK's own file, byte for byte.
//
// A bundled widget has to carry colibri.js beside its page — the terminal injects only the raw
// `window.colibri` tunnel — so the sample and every starter hold a copy. A copy that falls behind
// sdk/ ships a starter without the newest routes, which is exactly what happened to the template
// before this check existed.
//
//   node scripts/sync-sdk-copies.mjs           rewrite every copy from sdk/
//   node scripts/sync-sdk-copies.mjs --check   fail when any copy differs (CI)
//
// The examples are not here on purpose: their dist/ is a committed, hash-pinned catalog bundle, so
// their src/lib changes only together with a rebuild of that bundle.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** [folder, the SDK files it carries] */
export const COPIES = [
  ["sdk/sample-widget", ["colibri.js"]],
  ["starters/plain/widget", ["colibri.js", "colibri.d.ts"]],
  ["starters/chart/widget", ["colibri.js", "colibri.d.ts"]],
  ["starters/react/src/lib", ["colibri.js", "colibri.d.ts"]],
  ["starters/trading/src/lib", ["colibri.js", "colibri.d.ts"]],
];

async function main() {
  const check = process.argv.includes("--check");
  const stale = [];
  for (const [folder, files] of COPIES) {
    for (const file of files) {
      const source = await readFile(path.join(root, "sdk", file));
      const target = path.join(root, folder, file);
      const current = await readFile(target).catch(() => null);
      if (current && current.equals(source)) continue;
      if (check) stale.push(`${folder}/${file}`);
      else await writeFile(target, source);
    }
  }
  if (stale.length) {
    console.error(`These copies differ from sdk/ — run: node scripts/sync-sdk-copies.mjs\n  ${stale.join("\n  ")}`);
    process.exit(1);
  }
  console.log(check ? "Every SDK copy matches sdk/." : "Every SDK copy rewritten from sdk/.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
