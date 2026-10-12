// The author docs: every page in Russian and English, every link and anchor resolving, nothing
// pointing at a place an author cannot open, the API reference matching sdk/colibri.d.ts member by
// member, and every code sample compiling against it. The conventions it enforces are AGENTS.md's.
//
//   node scripts/docs.mjs check      pairs, links, anchors, published ids, the reference vs colibri.d.ts
//   node scripts/docs.mjs snippets   every js/ts block of README and docs/ type-checks (needs
//                                    `npm ci --prefix starters/react` first, for its pinned tsc)
//   node scripts/docs.mjs scaffold   print what the reference is missing, ready to paste; writes nothing

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_URL = "https://github.com/Colibriecosystem/colibri-widget-sdk";

/** Pages that are not pairs: agent instructions, and a note inside a starter for whoever edits it. */
const UNPAIRED = new Set(["AGENTS.md", "CLAUDE.md", "starters/react/src/lib/README.md"]);

/** Public organisation repositories a public page may link. Anything else there is private. */
const PUBLIC_REPOS = new Set(["colibri-widget-sdk", "colibri-sdk", "colibri-mockups"]);

/** Where each part of the API is documented, under docs/reference/. */
export const REFERENCE_PAGES = {
  markets: "market-data",
  stream: "market-data",
  connections: "account-and-trading",
  trading: "account-and-trading",
  workspace: "layout",
  panels: "layout",
  notifications: "notifications",
  signalLevels: "notifications",
  storage: "storage-and-net",
  net: "storage-and-net",
};
/** Top-level functions, the error class, the constants and the host events live on the bridge page. */
const BRIDGE_PAGE = "bridge";
/** Each stream channel is documented beside the data it carries. */
export const CHANNEL_PAGES = {
  book: "market-data",
  trades: "market-data",
  funding: "market-data",
  positions: "account-and-trading",
  orders: "account-and-trading",
  balance: "account-and-trading",
  notifications: "notifications",
  signalLevels: "notifications",
};

/**
 * Members that call no route of their own, and what their scope line names instead. `storage` is
 * enforced by the host, `net.fetch` by the manifest's `egress`, a stream by its channel's scope, and
 * `panels.self`/`siblings` are built from `panels.get`/`list`.
 */
export const SCOPE_EXEMPT = {
  "storage.*": ["storage"],
  "net.fetch": ["egress"],
  "stream.subscribe": ["CHANNEL_SCOPES"],
  "stream.onAny": [],
  "panels.self": ["panels"],
  "panels.siblings": ["panels"],
};

// ── markdown ─────────────────────────────────────────────────────────────────────────────────────

/** camelCase → kebab-case: `removeBySymbol` → `remove-by-symbol`. */
export const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

/** The English twin of a Russian page: `X.md` → `X.en.md`. */
export const englishOf = (page) => page.replace(/\.md$/, ".en.md");

/**
 * The page's lines with what sits inside fences marked, so nothing in a code block is read as a
 * heading or a link. `fence` is the info string (`ts decl`, `json`, …) of the block a line opens.
 */
export function lines(text) {
  const out = [];
  let open = null;
  text.split(/\r?\n/).forEach((line, i) => {
    const fence = /^(\s*)(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence && !open) {
      open = { marker: fence[2], info: fence[3].trim() };
      out.push({ n: i + 1, text: line, code: false, opens: open.info });
    } else if (fence && open && fence[2].startsWith(open.marker[0]) && fence[2].length >= open.marker.length && !fence[3].trim()) {
      out.push({ n: i + 1, text: line, code: false, closes: true });
      open = null;
    } else {
      out.push({ n: i + 1, text: line, code: !!open });
    }
  });
  return out;
}

/** The text GitHub renders for a heading: tags gone, links reduced to their text, code kept. */
export function headingText(raw) {
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*|__|\*/g, "")
    .trim();
}

/** GitHub's heading anchor: lowercase, punctuation and symbols dropped, each space a hyphen. */
export function slug(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, "").replace(/ /g, "-");
}

