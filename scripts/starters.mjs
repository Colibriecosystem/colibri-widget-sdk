// The starters a terminal creates a widget project from (Nest → Author → a widget → Code → From a
// template): check their sources, build the Vite ones, pack each into a zip and write the index a
// terminal reads. The contract is starters/README.md; this file is what enforces it.
//
//   node scripts/starters.mjs check                          the sources (every PR)
//   node scripts/starters.mjs build                          npm ci, typecheck and build the Vite starters
//   node scripts/starters.mjs pack --release <tag> --out <d> the zips, starters.json and NOTES.md
//   node scripts/starters.mjs verify <d>                     re-read what pack wrote, as a terminal would
//   node scripts/starters.mjs smoke --repo <o/r> --release <tag>   what GitHub serves is what was built

import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readZip, sha256, writeZip } from "./zip.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_INDEX = "starters/starters.json";

/** The index format terminals read. A breaking change publishes starters.v2.json beside it instead. */
export const SCHEMA_VERSION = 1;
const KEY = /^[a-z0-9][a-z0-9-]{0,31}$/;
const ASSET = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}\.zip$/;
/** The terminal's own rules for a manifest: a lowercase DNS label of 1–40 characters… */
const ID = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/;
/** …three plain numbers (the versioning policy has no pre-release channel)… */
const VERSION = /^\d+\.\d+\.\d+$/;
const SCOPES = new Set(["marketData", "account:read", "trading", "panels", "notifications", "signalLevels", "storage"]);
/** …and no presentation: Nest owns a widget's name, icon and author. */
const LEGACY = ["name", "icon", "author"];
/** The terminal's caps on a served folder. */
const MAX_FILES = 2000;
const MAX_BYTES = 50 * 1024 * 1024;

/** A relative, forward-slashed path that cannot leave the folder it is read against. */
export function isSafeRelative(p) {
  return (
    typeof p === "string" &&
    p.length > 0 &&
    !p.startsWith("/") &&
    !p.includes("\\") &&
    !p.includes(":") &&
    p.split("/").every((segment) => segment && segment !== "." && segment !== "..")
  );
}

const isLoopback = (entry) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?(\/|$)/.test(entry);

/**
 * What the terminal would refuse in one widget.json. `dev` allows the loopback dev-server entry,
 * which only an unpacked widget may have and which can never be released.
 * @returns {{manifest: object|null, problems: string[]}}
 */
export function readManifest(text, { dev }) {
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (e) {
    return { manifest: null, problems: [`not JSON: ${e.message}`] };
  }
  const problems = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return { manifest: null, problems: ["not an object"] };
  if (!ID.test(manifest.id ?? "")) problems.push(`id "${manifest.id}" is not a lowercase label of 1–40 characters`);
  if (!VERSION.test(manifest.version ?? "")) problems.push(`version "${manifest.version}" is not three plain numbers`);
  const entry = manifest.entry;
  if (typeof entry !== "string" || !(isSafeRelative(entry) || (dev && isLoopback(entry)))) {
    problems.push(`entry "${entry}" is not ${dev ? "a relative path or a loopback dev server" : "a relative path"}`);
  }
  const surfaces = manifest.surfaces;
  if (!Array.isArray(surfaces) || surfaces.length === 0 || surfaces.some((s) => s !== "slot" && s !== "window")) {
    problems.push("surfaces must be a non-empty list of slot and window");
  }
  for (const scope of manifest.permissions ?? []) {
    if (!SCOPES.has(scope)) problems.push(`unknown permission "${scope}"`);
  }
  for (const field of LEGACY) {
    if (field in manifest) problems.push(`"${field}" belongs to Nest, not widget.json`);
  }
  return { manifest, problems };
}

/** A Vite starter's served manifests are built from public/; this is the file to check before a build. */
function sourceOf(starter, manifestPath) {
  const prefix = starter.serve + "/";
  return starter.build === "vite" && manifestPath.startsWith(prefix) ? "public/" + manifestPath.slice(prefix.length) : manifestPath;
}

