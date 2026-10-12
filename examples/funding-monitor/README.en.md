# Funding monitor

> Русская версия — [README.md](README.md).

Funding across six venues in one table, sorted by annualized rate, with a countdown to settlement
and threshold alerts.

This is a reference widget: only the public SDK and declared hosts, no private hooks.

## Why `colibri.net.fetch` is here

Two of the six venues — **KuCoin and Kraken Futures — send no CORS headers at all** (checked
live). A plain `fetch` from the page cannot read them, and nothing on the page side gets around
that. So the TERMINAL makes the request — to exactly the hosts the user saw when granting
permissions. That also makes the `egress` list the first place on the platform that actually
forbids something rather than only being shown at install.

## Rates cannot be compared directly

Each venue publishes its rate **for its own interval**: 8 hours for most, an hour for Kraken and
Hyperliquid, and a per-contract interval for KuCoin (`fundingRateGranularity` comes right in the
response). So the only comparable number is the annualized rate, and that is what the table sorts
by. The Interval column shows what the adapter used.

Kraken stands apart: its `fundingRate` is **not a fraction** but an absolute amount that has to be
divided by the mark price. Skip that and there is no error — just a confidently wrong number.

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
at `http://localhost:5173`). The ID `funding-monitor` belongs to the published example, so put your
own widget's ID into `dev/widget.json` (and into `public/widget.json` if you will build your own
version) and link the `dev` folder to that widget on the Author tab — see
[Your own folder](../../docs/getting-started.en.md#own-folder).

## What to read in the code

| File | Why read it |
|---|---|
| `src/venues/index.ts` | Six adapters, each with its quirk in a comment: seconds instead of milliseconds at Gate, an absolute rate at Kraken, the positional zip `universe[i]`/`assetCtxs[i]` at Hyperliquid, and POST only there too. |
| `src/alerts.ts` | Why alerts latch. A rate stays above the threshold for hours, and the settlement window is wider than the polling period — without the latch an alert would fire on every poll and become useless. |
| `src/App.tsx` | One polling loop per venue rather than one shared loop: a slow or failing venue must not hold up the rest, and each keeps its last good data while it retries. |

Polling runs once a minute with jitter: six requests a minute against a limit of 60, a tenfold
margin.
