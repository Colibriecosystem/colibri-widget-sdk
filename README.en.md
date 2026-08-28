# @colibri-terminal/sdk

> Русская версия — [README.md](README.md), она же основная.
>
> The author's path — three stages, from a folder to the catalog: [AUTHORING.en.md](AUTHORING.en.md).
>
> Publication and revocation rules: [policies/](policies/).

The typed client for the Colibri widget API. A widget is a web page the terminal hosts in an
embedded WebView; this package is the ergonomic way to talk to the terminal from inside it.

## The one thing to understand first

The terminal injects a raw tunnel at `window.colibri` **before any of your page's code runs** —
this SDK is *sugar over that object*, never a second contract. Everything here is optional: a
widget that prefers `window.colibri.request("GET", "/exchanges")` is equally supported and will
never fall behind, because both go through the same route table.

That table is not copied by hand: [`ROUTES`](colibri.js) is compared against the terminal's live
routes by a unit test in the terminal itself, so this SDK cannot silently drift from the API it
wraps.

## Where market data comes from (read this before building a screener)

**Your widget owns its market data.** The terminal's `markets.*` routes serve what the TERMINAL
has open — a symbol is held because a panel or a caller pinned it, and released when it goes
idle — so they are panel-coupled by construction and cannot answer a whole-venue scan. They are
fully supported for what they are (the book the user is already watching, the venue catalog,
cluster history), and a widget is welcome to use them. They are simply never the thing your
widget's core function should rest on.

For scanning, screening, or any data the terminal does not already have open, connect to the
venue yourself: list the hosts in your manifest's `egress` allowlist and open your own venue
WebSockets. They work from a page context already, and for venue REST endpoints that ship no
CORS headers the host fulfills the request for you, so CORS is not your problem either.

What only the terminal has — and therefore what this SDK is really for — is your accounts:
connections, positions, orders, balances, closed-trade history, trading through your keys, plus
panels, notifications and price alerts.

## Install

No build step and no dependencies. Either vendor the two files next to your page:

```html
<script type="module">
  import colibri from "./colibri.js";
</script>
```

…or, once published, `npm i @colibri-terminal/sdk`.

## Use

```js
import colibri, { markets, panels, notifications, storage, stream, on } from "./colibri.js";

// Who am I, and what may I do? Available synchronously — no await, no ready event.
const { widgetId, instanceId, surface, theme, grantedScopes } = colibri.handshake();

// Read terminal state.
const venues = await markets.exchanges();
const book = await markets.book("BinanceSpot", "BTCUSDT", { depth: 20 });

// Act on the terminal.
await panels.add({ content: { exchange: "BinanceSpot", symbol: "ETHUSDT", views: ["orderbook"] }, activate: true });
await notifications.raise({ message: "Spread widened past 4 bps", severity: "warning" });

// Live data. Returns an unsubscribe function; re-subscribes itself if the bridge is toggled.
const stop = stream.subscribe("trades", { exchange: "BinanceSpot", symbol: "BTCUSDT" }, (data) => {
  for (const t of data.trades) console.log(t.price, t.qty, t.isBuy);
});

// Durable per-instance state — survives restarts, wiped when the widget is uninstalled.
await storage.set("layout", JSON.stringify({ sort: "volume" }));

// The terminal's theme is applied to your page automatically (CSS custom properties); listen
// only if you also need to react in code.
on("theme", (e) => console.log("theme is now", e.theme));
```

### Errors

Calls resolve with the response body on success and **reject** with a `ColibriError` otherwise, so
a forgotten check cannot pass a failure off as data. Switch on `code`, never on `message`:

```js
try {
  await notifications.raise({ message: "" });
} catch (e) {
  if (e.code === "bridge_disabled") { /* the user turned the API bridge off in Nest */ }
  else if (e.code === "bad_request") { /* your payload */ }
}
```

`bridge_disabled` (503) is worth handling explicitly: the user can switch the API bridge off in
**Nest → Settings**, which leaves your widget *running* but API-blind. You also get a `bridge`
event on both edges, so you can show a degraded state and recover without a reload.

Three more your widget can meet, all of them about limits the user set rather than bugs in your
payload:

- `unauthorized` (401) — the route needs a scope your widget was not granted. Declare it in the
  manifest and it becomes part of what the user is asked to consent to.
- `rate_limited` (429) — too many calls in the last minute. Back off and retry; if you are
  polling for live data, subscribe to a stream instead, which is what streams are for.
- `budget_exceeded` (403) — an order was within its granted connection but over the per-order or
  per-minute budget the user set for your widget. Surface it to the user; do not retry in a loop.