/**
 * The source index and every starter's files, as CI and the terminal will read them.
 * @param {object} source the parsed starters/starters.json
 * @param {(relativePath: string) => Promise<string|null>} read a file under the repository root, or null
 * @param {{built?: boolean}} [options] built: read a Vite starter's served manifests from its build
 * @returns {Promise<{problems: string[], facts: Record<string, {id: string, needsNode: boolean, minColibriVersion: string|null, minApiVersion: number}>}>}
 */
export async function checkStarters(source, read, options = {}) {
  const problems = [];
  const facts = {};
  if (source?.schemaVersion !== SCHEMA_VERSION) problems.push(`schemaVersion must be ${SCHEMA_VERSION}`);
  const seen = new Set();
  for (const s of source?.starters ?? []) {
    const where = `starter "${s.key}"`;
    const bad = (text) => problems.push(`${where}: ${text}`);
    if (!KEY.test(s.key ?? "")) bad("key must match " + KEY);
    if (seen.has(s.key)) bad("key repeats");
    seen.add(s.key);
    for (const field of ["title", "description"]) {
      if (!s[field]?.ru?.trim() || !s[field]?.en?.trim()) bad(`${field} needs ru and en`);
    }
    if (!isSafeRelative(s.path)) bad("path is not a safe relative path");
    if (s.build !== null && s.build !== "vite") bad('build must be null or "vite"');
    if (!isSafeRelative(s.serve)) bad("serve is not a safe relative path");
    if (!Array.isArray(s.manifests) || s.manifests.length === 0 || !s.manifests.every(isSafeRelative)) bad("manifests must list safe relative paths");
    else if (!s.manifests.includes(`${s.serve}/widget.json`)) bad(`manifests must include ${s.serve}/widget.json`);
    if (s.packageJson !== null && !isSafeRelative(s.packageJson)) bad("packageJson must be null or a safe relative path");
    if (!isSafeRelative(s.edit)) bad("edit is not a safe relative path");
    if (problems.some((p) => p.startsWith(where))) continue;

    const served = `${s.serve}/widget.json`;
    const read1 = (rel) => read(path.posix.join(s.path, rel));
    let identity = null;
    let servedManifest = null;
    for (const m of s.manifests) {
      const file = options.built ? m : sourceOf(s, m);
      const text = await read1(file);
      if (text === null) {
        bad(`${file} is missing`);
        continue;
      }
      const { manifest, problems: mp } = readManifest(text, { dev: m !== served });
      mp.forEach((p) => bad(`${file}: ${p}`));
      if (!manifest) continue;
      const id = { id: manifest.id, version: manifest.version, permissions: [...(manifest.permissions ?? [])].sort().join(",") };
      if (identity && (identity.id !== id.id || identity.version !== id.version || identity.permissions !== id.permissions)) {
        bad(`${file} disagrees with the others on id, version or permissions`);
      }
      identity ??= id;
      if (m === served) servedManifest = manifest;
    }
    if ((await read1(s.edit)) === null) bad(`edit file ${s.edit} is missing`);
    if (s.packageJson) {
      const pkg = await read1(s.packageJson);
      if (pkg === null) bad(`${s.packageJson} is missing`);
      else if (typeof JSON.parse(pkg).name !== "string") bad(`${s.packageJson} has no name`);
    }
    if (servedManifest) {
      facts[s.key] = {
        id: servedManifest.id,
        needsNode: s.build === "vite",
        minColibriVersion: servedManifest.minColibriVersion ?? null,
        minApiVersion: servedManifest.minApiVersion ?? 1,
      };
    }
  }
  return { problems, facts };
}

