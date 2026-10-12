# Recipes

> Русская версия — [recipes.md](recipes.md).

Short answers to common tasks. Each recipe gives the goal, the scope it needs, the code, the
pitfalls and where to read next. The code is a page module with `colibri.js` beside the page, as in
the [starters](../starters/). Every call is described in full in the [reference](reference/README.en.md).

| Task | Scope |
| --- | --- |
| [The order book: at once, then live](#order-book) | `marketData` |
| [The trade tape](#last-trades) | `marketData` |
| [An account's positions and balance](#positions-and-balance) | `account:read` |
| [An order that never sends itself](#place-order-safely) | `trading`, `account:read` |
| [The terminal's colours](#follow-theme) | none |
| [The terminal's language](#follow-language) | none |
| [Settings that survive a restart](#save-settings) | `storage` |
| [Data from other venues](#outside-data) | hosts in `egress` |
| [A scope revoked while running](#revoked-scope) | any |
| [The user switched the API off](#bridge-off) | none |
| [Where is my slot, and what is beside it](#find-my-box) | `panels` |

## <a id="order-book"></a>The order book: at once, then live

Show the book right away, then keep it live. Scope: `marketData`.

```js
import { markets, stream } from "./colibri.js";

const exchange = "BinanceSpot";
const symbol = "BTCUSDT";
const $ = (id) => document.getElementById(id);

function paint(book) {
  if (book.exchange !== exchange || book.symbol !== symbol) return; // another subscription's frame
  const bid = book.bids[0];
  const ask = book.asks[0];
  // Prices and sizes are strings. Show them as they are; turn them into numbers only to do math.
  $("bid").textContent = bid ? `${bid.price} × ${bid.baseQty}` : "—";
  $("ask").textContent = ask ? `${ask.price} × ${ask.baseQty}` : "—";
  const tick = Number(book.tickSize);
  const spread = bid && ask ? Math.round((Number(ask.price) - Number(bid.price)) / tick) : null;
  $("spread").textContent = spread === null ? "—" : `${spread} ticks`;
}

// The first paint, at once. Before the terminal has the book it answers not_ready.
markets.book(exchange, symbol, { depth: 20 }).then(paint).catch(() => {});

// Then live snapshots: 20 levels a side, at most 4 a second.
const stop = stream.subscribe("book", { exchange, symbol, depth: 20, hz: 4 }, paint);
// Call stop() when the book is no longer needed: a subscription keeps the symbol open.
```

Pitfalls:

- **A `book` frame is a full snapshot, not a diff.** Replace the previous book with it whole.
- **Numbers are decimal strings.** `"64012.50"` and `"64012.5"` are the same price: compare after
  `Number()`, display the string, which carries as many decimals as the venue gave.
- **A handler sees every frame of its channel.** Subscribe to two symbols and both reach both
  handlers, which is why `paint` checks `exchange` and `symbol` first. `depth` is 1 to 1000, `hz` is
  1 to 10; a larger value is clamped.

Reference: [`markets.book()`](reference/market-data.en.md#markets-book),
[`stream.subscribe()`](reference/market-data.en.md#stream-subscribe),
[the `book` channel](reference/market-data.en.md#channel-book). Example:
[the Plain starter](../starters/plain/), [the Trading starter](../starters/trading/).

## <a id="last-trades"></a>The trade tape

Show a symbol's latest trades. Scope: `marketData`.

```js
import { stream } from "./colibri.js";

const exchange = "BinanceSpot";
const symbol = "BTCUSDT";
const KEEP = 200; // how many recent trades to keep
const tape = []; // your own ring: oldest first, newest last

stream.subscribe("trades", { exchange, symbol }, (frame) => {
  if (frame.exchange !== exchange || frame.symbol !== symbol) return;
  // A frame holds only the trades since the last one, oldest first: an increment, not a snapshot.
  tape.push(...frame.trades);
  if (tape.length > KEEP) tape.splice(0, tape.length - KEEP);
  schedule();
});

// Frames arrive faster than it is worth redrawing: at most one redraw per screen frame.
let queued = false;
function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    const rows = tape.slice(-30).reverse().map((t) => {
      const time = new Date(t.timeMs).toLocaleTimeString();
      const side = t.isBuy ? "buy" : "sell";
      return `<tr class="${side}"><td>${time}</td><td>${t.price}</td><td>${t.qty}</td></tr>`;
    });
    document.getElementById("tape").innerHTML = rows.join("");
  });
}
```

Pitfalls:

- **A frame is an increment.** A table redrawn from one frame shows a row or two: keep the trades
  yourself and trim the buffer yourself.
- **The stream has no history.** The tape starts when you subscribe. Volume by price over the past
  hours comes from [`markets.clusters()`](reference/market-data.en.md#markets-clusters).
- **`isBuy` is the aggressor's side:** `true` means a buyer lifted the ask. Some venues send one
  trade per fill, so frames can be many — draw no more often than the screen does.

Reference: [the `trades` channel](reference/market-data.en.md#channel-trades),
[`stream.subscribe()`](reference/market-data.en.md#stream-subscribe). Example:
[the Chart starter](../starters/chart/) builds candles from this tape.

## <a id="positions-and-balance"></a>An account's positions and balance

Show one connection's positions and balances and keep them live. Scope: `account:read`.

```js
import { connections, hasScope, stream } from "./colibri.js";

const $ = (id) => document.getElementById(id);
const state = { positions: null, balances: null };
const set = (key, value) => { state[key] = value; render(); };

function follow(id) {
  // Subscribe first, then read the snapshot: so the snapshot never overwrites a fresher frame.
  stream.subscribe("positions", { connectionId: id }, (d) => {
    if (d.connectionId === id) set("positions", d.positions);
  });
  stream.subscribe("balance", { connectionId: id }, (d) => {
    if (d.connectionId === id) set("balances", d.balances);
  });
  connections.positions(id).then((d) => state.positions ?? set("positions", d.positions));
  connections.balances(id).then((d) => state.balances ?? set("balances", d.balances));
}

function render() {
  // quantity is signed: plus is long, minus is short.
  const open = (state.positions ?? []).map((p) => `${p.symbol} ${p.quantity} @ ${p.entryPrice}`);
  const assets = (state.balances ?? [])
    .filter((b) => Number(b.free) + Number(b.locked) > 0)
    .map((b) => `${b.asset} ${b.free} (+${b.locked} in orders)`);
  $("positions").textContent = open.join("\n") || "no positions";
  $("balances").textContent = assets.join("\n");
}

if (!hasScope("account:read")) {
  $("positions").textContent = "The widget was not granted to see the account.";
} else {
  // The user picks the connection; to keep this short, it is the first one listed.
  const { connections: list } = await connections.list();
  if (list.length > 0) follow(list[0].id);
  else $("positions").textContent = "No connections: they are added in the Connections window.";
}
```

Pitfalls:

- **Every `positions` and `balance` frame is the whole set.** Replace the previous list rather than
  appending to it. An empty list means "no positions", not "nothing changed".
- **Numbers are strings**, and `quantity` is signed. Add them up after `Number()`.
- **The scope can be revoked while the widget runs.** Without `account:read` calls answer
  `unauthorized` and a subscription is refused — see the [revoked-scope recipe](#revoked-scope).

Reference: [`connections.list()`](reference/account-and-trading.en.md#connections-list),
[`connections.positions()`](reference/account-and-trading.en.md#connections-positions),
[`connections.balances()`](reference/account-and-trading.en.md#connections-balances),
[the `positions` channel](reference/account-and-trading.en.md#channel-positions),
[the `balance` channel](reference/account-and-trading.en.md#channel-balance). Example:
[the Trading starter](../starters/trading/).

## <a id="place-order-safely"></a>An order that never sends itself

Let the user place a limit order that leaves only on their explicit confirmation. Scopes:
`trading` for the order, `account:read` for the `orders` stream.

This is the [Trading starter](../starters/trading/)'s pattern cut down to its core. Keep it in your
widget too:

- **A demo connection first.** A live one carries a visible "LIVE — real money" bar.
- **Limit orders only** — no market orders, no cancel-all, no close-all. The SDK has these mass
  actions (`trading.cancelAll()`, `trading.closePositions()`); if your widget needs one, put it
  behind the same confirmation.
- **Price and size start empty** and are never restored from `storage`: a restarted widget can
  never be one click away from an order nobody typed.
- **The confirm step shows everything**: connection, symbol, side, price, size. Any edit closes it —
  what is confirmed is exactly what is sent.
- **Only a separate Confirm button sends** — a `<button type="button">` with no `<form>`, so Enter
  never presses it. Never on load, from a timer, from a stream handler, from a restored setting or
  on a keypress.

```html
<div id="live" hidden>LIVE — real money</div>
<input id="price" inputmode="decimal"> <input id="size" inputmode="decimal">
<button type="button" id="buy">Buy…</button>
<div id="confirm" hidden>
  <span id="summary"></span>
  <button type="button" id="confirm-do">Confirm</button>
  <button type="button" id="cancel">Cancel</button>
</div>
<div id="status"></div> <pre id="mine"></pre>
```

```js
import { connections, hasScope, stream, trading } from "./colibri.js";

const $ = (id) => document.getElementById(id);
const read = (id) => { const e = $(id); return e instanceof HTMLInputElement ? e.value : ""; };
const DECIMAL = /^\d+(\.\d+)?$/;
const REFUSED = {
  trading_not_enabled: "This widget may not trade on this connection: see Trading accounts.",
  not_ready: "The connection is not ready yet — try again in a couple of seconds.",
  budget_exceeded: "The order is over the budget the user set for this widget.",
  rate_limited: "Too many requests — wait a little.",
};
const { connections: list } = await connections.list(); // a demo connection first
const conn = list.find((c) => c.demo && !c.viewOnly) ?? list.find((c) => !c.viewOnly);
if (!conn) throw new Error("no connection that can trade");
$("live").hidden = conn.demo; // a live one carries the "LIVE — real money" bar

let pending = null; // "Buy…" sends nothing: it only shows what would be sent
$("buy").addEventListener("click", () => {
  const price = read("price"), size = read("size");
  if (!hasScope("trading") || !DECIMAL.test(price) || !DECIMAL.test(size)) return;
  pending = { symbol: "BTCUSDT", side: "BUY", type: "Limit", price, sizeBase: size };
  $("summary").textContent = `${conn.label || conn.exchange}: buy ${size} BTCUSDT at ${price}`;
  $("confirm").hidden = false;
});
const close = () => { pending = null; $("confirm").hidden = true; };
for (const id of ["price", "size"]) $(id).addEventListener("input", close);
$("cancel").addEventListener("click", close);
const mine = new Set(); // "Confirm" is the one place an order leaves from
$("confirm-do").addEventListener("click", async () => {
  const order = pending;
  close();
  if (!order) return;
  try { mine.add((await trading.place(conn.id, order)).clientOrderId); } // 202 — enqueued
  catch (e) { $("status").textContent = REFUSED[e.code] ?? e.message; } // by code, never by text
});
// The venue answers on the orders stream (working orders only); yours are known by clientOrderId.
stream.subscribe("orders", { connectionId: conn.id }, (d) => {
  const own = d.orders.filter((o) => mine.has(o.clientOrderId));
  $("mine").textContent = own.map((o) => `${o.side} ${o.filledQuantity}/${o.quantity}`).join("\n");
});
```

Pitfalls:

- **`202` means "enqueued", not "filled".** The venue's answer arrives on the `orders` stream. An
  order that leaves it is no longer working: it was filled, cancelled or rejected. A fill shows in
  the positions.
- **Trading is granted to the widget itself, per connection** — in its permissions, under Trading
  accounts, together with the per-order and per-minute limits. The widget cannot know in advance:
  a connection's `apiTradingEnabled` is about external programs, not widgets. It finds out from a
  `trading_not_enabled` (403) refusal — then tell the user where to allow it.
- **The other refusals go by `code` too, never by text.** `not_ready` (503) — the connection is
  not ready yet; `budget_exceeded` (403) — the order is over the per-order or per-minute budget the
  user set for your widget; `rate_limited` (429) — too many calls. Show it to the user; do not retry
  in a loop.

Reference: [`trading.place()`](reference/account-and-trading.en.md#trading-place),
[the `orders` channel](reference/account-and-trading.en.md#channel-orders),
[`connections.list()`](reference/account-and-trading.en.md#connections-list),
[errors](reference/README.en.md#errors). Example: [the Trading starter](../starters/trading/),
`src/App.tsx`.

## <a id="follow-theme"></a>The terminal's colours

Look native in whatever theme the user picks, light or dark. No scope needed.

The terminal puts its palette into CSS variables on `<html>` before your page's code runs, and
updates them whenever the theme, the colours, the font size or the language changes. Use the
**roles** — `--colibri-role-*`; the second value in `var()` is only there for opening the page
outside the terminal:

```css
body {
  background: var(--colibri-role-background, #0b0e13);
  color: var(--colibri-role-text, #d8dee9);
  font-size: calc(13px * var(--colibri-font-scale, 1));
}
.card  {
  background: var(--colibri-role-surface, #171b23);
  border: 1px solid var(--colibri-role-divider, #2a2f3a);
}
.muted { color: var(--colibri-role-dim-text, #8b93a3); }
.buy   { color: var(--colibri-role-bullish, #4caf50); }
.sell  { color: var(--colibri-role-bearish, #e05252); }
.link  { color: var(--colibri-role-accent, #4c8dff); }
:root[data-theme="light"] .logo { filter: invert(1); }
```

Code is needed only where `var()` does not reach — on a canvas, for instance:

```js
import { on } from "./colibri.js";

function palette() {
  const css = getComputedStyle(document.documentElement);
  const pick = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return {
    up: pick("--colibri-role-bullish", "#26a17b"),
    down: pick("--colibri-role-bearish", "#e05260"),
    grid: pick("--colibri-role-divider", "#2a2f38"),
    scale: Number(pick("--colibri-font-scale", "1")) || 1,
  };
}

let colors = palette();
function redraw() {
  // … redraw the canvas with colors
}

// When the event arrives, the variables on <html> are already the new ones.
on("theme", (e) => {
  colors = palette();
  console.log(`theme ${e.theme}, font ×${e.fontScale}`);
  redraw();
});
```

Pitfalls:

- **There is no separate "buy" or "sell" variable.** Their colours are the roles `--colibri-role-bullish` and
  `--colibri-role-bearish`. The full list of roles is in the [theme reference](reference/theme.en.md#roles).
- **`--colibri-<element>` names parts of the terminal's order book**, not interface colours. For
  your own buttons, background and text use the roles: there are ten, and each makes sense in any
  palette.
- **Do not hard-code a background.** The user may pick a light theme; `data-theme` on `<html>`
  (`dark` or `light`) is only for what a colour cannot express, such as images.

Reference: [roles](reference/theme.en.md#roles), [the `<html>` attributes](reference/theme.en.md#attributes),
[the `theme` event](reference/bridge.en.md#event-theme). Example: all four
[starters](../starters/); [Chart](../starters/chart/) draws on a canvas.

## <a id="follow-language"></a>The terminal's language

Show text in the terminal's language and switch along with it. No scope needed.

```html
<h1 data-t="title"></h1>
<p data-t="empty"></p>
```

```js
import { handshake, on } from "./colibri.js";

// Every key goes into both tables.
const TEXT = {
  ru: { title: "Фандинг", empty: "Нет данных", updated: "Обновлено в {0}" },
  en: { title: "Funding", empty: "No data", updated: "Updated at {0}" },
};
const pickLang = (tag) => (tag === "ru" ? "ru" : "en"); // anything but Russian shows English
let lang = pickLang(handshake().lang);
const t = (key, ...args) => TEXT[lang][key].replace(/\{(\d)\}/g, (_, i) => String(args[i]));

function paintLabels() {
  for (const el of document.querySelectorAll("[data-t]")) {
    el.textContent = t(el.getAttribute("data-t"));
  }
}

// The language changes while the widget runs, with no reload — along with the theme event.
on("theme", (e) => {
  lang = pickLang(e.lang);
  paintLabels();
});
paintLabels();
console.log(t("updated", new Date().toLocaleTimeString(lang)));
```

Pitfalls:

- **There is no separate language event.** The new language arrives as the `lang` field of the
  `theme` event; `handshake().lang` is already updated by then.
- **The language is not only `ru` or `en`.** Pick a default for every other one.
- **CSS has the language on `<html>` too:** `data-colibri-lang`, for instance
  `:root[data-colibri-lang="ru"] .label { width: 9em; }`.

Reference: [`handshake()`](reference/bridge.en.md#handshake),
[the `theme` event](reference/bridge.en.md#event-theme), [language](reference/theme.en.md#language).
Example: [the Plain starter](../starters/plain/) — a table in the page;
[the Trading starter](../starters/trading/) — `src/i18n.ts`.

## <a id="save-settings"></a>Settings that survive a restart

Remember the user's choice: venue, symbol, threshold. Scope: `storage`.

```js
import { storage } from "./colibri.js";

// storage holds strings: an object goes through JSON.
const DEFAULTS = { exchange: "BinanceSpot", symbol: "BTCUSDT", alertAbove: "" };

async function load() {
  try {
    const raw = await storage.get("settings");
    return { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULTS }; // no scope, or a damaged entry — run on the defaults
  }
}

async function save(settings) {
  try {
    await storage.set("settings", JSON.stringify(settings));
  } catch (e) {
    console.warn("settings were not saved:", e.code ?? e);
  }
}

let settings = await load();
// … the user picked another symbol:
settings = { ...settings, symbol: "ETHUSDT" };
await save(settings);
```

Pitfalls:

- **Each instance has its own storage.** Two instances of one widget never see each other's keys.
  It survives a restart and an update of the widget, and it is wiped when the widget is uninstalled.
- **In-memory state does not survive a reload**, and while you develop, the widget reloads on every
  file save. Anything the user would hate to type again belongs in `storage`, not in
  `localStorage`: that one is shared by every instance of the widget, because they share an origin.
- **Orders are never restored.** Saving the connection and the symbol is fine; an order's price and
  size are not — see the [safe order](#place-order-safely).

Reference: [`storage.get()`](reference/storage-and-net.en.md#storage-get),
[`storage.set()`](reference/storage-and-net.en.md#storage-set). Example:
[the Plain starter](../starters/plain/) keeps the venue and the symbol,
[the Trading starter](../starters/trading/) the connection and the symbol.

## <a id="outside-data"></a>Data from other venues

Get data the terminal does not have: another venue, the whole market, funding across six venues.
No scope needed — the hosts go in the manifest's `egress`.

`markets.*` serves what the terminal itself has open: a symbol is held while a panel or a
subscription holds it. A whole-venue scan cannot rest on that, so connect to the venue yourself.
The user sees the `egress` list at install:

```json
{
  "egress": ["futures.kraken.com", "fstream.binance.com"]
}
```

```js
import { net } from "./colibri.js";

// REST through the terminal: Kraken Futures sends no CORS headers, so fetch() cannot read it.
async function venueJson(url) {
  const r = await net.fetch(url);
  if (!r.ok) throw new Error(r.code); // never reached the venue: egress_denied, rate_limited, …
  if (r.status >= 300) throw new Error(`HTTP ${r.status}`); // reached it, and it answered an error
  return JSON.parse(r.body); // body is text: parsing is yours
}
const { tickers } = await venueJson("https://futures.kraken.com/derivatives/api/v3/tickers");
console.log(`tickers: ${tickers.length}`);

// A WebSocket goes straight from the page, but only to a host in egress.
const ws = new WebSocket("wss://fstream.binance.com/stream?streams=!forceOrder@arr");
ws.onmessage = (m) => console.log(JSON.parse(m.data)); // liquidations across the whole market
```

Pitfalls:

- **A socket to a host outside `egress` fails at once**, with a `SecurityError`: the terminal
  serves your page with a `Content-Security-Policy: connect-src` built from that list. The blocked
  host shows in the F12 report. A host without a port covers any port; `ws.okx.com:8443` covers
  only 8443.
- **`net.fetch` is `https` only, GET and POST only**, and redirects are not followed: a 3xx comes
  back as it is. `ok: true` means "reached the venue", not "2xx" — check the status yourself. The
  limit is 60 calls a minute per instance.
- **Reconnecting is yours.** Sockets drop; reconnect with a pause, and send the venue's heartbeat if
  it expects one — the browser does not send WebSocket pings by itself.

Reference: [`net.fetch()`](reference/storage-and-net.en.md#net-fetch),
[`egress`](reference/manifest.en.md#manifest-egress), [where market data
comes from](reference/market-data.en.md#market-data-sources). Example:
[Funding monitor](../examples/funding-monitor/) reads REST through `net.fetch`,
[Liquidation radar](../examples/liquidation-radar/) keeps its own sockets. Nest check:
[`egress-ws.undeclared-host`](../CHECKS.en.md#egress-wsundeclared-host).

## <a id="revoked-scope"></a>A scope revoked while running

Survive a revoked scope: show what is gone instead of failing. Scope: any — here `account:read`.

```js
import { ColibriError, connections, hasScope, on } from "./colibri.js";

const $ = (id) => document.getElementById(id);

// Scopes change while the widget runs: the user edits them in My widgets.
function applyScopes() {
  const canSee = hasScope("account:read");
  $("account").hidden = !canSee;
  $("no-account").hidden = canSee; // "The widget was not granted to see the account"
  if (canSee) void refresh();
}

async function refresh() {
  try {
    const { connections: list } = await connections.list();
    $("account").textContent = list.map((c) => c.label || c.exchange).join(", ");
  } catch (e) {
    // Revoked between the check and the call — the same state, not an error.
    if (e instanceof ColibriError && e.code === "unauthorized") $("no-account").hidden = false;
    else throw e;
  }
}

on("grants", applyScopes); // handshake().grantedScopes is already the new set by then
applyScopes();
```

Pitfalls:

- **`unauthorized` (401) does not say which scope was missing** — on purpose. Check `hasScope()`
  before the call and listen for the `grants` event.
- **Stop whatever lived on that scope:** polls, subscriptions to its channels, buttons that will
  not work without it.
- **Do not fail at start.** A widget missing some scopes shows what it can and says where to grant
  the rest.

Reference: [`hasScope()`](reference/bridge.en.md#has-scope),
[the `grants` event](reference/bridge.en.md#event-grants), [permissions](reference/README.en.md#permissions).
Example: [the Trading starter](../starters/trading/) hides the ticket and the account without their
scopes.

## <a id="bridge-off"></a>The user switched the API off

Survive the API being off: the widget runs, but no terminal call gets through. No scope needed.

The user can switch the API off for every widget: Nest → Settings → API bridge. The widget keeps
running, and every call answers `bridge_disabled` (503).

```js
import { ColibriError, markets, on } from "./colibri.js";

const banner = document.getElementById("bridge-off"); // "The widget API is off"
const last = document.getElementById("last");

async function load() {
  try {
    const book = await markets.book("BinanceSpot", "BTCUSDT", { depth: 1 });
    last.textContent = book.lastPrice;
    banner.hidden = true;
  } catch (e) {
    if (e instanceof ColibriError && e.code === "bridge_disabled") banner.hidden = false;
    else throw e;
  }
}

// Switched on or off — the bridge event arrives. No need to poll in a loop.
on("bridge", (e) => {
  banner.hidden = e.enabled;
  if (e.enabled) void load(); // repeat one-off reads; stream.subscribe comes back by itself
});
void load();
```

Pitfalls:

- **`handshake()` has no bridge state.** The first `bridge_disabled` refusal tells you the API is
  off at start; after that, the `bridge` event arrives on every switch.
- **`stream.subscribe` subscriptions restore themselves** when the API is switched back on. Code
  that talks to `window.colibri` directly subscribes again itself.
- **It is the user's choice, not a failure.** A calm line instead of a red error, and no retries in
  a loop.

Reference: [the `bridge` event](reference/bridge.en.md#event-bridge),
[`ColibriError`](reference/bridge.en.md#colibri-error), [errors](reference/README.en.md#errors).
Example: [the Plain starter](../starters/plain/), [the Trading starter](../starters/trading/).

## <a id="find-my-box"></a>Where is my slot, and what is beside it

Find which slot the widget sits in and what the neighbouring slots hold — for instance, the order
book next to it, to follow its symbol. Scope: `panels`.

```js
import { handshake, on, workspace } from "./colibri.js";

// Neighbours are the slots in the same split as mine.
async function neighbours() {
  const slotId = handshake().slotId;
  if (!slotId) return []; // in a window slotId is null: no neighbours
  const { position } = await workspace.slot(slotId);
  if (!position.parent) return []; // my slot is the only one on its tab
  const { tab } = await workspace.tab(position.tabId);
  let node = tab.layout; // from the tab's root down to my split
  for (const i of position.path.slice(0, -1)) {
    if (node.type === "split") node = node.children[i];
  }
  return node.type === "split" ? node.children.filter((_, i) => i !== position.parent.index) : [];
}

// "The order book next to me" — the first neighbour holding one.
async function bookNextToMe() {
  for (const box of await neighbours()) {
    if (box.type === "slot" && box.content.kind === "orderbook") return box.content;
  }
  return null;
}

async function follow() {
  const book = await bookNextToMe();
  document.getElementById("target").textContent = book ? `${book.exchange} ${book.symbol}` : "—";
}

// The widget can move to another slot or into a window without a restart — then surface arrives.
on("surface", () => void follow());
void follow();
```

Pitfalls:

- **`panels.*` is deprecated** and removed in terminal 1.4.0. New code uses `workspace`.
- **The user changes the layout without an event.** `surface` arrives only when the widget itself
  moves. If what is beside you matters, read the layout again before acting.
- **A neighbour is a slot in the same split only.** A book two levels up is not a neighbour: for
  that, walk the tab's whole tree from `workspace.tab()`.

Reference: [`handshake()`](reference/bridge.en.md#handshake),
[the `surface` event](reference/bridge.en.md#event-surface),
[`workspace.slot()`](reference/layout.en.md#workspace-slot),
[`workspace.tab()`](reference/layout.en.md#workspace-tab). No starter does this.
