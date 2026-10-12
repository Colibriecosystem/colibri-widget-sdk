# Widget API reference

> Русская версия — [README.md](README.md).

The reference for the `colibri.js` SDK and the `window.colibri` bridge: every function, every event,
every manifest field and every theme variable. Writing your first widget? Start with
[the first widget](../getting-started.en.md); ready answers to common tasks are in the
[recipes](../recipes.en.md).

## <a id="install"></a>Install

The SDK is two files: [`sdk/colibri.js`](../../sdk/colibri.js) and
[`sdk/colibri.d.ts`](../../sdk/colibri.d.ts). No build step, no dependencies. It is not on npm:
`sdk/package.json` is marked private and exists for this repository only. Copy both files into your
project:

- a page without a build — next to `index.html`, imported as `./colibri.js`;
- a Vite or other bundler project — into `src/lib/`, imported as `./lib/colibri.js`.

The starters in [`starters/`](../../starters/) already carry both copies. The terminal injects only
the `window.colibri` bridge into your page, not the SDK, so the SDK ships with your widget: inside
its archive, or on a hosted widget's server.

```html
<script type="module">
  import { handshake, markets } from "./colibri.js";

  const { lang } = handshake();
  const venues = await markets.exchanges();
</script>
```

Import functions by name or the whole SDK as one object — they are the same thing:

```js
import colibri, { markets, stream, on } from "./colibri.js";

const venues = await markets.exchanges();
const same = await colibri.markets.exchanges();
```

`colibri.d.ts` sits next to `colibri.js`, so TypeScript finds the types by itself; in plain JS your
editor uses them for hints. Do not edit these files in your copy: a new SDK version is new copies of
the same two files, and your own helpers are easier to keep in a module of your own on top of them.

## <a id="pages"></a>Reference pages

| Page | What it covers |
| --- | --- |
| [Bridge and events](bridge.en.md) | `request`, `handshake`, `hasScope`, `on`, `ColibriError`, the constants, the host events, `window.colibri` itself |
| [Market data](market-data.en.md) | `markets`, `stream`, the `book`, `trades` and `funding` channels |
| [Accounts and trading](account-and-trading.en.md) | `connections`, `trading`, the `positions`, `orders` and `balance` channels |
| [Layout](layout.en.md) | `workspace`: windows, tabs, slots, chart windows; the deprecated `panels` |
| [Notifications and alerts](notifications.en.md) | `notifications`, `signalLevels`, the `notifications` and `signalLevels` channels |
| [Storage and network](storage-and-net.en.md) | `storage`, `net.fetch` |
| [Manifest](manifest.en.md) | every `widget.json` field, its rules and its refusal codes |
| [Theme](theme.en.md) | role and palette CSS variables, font scale, the `<html>` attributes, language |

## <a id="bridge-vs-sdk"></a>The bridge and the SDK