/** The index a terminal reads: the source's own fields plus what only CI knows. */
export function publishedIndex(source, facts, { release, sdkCommit, hashes }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    release,
    sdkCommit,
    starters: source.starters.map((s) => ({
      key: s.key,
      title: s.title,
      description: s.description,
      asset: `starter-${s.key}.zip`,
      sha256: hashes[s.key],
      serve: s.serve,
      manifests: s.manifests,
      packageJson: s.packageJson,
      edit: s.edit,
      needsNode: facts[s.key].needsNode,
      minColibriVersion: facts[s.key].minColibriVersion,
      minApiVersion: facts[s.key].minApiVersion,
    })),
  };
}

/** Every file under `dir`, forward-slashed and relative to it. */
async function walk(dir, prefix = "") {
  const out = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.isDirectory()) out.push(...(await walk(path.join(dir, item.name), rel)));
    else if (item.isFile()) out.push(rel);
  }
  return out;
}

/** One starter's zip entries: what git tracks in its folder, plus a Vite build's served folder. */
async function starterEntries(s) {
  const tracked = execFileSync("git", ["ls-files", "-z", "--", s.path], { cwd: root })
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((f) => path.posix.relative(s.path, f));
  const names = new Set(tracked);
  if (s.build === "vite") for (const f of await walk(path.join(root, s.path, s.serve))) names.add(`${s.serve}/${f}`);
  const entries = [];
  for (const name of names) entries.push({ name, data: await readFile(path.join(root, s.path, name)) });
  return entries;
}

const readUnder = (base) => async (rel) => readFile(path.join(base, rel), "utf8").catch(() => null);
const fail = (problems) => {
  console.error(problems.map((p) => "  " + p).join("\n"));
  process.exit(1);
};
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const loadSource = async () => JSON.parse(await readFile(path.join(root, SOURCE_INDEX), "utf8"));

async function check() {
  const { problems } = await checkStarters(await loadSource(), readUnder(root));
  if (problems.length) fail(problems);
  console.log("Every starter checks out.");
}

function build() {
  return loadSource().then((source) => {
    for (const s of source.starters.filter((x) => x.build === "vite")) {
      const cwd = path.join(root, s.path);
      const npm = (...args) => execFileSync("npm", args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
      console.log(`── ${s.key}`);
      npm("ci");
      npm("run", "typecheck");
      npm("run", "build");
    }
  });
}

async function pack() {
  const release = arg("--release");
  const out = arg("--out");
  if (!release || !out) fail(["pack needs --release <tag> --out <dir>"]);
  const source = await loadSource();
  const { problems, facts } = await checkStarters(source, readUnder(root), { built: true });
  if (problems.length) fail(problems);
  await mkdir(out, { recursive: true });
  const hashes = {};
  const notes = [`Starters for Nest → Author → a widget → Code → From a template. Built from ${release}.`, ""];
  for (const s of source.starters) {
    const entries = await starterEntries(s);
    const bytes = entries.reduce((n, e) => n + e.data.length, 0);
    if (entries.length > MAX_FILES || bytes > MAX_BYTES) fail([`${s.key}: ${entries.length} files, ${bytes} bytes is over the terminal's caps`]);
    const zip = writeZip(entries);
    hashes[s.key] = sha256(zip);
    await writeFile(path.join(out, `starter-${s.key}.zip`), zip);
    notes.push(`- \`starter-${s.key}.zip\` — ${s.title.en}; sha256 \`${hashes[s.key]}\``);
  }
  const sdkCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root }).toString().trim();
  const index = publishedIndex(source, facts, { release, sdkCommit, hashes });
  await writeFile(path.join(out, "starters.json"), JSON.stringify(index, null, 2) + "\n");
  await writeFile(path.join(out, "NOTES.md"), notes.join("\n") + "\n");
  console.log(`Packed ${source.starters.length} starters into ${out}.`);
}

/**
 * Re-read a packed release the way a terminal will: the index, each zip's hash and paths, and the
 * manifests inside each zip.
 */
