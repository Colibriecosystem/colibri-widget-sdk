# The bridge, functions and host events

> Русская версия — [bridge.md](bridge.md).

What belongs to no single API area lives here: calling any route, what the instance is, checking
scopes, the host events, the error class and the constants. At the end are the types, among them
`ColibriBridge` — `window.colibri` itself. How the bridge differs from the SDK is in the
[reference index](README.en.md#bridge-vs-sdk).

Outside the terminal — in an ordinary browser, say — there is no bridge, and every function here
throws a plain `Error`.

## <a id="functions"></a>Functions

### <a id="request"></a>`request()`

```ts decl
function request<T = unknown>(method: string, path: string, options?: RequestOptions): Promise<T>;

interface RequestOptions {
  /** Query parameters; `undefined` / `null` values are dropped. */
  params?: Record<string, string | number | boolean | null | undefined>;
  /** JSON body for POST / PUT / PATCH. */
  body?: unknown;
  /** Response-shape version to ask for; defaults to {@link API_VERSION}. */
  apiVersion?: number;
}
```

Calls any route in [`ROUTES`](#routes): resolves with the response body on 2xx and rejects with a
[`ColibriError`](#colibri-error) on any other status. Every area function that calls a route —
`markets.book()` and the rest — wraps it; use `request()` when there is no wrapper. It needs the scope the route carries in
`ROUTES`. The SDK does not encode the path: wrap path segments in `encodeURIComponent`, and pass
parameters in `params`.

```ts
import { request } from "./colibri.js";
import type { Book } from "./colibri.js";

const symbol = "BTCUSDT";
const book = await request<Book>("GET", `/markets/BinanceSpot/${encodeURIComponent(symbol)}/book`, {
  params: { depth: 20 },
});
console.log(book.bestBid, book.bestAsk);
```

### <a id="handshake"></a>`handshake()`

```ts decl
function handshake(): Handshake;

/** What the instance is, available synchronously before any page script runs. */
interface Handshake {
  /** The API version this terminal serves; a manifest may demand a minimum via `minApiVersion`. */
  apiVersion: number;
  widgetId: string;
  /** This surface's instance id — also the namespace your `storage` keys live in. */
  instanceId: string;
  surface: WidgetSurface;
  /**
   * The durable id of the SLOT hosting this widget, or `null` when `surface` is `"window"`.
   * Pass it to `panels.get()` (or call `panels.self()`) to find where you sit and what is beside
   * you — no user setup, nothing to paste.
   *
   * Updated in place BEFORE the `surface` event fires, exactly like `surface`: a widget can be
   * moved between boxes, and between a box and a window, without being restarted.
   */
  slotId: string | null;
  /** `dark` | `light`; also delivered on the `theme` event when it changes. */
  theme: string;
  /** UI language tag (`en`, `ru`, …). */
  lang: string;
  grantedScopes: Scope[];
}
```

Returns what the instance is, synchronously: the bridge puts it into the page before your first line
runs, so there is no ready event to wait for. It is one and the same object for the page's whole life:
the terminal updates its `theme`, `lang`, `surface`, `slotId` and `grantedScopes` before the matching
event, so `handshake().theme` always returns the current theme.

| Field | What it is |
| --- | --- |
| `apiVersion` | The major of the bridge contract, currently 1; see [versions](README.en.md#versions). |
| `widgetId` | The `id` from the manifest. |
| `instanceId` | This instance's durable id. Your `storage` keys live in it, so two copies of a widget keep separate settings. |
| `surface` | `"slot"` — a slot in a tab; `"window"` — a standalone window. |
| `slotId` | The slot's durable id; `null` in a window. |
| `theme` | `"dark"` or `"light"`. |
| `lang` | The terminal's UI language: `"ru"` or `"en"`. More may come — show an unknown one in English. |
| `grantedScopes` | The scopes the widget holds now; see [permissions](README.en.md#permissions). |

```js
import { handshake } from "./colibri.js";

const { widgetId, instanceId, surface, lang } = handshake();
console.log(`${widgetId}/${instanceId}: ${surface}, language ${lang}`);
```

### <a id="has-scope"></a>`hasScope()`

```ts decl
function hasScope(scope: Scope): boolean;
```

`true` when the widget holds the scope now. It reads the live `handshake().grantedScopes`, which the
terminal updates before the [`grants`](#event-grants) event. Good for hiding a button or a section, but
no substitute for handling `unauthorized`: a scope can be switched off between the check and the call.
The scope names are in [`SCOPES`](#scopes); a channel's scope is in [`CHANNEL_SCOPES`](#channel-scopes).

```js
import { hasScope } from "./colibri.js";

document.querySelector("#buy")?.toggleAttribute("disabled", !hasScope("trading"));
```

### <a id="on"></a>`on()`

```ts decl
function on<E extends HostEvent>(event: E, handler: (payload: HostEventPayloads[E]) => void): () => void;
```

Subscribes a handler to a [host event](#events) and returns an unsubscribe function. The payload type
follows from the event name. The bridge silently catches an exception thrown by a handler, so that it
breaks neither the bridge nor the other handlers — catch and log yourself.

```js
import { on } from "./colibri.js";

const off = on("visibility", (e) => {
  console.log(e.visible ? "widget shown" : "widget hidden");
});

// When the handler is no longer needed:
off();
```

## <a id="constants"></a>The error class and the constants

### <a id="colibri-error"></a>`ColibriError`

```ts decl
/** A refusal from the terminal. Switch on `code`, never on `message`. */
class ColibriError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message?: string);
}
```

A refusal from the terminal. `status` is HTTP-shaped (401, 404, 503 …) and always 0 from `storage.*`;
`code` is a stable code; `message` explains it to a person, and its text may change. It is thrown by
`request()` and every area function on a non-2xx answer, by `storage.*` with status 0, and by
`panels.self()` with the code `no_slot`. `net.fetch` never throws. Every code and what to do about it
is in the [reference index](README.en.md#errors).

```js
import { notifications, ColibriError } from "./colibri.js";

try {
  await notifications.raise({ message: "Spread wider than 4 bp", severity: "warning" });
} catch (e) {
  if (!(e instanceof ColibriError)) throw e;
  if (e.code === "bridge_disabled") console.log("the user switched the API off");
  else if (e.code === "unauthorized") console.log("no notifications scope");
  else console.warn(e.status, e.code, e.message);
}
```

### <a id="api-version"></a>`API_VERSION`

```ts decl
const API_VERSION: number;
```

The response-shape version this SDK reads — currently 2. The SDK sends it with every call. It is not
`handshake().apiVersion`: that one is the contract major a manifest's `minApiVersion` is compared
with. Only the deprecated `/app/panels` family has two shapes, and from terminal 1.4.0 it has one
left — v2. There is no reason to pass your own version through `RequestOptions.apiVersion`; a version
the terminal does not serve is refused with `unsupported_api_version`. More in
[versions](README.en.md#versions).

### <a id="routes"></a>`ROUTES`

```ts decl
/** `[method, path, requiresToken, scope]` — the terminal's route table, test-pinned. */
const ROUTES: ReadonlyArray<readonly [string, string, boolean, Scope]>;
```

The terminal's route table: `[method, path, requiresToken, scope]`. It is data, not a description: a
test in the terminal compares it with the live routes. The third element belongs to the local HTTP
door for programs on the user's machine and does not concern a widget — over the bridge, a call is
decided by its scope alone. Handy for finding the scope of a route you call through
[`request()`](#request).

```js
import { ROUTES } from "./colibri.js";

const tradingRoutes = ROUTES.filter(([, , , scope]) => scope === "trading").map(([method, path]) => `${method} ${path}`);
console.log(tradingRoutes);
```

### <a id="channels"></a>`CHANNELS`

```ts decl
const CHANNELS: readonly Channel[];
```

Every stream channel: [`book`](market-data.en.md#channel-book), [`trades`](market-data.en.md#channel-trades),
[`funding`](market-data.en.md#channel-funding), [`positions`](account-and-trading.en.md#channel-positions),
[`orders`](account-and-trading.en.md#channel-orders), [`balance`](account-and-trading.en.md#channel-balance),
[`notifications`](notifications.en.md#channel-notifications) and
[`signalLevels`](notifications.en.md#channel-signal-levels). Subscribe with `stream.subscribe()`.

### <a id="scopes"></a>`SCOPES`

```ts decl
/** Every permission name, as `widget.json`'s `permissions` takes it. */
const SCOPES: {
  readonly marketData: "marketData";
  readonly accountRead: "account:read";
  readonly trading: "trading";
  readonly panels: "panels";
  readonly notifications: "notifications";
  readonly signalLevels: "signalLevels";
  readonly storage: "storage";
};
```

All seven scope names. Use the constant instead of a string and your editor catches the typo:
`SCOPES.accountRead` is `"account:read"`. What each scope opens is in the
[reference index](README.en.md#permissions).

### <a id="channel-scopes"></a>`CHANNEL_SCOPES`

```ts decl
/** channel → the scope that unlocks it. */
const CHANNEL_SCOPES: Readonly<Record<Channel, Scope>>;
```

Channel → the scope you cannot subscribe without: `book`, `trades` and `funding` need `marketData`;
`positions`, `orders` and `balance` need `account:read`; `notifications` needs `notifications`;
`signalLevels` needs `signalLevels`.

```js
import { CHANNEL_SCOPES, hasScope, stream } from "./colibri.js";

if (hasScope(CHANNEL_SCOPES.book)) {
  stream.subscribe("book", { exchange: "BinanceSpot", symbol: "BTCUSDT" }, (book) => {
    console.log(book.bestBid, book.bestAsk);
  });
}
```

## <a id="events"></a>Host events

Subscribe with [`on()`](#on). The terminal updates the `handshake()` fields before the handlers run.

Right after the page loads, the terminal sends `theme`, `visibility`, `grants`, `surface` and
`bridge` with the current state — and again after every page restart. So a handler subscribed at
startup gets the event even when nothing changed: read an event as "this is how things are", not as
"something changed".

| Event | When | Updated in `handshake()` |
| --- | --- | --- |
| [`theme`](#event-theme) | theme, colours, font size, language | `theme`, `lang` |
| [`visibility`](#event-visibility) | the widget was shown or hidden | — |
| [`surface`](#event-surface) | the widget was moved | `surface`, `slotId` |
| [`bridge`](#event-bridge) | the widget API was switched off or on | — |
| [`grants`](#event-grants) | the scopes changed | `grantedScopes` |
| [`streamReset`](#event-stream-reset) | the terminal dropped the subscriptions | — |
| [`permissionRefused`](#event-permission-refused) | a browser permission was refused | — |

### <a id="event-theme"></a>`theme`

```ts decl
/** `theme`: the palette, the language or the font scale changed. `handshake()` is updated first. */
interface ThemeEvent {
  type: "colibri:theme";
  /** `dark` | `light`. */
  theme: string;
  /** Every CSS variable the host sets on `<html>`, name → value. */
  vars: Record<string, string>;
  /** UI language tag (`en`, `ru`, …). */
  lang: string;
  /** The terminal's font scale; also `--colibri-font-scale`. */
  fontScale: number;
}
```

Arrives when the user changes the theme, the palette colours, the font size or the UI language. By the
time your handler runs, `handshake().theme` and `handshake().lang` are updated, and the CSS variables
and the `data-theme` and `data-colibri-lang` attributes on `<html>` are already reset. Styles built on
the variables follow the theme by themselves; subscribe if you draw on a `<canvas>` — the colours there
have to be read again — or re-render text in the new language. `e.vars` is every colour variable,
name → value. The variables are [on the theme page](theme.en.md); the recipe is
[follow the theme](../recipes.en.md#follow-theme).

```js
import { on } from "./colibri.js";

on("theme", (e) => {
  const css = getComputedStyle(document.documentElement);
  const text = css.getPropertyValue("--colibri-role-text").trim() || "#d8dee9";
  console.log(e.theme, e.lang, e.fontScale, text);
});
```

### <a id="event-visibility"></a>`visibility`

```ts decl
/** `visibility`: the widget was shown or hidden. A hidden widget keeps running. */
interface VisibilityEvent {
  type: "colibri:visibility";
  visible: boolean;
}
```

Arrives when the widget is shown or hidden — when the user switches tabs, for instance. A hidden widget
is not frozen: its timers, sockets and subscriptions carry on, and the terminal stops nothing for you.
While `visible` is false, stop the expensive work — animation, frequent redraws, extra requests; when
the widget is visible again, redraw once from the latest data. There is no `handshake()` field for
this: the current state arrives as this same event right after the page loads.

```js
import { on } from "./colibri.js";

let visible = true;
on("visibility", (e) => {
  visible = e.visible;
  if (visible) requestAnimationFrame(() => console.log("redraw once"));
});
```

### <a id="event-surface"></a>`surface`

```ts decl
/** `surface`: the widget moved between boxes, or between a box and a window. It is not restarted. */
interface SurfaceEvent {
  type: "colibri:surface";
  surface: WidgetSurface;
  /** The new box's durable id; `null` (or absent) in a window. */
  slotId?: string | null;
}
```

Arrives when the widget is moved to another slot, or between a slot and a window. The instance is not
recreated: the page, its in-memory state and `storage` all stay, and this event is the only notice of
the move. By the time your handler runs, `handshake().surface` and `handshake().slotId` are updated. If
the widget relies on its neighbours in the layout, read your slot again —
[`workspace.slot()`](layout.en.md#workspace-slot); a window has no slot, and `slotId` is `null` or
absent. The recipe is [find my slot](../recipes.en.md#find-my-box).

```js
import { on, workspace } from "./colibri.js";

on("surface", async (e) => {
  if (!e.slotId) return; // a window has no slot
  const { position } = await workspace.slot(e.slotId);
  console.log("now in tab", position.tabId);
});
```

### <a id="event-bridge"></a>`bridge`

```ts decl
/** `bridge`: the user switched the widget API off or back on. */
interface BridgeEvent {
  type: "colibri:bridge";
  enabled: boolean;
}
```

Arrives when the user switches the widget API off or back on in the settings. While the API is off, the
widget keeps running, but every call and `storage.*` reject with `bridge_disabled`, `net.fetch` answers
`ok: false` with the same code, and stream subscriptions are dropped. Show that the data is not
updating, and do not retry calls in a loop. When `enabled` is `true` again, `stream.subscribe`
resubscribes by itself; one-off requests are yours to repeat. There is no `handshake()` field: the
current state arrives as this event right after the page loads. The recipe is
[the bridge is off](../recipes.en.md#bridge-off).

```js
import { on } from "./colibri.js";

on("bridge", (e) => {
  document.body.classList.toggle("api-off", !e.enabled);
});
```

### <a id="event-grants"></a>`grants`

```ts decl
/** `grants`: the scopes this widget holds changed. `handshake().grantedScopes` is updated first. */
interface GrantsEvent {
  type: "colibri:grants";
  scopes: Scope[];
}
```

Arrives when the widget's scopes change — when the user switches a scope off or back on in "My widgets",
for instance. `e.scopes` is the whole set held now; `handshake().grantedScopes` is already updated, so
[`hasScope()`](#has-scope) answers the new way. Hide what no longer works and bring back what works
again. The terminal checks every call itself, so a widget that ignores this event learns about a
revocation from an `unauthorized` answer. More in [permissions](README.en.md#permissions); the recipe
is [a scope was revoked](../recipes.en.md#revoked-scope).

```js
import { on, hasScope } from "./colibri.js";

on("grants", (e) => {
  console.log("scopes now:", e.scopes.join(", "));
  document.querySelector("#positions")?.toggleAttribute("hidden", !hasScope("account:read"));
});
```

### <a id="event-stream-reset"></a>`streamReset`

```ts decl
/** `streamReset`: the host dropped every subscription; `stream.subscribe` re-issues them itself. */
interface StreamResetEvent {
  type: "colibri:stream-reset";
  reason: string;
}
```

Arrives when the terminal drops every subscription the widget holds: the widget API was switched off,
or the page could not keep up with the frames. `stream.subscribe` subscribes again by itself; if you use
the stream directly through `window.colibri.stream`, resubscribe yourself. Frames during the reset are
lost: `book`, `positions`, `orders` and `balance` arrive whole with the next frame, while the prints the
`trades` channel missed are not sent again. `reason` is text for a log, not a code: do not branch on it.

```js
import { on } from "./colibri.js";

on("streamReset", (e) => {
  console.info("stream reset:", e.reason);
});
```

### <a id="event-permission-refused"></a>`permissionRefused`

```ts decl
/** Why the terminal refused a browser permission request — see CAPABILITIES § Browser permissions. */
type PermissionRefusedReason = "forbidden" | "foreign-origin" | "undeclared" | "not-granted" | "no-user-gesture";

/** The `permissionRefused` payload: a browser permission request the terminal refused, and why. */
interface PermissionRefusedEvent {
  type: "colibri:permission-refused";
  /** The permission's name in the list (`camera`, `clipboard-read`, …), or `unknown`. */
  permission: string;
  /** The browser's own number for the permission kind. */
  kind: number;
  reason: PermissionRefusedReason;
  /** The English line the terminal also wrote to this page's console. */
  message: string;
}
```

Arrives when the terminal refuses the page a browser permission — the microphone, the camera, the
clipboard and the rest. It arrives with the widget API off too. The page gets the browser's ordinary
`NotAllowedError` at the same time, and DevTools shows one `console.warn` line per permission-and-reason
pair. `reason` tells you what to do: `undeclared` — declare the permission in
[`browserPermissions`](manifest.en.md#manifest-browser-permissions); `not-granted` — suggest the user
turn it on; `no-user-gesture` — ask from a click or key handler. Every reason and rule is in
[CAPABILITIES.en.md](../../CAPABILITIES.en.md#browser-permissions).

```js
import { on } from "./colibri.js";

on("permissionRefused", (e) => {
  if (e.reason === "not-granted") console.log(`Allow "${e.permission}" in the widget's settings`);
});
```

## <a id="types"></a>Types

Where a widget lives, and what the scopes are:

```ts decl
/** Where a widget instance lives. */
type WidgetSurface = "slot" | "window";

/** The scope vocabulary. A widget holds only what its manifest declares AND the user consented to. */
type Scope =
  | "marketData"
  | "account:read"
  | "trading"
  | "panels"
  | "notifications"
  | "signalLevels"
  | "storage";
```

The event names and each one's payload — the events themselves are described above:

```ts decl
type HostEvent = "theme" | "visibility" | "surface" | "bridge" | "grants" | "streamReset" | "permissionRefused";

/** event → the payload its handler receives. */
interface HostEventPayloads {
  theme: ThemeEvent;
  visibility: VisibilityEvent;
  surface: SurfaceEvent;
  bridge: BridgeEvent;
  grants: GrantsEvent;
  streamReset: StreamResetEvent;
  permissionRefused: PermissionRefusedEvent;
}
```

`ColibriBridge` is `window.colibri` itself. `colibri.d.ts` declares it as an optional field of
`Window`: outside the terminal it is absent. Its `request` resolves with `{ status, body }` whatever the
status, `storage` answers `{ ok, code }`, and `stream` and `on` hand over frames and events as they
come — the SDK on top of them is described on this page and in the
[reference index](README.en.md#bridge-vs-sdk). The `NetFetchResult` and `StreamFrame` types are on the
[storage and network](storage-and-net.en.md) and [market data](market-data.en.md) pages.

```ts decl
/** The raw tunnel the host injects. The named exports above are sugar over exactly this. */
interface ColibriBridge {
  handshake: Handshake;
  apiVersion: number;
  widgetId: string;
  instanceId: string;
  /** A getter: a move between a box and a window rewrites it in place. */
  readonly surface: WidgetSurface;
  /** The hosting box's durable id, `null` in a window; a getter, like `surface`. */
  readonly slotId: string | null;
  readonly theme: string;
  readonly lang: string;
  readonly grantedScopes: Scope[];
  request(method: string, path: string, opts?: { query?: string; body?: unknown; apiVersion?: number }): Promise<{ status: number; body: unknown }>;
  storage: {
    get(key: string): Promise<{ ok: boolean; value: string | null; code?: string }>;
    set(key: string, value: string): Promise<{ ok: boolean; code?: string }>;
    remove(key: string): Promise<{ ok: boolean; code?: string }>;
    keys(): Promise<{ ok: boolean; keys?: string[]; code?: string }>;
    clear(): Promise<{ ok: boolean; code?: string }>;
  };
  net: {
    fetch(url: string, init?: { method?: "GET" | "POST"; body?: string; contentType?: string }): Promise<NetFetchResult>;
  };
  stream: {
    subscribe(channel: Channel, args?: Record<string, unknown>): void;
    unsubscribe(channel: Channel, args?: Record<string, unknown>): void;
    on(handler: (frame: StreamFrame) => void): void;
    off(handler: (frame: StreamFrame) => void): void;
  };
  on(event: HostEvent, handler: (payload: never) => void): void;
  off(event: HostEvent, handler: (payload: never) => void): void;
}
```