/** Every heading of a page: its level, its explicit ids, GitHub's slug (with -1, -2 for repeats). */
export function headings(text) {
  const seen = new Map();
  const out = [];
  for (const line of lines(text)) {
    if (line.code) continue;
    const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line.text);
    if (!m) continue;
    const ids = [...m[2].matchAll(/<a\s+id="([^"]+)"\s*>\s*<\/a>/g)].map((x) => x[1]);
    let s = slug(headingText(m[2]));
    const count = seen.get(s) ?? 0;
    seen.set(s, count + 1);
    if (count > 0) s = `${s}-${count}`;
    out.push({ n: line.n, level: m[1].length, ids, slug: s, text: headingText(m[2]) });
  }
  return out;
}

/** Everything `#anchor` may name on a page: explicit ids anywhere, and every heading's slug. */
export function anchors(text) {
  const set = new Set();
  for (const line of lines(text)) {
    if (line.code) continue;
    for (const m of line.text.matchAll(/<a\s+(?:id|name)="([^"]+)"/g)) set.add(m[1]);
  }
  for (const h of headings(text)) set.add(h.slug);
  return set;
}

/** Every explicit id on a page, in order. */
export const ids = (text) =>
  lines(text)
    .filter((l) => !l.code)
    .flatMap((l) => [...l.text.matchAll(/<a\s+id="([^"]+)"\s*>/g)].map((m) => m[1]));

/** Every link target outside code: `[x](target)`, `[x]: target`, `href="target"`. */
export function links(text) {
  const out = [];
  for (const line of lines(text)) {
    if (line.code || line.opens !== undefined || line.closes) continue;
    const prose = line.text.replace(/`[^`]*`/g, "");
    for (const m of prose.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) out.push({ n: line.n, target: m[1] });
    const ref = /^\s*\[[^\]]+\]:\s*(\S+)/.exec(prose);
    if (ref) out.push({ n: line.n, target: ref[1] });
    for (const m of prose.matchAll(/href="([^"]+)"/g)) out.push({ n: line.n, target: m[1] });
  }
  return out;
}

/** The fenced blocks of a page: their info string, first line and body. */
export function blocks(text) {
  const out = [];
  let current = null;
  for (const line of lines(text)) {
    if (line.opens !== undefined) current = { info: line.opens, n: line.n, body: [] };
    else if (line.closes && current) {
      out.push({ ...current, body: current.body.join("\n") });
      current = null;
    } else if (current) current.body.push(line.text);
  }
  return out;
}

// ── the checks ───────────────────────────────────────────────────────────────────────────────────

/** A Russian page whose English twin is missing, or an English page with no Russian original. */
export function checkPairs(files) {
  const problems = [];
  const set = new Set(files);
  for (const f of files) {
    if (UNPAIRED.has(f)) continue;
    if (f.endsWith(".en.md")) {
      if (!set.has(f.replace(/\.en\.md$/, ".md"))) problems.push(`${f}: an English page with no Russian original`);
    } else if (!set.has(englishOf(f))) problems.push(`${f}: no English pair (${englishOf(f)})`);
  }
  return problems;
}

/**
 * The two languages of one page must have the same shape: the same explicit ids, the same heading
 * levels in the same order, the same code blocks (by info string), and byte-identical `json`.
 */
export function checkPairShape(page, ru, en) {
  const problems = [];
  const a = ids(ru).join(" ");
  const b = ids(en).join(" ");
  if (a !== b) problems.push(`${page}: the explicit ids differ between the languages\n    ru: ${a}\n    en: ${b}`);
  const levels = (t) => headings(t).map((h) => h.level).join("");
  if (levels(ru) !== levels(en)) problems.push(`${page}: the heading structure differs between the languages (ru ${levels(ru)}, en ${levels(en)})`);
  const infos = (t) => blocks(t).map((x) => x.info || "(none)");
  if (infos(ru).join("|") !== infos(en).join("|")) problems.push(`${page}: the code blocks differ between the languages (ru ${infos(ru).join(", ")}; en ${infos(en).join(", ")})`);
  const json = (t) => blocks(t).filter((x) => x.info === "json").map((x) => x.body.trim());
  const [jr, je] = [json(ru), json(en)];
  jr.forEach((body, i) => {
    if (je[i] !== undefined && je[i] !== body) problems.push(`${page}: json block ${i + 1} differs between the languages`);
  });
  return problems;
}

/** A paragraph line directly above `---` or `===` is rendered by GitHub as a heading. */
export function checkAccidentalHeadings(page, text) {
  const problems = [];
  const all = lines(text);
  for (let i = 1; i < all.length; i++) {
    const line = all[i];
    const prev = all[i - 1];
    if (line.code || prev.code || prev.opens !== undefined || prev.closes) continue;
    if (!/^(-{2,}|=+)\s*$/.test(line.text)) continue;
    const p = prev.text.trim();
    if (!p || /^(#|[-*+>|<]|\d+[.)]\s)/.test(p)) continue;
    problems.push(`${page}:${line.n}: "${p.slice(0, 50)}" sits directly above "${line.text.trim()}", so GitHub renders it as a heading — put a blank line between them`);
  }
  return problems;
}

/** Nothing on a public page may point at a private repository or a private doc. */
export function checkPublic(page, text) {
  const problems = [];
  for (const [i, line] of text.split(/\r?\n/).entries()) {
    if (line.includes("docs/functionality/")) problems.push(`${page}:${i + 1}: names a private doc (docs/functionality/)`);
    for (const m of line.matchAll(/github\.com\/Colibriecosystem\/([A-Za-z0-9._-]+)/gi)) {
      if (!PUBLIC_REPOS.has(m[1].toLowerCase())) problems.push(`${page}:${i + 1}: links the private repository ${m[1]}`);
    }
    for (const m of line.matchAll(/colibriecosystem\.github\.io\/([A-Za-z0-9._-]+)/gi)) {
      if (!PUBLIC_REPOS.has(m[1].toLowerCase())) problems.push(`${page}:${i + 1}: links a private site (${m[1]})`);
    }
  }
  return problems;
}

/**
 * Every relative link resolves to a tracked file or folder, and every `#anchor` to an id or a
 * heading on its page. A link to this repository's own GitHub URL is checked the same way.
 * @param read (file) → its text, or null when it is not a tracked file
 * @param isDir (path) → true when a tracked file lives under it
 */
export function checkLinks(page, text, read, isDir) {
  const problems = [];
  const own = new RegExp(`^${REPO_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/(?:blob|tree)/main/([^?#]*)(#.*)?$`);
  for (const { n, target } of links(text)) {
    let rel = target;
    const mine = own.exec(target);
    if (mine) rel = "/" + mine[1] + (mine[2] ?? "");
    else if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    const [p, hash] = rel.split("#");
    const file = p ? (p.startsWith("/") ? p.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(page), decodeURI(p)))).replace(/\/$/, "") : page;
    const body = file === page ? text : read(file);
    if (body === null && !isDir(file)) {
      problems.push(`${page}:${n}: links ${target}, but ${file} is not a tracked file`);
      continue;
    }
    if (hash !== undefined && body !== null && file.endsWith(".md") && !anchors(body).has(decodeURIComponent(hash))) {
      problems.push(`${page}:${n}: links ${target}, but ${file} has no #${decodeURIComponent(hash)}`);
    }
  }
  return problems;
}

/**
 * The ids released terminals link (scripts/published-ids.txt): each must stay, in both languages
 * when it is an explicit id on a paired page.
 */
export function checkPublished(list, read) {
  const problems = [];
  for (const raw of list.split(/\r?\n/)) {
    const entry = raw.trim();
    if (!entry || entry.startsWith("//")) continue;
    const [page, anchor] = entry.split("#");
    const pages = page.endsWith(".en.md") || UNPAIRED.has(page) ? [page] : [page, englishOf(page)];
    for (const p of pages) {
      const body = read(p);
      if (body === null) problems.push(`published ${entry}: ${p} is gone — a released terminal links it`);
      else if (anchor && !anchors(body).has(anchor)) problems.push(`published ${entry}: ${p} has no #${anchor} — a released terminal links it`);
    }
  }
  return problems;
}

// ── the API surface ──────────────────────────────────────────────────────────────────────────────

/** `text` without comments, and with `export`/`declare` and every whitespace character dropped. */
export const squash = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/\b(export|declare)\b/g, "")
    .replace(/\s+/g, "")
    // A union may open with a `|` or not; both are the same type.
    .replace(/=\|/g, "=");