export async function verifyRelease(index, readAsset) {
  const problems = [];
  if (index.schemaVersion !== SCHEMA_VERSION) problems.push("schemaVersion");
  if (typeof index.release !== "string" || !index.release) problems.push("release is missing");
  for (const s of index.starters ?? []) {
    const bad = (text) => problems.push(`${s.key}: ${text}`);
    if (!ASSET.test(s.asset ?? "")) bad(`asset name "${s.asset}"`);
    if (!/^[0-9a-f]{64}$/.test(s.sha256 ?? "")) bad("sha256 is not 64 lowercase hex characters");
    const zip = await readAsset(s.asset);
    if (!zip) {
      bad("asset is missing");
      continue;
    }
    if (sha256(zip) !== s.sha256) bad("sha256 does not match the zip");
    const files = new Map(readZip(zip).map((e) => [e.name, e.data]));
    for (const name of files.keys()) {
      if (!isSafeRelative(name)) bad(`unsafe entry ${name}`);
      if (name.split("/").includes("node_modules")) bad(`node_modules inside the zip: ${name}`);
    }
    const read = async (rel) => (files.has(rel) ? files.get(rel).toString("utf8") : null);
    // The zip's root stands in for the starter's folder; its served manifests are already built.
    const asSource = { schemaVersion: SCHEMA_VERSION, starters: [{ ...s, path: "zip", build: null }] };
    const { problems: inner } = await checkStarters(asSource, async (rel) => read(rel.slice("zip/".length)));
    inner.forEach((p) => bad(p.replace(/^starter "[^"]+": /, "")));
    const served = JSON.parse((await read(`${s.serve}/widget.json`)) ?? "{}");
    if (!files.has(`${s.serve}/${served.entry}`)) bad(`the served entry ${s.serve}/${served.entry} is not in the zip`);
    if (s.needsNode) {
      const html = (await read(`${s.serve}/index.html`)) ?? "";
      if (/\s(src|href)="\//.test(html)) bad(`${s.serve}/index.html has a root-absolute asset URL (vite base must be "./")`);
    }
  }
  return problems;
}

async function verify() {
  const dir = process.argv[3];
  if (!dir) fail(["verify needs the folder pack wrote"]);
  const index = JSON.parse(await readFile(path.join(dir, "starters.json"), "utf8"));
  const problems = await verifyRelease(index, (asset) => readFile(path.join(dir, asset)).catch(() => null));
  if (problems.length) fail(problems);
  console.log(`Verified ${index.starters.length} starters in ${dir}.`);
}

/** Download what a terminal downloads — the index from `latest`, each zip from the index's release. */
async function smoke() {
  const repo = arg("--repo");
  const expected = arg("--release");
  if (!repo) fail(["smoke needs --repo <owner/name>"]);
  const get = async (url) => {
    for (let attempt = 1; ; attempt++) {
      const response = await fetch(url, { headers: { "User-Agent": "colibri-widget-sdk-ci" } });
      if (response.ok) return Buffer.from(await response.arrayBuffer());
      if (attempt === 5) throw new Error(`${url}: HTTP ${response.status}`);
      await new Promise((r) => setTimeout(r, attempt * 3000));
    }
  };
  const base = `https://github.com/${repo}/releases`;
  const index = JSON.parse((await get(`${base}/latest/download/starters.json`)).toString("utf8"));
  if (expected && index.release !== expected) fail([`latest serves ${index.release}, expected ${expected}`]);
  const problems = await verifyRelease(index, (asset) => get(`${base}/download/${encodeURIComponent(index.release)}/${encodeURIComponent(asset)}`));
  if (problems.length) fail(problems);
  console.log(`latest serves ${index.release}: ${index.starters.length} starters, every hash matches.`);
}

const commands = { check, build, pack, verify, smoke };
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = commands[process.argv[2]];
  if (!command) fail([`usage: node scripts/starters.mjs ${Object.keys(commands).join("|")}`]);
  await command();
}
