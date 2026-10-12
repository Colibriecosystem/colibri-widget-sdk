// node --test scripts/docs.test.mjs — the docs gate: anchors, links, pairs, and the reference against the types.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  anchors,
  checkAccidentalHeadings,
  checkLinks,
  checkPairShape,
  checkPairs,
  checkPublic,
  checkPublished,
  checkReference,
  checkSdkAgreement,
  headings,
  kebab,
  parseSdk,
  parseTypes,
  scopeOf,
  slug,
  snippetsOf,
} from "./docs.mjs";

const files = (map) => (file) => (file in map ? map[file] : null);
const noDirs = () => false;

test("a heading's anchor is GitHub's: lowercase, punctuation dropped, spaces to hyphens, Cyrillic kept", () => {
  assert.equal(slug("Номер версии виджета и совместимость"), "номер-версии-виджета-и-совместимость");
  assert.equal(slug("A widget's version number, and compatibility"), "a-widgets-version-number-and-compatibility");
  assert.equal(slug("manifest.legacy-fields"), "manifestlegacy-fields");
  assert.equal(slug("Стадия 1 · Разработка"), "стадия-1--разработка");
  assert.deepEqual(
    headings("### `manifest.legacy-fields`").map((h) => h.slug),
    ["manifestlegacy-fields"],
  );
});

test("a repeated heading gets -1 and -2, as on GitHub", () => {
  assert.deepEqual(
    headings("## Errors\n\n## Errors\n\n## Errors").map((h) => h.slug),
    ["errors", "errors-1", "errors-2"],
  );
});

test("an id inside a heading is an anchor and leaves the heading's own slug alone", () => {
  const page = '## <a id="release-version"></a>Номер версии';
  const found = anchors(page);
  assert.ok(found.has("release-version"));
  assert.ok(found.has("номер-версии"));
});

test("a link inside a code block is not checked", () => {
  const page = "```md\n[gone](nowhere.md)\n```\n";
  assert.deepEqual(checkLinks("a.md", page, files({}), noDirs), []);
});

test("a relative link to a file that is not tracked is a problem", () => {
  const problems = checkLinks("README.md", "See [ROUTES](colibri.js).", files({}), noDirs);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /README\.md:1: links colibri\.js/);
});