/** Read up to the `;` that closes a declaration starting at `from`, brackets balanced. */
function statementAt(text, from) {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "*") i = text.indexOf("*/", i + 2) + 1;
    else if (c === "/" && text[i + 1] === "/") i = text.indexOf("\n", i);
    else if ("({[".includes(c)) depth++;
    else if (")}]".includes(c)) depth--;
    else if (c === ";" && depth === 0) return text.slice(from, i + 1);
  }
  return text.slice(from);
}

/**
 * What colibri.d.ts declares: each namespace's members with their signatures, the top-level
 * functions, classes and constants, the host events, the channels and every exported type.
 */
export function parseTypes(dts) {
  const clean = dts.replace(/\r/g, "");
  const namespaces = {};
  const values = {};
  const types = {};
  for (const m of clean.matchAll(/^export declare const (\w+): \{\n([\s\S]*?)^\};/gm)) {
    const members = {};
    const body = m[2];
    for (const mm of body.matchAll(/^ {2}(\w+)\s*[<(]/gm)) {
      members[mm[1]] = statementAt(body, mm.index + 2).trim();
    }
    if (Object.keys(members).length) namespaces[m[1]] = members;
    else values[m[1]] = statementAt(clean, m.index).trim();
  }
  for (const m of clean.matchAll(/^export declare (function|class|const) (\w+)/gm)) {
    if (namespaces[m[2]] || values[m[2]]) continue;
    values[m[2]] = m[1] === "class" ? classAt(clean, m.index) : statementAt(clean, m.index).trim();
  }
  for (const m of clean.matchAll(/^export (interface|type) (\w+)/gm)) {
    types[m[2]] = m[1] === "interface" ? classAt(clean, m.index) : statementAt(clean, m.index).trim();
  }
  const union = (name) => [...(/^export type \w+ =([^;]+);/m.exec(types[name] ?? "")?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  return { namespaces, values, types, events: union("HostEvent"), channels: union("Channel") };
}

/** An interface or class body runs to the brace that closes its first one. */
function classAt(text, from) {
  const open = text.indexOf("{", from);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return text.slice(from, i + 1);
  }
  return text.slice(from);
}

/** What colibri.js exports as namespaces, each member with the source of its body. */
export function parseSdk(js) {
  const clean = js.replace(/\r/g, "");
  const namespaces = {};
  for (const m of clean.matchAll(/^export const (\w+) = \{\n([\s\S]*?)^\};/gm)) {
    const body = m[2];
    const all = [...body.matchAll(/^ {2}(?:async\s+)?(\w+)\s*(?::|\()/gm)];
    const members = {};
    for (const s of all) {
      if (s[1].startsWith("_")) continue;
      const next = all.find((x) => x.index > s.index);
      const source = body.slice(s.index, next ? next.index : body.length);
      // A function: a method, or a property whose value is an arrow. SCOPES and CHANNEL_SCOPES are
      // plain maps — constants, not namespaces.
      if (/^ {2}(?:async\s+)?\w+\s*\(/.test(source) || /^ {2}\w+\s*:\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>/.test(source)) members[s[1]] = source;
    }
    if (Object.keys(members).length) namespaces[m[1]] = members;
  }
  const routes = [...clean.matchAll(/\["(?<m>[A-Z]+)",\s*"(?<p>[^"]+)",\s*(?:true|false),\s*"(?<s>[^"]+)"\]/g)].map((x) => ({
    key: `${x.groups.m} ${x.groups.p.replace(/\{[^}]*\}/g, "{}")}`,
    scope: x.groups.s,
  }));
  return { namespaces, routes };
}

/** The scope a member needs: the one its route carries, or the exemption table's answer. */
export function scopeOf(ns, member, source, routes) {
  for (const key of [`${ns}.${member}`, `${ns}.*`]) if (SCOPE_EXEMPT[key]) return SCOPE_EXEMPT[key];
  const call = /request\(\s*"([A-Z]+)",\s*[`"]([^`"]+)[`"]/.exec(source ?? "");
  if (!call) return null;
  const key = `${call[1]} ${call[2].replace(/\$\{[^}]*\}/g, "{}").replace(/\{[^}]*\}/g, "{}")}`;
  const route = routes.find((r) => r.key === key);
  return route ? [route.scope] : null;
}

/** colibri.js and colibri.d.ts name the same namespaces and the same members. */
export function checkSdkAgreement(api, sdk) {
  const problems = [];
  for (const ns of new Set([...Object.keys(api.namespaces), ...Object.keys(sdk.namespaces)])) {
    const a = Object.keys(api.namespaces[ns] ?? {}).sort();
    const b = Object.keys(sdk.namespaces[ns] ?? {}).sort();
    const onlyTypes = a.filter((x) => !b.includes(x));
    const onlyJs = b.filter((x) => !a.includes(x));
    if (onlyTypes.length) problems.push(`colibri.d.ts declares ${onlyTypes.map((x) => `${ns}.${x}`).join(", ")}, which colibri.js does not have`);
    if (onlyJs.length) problems.push(`colibri.js has ${onlyJs.map((x) => `${ns}.${x}`).join(", ")}, which colibri.d.ts does not declare`);
  }
  for (const [ns, members] of Object.entries(sdk.namespaces)) {
    for (const [member, source] of Object.entries(members)) {
      if (scopeOf(ns, member, source, sdk.routes) === null) problems.push(`${ns}.${member}: its scope cannot be derived — it calls no route in ROUTES and has no entry in SCOPE_EXEMPT`);
    }
  }
  return problems;
}

/** Every section a reference page must have, each with the id, page, signature and scope it carries. */
export function expectedReference(api, sdk) {
  const out = [];
  for (const [ns, members] of Object.entries(api.namespaces)) {
    for (const [member, signature] of Object.entries(members)) {
      out.push({
        id: `${kebab(ns)}-${kebab(member)}`,
        page: REFERENCE_PAGES[ns],
        name: `${ns}.${member}`,
        signature,
        scope: scopeOf(ns, member, sdk.namespaces[ns]?.[member], sdk.routes),
      });
    }
  }
  for (const [name, declaration] of Object.entries(api.values)) out.push({ id: kebab(name).replace(/_/g, "-").replace(/--+/g, "-"), page: BRIDGE_PAGE, name, signature: declaration, scope: undefined });
  for (const e of api.events) out.push({ id: `event-${kebab(e)}`, page: BRIDGE_PAGE, name: `on("${e}")` });
  for (const c of api.channels) out.push({ id: `channel-${kebab(c)}`, page: CHANNEL_PAGES[c] ?? "market-data", name: `stream "${c}"` });
  return out;
}

/** The section a heading opens: from it to the next heading of the same or a higher level. */
function sectionOf(text, id) {
  const all = lines(text);
  const hs = headings(text);
  const h = hs.find((x) => x.ids.includes(id));
  if (!h) return null;
  const end = hs.find((x) => x.n > h.n && x.level <= h.level);
  return all.filter((l) => l.n >= h.n && (!end || l.n < end.n));
}

/** The backticked words on a section's `Scope:` / `Разрешение:` line, or null without one. */
function scopeLine(section) {
  const line = section.find((l) => !l.code && /^\s*(?:\*\*)?(Scope|Разрешение)s?:/.test(l.text));
  return line ? [...line.text.matchAll(/`([^`]+)`/g)].map((m) => m[1]).sort() : null;
}

/**
 * The reference against colibri.d.ts, in one language: every member, value, event and channel has
 * its id on its own page; no id claims a member that does not exist; a member's section holds its
 * signature in a `ts decl` block and names the scope it needs; every type is declared somewhere.
 * @param pages reference page name → its text in this language (null when missing)
 */
export function checkReference(api, sdk, pages, language) {
  const problems = [];
  const where = (page) => `docs/reference/${page}${language === "en" ? ".en.md" : ".md"}`;
  const expected = expectedReference(api, sdk);
  const owner = new Map(expected.map((e) => [e.id, e]));
  const prefixes = [...Object.keys(api.namespaces).map((ns) => `${kebab(ns)}-`), "event-", "channel-"];
  for (const [page, text] of Object.entries(pages)) {
    if (text === null) continue;
    for (const id of ids(text)) {
      const e = owner.get(id);
      if (e && e.page !== page) problems.push(`${where(page)}: documents ${e.name} (#${id}), which belongs on ${where(e.page)}`);
      if (!e && prefixes.some((p) => id.startsWith(p))) problems.push(`${where(page)}: #${id} names no member, event or channel of colibri.d.ts`);
    }
  }
  for (const e of expected) {
    const text = pages[e.page];
    if (text === null || text === undefined) {
      problems.push(`${where(e.page)} is missing, so ${e.name} is undocumented`);
      continue;
    }
    const section = sectionOf(text, e.id);
    if (!section) {
      problems.push(`${where(e.page)}: no section for ${e.name} — a heading carrying <a id="${e.id}"></a>`);
      continue;
    }
    if (e.signature) {
      const decls = blocks(section.map((l) => l.text).join("\n")).filter((b) => /^ts\s+decl\b/.test(b.info));
      if (!decls.some((b) => squash(b.body).includes(squash(e.signature)))) {
        problems.push(`${where(e.page)}: the ${e.name} section has no \`ts decl\` block holding its colibri.d.ts declaration:\n    ${e.signature.replace(/\s+/g, " ")}`);
      }
    }
    if (e.scope) {
      const named = scopeLine(section);
      const want = [...e.scope].sort();
      if (named === null) problems.push(`${where(e.page)}: the ${e.name} section has no ${language === "ru" ? "«Разрешение:»" : '"Scope:"'} line (it needs ${want.map((s) => `\`${s}\``).join(", ") || "none"})`);
      else if (named.join() !== want.join()) problems.push(`${where(e.page)}: ${e.name} needs ${want.map((s) => `\`${s}\``).join(", ") || "no scope"}, but its scope line names ${named.map((s) => `\`${s}\``).join(", ") || "none"}`);
    }
  }
  const declared = Object.values(pages)
    .filter(Boolean)
    .flatMap((t) => blocks(t).filter((b) => /^ts\s+decl\b/.test(b.info)).map((b) => squash(b.body)))
    .join("\n");
  for (const [name, declaration] of Object.entries(api.types)) {
    if (!declared.includes(squash(declaration))) problems.push(`docs/reference (${language}): the type ${name} is not declared in any \`ts decl\` block, or differs from colibri.d.ts`);
  }
  return problems;
}

// ── running it ───────────────────────────────────────────────────────────────────────────────────

const tracked = () => execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
const readTracked = (set) => (file) => (set.has(file) ? readFileSync(path.join(root, file), "utf8") : null);
const isTrackedDir = (all) => (dir) => all.some((f) => f.startsWith(dir + "/"));
const fail = (problems) => {
  console.error(problems.map((p) => `  ✗ ${p}`).join("\n"));
  console.error(`\n${problems.length} problem(s).`);
  process.exit(1);
};

function referencePages(read, language) {
  const names = [...new Set([...Object.values(REFERENCE_PAGES), ...Object.values(CHANNEL_PAGES), BRIDGE_PAGE])];
  return Object.fromEntries(names.map((n) => [n, read(`docs/reference/${n}${language === "en" ? ".en.md" : ".md"}`)]));
}

function check() {
  const all = tracked();
  const set = new Set(all);
  const read = readTracked(set);
  const md = all.filter((f) => f.endsWith(".md") && !f.includes("node_modules/"));
  const problems = [...checkPairs(md)];
  for (const page of md) {
    const text = read(page);
    problems.push(...checkAccidentalHeadings(page, text), ...checkPublic(page, text), ...checkLinks(page, text, read, isTrackedDir(all)));
    if (!page.endsWith(".en.md") && !UNPAIRED.has(page) && set.has(englishOf(page))) problems.push(...checkPairShape(page, text, read(englishOf(page))));
  }
  for (const file of ["sdk/colibri.js", "sdk/colibri.d.ts"]) problems.push(...checkPublic(file, read(file)));
  problems.push(...checkPublished(read("scripts/published-ids.txt") ?? "", read));
  const api = parseTypes(read("sdk/colibri.d.ts"));
  const sdk = parseSdk(read("sdk/colibri.js"));
  problems.push(...checkSdkAgreement(api, sdk));
  for (const language of ["ru", "en"]) problems.push(...checkReference(api, sdk, referencePages(read, language), language));
  if (problems.length) fail(problems);
  console.log(`${md.length} pages: pairs, links, anchors, published ids and the reference against colibri.d.ts all hold.`);
}

/** The prelude a snippet without imports gets: the default export, every named value and type. */
export function prelude(api) {
  const values = [...Object.keys(api.namespaces), ...Object.keys(api.values)].sort();
  return [
    `import colibri from "@colibri-terminal/sdk";`,
    `import { ${values.join(", ")} } from "@colibri-terminal/sdk";`,
    `import type { ${Object.keys(api.types).sort().join(", ")} } from "@colibri-terminal/sdk";`,
  ].join("\n");
}

/** Every js/ts block of README and docs/, minus `ts decl` blocks and those marked `<!-- check: skip -->`. */
export function snippetsOf(page, text) {
  const out = [];
  const raw = text.split(/\r?\n/);
  for (const b of blocks(text)) {
    const lang = b.info.split(/\s+/)[0];
    if (!["js", "ts", "javascript", "typescript"].includes(lang) || /\bdecl\b/.test(b.info)) continue;
    let i = b.n - 2;
    while (i >= 0 && !raw[i].trim()) i--;
    const marker = i >= 0 ? /<!--\s*check:\s*(skip|prelude)\s*([\s\S]*?)-->/.exec(raw[i]) : null;
    if (marker?.[1] === "skip") continue;
    out.push({ where: `${page}:${b.n}`, code: b.body, extra: marker?.[1] === "prelude" ? marker[2].trim() : "" });
  }
  return out;
}

function snippets() {
  const all = tracked();
  const read = readTracked(new Set(all));
  const tsc = path.join(root, "starters/react/node_modules/typescript/bin/tsc");
  if (!existsSync(tsc)) fail(["no TypeScript: run `npm ci --prefix starters/react` first"]);
  const api = parseTypes(read("sdk/colibri.d.ts"));
  const pages = all.filter((f) => /^(README(\.en)?\.md|docs\/.+\.md)$/.test(f));
  const found = pages.flatMap((p) => snippetsOf(p, read(p)));
  const dir = mkdtempSync(path.join(os.tmpdir(), "colibri-snippets-"));
  try {
    writeFileSync(path.join(dir, "colibri.d.ts"), read("sdk/colibri.d.ts"));
    writeFileSync(
      path.join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "es2022",
          module: "es2022",
          moduleResolution: "bundler",
          lib: ["es2022", "dom", "dom.iterable"],
          strict: false,
          noEmit: true,
          skipLibCheck: true,
          allowJs: false,
          paths: { "@colibri-terminal/sdk": ["./colibri.d.ts"] },
        },
        include: ["*.ts"],
      }),
    );
    const names = found.map((s, i) => {
      const name = `snippet-${String(i + 1).padStart(3, "0")}.ts`;
      const head = /^\s*import\s/m.test(s.code) ? "" : prelude(api) + "\n";
      writeFileSync(path.join(dir, name), `${head}${s.extra ? s.extra + "\n" : ""}${s.code}\nexport {};\n`);
      return { name, where: s.where, offset: (head ? head.split("\n").length - 1 : 0) + (s.extra ? s.extra.split("\n").length : 0) };
    });
    try {
      execFileSync(process.execPath, [tsc, "-p", dir], { encoding: "utf8", stdio: "pipe" });
    } catch (e) {
      const out = String(e.stdout || "") + String(e.stderr || "");
      const problems = out
        .split(/\r?\n/)
        .filter((l) => /snippet-\d+\.ts\(\d+,\d+\)/.test(l))
        .map((l) => {
          const m = /(snippet-\d+\.ts)\((\d+),(\d+)\): (.*)$/.exec(l);
          const s = names.find((x) => x.name === m[1]);
          const [page, start] = s.where.split(":");
          return `${page}:${Number(start) + Number(m[2]) - s.offset}: ${m[4]}`;
        });
      fail(problems.length ? problems : [out.trim()]);
    }
    console.log(`${found.length} snippets in ${pages.length} pages type-check against sdk/colibri.d.ts.`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** What the reference lacks, as headings, `ts decl` blocks and scope lines to paste. */
function scaffold() {
  const all = tracked();
  const read = readTracked(new Set(all));
  const api = parseTypes(read("sdk/colibri.d.ts"));
  const sdk = parseSdk(read("sdk/colibri.js"));
  const language = process.argv.includes("--en") ? "en" : "ru";
  const pages = referencePages(read, language);
  for (const e of expectedReference(api, sdk)) {
    if (pages[e.page] && sectionOf(pages[e.page], e.id)) continue;
    console.log(`<!-- ${e.page} -->\n### <a id="${e.id}"></a>\`${e.name}\`\n`);
    if (e.signature) console.log("```ts decl\n" + e.signature + "\n```\n");
    if (e.scope) console.log(`${language === "en" ? "Scope" : "Разрешение"}: ${e.scope.map((s) => `\`${s}\``).join(", ")}\n`);
  }
}

const commands = { check, snippets, scaffold };
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = commands[process.argv[2]];
  if (!command) fail([`usage: node scripts/docs.mjs ${Object.keys(commands).join("|")}`]);
  command();
}
