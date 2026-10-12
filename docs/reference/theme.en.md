# Theme: colours, font and language

> Русская версия — [theme.md](theme.md).

The terminal hands its palette to the widget page by itself, as CSS variables on `<html>`, together
with a font scale and two attributes — and updates them whenever the theme, the colours, the font size
or the language change. Write your colours with the role variables and the widget looks native with
zero code.

```css
body {
  background: var(--colibri-role-background, #0b0e13);
  color: var(--colibri-role-text, #d8dee9);
  font-size: calc(13px * var(--colibri-font-scale, 1));
}
.card {
  background: var(--colibri-role-surface, #171b23);
  border: 1px solid var(--colibri-role-divider, #2a2f3a);
}
.hint { color: var(--colibri-role-dim-text, #8b93a3); }
.buy { color: var(--colibri-role-bullish, #4caf50); }
.sell { color: var(--colibri-role-bearish, #e05252); }
```

Always write the fallback, the second argument of `var()`: outside the terminal — in an ordinary
browser, say — the variables do not exist, and in the first moments of loading they may not be set
yet. Every colour variable's value is an eight-digit hex `#rrggbbaa`: the opacity is the last two
digits.

## <a id="roles"></a>Roles

Roles are the vocabulary for styling the widget itself: background, surface, text, dividers, buy and
sell. They are the stable contract: role names do not change between terminal versions. The user can
override a role in the colour settings, and a widget built on roles follows.

| Variable | Role in the colour settings | What it is for in a widget |
| --- | --- | --- |
| `--colibri-role-bullish` | Bullish | buy, up, bid: text, lines, marks |
| `--colibri-role-bearish` | Bearish | sell, down, ask: text, lines, marks |
| `--colibri-role-bullish-muted` | Bullish (muted) | fills and row backgrounds on the buy side |
| `--colibri-role-bearish-muted` | Bearish (muted) | fills and row backgrounds on the sell side |
| `--colibri-role-background` | Background | the page background |
| `--colibri-role-surface` | Surface | what sits above the background: cards, headers, inputs |
| `--colibri-role-text` | Text | the main text and figures |
| `--colibri-role-dim-text` | Dim text | captions, secondary text, hints |
| `--colibri-role-accent` | Accent | highlights, volume bars, the active item |
| `--colibri-role-divider` | Divider | borders, lines, grids |

## <a id="elements"></a>Palette elements

Besides the roles, the terminal hands over every colour of its palette — 94 elements of the order book,
the trades tape, the clusters, the chart and the window chrome. A variable's name is `--colibri-`
followed by the element's name in hyphenated lower case. Elements are parts of the terminal's own
drawing, not a vocabulary for widgets: a new terminal version may rename, add or remove one, and then
the variable disappears and your fallback takes over. The contract is the roles. Use an element only
when you need exactly that terminal colour — the liquidation bubble from the tape, say — and always with
a fallback.

<details>
<summary>All 94 element variables</summary>

**Orderbook ladder**

| Variable | Name in the colour settings |
| --- | --- |
| `--colibri-background` | Panel background |
| `--colibri-ask-background` | Ask row background |
| `--colibri-bid-background` | Bid row background |
| `--colibri-best-ask` | Best ask highlight |
| `--colibri-best-bid` | Best bid highlight |
| `--colibri-spread` | Spread row |
| `--colibri-text-ask` | Ask price text |
| `--colibri-text-bid` | Bid price text |
| `--colibri-text-black` | Volume text |
| `--colibri-text-gray` | Header % pill / status text |
| `--colibri-bar` | Volume bar |
| `--colibri-large-volume` | Large-volume bar ① |
| `--colibri-large-volume2` | Large-volume bar ② |
| `--colibri-large-volume3` | Large-volume bar ③ |
| `--colibri-large-volume4` | Large-volume bar ④ |
| `--colibri-divider` | Column divider |
| `--colibri-round-divider` | 10-row divider |
| `--colibri-hover-row-highlight` | Hover row highlight |
| `--colibri-hover-readout-plaque` | Hover % / volume plaque |
| `--colibri-hover-readout-ink` | Hover % / volume text |

**Orders & position**

| Variable | Name in the colour settings |
| --- | --- |
| `--colibri-order-buy-fill` | Buy order fill |
| `--colibri-order-buy-border` | Buy order border |
| `--colibri-order-sell-fill` | Sell order fill |
| `--colibri-order-sell-border` | Sell order border |
| `--colibri-order-x-glyph` | Cancel (×) glyph |
| `--colibri-order-qty-text` | Order qty text |
| `--colibri-position-entry-row` | Position entry row |
| `--colibri-mark-price-marker` | Mark price marker (MP) |
| `--colibri-index-price-marker` | Index price marker (IP) |
| `--colibri-liquidation-price-marker` | Liquidation price marker (LP) |

**Trades tape & liquidations**

| Variable | Name in the colour settings |
| --- | --- |
| `--colibri-tick-buy-circle` | Buy trade bubble |
| `--colibri-tick-sell-circle` | Sell trade bubble |
| `--colibri-tick-text` | Trade bubble label |
| `--colibri-tick-stroke` | Trade bubble outline |
| `--colibri-connector-line` | Trade connector line |
| `--colibri-liq-buy-fill` | Liquidation buy bubble |
| `--colibri-liq-sell-fill` | Liquidation sell bubble |
| `--colibri-liq-stroke` | Liquidation outline |
| `--colibri-tape-entry-marker` | Position entry marker |
| `--colibri-tape-entry-marker-text` | Position entry marker text |

