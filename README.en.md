# Colibri widget SDK

> Русская версия — [README.md](README.md).

A Colibri widget is a web page the terminal opens in a panel or in a window of its own, and gives
its API: market data, the user's accounts and orders through their connections, the layout,
notifications, price alerts, the theme and the language. Users install widgets from the Nest
catalog and decide for themselves which permissions to grant. This repository holds everything an
author needs: the SDK, the four starters the terminal creates a project from, two reference
widgets, the documentation and the publishing rules.

## <a id="path"></a>The author's path

1. [Your first widget](docs/getting-started.en.md) — from the Author tab in Nest to the first
   version in the catalog.
2. [API reference](docs/reference/README.en.md) — every call, channel and event: what it takes,
   what it returns, the scope it needs and how it refuses.
3. [Recipes](docs/recipes.en.md) — the order book, the trade tape, the account, a safe order, the
   theme, the language, settings, data from other venues.
4. [Publishing](docs/publishing.en.md) — the author and their key, the listing, releasing a version, review,
   access and stats.

At hand:

- [`starters/`](starters/) — four starters: Plain, TypeScript + React, Trading and Chart. The
  terminal creates a project from them itself.
- [CAPABILITIES.en.md](CAPABILITIES.en.md) — the widget's environment: what works, what does not,
  and how to pick an architecture. Read it before you design.
- [CHECKS.en.md](CHECKS.en.md) — Nest's checks: what each refusal code means and how to fix it.
- [`policies/`](policies/) — what may be published, and what happens when a widget is taken down.
- [`examples/`](examples/) — two reference widgets with their sources: Funding monitor and
  Liquidation radar.

## <a id="example"></a>What it looks like

The order book: a snapshot for the first paint, then live updates. `colibri.js` sits beside the
page — every starter already carries a copy.

```js
import { handshake, markets, stream } from "./colibri.js";

const exchange = "BinanceSpot";
const symbol = "BTCUSDT";

// Who am I and what may I do — known at once, with no await and no ready event.
const { widgetId, grantedScopes } = handshake();
console.log(widgetId, grantedScopes);

// A snapshot, then live snapshots at most 4 a second. Prices and sizes arrive as strings.
const book = await markets.book(exchange, symbol, { depth: 10 });
console.log(book.bestBid, book.bestAsk);
const stop = stream.subscribe("book", { exchange, symbol, depth: 10, hz: 4 }, (live) => {
  console.log(live.bestBid, live.bestAsk);
});
```

What can go wrong here, and how to survive it, is in the [order-book recipe](docs/recipes.en.md#order-book).

## <a id="layout"></a>What lives where

| Folder | What it holds |
| --- | --- |
| [`sdk/`](sdk/) | the SDK — `colibri.js` and its types `colibri.d.ts`: two files you put beside your page |
| [`starters/`](starters/) | the starters; every release of this repository is a starters release, and terminals take them from it |
| [`examples/`](examples/) | the reference widgets: sources and built `dist/` |
| [`docs/`](docs/) | the author docs: first widget, reference, recipes, publishing |
| [`policies/`](policies/) | the Nest catalog's rules: what may be published, how a widget is taken down |
| [`scripts/`](scripts/) | the repository's checks: docs, starters, SDK copies |
