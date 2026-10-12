# Liquidation radar

> Русская версия — [README.md](README.md).

A liquidation feed across five venues in one table: size buckets over 5 minutes, a sound on large
prints, the terminal's colours (amber = a long was liquidated, cyan = a short).

This is a reference widget: it is built only on the public SDK and on declared hosts, with no
private hooks. Everything it does, your widget can do too.

## What it shows

- **The data comes from the widget's own WebSocket connections.** The terminal does not serve
  liquidations through the Local API (its `trades` do not carry them, by design), so the widget goes
  to the venues itself — through the hosts in `egress`, which the user sees when granting
  permissions.
- **Five venues, six sockets.** OKX, Bitget, Gate and Binance have market-wide streams: one
  subscription covers the whole market. Bybit has no such stream — it needs the instrument list
  and a subscription per symbol; 843 of them fit into one socket in batches of 50.
- **Sound and alerts go through the terminal's notifications**, so they work while the tab is
  hidden: hidden widgets keep running at full rate.

## Running it

The simplest way is to install the widget from the Nest catalog: it is published there. The built
version also sits in this repository, in `dist`, and you can install it locally: zip the contents
of `dist` (with `widget.json` at the archive's root) and open **Nest → My widgets → Add a local
widget… → Install from zip…**. At install the terminal shows the hosts the widget will be able to
reach.

If you want to change the code:

```bash
npm install
npm run build
```

For development with hot reload — `npm run dev` and the `dev` folder (its manifest's `entry` points
at `http://localhost:5173`). The ID `liquidation-radar` belongs to the published example, so put
your own widget's ID into `dev/widget.json` (and into `public/widget.json` if you will build your
own version) and link the `dev` folder to that widget on the Author tab — see
[Your own folder](../../docs/getting-started.en.md#own-folder).

## What to read in the code

| File | Why read it |
|---|---|
| `src/venues/index.ts` | Five adapters. The key thing here is **which side was liquidated**: Binance and OKX report the side of the FORCED ORDER, while Bybit, Bitget and OKX's `posSide` field report the side of the POSITION. Mixing them up inverts every colour on screen, and without the venue's own UI beside it you cannot tell. |
| `src/venues/types.ts` | `resilientSocket` — reconnect with jitter and an **application-level** heartbeat: a browser cannot send WebSocket pings, so every venue that expects them gets its own frame. |
| `src/App.tsx` | The difference between "connected" and "data is flowing". A socket can finish its handshake, accept every subscription and stay silent — this was measured on a live machine, so each venue has a status of its own. |

## Sizes

Each venue counts size its own way, and the adapter brings everything to the base coin: OKX sends
CONTRACTS (it needs `ctVal`), Gate a signed contract size (`quanto_multiplier`, and the sign is the
side), Bitget the quote volume directly (divided by the price), Binance and Bybit the base coin as
it is.
