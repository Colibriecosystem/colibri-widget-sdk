# A Colibri widget — trading

A connection's account, live — balances, positions, orders — and a **limit** order that leaves only
after an explicit confirmation. Vite, TypeScript and React.

> Русская версия — [README.md](README.md), она же основная.

## Where this project comes from

The terminal creates it: **Nest → Author → a widget → Code → From a template → Trading**. It writes
the widget's ID into every `widget.json` and `package.json` and loads the ready **`dist/`** build
with hot reload.

To trade, the widget needs two permissions: `trading` when the widget is installed, and trading
allowed for the specific connection — **Settings → Program → Local API**. Without the second the
terminal answers `403 trading_not_enabled`, and the widget says where to switch it on.

## The rules this starter keeps

Keep them in your widget too:

- **An order is sent from one place** — the Confirm button's handler (`place` in `src/App.tsx`).
  Never on load, from a timer, from a stream handler, from a restored setting or on a key press.
- **Price and size start empty** and are never restored from `storage`: a restarted widget cannot
  be one click away from an order the user did not type.
- **Any edit closes the confirmation**, so what is confirmed is exactly what is sent.
- **A demo connection first.** A live one carries a red "LIVE — real money" bar.
- **Limit orders only.** No market orders, no cancel-all and no close-all in the starter: those are
  mass actions, and an example people copy does not need them. The SDK has them —
  `trading.cancelAll` and `trading.closePositions`.

A `202` means the order was queued, not filled: the exchange's answer arrives on the `orders`
stream. On top of the widget's own rules, the terminal applies the same limits to its orders as to
a click in the order book.

## Editing

Node.js 20 or newer:

```bash
npm install
npm run watch
```

The build lands in `dist/` and the terminal reloads the widget. `npm run typecheck` checks types.
The HMR variant is `npm run dev` (port 5174) with the `dev/` folder instead of `dist/`.

| Path | What it is |
|---|---|
| `src/App.tsx` | the widget: connection, book, order, account |
| `src/i18n.ts` | the Russian and English text |
| `src/styles.css` | styles on the terminal's theme variables |
| `public/widget.json`, `dev/widget.json` | the manifest and its dev variant |
| `src/lib/colibri.js`, `colibri.d.ts` | the SDK and its types — a copy of this repository's `sdk/` |