test("a link to an anchor its page does not have is a problem", () => {
  const read = files({ "docs/b.md": "## <a id=\"here\"></a>Here" });
  assert.deepEqual(checkLinks("docs/a.md", "[ok](b.md#here)", read, noDirs), []);
  assert.match(checkLinks("docs/a.md", "[bad](b.md#there)", read, noDirs)[0], /has no #there/);
});

test("a link to this repository's own GitHub page is checked like a relative one", () => {
  const read = files({ "CHECKS.md": "### `size.too-large`" });
  const own = "https://github.com/Colibriecosystem/colibri-widget-sdk/blob/main/CHECKS.md";
  assert.deepEqual(checkLinks("README.md", `[x](${own}#sizetoo-large)`, read, noDirs), []);
  assert.equal(checkLinks("README.md", `[x](${own}#nope)`, read, noDirs).length, 1);
});

test("a published id that disappears is a problem", () => {
  const list = "// comment\ndocs/publishing.md#release-version\n";
  const both = files({ "docs/publishing.md": '## <a id="release-version"></a>x', "docs/publishing.en.md": '## <a id="release-version"></a>x' });
  assert.deepEqual(checkPublished(list, both), []);
  const enLost = files({ "docs/publishing.md": '## <a id="release-version"></a>x', "docs/publishing.en.md": "## x" });
  assert.match(checkPublished(list, enLost)[0], /publishing\.en\.md has no #release-version/);
});

test("a Russian page without its English pair is a problem, and AGENTS.md is exempt", () => {
  assert.deepEqual(checkPairs(["AGENTS.md", "CHECKS.md", "CHECKS.en.md"]), []);
  assert.match(checkPairs(["docs/recipes.md"])[0], /no English pair/);
  assert.match(checkPairs(["docs/recipes.en.md"])[0], /no Russian original/);
});

test("a pair whose ids, heading levels or code-block languages differ is a problem naming the page", () => {
  const ru = '# Т\n\n## <a id="a"></a>А\n\n```js\nx\n```\n';
  assert.deepEqual(checkPairShape("p.md", ru, '# T\n\n## <a id="a"></a>A\n\n```js\nx\n```\n'), []);
  assert.match(checkPairShape("p.md", ru, '# T\n\n## <a id="b"></a>A\n\n```js\nx\n```\n')[0], /p\.md: the explicit ids differ/);
  assert.match(checkPairShape("p.md", ru, '# T\n\n### <a id="a"></a>A\n\n```js\nx\n```\n')[0], /heading structure differs/);
  assert.match(checkPairShape("p.md", ru, '# T\n\n## <a id="a"></a>A\n\n```ts\nx\n```\n')[0], /code blocks differ/);
});

test("a json block that differs between the languages is a problem", () => {
  const ru = '```json\n{"id": "a"}\n```';
  assert.match(checkPairShape("p.md", ru, '```json\n{"id": "b"}\n```')[0], /json block 1 differs/);
});

test("a paragraph directly above a --- line is caught, because GitHub renders it as a heading", () => {
  assert.equal(checkAccidentalHeadings("a.md", "Some prose.\n---\n").length, 1);
  assert.deepEqual(checkAccidentalHeadings("a.md", "Some prose.\n\n---\n"), []);
  assert.deepEqual(checkAccidentalHeadings("a.md", "| a |\n|---|\n"), []);
  assert.deepEqual(checkAccidentalHeadings("a.md", "```\nx\n---\n```\n"), []);
});

test("a link into a private repository or a private doc path is a problem", () => {
  assert.equal(checkPublic("a.md", "see docs/functionality/18-widget-platform.md").length, 1);
  assert.equal(checkPublic("a.md", "https://github.com/Colibriecosystem/colibri/blob/main/x").length, 1);
  assert.deepEqual(checkPublic("a.md", "https://github.com/Colibriecosystem/colibri-sdk and https://colibriecosystem.github.io/colibri-mockups/"), []);
});

const DTS = `
export type Channel =
  | "book"
  | "signalLevels";
export type HostEvent = "theme" | "streamReset";
export interface Book {
  /** a comment */
  symbol: string;
}
export declare function handshake(): Handshake;
export declare const API_VERSION: number;
export declare const SCOPES: {
  readonly marketData: "marketData";
};
export declare const markets: {
  /** The book. */
  book(exchange: string, symbol: string): Promise<Book>;
  subscribe<C extends Channel>(
    channel: C,
    handler: (data: unknown) => void,
  ): () => void;
};
export declare const storage: {
  get(key: string): Promise<string | null>;
};
`;

const JS = `
export const ROUTES = [
  ["GET", "/markets/{exchange}/{symbol}/book", false, "marketData"],
];
export const SCOPES = {
  marketData: "marketData",
};
export const markets = {
  book: (exchange, symbol) =>
    request("GET", \`/markets/\${encodeURIComponent(exchange)}/\${encodeURIComponent(symbol)}/book\`),
  subscribe(channel, handler) {
    return () => {};
  },
};
export const storage = {
  async get(key) {
    return null;
  },
};
`;

test("every namespace member of colibri.d.ts is read, multi-line signatures included", () => {
  const api = parseTypes(DTS);
  assert.deepEqual(Object.keys(api.namespaces), ["markets", "storage"]);
  assert.deepEqual(Object.keys(api.namespaces.markets), ["book", "subscribe"]);
  assert.match(api.namespaces.markets.subscribe, /^subscribe<C extends Channel>\(\n[\s\S]*\): \(\) => void;$/);
  assert.deepEqual(Object.keys(api.values).sort(), ["API_VERSION", "SCOPES", "handshake"]);
  assert.deepEqual(api.channels, ["book", "signalLevels"]);
  assert.deepEqual(api.events, ["theme", "streamReset"]);
  assert.ok(api.types.Book.includes("symbol: string;"));
});

test("colibri.js and colibri.d.ts naming different members is a problem", () => {
  const api = parseTypes(DTS);
  assert.deepEqual(checkSdkAgreement(api, parseSdk(JS.replace("subscribe(channel, handler) {", "subscribe(channel, handler) {"))), [
    "markets.subscribe: its scope cannot be derived — it calls no route in ROUTES and has no entry in SCOPE_EXEMPT",
  ]);
  const extra = JS.replace("export const storage = {", "export const storage = {\n  keys: () => request(\"GET\", \"/x\"),");
  assert.ok(checkSdkAgreement(api, parseSdk(extra)).some((p) => /colibri\.js has storage\.keys/.test(p)));
});

test("a member's scope comes from the route its wrapper calls", () => {
  const sdk = parseSdk(JS);
  assert.deepEqual(scopeOf("markets", "book", sdk.namespaces.markets.book, sdk.routes), ["marketData"]);
  assert.equal(scopeOf("markets", "subscribe", sdk.namespaces.markets.subscribe, sdk.routes), null);
});

test("storage, net and stream take their scope from the exemption table, not ROUTES", () => {
  assert.deepEqual(scopeOf("storage", "get", "async get(key) {}", []), ["storage"]);
  assert.deepEqual(scopeOf("net", "fetch", "fetch: (url) => bridge().net.fetch(url)", []), ["egress"]);
  assert.deepEqual(scopeOf("stream", "subscribe", "subscribe() {}", []), ["CHANNEL_SCOPES"]);
  assert.deepEqual(scopeOf("stream", "onAny", "onAny() {}", []), []);
});

test("SCOPES and CHANNEL_SCOPES are constants, not namespaces", () => {
  assert.deepEqual(Object.keys(parseSdk(JS).namespaces).sort(), ["markets", "storage"]);
});

const fullDts = DTS.replace(/  subscribe<C[\s\S]*?\): \(\) => void;\n/, "");
const fullJs = JS.replace(/  subscribe\(channel, handler\) \{[\s\S]*?\n  \},\n/, "");
const page = (body) => ({ "market-data": body, "account-and-trading": "", layout: "", notifications: "", "storage-and-net": STORAGE, bridge: BRIDGE });
const STORAGE = '### <a id="storage-get"></a>get\n\n```ts decl\nget(key: string): Promise<string | null>;\n```\n\nScope: `storage`.\n';
const BRIDGE = [
  '## <a id="handshake"></a>h\n\n```ts decl\nfunction handshake(): Handshake;\n```',
  '## <a id="api-version"></a>v\n\n```ts decl\nconst API_VERSION: number;\n```',
  '## <a id="scopes"></a>s\n\n```ts decl\nconst SCOPES: { readonly marketData: "marketData"; };\n```',
  '## <a id="event-theme"></a>t\n\n## <a id="event-stream-reset"></a>r',
  '```ts decl\ntype Channel = "book" | "signalLevels";\ntype HostEvent = "theme" | "streamReset";\ninterface Book { symbol: string; }\n```',
].join("\n\n");
const BOOK = '## <a id="markets-book"></a>`markets.book()`\n\n```ts decl\nbook(exchange: string, symbol: string): Promise<Book>;\n```\n\nScope: `marketData`.\n\n## <a id="channel-book"></a>b\n';

test("a member without a heading, or a heading without a member, is a problem in each language", () => {
  const api = parseTypes(fullDts);
  const sdk = parseSdk(fullJs);
  const pages = { ...page(BOOK), notifications: '## <a id="channel-signal-levels"></a>s' };
  assert.deepEqual(checkReference(api, sdk, pages, "en"), []);
  const missing = checkReference(api, sdk, { ...pages, "market-data": '## <a id="channel-book"></a>b' }, "en");
  assert.ok(missing.some((p) => /no section for markets\.book/.test(p)));
  const phantom = checkReference(api, sdk, { ...pages, "market-data": BOOK + '\n## <a id="markets-candles"></a>c' }, "ru");
  assert.ok(phantom.some((p) => /docs\/reference\/market-data\.md: #markets-candles names no member/.test(p)));
});

test("a member documented on another area's page is a problem", () => {
  const api = parseTypes(fullDts);
  const sdk = parseSdk(fullJs);
  const pages = { ...page('## <a id="channel-book"></a>b'), layout: BOOK.replace('## <a id="channel-book"></a>b\n', ""), notifications: '## <a id="channel-signal-levels"></a>s' };
  assert.ok(checkReference(api, sdk, pages, "en").some((p) => /layout\.en\.md: documents markets\.book .* which belongs on docs\/reference\/market-data\.en\.md/.test(p)));
});

test("a signature that differs from colibri.d.ts, or a scope line that differs from the derived one, is a problem", () => {
  const api = parseTypes(fullDts);
  const sdk = parseSdk(fullJs);
  const base = { notifications: '## <a id="channel-signal-levels"></a>s' };
  const wrongSig = checkReference(api, sdk, { ...page(BOOK.replace("symbol: string)", "symbol?: string)")), ...base }, "en");
  assert.ok(wrongSig.some((p) => /markets\.book section has no `ts decl` block/.test(p)));
  const wrongScope = checkReference(api, sdk, { ...page(BOOK.replace("Scope: `marketData`", "Scope: `trading`")), ...base }, "en");
  assert.ok(wrongScope.some((p) => /markets\.book needs `marketData`, but its scope line names `trading`/.test(p)));
  const ruScope = checkReference(api, sdk, { ...page(BOOK.replace("Scope:", "Разрешение:")), ...base }, "ru");
  assert.deepEqual(ruScope, []);
});

test("kebab turns camelCase and constants into ids", () => {
  assert.equal(kebab("removeBySymbol"), "remove-by-symbol");
  assert.equal(kebab("signalLevels"), "signal-levels");
  assert.equal(kebab("ColibriError"), "colibri-error");
});

test("a snippet marked skip is not compiled, and a prelude comment is prepended", () => {
  const text = [
    "```js",
    "markets.book('a', 'b');",
    "```",
    "",
    "<!-- check: skip -->",
    "```js",
    "partial(",
    "```",
    "",
    '<!-- check: prelude const exchange = "BinanceSpot"; -->',
    "",
    "```ts",
    "markets.book(exchange, 'b');",
    "```",
    "",
    "```ts decl",
    "book(): void;",
    "```",
  ].join("\n");
  const found = snippetsOf("docs/x.md", text);
  assert.deepEqual(
    found.map((s) => [s.where, s.extra]),
    [
      ["docs/x.md:1", ""],
      ["docs/x.md:12", 'const exchange = "BinanceSpot";'],
    ],
  );
});