## Styling

The host pushes its palette into your page as CSS custom properties (`--colibri-background`,
`--colibri-buy`, …) plus `data-theme` and `data-colibri-lang` on `<html>`, and re-pushes them
whenever the user changes theme, colours, font size or language. Use the variables and your widget
looks native with zero code.

## Versioning

`apiVersion` is additive within a major: new routes and new optional fields do not bump it. Declare
the minimum you need in your `widget.json` as `minApiVersion` — the terminal refuses to start a
widget that needs a newer API rather than failing halfway through its first call. This package's
semver major tracks `apiVersion`.

## Building a widget

A widget is a folder holding a `widget.json` and whatever your build produces. There is no SDK
install step and no toolchain the terminal cares about — if it emits HTML, it can be a widget.

```json
{
  "id": "my-widget",
  "name": "My Widget",
  "version": "1.0.0",
  "entry": "index.html",
  "icon": "icon.png",
  "surfaces": ["slot"],
  "permissions": ["marketData"],
  "minApiVersion": 1
}
```

`id` is a lowercase DNS label, because it is simultaneously your widget's origin
(`https://<id>.widgets.colibri.internal`) and its folder name. `permissions` is what the user is
asked to consent to — declare only what you use, since a manifest that grows a permission asks
again.

The optional `icon` field is an image path inside the bundle (PNG, up to 512 KB): the terminal
renders it everywhere the widget is visible — the catalog card and listing, the My-widgets list,
the Notifications window Widgets tab, the bottom-strip bookmark, the panel and window headers,
the 🧩 menu. Without one, the 🧩 glyph shows everywhere. And on `surfaces`: only a widget that
declares `"window"` can be opened as a standalone window and pinned to the bottom bookmark strip —
a slot-only widget lives in panels exclusively.

Then, in the terminal: **Nest → "My widgets" → "Add widget…" → the Development card → "Load unpacked…"** and pick
that folder. The terminal serves it **in place** — nothing is copied — so the folder you keep
editing is the folder the widget runs from. Place it with the 🧩 button on an empty panel.

### The edit-save-see loop

Watch is on by default. Save a file and the widget reloads itself, typically in well under a
second. Point the loader at your build OUTPUT (`dist/`), not your source tree: a bundle is capped
at 2000 files and 50 MB, and a `node_modules` tree blows through both — the refusal will say
which cap it hit.

With a bundler, `vite build --watch` (or your equivalent) is the whole loop: it rewrites `dist/`
on every save and the terminal picks it up. Make sure your `widget.json` is copied into the output
— in Vite, putting it in `public/` does that.

If you would rather use HMR, you can: set `entry` to `http://localhost:5173` and the terminal
loads your dev server directly. That form is accepted **only** for an unpacked widget, and only
for literal `localhost` / `127.0.0.1` — it is a development affordance, not a distributable
manifest.

`DevTools` on the widget's row (or in the widget's ⚙ menu) opens Chromium DevTools against your
page: console, network, elements, the usual. For an installed widget the affordance is off unless
you turn on «Инструменты разработчика для установленных виджетов».

### Surviving a reload

A reload re-navigates the page, so in-memory state is gone. `storage` is the durable half — it is
per widget-instance, survives restarts and updates, and is wiped when the widget is uninstalled.
Keep anything the user would be annoyed to re-enter there.

## Packaging

«Упаковать для «Гнезда»» turns the folder into a `.zip` plus the **content hash** a listing pins.

The contract is over the **extracted content, never the zip bytes**: extract the archive to a
directory, hash it, and you must get the same value. That is deliberate — it means the hash you
submit is reproducible on any machine with any zip tool, because timestamps, entry order and
compression level cannot affect it.

The hash is SHA-256 over, for each file in ordinal path order,
`UTF-8(relative path) ‖ 0x00 ‖ int64-LE(length) ‖ SHA-256(bytes)`. Paths use forward slashes,
empty directories contribute nothing, and symlinks are refused outright — a link could otherwise
smuggle content from outside the folder past the pin, which also means an extractor must never
materialize one.

A manifest whose `entry` is a dev server cannot be packed: there is nothing to distribute.
## Reference

- Route and stream wire shapes: `docs/functionality/16-local-api-and-widgets.md`
- The widget platform (manifest, install, lifecycle, bridge): `docs/functionality/18-widget-platform.md`
- A working widget: [`sample-widget/`](sample-widget)
- A starter project (TypeScript + React, no framework lock-in): the `template/` folder of the public SDK repository
