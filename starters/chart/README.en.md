# A Colibri widget — chart

Candles from live trades on a `<canvas>`: 1s, 5s, 15s and 1m timeframes, volume, bid and ask lines,
a crosshair with the candle's values. No third-party libraries and no build.

> Русская версия — [README.md](README.md), она же основная.

## Where this project comes from

The terminal creates it: **Nest → Author → a widget → Code → From a template → Chart**. It writes
the widget's ID into `widget/widget.json` and loads the **`widget/`** folder with hot reload.

## How it works

| Path | What it is |
|---|---|
| `widget/index.html` | the page: what to show and where the data comes from |
| `widget/chart.js` | the drawing: candles, axes, crosshair |
| `widget/colibri.js`, `colibri.d.ts` | the SDK and its types — a copy of this repository's `sdk/` |

- Prints arrive from the `trades` stream and are kept as one-second candles; longer timeframes are
  merged from them when drawn. The last hour is kept.
- Widgets have no candle-history route, so the chart starts when it opens. Fetch history from the
  venue yourself: add its host to the manifest's `egress` and request candles with
  `colibri.net.fetch` — the terminal makes the call for the widget.
- The canvas takes its colours from the terminal's theme variables and re-reads them on `theme`.
- A hidden widget keeps collecting prints but draws nothing until it is shown again (the
  `visibility` event).