**Cluster / footprint**

| Variable | Name in the colour settings |
| --- | --- |
| `--colibri-cluster-text` | Cluster cell text |
| `--colibri-cluster-buy` | Cluster cell (buy) |
| `--colibri-cluster-sell` | Cluster cell (sell) |
| `--colibri-cluster-poc-frame` | Cluster max-volume frame |
| `--colibri-footer-volume-bg` | Cluster volume background |
| `--colibri-footer-text` | Cluster volume text |
| `--colibri-footer-time-bg` | Cluster time background |
| `--colibri-footer-time-text` | Cluster time text |

**Panel header & badges**

| Variable | Name in the colour settings |
| --- | --- |
| `--colibri-header-background` | Header background |
| `--colibri-header-symbol` | Symbol text |
| `--colibri-header-positive` | Change % up |
| `--colibri-header-negative` | Change % down |
| `--colibri-market-spot-bg` | Spot badge |
| `--colibri-market-spot-text` | Spot badge text |
| `--colibri-market-futures-bg` | Futures badge |
| `--colibri-market-futures-text` | Futures badge text |

**Candlestick chart**

| Variable | Name in the colour settings |
| --- | --- |
| `--colibri-candle-bull-body` | Bull candle body |
| `--colibri-candle-bear-body` | Bear candle body |
| `--colibri-candle-bull-wick` | Bull candle wick |
| `--colibri-candle-bear-wick` | Bear candle wick |
| `--colibri-candle-border` | Candle border |
| `--colibri-chart-grid-line` | Chart grid line |
| `--colibri-crosshair-line` | Crosshair |
| `--colibri-current-price-badge` | Current price badge |
| `--colibri-signal-marker-line` | Signal marker line |
| `--colibri-signal-alert-line` | Signal alert line |
| `--colibri-signal-crossed-line` | Signal crossed line |
| `--colibri-chart-drawing` | Drawing line |
| `--colibri-chart-drawing-selected` | Drawing selection |
| `--colibri-chart-background` | Chart background |
| `--colibri-chart-price-zone-bg` | Price zone background |
| `--colibri-chart-time-zone-bg` | Timeframe zone background |
| `--colibri-chart-scale-text` | Scale numbers |
| `--colibri-chart-ruler-text` | Ruler text |
| `--colibri-chart-pane-separator` | Plot frame lines |
| `--colibri-volume-bar-bull` | Volume bar (buy) |
| `--colibri-volume-bar-bear` | Volume bar (sell) |
| `--colibri-chart-order-buy` | Buy order line |
| `--colibri-chart-order-sell` | Sell order line |
| `--colibri-chart-position-profit` | Position entry line (profit) |
| `--colibri-chart-position-loss` | Position entry line (loss) |
| `--colibri-chart-take-profit` | Take-profit line |
| `--colibri-chart-stop-loss` | Stop-loss line |
| `--colibri-chart-liquidation` | Liquidation line |
| `--colibri-chart-trade-buy` | Closed trade buy marker |
| `--colibri-chart-trade-sell` | Closed trade sell marker |
| `--colibri-chart-trade-connector` | Closed trade connector |

**App chrome**

| Variable | Name in the colour settings |
| --- | --- |
| `--colibri-window-header` | Window header |
| `--colibri-tab-active` | Active tab |
| `--colibri-tab-hover` | Tab hover |
| `--colibri-tab-attention` | Tab signal alert |

**Tab mark colours**

| Variable | Name in the colour settings |
| --- | --- |
| `--colibri-tab-mark-position` | Tab position mark |
| `--colibri-tab-mark-limits` | Tab limit-order mark |
| `--colibri-tab-mark-text` | Tab counter text |

</details>

## <a id="font-scale"></a>Font scale

`--colibri-font-scale` is a number: 1 at the terminal's default font size, more or less when the user
changes the font size in the settings. Multiply your sizes by it and the widget's text grows with the
terminal's:

```css
body { font-size: calc(13px * var(--colibri-font-scale, 1)); }
```

A `<canvas>` ignores the variable — take `fontScale` from the [`theme`](bridge.en.md#event-theme)
event.

## <a id="attributes"></a>The `<html>` attributes

| Attribute | Values | What for |
| --- | --- | --- |
| `data-theme` | `dark`, `light` | Styles that depend on the light or dark base — a logo in two variants, for instance. |
| `data-colibri-lang` | `ru`, `en` | Styles that depend on the terminal's UI language. |

```css
:root[data-theme="light"] .logo { filter: invert(1); }
```

The terminal sets the attributes and the variables on `<html>` by itself — no later than the
`DOMContentLoaded` event — and resets them on every change. It leaves the `lang` attribute alone. In a
script, do not read the attributes at load: the same facts are in `handshake().theme` and
`handshake().lang`, available synchronously before your first line runs.

## <a id="language"></a>Language

The terminal's UI language is `handshake().lang`: currently `"ru"` or `"en"`. More may come, so show
an unknown one in English. The user can switch the language on the fly, without restarting the widget:
the [`theme`](bridge.en.md#event-theme) event then arrives with the new `lang`, and
`handshake().lang` is already updated. The recipe is [follow the language](../recipes.en.md#follow-language).

```js
import { handshake, on } from "./colibri.js";

const texts = { ru: { title: "Стакан" }, en: { title: "Order book" } };
const render = (lang) => {
  document.title = (texts[lang] ?? texts.en).title;
};
render(handshake().lang);
on("theme", (e) => render(e.lang));
```
