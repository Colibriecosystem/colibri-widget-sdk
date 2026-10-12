# Notifications and price alerts: notifications and signalLevels

> Русская версия — [notifications.md](notifications.md).

`notifications` shows the user a terminal notification: a toast and a sound. `signalLevels` sets
price alerts — levels on the order book that fire when the price crosses them. Two stream channels
push terminal notifications and alert events live.

The user can mute everything your widget sends: in the Notifications window, on the Widgets tab, or
from the widget's row menu in Nest. A muted widget keeps running and its calls succeed with the status
`muted`, but the user sees and hears nothing. Send a notification when the user has to notice
something, not on every change — or yours will be the first widget muted.

## <a id="notifications"></a>notifications

### <a id="notifications-raise"></a>`notifications.raise()`

```ts decl
raise(body: { message: string; severity?: "info" | "success" | "warning" | "error"; title?: string }): Promise<unknown>;
```

Scope: `notifications`.

Show a notification in the terminal: a toast and a sound — as the user configured notifications from
the API and widgets in settings. `message` is required, at most 500 characters. `severity` is `info`
(the default), `success`, `warning` or `error`; anything else is `400 bad_request`. The terminal does
not show `title` today — put everything that must be seen into `message`. The reply is
`{ status: "raised" }`, or `{ status: "muted" }` when the user muted the widget.

```js
import { notifications } from "./colibri.js";

await notifications.raise({ message: "BTCUSDT: spread wider than 4 bps", severity: "warning" });
```

## <a id="signal-levels"></a>signalLevels

