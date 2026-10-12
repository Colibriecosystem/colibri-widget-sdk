# Account and trading: connections and trading

> Русская версия — [account-and-trading.md](account-and-trading.md).

This is what the SDK is really for: nobody but the terminal has this data. `connections` reads the
user's accounts — venue connections, positions, working orders, balances, closed-trade history.
`trading` places and cancels orders through those connections. Venue keys never cross the bridge: a
widget sees a connection's id, venue and flags, never its credentials.

Numbers on the wire are decimal strings, times are unix milliseconds.

## <a id="connections"></a>connections

Account reads. They move nothing, but they expose sizes, PnL and balances — so they are a scope of
their own, `account:read`, shown to the user as a separate line at install. When a widget asks for
both `account:read` and hosts in `egress`, the install dialog asks for one more acknowledgement:
account data plus the network is what can leave the machine.

For anything that changes, subscribe to the [account channels](#live-channels): they push the same
data as these calls, on their own and at once.

```js
import { connections } from "./colibri.js";

const { connections: list } = await connections.list();
const account = list.find((c) => !c.viewOnly);  // a connection with keys
const { positions } = await connections.positions(account.id);
```

### <a id="connections-list"></a>`connections.list()`

```ts decl
list(): Promise<{ connections: Connection[] }>;
```

Scope: `account:read`.

Every connection the user has — [`Connection`](#types). `id` is the key for every other call and for
the account channels. `viewOnly: true` means no keys, or trading switched off on the connection: only
its data is visible. `demo: true` is a demo account or a venue testnet; if your widget trades, offer
it first.

### <a id="connections-get"></a>`connections.get()`

```ts decl
get(id: string): Promise<Connection>;
```

Scope: `account:read`.

One connection. None with that id is `404 unknown_connection`: the user may have deleted the
connection while your widget kept its id.

### <a id="connections-positions"></a>`connections.positions()`

```ts decl
positions(id: string): Promise<PositionsData>;
```

Scope: `account:read`.

Open positions across the connection's symbols — [`PositionsData`](#types). `quantity` is signed:
above zero is long. Live positions: the [`positions`](#channel-positions) channel.

### <a id="connections-orders"></a>`connections.orders()`

```ts decl
orders(id: string): Promise<OrdersData>;
```

Scope: `account:read`.

The connection's working orders, regular and trigger — [`OrdersData`](#types). `clientOrderId` is
what [`trading.cancel()`](#trading-cancel) takes. The live list: the [`orders`](#channel-orders)
channel.

### <a id="connections-balances"></a>`connections.balances()`

```ts decl
balances(id: string): Promise<BalanceData>;
```

Scope: `account:read`.

Per-asset balances — [`BalanceData`](#types): `free` is available, `locked` is reserved for orders.
Live balances: the [`balance`](#channel-balance) channel.

### <a id="connections-trades"></a>`connections.trades()`

```ts decl
trades(
  id: string,
  params?: { page?: number; pageSize?: number; symbol?: string; fromMs?: number; toMs?: number },
): Promise<unknown>;
```

Scope: `account:read`.

Closed-trade history — the terminal's own record, which the venue does not keep in this form. Newest
close first: `{ connectionId, trades, page, pageSize, totalCount, totalPages }`. A row has `id`, the
side (`Long` or `Short`), entry and exit prices, quantity, turnover, `netPnl`, `pnlPercent`,
commission, funding, and the open and close times. `page` counts from 1, `pageSize` is 1–500 (default
100). `fromMs` and `toMs` bound the close time as a half-open `[fromMs, toMs)`, so adjacent windows
never count the trade on the seam twice. A row may be amended after it is written: the terminal first
computes it itself, then overwrites it with the venue's numbers — re-read rather than cache forever.

### <a id="connections-trade"></a>`connections.trade()`

```ts decl
trade(id: string, tradeId: number | string): Promise<unknown>;
```

Scope: `account:read`.

One closed trade with its fills: `{ connectionId, trade, fills }`, fills oldest first, each with the
price, the quantity in coins and in the quote currency, the commission, the side, the time and the
venue's trade id. A trade that does not exist and a trade of another connection answer the same
`404`: anything else would report what exists outside this connection.

## <a id="trading"></a>trading

Orders through the user's own connection — the same path a click in the terminal takes, with each
venue's same rules. Read the rules below before writing trading code: the terminal enforces them,
and there is no way around them.

**Two keys.** You need the `trading` scope in the manifest **and** the user's permission for your
widget on that specific connection. It is given in the install dialog, under **Trading accounts**:
the user ticks the accounts the widget may trade on and sets its limits. Without the tick, every
`trading.*` call on that connection gets `403 trading_not_enabled`. The
[`Connection.apiTradingEnabled`](#types) field reports a different grant — the one for external
Local API programs (Settings → Program → Local API) — and does not show your widget's.

**Limits.** Every trading grant carries a per-order cap in dollars and an orders-per-minute cap: $250
and 12 orders by default (the numbers are in [CAPABILITIES.en.md](../../CAPABILITIES.en.md#hard-boundaries)).
The user sets them in the same dialog and may remove them altogether. An order over a limit is refused `403 budget_exceeded` before it
reaches the queue. Only new orders count: cancels and closes are never limited — otherwise a limit
could trap the user in a position. A market order sized in coins (`sizeBase`) is valued at the current
price; when there is no price yet, it is refused with the same code — send `sizeQuote`.

**The reply is the queue, not the venue.** Every call answers `{ status: "accepted" }` the moment the
command is enqueued. The venue's answer arrives on the [`orders`](#channel-orders) channel (and on
[`positions`](#channel-positions) for a close): track the `clientOrderId` there. `503 not_ready` means
the connection is still warming up — retry later. An unknown connection is `404 unknown_connection`.

**Only on a click.** Place an order only because the user asked for it right now: pressed a button
and confirmed. Never on load, from a timer, from a stream handler, from a restored setting or on a
keypress. Do not restore a price or a size from `storage`. The whole pattern is in the
[recipe](../recipes.en.md#place-order-safely) and in the [`starters/trading`](../../starters/trading/)
starter.

<!-- check: prelude declare const confirmButton: HTMLButtonElement; declare const connectionId: string; declare const ticket: { symbol: string; price: string; size: string }; declare function showPending(clientOrderId: string): void; declare function showError(text: string): void; -->
```js
import { trading, ColibriError } from "./colibri.js";

// The one place an order leaves from: the Confirm button's click.
confirmButton.addEventListener("click", async () => {
  try {
    const { clientOrderId } = await trading.place(connectionId, {
      symbol: ticket.symbol,
      side: "BUY",
      type: "Limit",
      price: ticket.price,
      sizeBase: ticket.size,
    });
    showPending(clientOrderId); // enqueued; the venue's answer arrives on the orders channel
  } catch (e) {
    if (!(e instanceof ColibriError)) throw e;
    if (e.code === "budget_exceeded") showError(e.message);      // a limit the user set
    else if (e.code === "trading_not_enabled") showError("Allow this widget to trade on this account.");
    else showError(e.message);
  }
});
```

### <a id="trading-place"></a>`trading.place()`

```ts decl
place(id: string, order: PlaceOrder): Promise<PlaceOrderAccepted>;
```

Scope: `trading`.

A limit or market order — [`PlaceOrder`](#types). The size is exactly one of two: `sizeQuote` ("spend
100 USDT") or `sizeBase` ("0.01 coins"). `price` is required for `Limit` and forbidden for `Market`.
`reduceOnly` on futures is an order that only ever reduces the position. A malformed order is
`400 bad_request`. The reply is a [`PlaceOrderAccepted`](#types): the new order's `clientOrderId`,
which is also how you cancel it.

### <a id="trading-cancel"></a>`trading.cancel()`

```ts decl
cancel(id: string, clientOrderId: string, symbol: string): Promise<{ status: "accepted" }>;
```

Scope: `trading`.

Cancel one order by its `clientOrderId` — the one `place()` returned, or the one
[`connections.orders()`](#connections-orders) shows. `symbol` is required: it routes the cancel to the
venue. The order leaves the [`orders`](#channel-orders) channel once the venue confirms.

### <a id="trading-cancel-all"></a>`trading.cancelAll()`

```ts decl
cancelAll(id: string, params?: { symbol?: string }): Promise<{ status: "accepted" }>;
```

Scope: `trading`.

Cancel the connection's working orders: with `{ symbol }` only that symbol's, **without it EVERY
symbol's on the account**, regular and trigger alike. Positions are untouched. A missing `symbol` does
not mean "the current symbol", it means the whole account: pass it explicitly when you mean one.

### <a id="trading-close-positions"></a>`trading.closePositions()`

```ts decl
closePositions(id: string): Promise<{ status: "accepted" }>;
```

Scope: `trading`.

Close **every** open position on the connection **at market** and cancel the orders left over — the
close-all hotkey, for one account. A market close slips, and it touches every symbol. Call it only on
the user's explicit command, behind a confirmation that says everything will be closed.

## <a id="live-channels"></a>Account channels

Three channels, all taking `{ connectionId }` and the `account:read` scope. Every frame is the **full**
state, the same shape as the matching call's reply: replace the old one with it. A frame arrives when
something changed. A handler sees the frames of all your subscriptions to its channel, so check
`data.connectionId`. How to subscribe: [`stream.subscribe()`](market-data.en.md#stream-subscribe).

```js
import { connections, stream } from "./colibri.js";

const connectionId = (await connections.list()).connections[0].id;
let orders = (await connections.orders(connectionId)).orders;

const stop = stream.subscribe("orders", { connectionId }, (data) => {
  if (data.connectionId !== connectionId) return;
  orders = data.orders; // the full list, not the changes
});
```

### <a id="channel-positions"></a>The `positions` channel

Scope: `account:read`. Args: `{ connectionId }`.

A frame is a [`PositionsData`](#types): every open position on the connection. An empty list means no
positions. The outcome of [`trading.closePositions()`](#trading-close-positions) shows up here too.

### <a id="channel-orders"></a>The `orders` channel

Scope: `account:read`. Args: `{ connectionId }`.

A frame is an [`OrdersData`](#types): every working order on the connection. An order accepted by
[`trading.place()`](#trading-place) appears here — look for its `clientOrderId` — and its state shows
here too (`status`, `filledQuantity`). An order that leaves the list no longer works: it was filled or
cancelled.

### <a id="channel-balance"></a>The `balance` channel

Scope: `account:read`. Args: `{ connectionId }`.

A frame is a [`BalanceData`](#types): every balance on the connection, free and reserved.

## <a id="types"></a>Types

A connection and what sits on it:

```ts decl
/** One exchange connection (account). No credentials ever cross the wire. */
interface Connection {
  id: string;
  /** The venue — the same id markets.exchanges() lists. */
  exchange: string;
  marketType: string;
  /** The user's name for it; may be empty. */
  label: string;
  /** Demo / testnet trading. */
  demo: boolean;
  /** No credentials, or trading switched off — market data only. */
  viewOnly: boolean;
  /** The trading grant for external Local API programs, not for a widget. */
  apiTradingEnabled: boolean;
}

interface Position {
  symbol: string;
  exchange: string;
  /** LONG | SHORT. */
  side: string;
  /** SIGNED base quantity: positive = long. */
  quantity: string;
  entryPrice: string;
}

/** One working order. */
interface Order {
  /** The cancel handle — the id trading.place returned. */
  clientOrderId: string;
  /** The venue's id once it confirmed the order. */
  exchangeOrderId: string | null;
  symbol: string;
  exchange: string;
  /** BUY | SELL. */
  side: string;
  /** Limit, Market, StopLoss, … */
  type: string;
  /** New, PartiallyFilled, … */
  status: string;
  price: string;
  quantity: string;
  filledQuantity: string;
}

interface Balance {
  asset: string;
  free: string;
  locked: string;
}
```

Replies and channel frames — always the full set:

```ts decl
/** connections.positions() and the positions frame. */
interface PositionsData {
  connectionId: string;
  positions: Position[];
}

/** connections.orders() and the orders frame. */
interface OrdersData {
  connectionId: string;
  orders: Order[];
}

/** connections.balances() and the balance frame. */
interface BalanceData {
  connectionId: string;
  balances: Balance[];
}
```

An order and its reply:

```ts decl
/** trading.place: exactly one of sizeQuote / sizeBase; price only (and always) for Limit. */
interface PlaceOrder {
  symbol: string;
  side: "BUY" | "SELL";
  type: "Limit" | "Market";
  /** Decimal string. Required for Limit, forbidden for Market. */
  price?: string;
  /** Spend this much quote ("100" USDT). */
  sizeQuote?: string;
  /** Buy or sell this many coins. */
  sizeBase?: string;
  /** Futures: a closing order that never grows the position. */
  reduceOnly?: boolean;
}

/** The order was ENQUEUED, not filled: follow clientOrderId on the orders channel. */
interface PlaceOrderAccepted {
  clientOrderId: string;
  status: "accepted";
}
```