The terminal injects a raw tunnel at `window.colibri` **before any of your page's code runs**. The
SDK is sugar over that object, never a second contract. Everything in it is optional: a widget that
calls `window.colibri.request("GET", "/exchanges")` directly is equally supported and will never fall
behind, because both go through the same route table. That table is not copied by hand:
[`ROUTES`](bridge.en.md#routes) is compared against the terminal's live routes by a test in the
terminal itself, so the SDK cannot silently drift from the API it wraps.

```js
import { markets } from "./colibri.js";

// The SDK: the response body, or a ColibriError thrown.
const venues = await markets.exchanges();

// The bridge directly: status and body for every answer, nothing thrown.
const raw = await window.colibri.request("GET", "/exchanges");
if (raw.status === 200) console.log(raw.body);
```

How the two paths differ:

| | `window.colibri` | SDK |
| --- | --- | --- |
| A call's answer | `{ status, body }` whatever the status | the body on 2xx, otherwise a thrown [`ColibriError`](bridge.en.md#colibri-error) |
| Query parameters | a ready `query` string | a `params` object |
| Response-shape version | only when you pass `apiVersion` | [`API_VERSION`](bridge.en.md#api-version) on every call |
| `storage` | `{ ok, value, code }` | the value, or a `ColibriError` with status 0 |
| Stream | every frame of every channel to one handler; resubscribing is yours | a handler per channel; resubscribes itself after a reset and after the bridge comes back on |
| Events | `on` / `off` with untyped payloads | [`on()`](bridge.en.md#on) with typed payloads and an unsubscribe function |

The bridge exists in the widget's own documents and in its same-origin frames; a third-party site's
frame does not get it. Outside the terminal — say, with the page open in an ordinary browser — there
is no `window.colibri`, and every SDK function throws a plain `Error`. Check `window.colibri` at
startup if your page must open there too. The object itself is described by the
[`ColibriBridge`](bridge.en.md#types) type.

## <a id="conventions"></a>Conventions

- **Numbers on the wire are decimal strings:** `"price": "64250.5"`, `"rate": "0.0001"` (that is
  0.01 %). Not one of the venue's digits is lost. Turn them into numbers only where you calculate;
  show the string as it is. Times are Unix milliseconds as numbers (`timeMs`, `nextFundingTimeMs`).
- **Ids are durable.** The `id` of a connection, window, tab, slot, chart window and alert, an order's
  `clientOrderId` and the instance's `instanceId` survive a terminal restart — you may keep them in
  `storage`. A window's or tab's positional `index` is not an id: it shifts when something closes.
- **A call returns the body or refuses.** Every SDK function resolves with the response body on 2xx
  and rejects with a [`ColibriError`](bridge.en.md#colibri-error) otherwise. Switch on `e.code`, not
  on `e.message`. The exception is `net.fetch`: it never throws and answers `{ ok, status, body,
  code }`.
- **A command is not its result.** A `trading.*` call answers when the command is queued; the venue's
  answer arrives on the `orders` and `positions` streams.
- **What a stream frame carries.** `book` is the whole book; `trades` is the prints since the
  previous frame, oldest first; `funding` is the current rate; `positions`, `orders` and `balance` are
  the whole set every time — replace, do not merge; `notifications` and `signalLevels` are one event
  per frame. A handler sees every frame of its channel, so check `data.symbol` or `data.connectionId`.
- **Subscribe, do not poll.** A widget gets 300 bridge calls a minute; a subscription spends none of
  them.
- **Answers grow.** Within one API version, answers gain new fields. Do not fail on a field you do
  not know.

## <a id="errors"></a>Error codes

An error reaches you in one of three ways:

- **a thrown [`ColibriError`](bridge.en.md#colibri-error)** — from `request()` and every area
  function; its `status` is HTTP-shaped;
- **a thrown `ColibriError` with status 0** — from `storage.*`; the codes are the same:
  `unauthorized`, `bad_request`, `bridge_disabled`, `quota_exceeded`, `internal`;
- **the `code` field of a `net.fetch` answer** when `ok` is false — `net.fetch` never throws.

A refused stream subscription arrives as a frame `{ type: "error", data: { code, message }, id }`;
`stream.onAny()` shows it.

| Code | Status | What happened | What to do |
| --- | --- | --- | --- |
| `bridge_disabled` | 503 | The user switched the widget API off in the settings. The widget keeps running, but every call, `storage` and `net.fetch` answer with this code, and stream subscriptions are dropped. | Show that the API is off and wait for the [`bridge`](bridge.en.md#event-bridge) event with `enabled: true`. `stream.subscribe` resubscribes by itself. |
| `unauthorized` | 401 | The widget lacks the scope the route needs: it was not declared, not granted, or the user switched it off. The answer is the same whichever scope is missing. | Check [`hasScope()`](bridge.en.md#has-scope) before calling, declare the scope in the manifest, listen for [`grants`](bridge.en.md#event-grants). See [permissions](#permissions). |
| `bad_request` | 400 | The request is wrong: a missing field, a wrong type, a value out of range; a second subscription to the same channel; an empty or too long `storage` key; in `net.fetch`, a URL that is not https, a method other than GET and POST, a body over 256 KB. | Fix the call. `message` says what is wrong — read it yourself, but decide in code by `code`. |
| `not_found` | 404 | No such route — the SDK is newer than the terminal — or no such record: a closed trade, an alert. | For a route, require the terminal version you need with [`minColibriVersion`](manifest.en.md#manifest-min-colibri-version); for a record, read the list again. |
| `unknown_connection`, `unknown_window`, `unknown_tab`, `unknown_slot`, `unknown_chart_window`, `unknown_panel` | 404 | Nothing has this id any more: the connection was deleted, the tab closed, the slot removed. | Read the list again (`connections.list()`, `workspace.get()`) and forget the stored id. |
| `unavailable` | 404, 503 | No data: a spot market has no funding, or it has not been fetched yet (404); a part of the terminal is not available in this build (503). | Do not ask a spot market for funding; otherwise show that the feature is unavailable. |
| `not_ready` | 503 | The book is not live yet, or the connection is not ready to trade yet. | Retry in a couple of seconds; for a book, subscribing to `book` is better. |
| `rate_limited` | 429 | More than 300 bridge calls in a minute; in `net.fetch`, more than 60 requests a minute; in the stream, more than 64 subscriptions at once. | Back off and retry later. If you poll for live data, subscribe to a stream instead. |
| `too_many_panels` | 429 | The widget opened too many panels. | Do not create slots in a loop: one `workspace.addSlots()` call creates up to 16 slots. |
| `budget_exceeded` | 403 | The order went over the per-order or per-minute limit the user set for the widget. | Show it to the user. Do not retry in a loop. |
| `trading_not_enabled` | 403 | The user has not allowed the widget to trade through this connection. | Show that this account has to be allowed for the widget under its Trading accounts. Do not retry. |
| `slot_occupied_by_widget` | 409 | A widget runs in this slot; the API neither changes nor clears such a slot. | Pick another slot. |
| `last_tab` | 409 | An attempt to close the main window's only tab. | Do not close it: the terminal has no main window without tabs. |
| `unsupported_api_version` | 400 | The request asked for a response-shape version the terminal does not serve. | Do not pass `apiVersion` in `RequestOptions`: the SDK sends the right one. |
| `internal` | 500 | The terminal failed, not your request. | Retry later; if it repeats, write to us. |
| `no_slot` | 400 | `panels.self()` or `panels.siblings()` in a window: a window is not in the grid. The SDK sets this code itself; the call never reaches the terminal. | Check `handshake().slotId` and listen for [`surface`](bridge.en.md#event-surface). |
| `quota_exceeded` | 0 | The widget's `storage` is full: a widget gets 5 MB. | Delete keys you no longer need. Keep settings there, not data. |
| `egress_denied` | 0 | `net.fetch`: the host is not among those declared in [`egress`](manifest.en.md#manifest-egress) and granted by the user. | Add the host to `egress` — the user is asked again. |
| `net_failed` | 0 | `net.fetch`: the request never got there — no connection, a DNS or TLS failure, a cancel. | Retry later. |
| `net_timeout` | 0 | `net.fetch`: the venue did not answer within 15 seconds. | Retry later, and less often. |
| `net_too_large` | the venue's | `net.fetch`: the answer is over 8 MB. | Ask for less: a filter, a page, a limit. |

```js
import { connections, ColibriError } from "./colibri.js";

try {
  const { connections: list } = await connections.list();
  console.log(`connections: ${list.length}`);
} catch (e) {
  if (e instanceof ColibriError && e.code === "unauthorized") console.log("needs the account:read scope");
  else throw e;
}
```

## <a id="permissions"></a>Permissions

A scope opens a part of the API to the widget. There are seven:

| Scope | What it opens | Stream channels |
| --- | --- | --- |
| `marketData` | `markets.exchanges`, `symbols`, `book`, `clusters`, `funding` — market data the terminal already holds | `book`, `trades`, `funding` |
| `account:read` | `connections.*` — connections, positions, orders, balances, trade history. Reads only | `positions`, `orders`, `balance` |
| `trading` | `trading.*` — place and cancel orders, close positions | — |
| `panels` | `workspace.*` and the deprecated `panels.*` — windows, tabs, slots; `markets.orderbookSettings` and `patchOrderbookSettings` | — |
| `notifications` | `notifications.raise`, `signalLevels.signal` — notifications and market signals into the terminal | `notifications` |
| `signalLevels` | `signalLevels.list`, `create`, `remove`, `removeBySymbol`, `clearTriggered` — price alerts | `signalLevels` |
| `storage` | `storage.*` — your own key-value store. The bridge itself checks it, not the route table | — |

Each route's scope is the fourth element of its [`ROUTES`](bridge.en.md#routes) entry; each channel's
is in [`CHANNEL_SCOPES`](bridge.en.md#channel-scopes). Network hosts and browser permissions are not
API scopes: they are separate manifest fields, [`egress`](manifest.en.md#manifest-egress) and
[`browserPermissions`](manifest.en.md#manifest-browser-permissions).

How a widget gets a scope:

1. **You declare it** in the manifest's [`permissions`](manifest.en.md#manifest-permissions). A name
   outside these seven makes the manifest fail at install (`manifest.invalid-permission`): a typo never
   quietly becomes "asks for nothing".
2. **The user consents** in the terminal's install dialog — an unpacked widget goes through it too.
   For `trading` they also accept the risk and pick the accounts and the limits: by default $250 per
   order and 12 orders a minute, and removing the limits takes a separate, deliberate choice. If the
   widget asks for `account:read` and for hosts in `egress`, the user separately confirms that account
   data may leave for those hosts.
3. **A new version that asks for more** — a scope, a host or a browser permission — shows the consent
   dialog again. Asking for less needs no question: what was dropped is revoked at once.
4. **The user can switch off** any granted scope in "My widgets" without removing the widget.
5. **What the widget holds now** is `handshake().grantedScopes` and [`hasScope()`](bridge.en.md#has-scope):
   declared, granted and not switched off. When the set changes, the [`grants`](bridge.en.md#event-grants)
   event arrives, with `grantedScopes` already updated.
6. **Not declared means never granted**, however willing the user. A call without the scope answers
   `401 unauthorized` — the same for whichever scope is missing.
7. **The terminal checks every call** against the live list, not against `handshake()`: a revoked scope
   stops working on the very next call.

```js
import { hasScope, on, SCOPES } from "./colibri.js";

const render = () => {
  document.body.classList.toggle("no-account", !hasScope(SCOPES.accountRead));
};
render();
on("grants", render);
```

How to survive a scope revoked on the fly — [the recipe](../recipes.en.md#revoked-scope).

## <a id="versions"></a>Versions

A widget deals with several numbers, and they mean different things:

| Number | Where | What it means |
| --- | --- | --- |
| `handshake().apiVersion` | the terminal | The major of the `window.colibri` contract, currently 1. It grows only with a breaking change: new routes and new optional fields do not move it. |
| [`minApiVersion`](manifest.en.md#manifest-min-api-version) | the manifest | The oldest contract the widget works with; 1 by default. A terminal with an older contract does not start such a widget — rather than letting it fail halfway through its first call. |
| [`minColibriVersion`](manifest.en.md#manifest-min-colibri-version) | the manifest | The oldest terminal version the widget works on. If your widget needs a feature from Colibri 1.4, put it here, not in `minApiVersion`. |
| [`API_VERSION`](bridge.en.md#api-version) | the SDK | The response-shape version, currently 2; the SDK sends it with every call. |
| [`version`](manifest.en.md#manifest-version) | the manifest | The widget's own version number; the rules are in [publishing](../publishing.en.md#release-version). |

**Response shapes** are versioned separately, per request: the terminal reads `API_VERSION` from the
bridge envelope. Today only the deprecated `/app/panels` family has two shapes: v2 is one `layout` tree
per tab, v1 the older flat list of slots, which a request without a version gets. **From terminal
1.4.0 v1 is removed and the version in the request is not read**; a client already on v2 — this SDK
is one — has nothing to change. Write new code against [`workspace`](layout.en.md#workspace-get), not
`panels`.