A price alert is a level on a venue and symbol: it is drawn on the order book and fires when the price
crosses it, whether or not a panel of that symbol is open. When it fires it raises a terminal
notification and an event on the [`signalLevels`](#channel-signal-levels) channel. Alerts survive a
restart and are not tied to a connection — they are a plain market mark.

A level fires **once**. With `oneShot: true` it is then removed; with `oneShot: false` (the default)
it stays with `isTriggered: true` and the firing time until
[`clearTriggered()`](#signal-levels-clear-triggered) sweeps it.

The set is shared by everyone who sets alerts through the API — every widget and every external
program: `list()` returns other callers' levels too, and `removeBySymbol()` and `clearTriggered()`
remove them too. Keep your own levels' ids and remove by id when you do not want to touch anyone
else's.

```js
import { signalLevels } from "./colibri.js";

const level = await signalLevels.create({
  exchange: "BinanceSpot",
  symbol: "BTCUSDT",
  price: "100000",
  direction: "above",
  note: "round-number breakout",
  oneShot: true,
});
```

### <a id="signal-levels-list"></a>`signalLevels.list()`

```ts decl
list(params?: RequestOptions["params"]): Promise<unknown>;
```

Scope: `signalLevels`.

The alerts — `{ levels: SignalLevel[] }` (see [`SignalLevel`](#types)). `{ exchange }` and
`{ symbol }` narrow the list; an unknown venue is `400 bad_request`. To follow the set, subscribe to
the [`signalLevels`](#channel-signal-levels) channel: it sends the current set at once and then every
change.

### <a id="signal-levels-create"></a>`signalLevels.create()`

```ts decl
create(body: unknown): Promise<unknown>;
```

Scope: `signalLevels`.

Set an alert. The body: `exchange`, `symbol` and `price` are required, `price` a positive decimal
string; `direction` is `above`, `below` or `cross` (default `cross`, any case); `note` is text the
notification shows when the level fires; `oneShot` defaults to `false`. The reply is `201` and the new
[`SignalLevel`](#types): its `id` is what removes it. A bad body is `400 bad_request`.

### <a id="signal-levels-remove"></a>`signalLevels.remove()`

```ts decl
remove(id: string): Promise<unknown>;
```

Scope: `signalLevels`.

Remove one alert by `id`. The reply is `{ removed: 1 }`; none such is `404 not_found`.

### <a id="signal-levels-remove-by-symbol"></a>`signalLevels.removeBySymbol()`

```ts decl
removeBySymbol(params: RequestOptions["params"]): Promise<unknown>;
```

Scope: `signalLevels`.

Remove every alert of one symbol: `{ exchange, symbol }`, both required (else `400 bad_request`). The
reply is `{ removed: n }`, 0 when nothing matched. It removes levels you did not set, too.

### <a id="signal-levels-clear-triggered"></a>`signalLevels.clearTriggered()`

```ts decl
clearTriggered(): Promise<unknown>;
```

Scope: `signalLevels`.

Remove every alert that has fired (`isTriggered: true`) — on every venue and symbol. The companion of
the default, under which a fired level stays. The reply is `{ removed: n }`.

### <a id="signal-levels-signal"></a>`signalLevels.signal()`

```ts decl
signal(body: unknown): Promise<unknown>;
```

Scope: `notifications`.

This is not an alert but a market signal: a row in the terminal's signal log (the Notifications
window, the Signals and API tabs) with a sound and a count on the bell. That is why its scope is
`notifications`, not `signalLevels`. The body is `{ exchange, symbol, text }`, all required, `text`
saying what happened in at most 200 characters. The reply is `{ status: "raised" }` or
`{ status: "muted" }`.

## <a id="live-channels"></a>Channels

Both channels are terminal-wide: you subscribe with no args. Their frames are never dropped, even
when the page cannot keep up. How to subscribe: [`stream.subscribe()`](market-data.en.md#stream-subscribe).

### <a id="channel-notifications"></a>The `notifications` channel

Scope: `notifications`. No args.

Every terminal notification — a [`StreamNotification`](#types): order fills and cancels, data-feed
health, market signals, other widgets' messages. Frames arrive with the type `"notification"`, in the
singular; `stream.subscribe` takes care of that. Right after subscribing, the recent notifications
arrive (a bounded log), then live ones — so do not sound an alarm on every frame after you subscribe.
`connectionId` and `connectionLabel` name the connection the notification is about, never its
credentials. `severity` arrives capitalized: `Info`, `Success`, `Warning`, `Error`.

```js
import { stream } from "./colibri.js";

stream.subscribe("notifications", undefined, (n) => {
  if (n.kind === "OrderFilled") console.log("filled:", n.symbol, n.message);
});
```

### <a id="channel-signal-levels"></a>The `signalLevels` channel

Scope: `signalLevels`. No args.

The life of price alerts. A frame arrives with the type `"signalLevel"`, and what happened is in
`frame.event`: `placed`, `removed` or `triggered`. `data` is the [`SignalLevel`](#types) itself.
Right after subscribing, the whole current set arrives as `placed` events — so the list builds itself
without a separate `list()`. The event is on the frame, not in `data`, so take the handler's second
argument.

```js
import { stream } from "./colibri.js";

const levels = new Map();
stream.subscribe("signalLevels", undefined, (level, frame) => {
  if (frame.event === "removed") levels.delete(level.id);
  else levels.set(level.id, level); // placed or triggered
});
```

## <a id="types"></a>Types

```ts decl
/** The notifications frame: one terminal notification. No credentials ever cross the wire. */
interface StreamNotification {
  /** The notification kind, e.g. OrderFilled. */
  kind: string;
  severity: "Info" | "Success" | "Warning" | "Error";
  message: string;
  symbol: string | null;
  connectionId: string | null;
  connectionLabel: string | null;
}

/** One price alert, as the signalLevels frame carries it (what happened is in frame.event). */
interface SignalLevel {
  id: string;
  exchange: string;
  symbol: string;
  price: string;
  direction: "Above" | "Below" | "Cross";
  note: string | null;
  /** Removed once it fires; otherwise kept with isTriggered until clearTriggered(). */
  oneShot: boolean;
  createdMs: number;
  isTriggered: boolean;
  triggeredMs: number | null;
}
```
