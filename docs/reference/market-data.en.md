# Market data: markets and stream

> Русская версия — [market-data.md](market-data.md).

Two parts of the API live here: `markets` answers a snapshot on request, `stream` pushes live frames
for as long as you are subscribed. The account channels (`positions`, `orders`, `balance`) are on
[account-and-trading.en.md](account-and-trading.en.md#channel-positions); notifications and price
alerts on [notifications.en.md](notifications.en.md#channel-notifications).

Every number on the wire is a decimal string (`"64950.10"`), so no tick precision is lost. Convert to
a number where you do the math. Times are unix milliseconds in the `…Ms` fields.

## <a id="market-data-sources"></a>Where market data comes from

Read this before you build a screener.

**Your widget owns its market data.** `markets.*` and the market channels serve what the terminal
has open: a symbol lives while a panel or a caller holds it, and is released when nothing needs it.
That makes them panel-coupled by construction, and they cannot answer a whole-venue scan. For what
they are they are fully supported: the book the user is already watching, the venue catalog, cluster
history. Use them, but do not rest your widget's core function on them.

For scanning, screening and any data the terminal does not have, connect to the venue yourself. List
the hosts in your manifest's [`egress`](manifest.en.md#manifest-egress) and open your own WebSockets
straight from the page — to those hosts only. The terminal serves your document with a
`Content-Security-Policy: connect-src` built from that list, so a socket to an undeclared host throws
a `SecurityError` at construction. The terminal counts and logs the blocked host, and it shows in the
F12 report: look there when a stream "silently" never opens. A host declared without a port covers
any port; `ws.okx.com:8443` covers only 8443.

REST is harder: **KuCoin and Kraken Futures send no CORS headers at all**, so a page cannot read them
by any means. The terminal performs such a request for you — [`net.fetch`](storage-and-net.en.md#net-fetch),
against the domains the user saw at install:

```js
import { net } from "./colibri.js";

const r = await net.fetch("https://futures.kraken.com/derivatives/api/v3/tickers");
if (!r.ok) throw new Error(r.code);          // egress_denied · rate_limited · net_timeout · …
const tickers = JSON.parse(r.body).tickers;  // body is TEXT — you parse it
```

`https` only, GET and POST only, the host must be in `egress`, redirects are never followed, and each
instance has its own rate cap. Every rule is on [storage-and-net.en.md](storage-and-net.en.md#net-fetch);
the ready recipe is on [recipes.en.md](../recipes.en.md#outside-data).

Both approaches run live in `examples/`:
[Liquidation radar](../../examples/liquidation-radar/) takes venue WebSockets directly,
[Funding monitor](../../examples/funding-monitor/) reaches venue REST through the terminal.

## <a id="markets"></a>markets

Snapshots on request. For anything that changes, subscribe to the [stream](#stream): polling eats the
300-bridge-calls-a-minute budget per widget quickly, and a subscription spends none of it.

```js
import { markets } from "./colibri.js";

const book = await markets.book("BinanceSpot", "BTCUSDT", { depth: 20 });
const spread = Number(book.bestAsk) - Number(book.bestBid);
```

### <a id="markets-exchanges"></a>`markets.exchanges()`

```ts decl
exchanges(): Promise<unknown>;
```

Scope: `marketData`.

The venues the terminal knows: `{ exchanges: [{ id, name, marketType, trading }] }`. `id` is the exact
string every `exchange` parameter takes (`BinanceSpot`, `BinanceLinearFutures`); `trading: false` marks
a market-data-only venue. Take ids from here rather than from your code: the venue set depends on the
user's terminal version.

### <a id="markets-symbols"></a>`markets.symbols()`

```ts decl
symbols(exchange: string): Promise<unknown>;
```

Scope: `marketData`.

Every instrument on the venue: `{ exchange, symbols: [{ symbol, name, baseAsset, quoteAsset, tickSize,
stepSize }] }`. `symbol` is the value every `symbol` parameter takes; `tickSize` and `stepSize` are the
price step and the quantity step. An unknown venue is `400 bad_request`.

### <a id="markets-book"></a>`markets.book()`

```ts decl
book(exchange: string, symbol: string, params?: RequestOptions["params"]): Promise<Book>;
```

Scope: `marketData`.

An order-book snapshot — [`Book`](#types). Levels run away from the best price (asks ascending, bids
descending), each with the coin quantity and the USD volume. `params.depth` is levels per side:
1–1000 (default 50) or `"full"`; `full` is capped at 5000 levels, and when the book is longer the
reply carries `truncated: true`. The first request opens the symbol in the terminal: until the book is
live the answer is `503 not_ready`, so retry in a second. For a live book use the
[`book`](#channel-book) channel.

### <a id="markets-clusters"></a>`markets.clusters()`

```ts decl
clusters(exchange: string, symbol: string, params?: RequestOptions["params"]): Promise<unknown>;
```

Scope: `marketData`.

Clusters (footprint): raw 15-second buckets, oldest first — `{ exchange, symbol, tickSize, buckets }`.
A bucket has `startUnixSec` (seconds, not milliseconds), buy and sell totals in USD and in coins, and
`levels` with the same sums per price. `params.limit` is how many of the latest buckets: 1–17280 (the
whole 72-hour buffer), default 240 (the last hour). Build larger timeframes yourself by summing
buckets. Before the first trade the list is empty.

### <a id="markets-funding"></a>`markets.funding()`

```ts decl
funding(exchange: string, symbol: string): Promise<Funding>;
```

Scope: `marketData`.

A perpetual's funding rate — [`Funding`](#types): `rate` as a string (`"0.0001"` is 0.01 %) and the
next settlement time. Spot, and a perpetual whose rate has not been fetched yet, answer
`404 unavailable`. Rate changes arrive on the [`funding`](#channel-funding) channel.

### <a id="markets-orderbook-settings"></a>`markets.orderbookSettings()`

```ts decl
orderbookSettings(exchange: string): Promise<unknown>;
```

Scope: `panels`.

The venue-level orderbook settings, resolved to their effective values — what a new panel of this
venue opens with: `{ exchange, settings }`. `settings` holds the size and volume units (`sizeUnit`,
`depthUnit`: `Usd` or `Base`), the tape, highlight and cluster thresholds (`minTradeUsd`,
`largeVolumeUsd`, …), price aggregation, tape and liquidation visibility, the breakeven stop percent
and auto-OCO. These are the user's settings, not market data, which is why the scope is `panels`.

### <a id="markets-patch-orderbook-settings"></a>`markets.patchOrderbookSettings()`

```ts decl
patchOrderbookSettings(exchange: string, patch: unknown): Promise<unknown>;
```

Scope: `panels`.

A partial update of the same settings: only the fields you send change, and the reply echoes them. A
bad value in any field refuses the whole request before anything changes (`400 bad_request`). Open
panels of that venue pick the change up at once, as after a save in the settings window. These are
the settings of every panel the user has on that venue — change them only on the user's explicit
action.

## <a id="stream"></a>stream

Live channels. One `subscribe` call is one subscription; frames reach the handler until you
unsubscribe. There is no reconnect loop to write: the bridge runs in-process and cannot "drop", and
the SDK restores its subscriptions itself — after the user switches the bridge back on (the
[`bridge`](bridge.en.md#event-bridge) event) and after [`streamReset`](bridge.en.md#event-stream-reset).

| Channel | Args | Scope | What arrives |
| --- | --- | --- | --- |
| [`book`](#channel-book) | `{ exchange, symbol, depth?, hz? }` | `marketData` | A full book snapshot when the book changed, at most `hz` times a second |
| [`trades`](#channel-trades) | `{ exchange, symbol }` | `marketData` | Only the prints since the last frame |
| [`funding`](#channel-funding) | `{ exchange, symbol }` | `marketData` | The rate, when it changed |
| [`positions`](account-and-trading.en.md#channel-positions), [`orders`](account-and-trading.en.md#channel-orders), [`balance`](account-and-trading.en.md#channel-balance) | `{ connectionId }` | `account:read` | A full snapshot when anything changed |
| [`notifications`](notifications.en.md#channel-notifications) | none | `notifications` | Terminal notifications: recent ones first, then live |
| [`signalLevels`](notifications.en.md#channel-signal-levels) | none | `signalLevels` | Price-alert events: the current set first, then live |

Mind the difference: `trades` sends an **increment** — the prints since the last frame, oldest
first — and the tape is yours to keep. The account channels send the **full state** every time, which
you simply replace.

### <a id="stream-subscribe"></a>`stream.subscribe()`

```ts decl
subscribe<C extends Channel>(
  channel: C,
  args: Record<string, unknown> | undefined,
  handler: (data: ChannelData[C], frame: StreamFrame<ChannelData[C]>) => void,
): () => void;
```

Scope: each channel has its own, see `CHANNEL_SCOPES`.

Returns an unsubscribe function — call it when you no longer need the data: the symbol changed, the
view closed. The handler gets the frame's `data` (typed per channel — [`ChannelData`](#types)) and the
frame itself.

- **A handler sees EVERY frame of its channel**, not just its own subscription's. Subscribe to two
  symbols and both reach both handlers, so check `data.symbol` (on the account channels,
  `data.connectionId`).
- **A subscription is a channel plus its key** (`exchange` + `symbol`, or `connectionId`). A second
  subscription with the same key is refused, and unsubscribing one drops the key for every handler.
  Subscribe once and fan the data out yourself. `depth` and `hz` are not part of the key: a second
  `book` on the same symbol with another depth does not apply.
- **Args.** Market channels take `{ exchange, symbol }`, and `book` also `depth` and `hz`; account
  channels take `{ connectionId }`; `notifications` and `signalLevels` take none (`undefined`).
- **Errors are not thrown.** A refusal arrives as a frame `{ type: "error", data: { code, message } }`,
  visible only through [`onAny`](#stream-on-any): `unauthorized` — the widget lacks the channel's scope,
  `bad_request` — an unknown channel, a missing key, or that subscription already exists,
  `rate_limited` — the instance already holds 64 subscriptions.
- When the page cannot keep up, market and account frames are replaced by fresher ones;
  notifications and alert events are never dropped.

<!-- check: prelude declare function render(bid: string, ask: string): void; -->
```js
import { stream } from "./colibri.js";

const exchange = "BinanceSpot";
const symbol = "BTCUSDT";

const stop = stream.subscribe("book", { exchange, symbol, depth: 20, hz: 5 }, (book) => {
  if (book.exchange !== exchange || book.symbol !== symbol) return; // another subscription's frame
  render(book.bids[0]?.price, book.asks[0]?.price);
});

// The symbol changed or the view closed — unsubscribe.
stop();
```

### <a id="stream-on-any"></a>`stream.onAny()`

```ts decl
onAny(handler: (frame: StreamFrame) => void): () => void;
```

Scope: none.

Every frame of the stream: every channel's data, acknowledgements (`subscribed`, `unsubscribed`) and
errors. It subscribes to nothing by itself. Use it for debugging and for a router of your own — and it
is the only place a refused subscription shows. Returns a function that removes the handler.

```js
import { stream } from "./colibri.js";

const off = stream.onAny((frame) => {
  if (frame.type === "error") console.warn("stream refused:", frame.data);
});
```

## <a id="live-channels"></a>Channels

### <a id="channel-book"></a>The `book` channel

Scope: `marketData`. Args: `{ exchange, symbol, depth?, hz? }`.

Every frame is a **full** book snapshot, the same shape as [`markets.book()`](#markets-book):
[`Book`](#types), not a diff. A frame arrives only when the book changed, and at most `hz` times a
second: `hz` is 1–10, default 10. `depth` is levels per side, 1–1000, default 50; a value out of range
is clamped, not refused. While you are subscribed the terminal keeps the symbol open. A widget that
needs only the price is fine with `depth: 1` and `hz: 4`.

### <a id="channel-trades"></a>The `trades` channel

Scope: `marketData`. Args: `{ exchange, symbol }`.

A frame is a [`TradesFrame`](#types): `{ exchange, symbol, trades }`. It is an **increment**: `trades`
holds only the prints since the previous frame, oldest first. There is no history on subscribe — the
first frame carries what happened after it. Keep the tape, the candles and the volumes yourself.
Frames come in batches, up to ten a second; liquidations are not part of this channel. `isBuy: true`
means the buyer was the aggressor.

### <a id="channel-funding"></a>The `funding` channel

Scope: `marketData`. Args: `{ exchange, symbol }`.

A frame is a [`Funding`](#types), the same shape as [`markets.funding()`](#markets-funding). It arrives
when the rate or the next settlement time changed. Spot, and a perpetual with no rate yet, send no
frames.

## <a id="types"></a>Types

The stream channels:

```ts decl
type Channel =
  | "book"
  | "trades"
  | "funding"
  | "positions"
  | "orders"
  | "balance"
  | "notifications"
  | "signalLevels";
```

The book. Every number is a decimal string:

```ts decl
/** One book level. */
interface BookLevel {
  price: string;
  /** Coin quantity. */
  baseQty: string;
  /** USD volume. */
  usdVolume: string;
}

/** markets.book() and the book frame: asks ascending, bids descending. */
interface Book {
  exchange: string;
  symbol: string;
  tickSize: string;
  /** "0" before the first trade. */
  lastPrice: string;
  /** null when that side is empty. */
  bestBid: string | null;
  bestAsk: string | null;
  bids: BookLevel[];
  asks: BookLevel[];
}
```

Trades and funding:

```ts decl
/** One print. */
interface Trade {
  price: string;
  /** Base-coin quantity. */
  qty: string;
  /** True = the buyer was the aggressor. */
  isBuy: boolean;
  /** Exchange time, unix ms. */
  timeMs: number;
}

/** The trades frame: the prints since the last frame, oldest first. */
interface TradesFrame {
  exchange: string;
  symbol: string;
  trades: Trade[];
}

/** markets.funding() and the funding frame. */
interface Funding {
  exchange: string;
  symbol: string;
  /** "0.0001" is 0.01 %. */
  rate: string;
  /** The next settlement, unix ms. */
  nextFundingTimeMs: number;
}
```

What a handler receives, and what a frame looks like:

```ts decl
/** channel → the data its frames carry. */
interface ChannelData {
  book: Book;
  trades: TradesFrame;
  funding: Funding;
  positions: PositionsData;
  orders: OrdersData;
  balance: BalanceData;
  notifications: StreamNotification;
  signalLevels: SignalLevel;
}

/** One stream frame as it arrives: data, acknowledgements and errors alike. */
interface StreamFrame<T = unknown> {
  type: string;
  data: T;
  /** signalLevels only: placed | removed | triggered. */
  event?: string;
  /** The correlation id an acknowledgement or an error echoes. */
  id?: string | null;
}
```

`PositionsData`, `OrdersData` and `BalanceData` are on
[account-and-trading.en.md](account-and-trading.en.md#types); `StreamNotification` and `SignalLevel`
on [notifications.en.md](notifications.en.md#types).
