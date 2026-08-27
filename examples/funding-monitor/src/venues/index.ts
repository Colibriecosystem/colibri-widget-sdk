import {
  EIGHT_HOURS_MS,
  HOUR_MS,
  annualize,
  nextTopOfHour,
  num,
  venueJson,
  type FundingRow,
  type VenueAdapter,
} from "./types";

/** Build a row, doing the annualization once so no adapter can forget it. */
function row(venue: string, symbol: string, rate: number, intervalMs: number, nextMs: number | null): FundingRow | null {
  if (!symbol || !Number.isFinite(rate)) return null;
  return { venue, symbol, rate, intervalMs, nextMs, annualized: annualize(rate, intervalMs) };
}

function rows(v: unknown, path?: string): unknown[] {
  const root = path ? (v as Record<string, unknown>)?.[path] : v;
  return Array.isArray(root) ? root : [];
}

/**
 * Binance USDⓈ-M. One request returns every symbol.
 *
 * The 8 h interval is the default rather than a fact: a handful of contracts settle every 4 h and
 * `/fapi/v1/fundingInfo` lists them. Reading that second endpoint is a refinement, not a
 * correctness fix — the table shows the interval it used, so an 8 h assumption is visible.
 */
const binance: VenueAdapter = {
  venue: "Binance",
  async load() {
    const data = await venueJson("https://fapi.binance.com/fapi/v1/premiumIndex");
    return rows(data)
      .map((r) => {
        const o = r as Record<string, unknown>;
        const next = num(o.nextFundingTime);
        return row("Binance", String(o.symbol ?? ""), num(o.lastFundingRate), EIGHT_HOURS_MS, Number.isFinite(next) && next > 0 ? next : null);
      })
      .filter((r): r is FundingRow => r !== null);
  },
};

/** Bybit linear. `fundingInterval` is per instrument, in MINUTES, and comes from a second call. */
const bybit: VenueAdapter = {
  venue: "Bybit",
  async load() {
    const intervals = new Map<string, number>();
    try {
      const meta = await venueJson("https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000");
      for (const r of rows((meta as Record<string, unknown>)?.result, "list")) {
        const o = r as Record<string, unknown>;
        const minutes = num(o.fundingInterval);
        if (o.symbol && Number.isFinite(minutes) && minutes > 0) intervals.set(String(o.symbol), minutes * 60 * 1000);
      }
    } catch {
      // Falling back to 8 h is better than dropping the venue; the interval column stays honest.
    }

    const data = await venueJson("https://api.bybit.com/v5/market/tickers?category=linear");
    return rows((data as Record<string, unknown>)?.result, "list")
      .map((r) => {
        const o = r as Record<string, unknown>;
        const symbol = String(o.symbol ?? "");
        const next = num(o.nextFundingTime);
        return row("Bybit", symbol, num(o.fundingRate), intervals.get(symbol) ?? EIGHT_HOURS_MS, Number.isFinite(next) && next > 0 ? next : null);
      })
      .filter((r): r is FundingRow => r !== null);
  },
};

/**
 * Gate USDT perps. Two traps in one response: `funding_next_apply` is in SECONDS where every other
 * venue here uses ms, and `funding_interval` is in seconds too.
 */
const gate: VenueAdapter = {
  venue: "Gate",
  async load() {
    const data = await venueJson("https://api.gateio.ws/api/v4/futures/usdt/contracts");
    return rows(data)
      .map((r) => {
        const o = r as Record<string, unknown>;
        const intervalSec = num(o.funding_interval);
        const nextSec = num(o.funding_next_apply);
        return row(
          "Gate",
          String(o.name ?? ""),
          num(o.funding_rate),
          Number.isFinite(intervalSec) && intervalSec > 0 ? intervalSec * 1000 : EIGHT_HOURS_MS,
          Number.isFinite(nextSec) && nextSec > 0 ? nextSec * 1000 : null,
        );
      })
      .filter((r): r is FundingRow => r !== null);
  },
};

/**
 * KuCoin futures. No CORS headers at all — unreachable from a page, so this adapter only works
 * through the host. `fundingRateGranularity` gives the interval in ms directly, and it genuinely
 * varies per contract (8 h on most, 4 h on some), so it is read rather than assumed.
 * `nextFundingRateDateTime` is an ABSOLUTE epoch, verified against the wall clock.
 */
const kucoin: VenueAdapter = {
  venue: "KuCoin",
  async load() {
    const data = await venueJson("https://api-futures.kucoin.com/api/v1/contracts/active");
    return rows(data, "data")
      .map((r) => {
        const o = r as Record<string, unknown>;
        const granularity = num(o.fundingRateGranularity);
        const next = num(o.nextFundingRateDateTime);
        return row(
          "KuCoin",
          String(o.symbol ?? ""),
          num(o.fundingFeeRate),
          Number.isFinite(granularity) && granularity > 0 ? granularity : EIGHT_HOURS_MS,
          Number.isFinite(next) && next > 0 ? next : null,
        );
      })
      .filter((r): r is FundingRow => r !== null);
  },
};

/**
 * Kraken Futures. Also CORS-less, and its `fundingRate` is NOT a fraction — it is an absolute
 * amount per contract, so it has to be divided by the mark price to become comparable. Skipping
 * that division does not fail loudly; it silently reports a nonsense rate.
 */
const kraken: VenueAdapter = {
  venue: "Kraken",
  async load() {
    const data = await venueJson("https://futures.kraken.com/derivatives/api/v3/tickers");
    const next = nextTopOfHour();
    return rows(data, "tickers")
      .map((r) => {
        const o = r as Record<string, unknown>;
        if (String(o.tag ?? "") !== "perpetual") return null;
        const absolute = num(o.fundingRate);
        const mark = num(o.markPrice);
        if (!Number.isFinite(absolute) || !Number.isFinite(mark) || mark <= 0) return null;
        return row("Kraken", String(o.symbol ?? "").toUpperCase(), absolute / mark, HOUR_MS, next);
      })
      .filter((r): r is FundingRow => r !== null);
  },
};

/** Hyperliquid. A POST, and the only one: `assetCtxs[i]` is positional against `universe[i]`. */
const hyperliquid: VenueAdapter = {
  venue: "Hyperliquid",
  async load() {
    const data = await venueJson("https://api.hyperliquid.xyz/info", {
      method: "POST",
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    });
    if (!Array.isArray(data) || data.length < 2) return [];
    const universe = rows((data[0] as Record<string, unknown>) ?? {}, "universe");
    const ctxs = Array.isArray(data[1]) ? (data[1] as unknown[]) : [];
    const next = nextTopOfHour();

    return universe
      .map((u, i) => {
        const name = String((u as Record<string, unknown>)?.name ?? "");
        const ctx = ctxs[i] as Record<string, unknown> | undefined;
        return ctx ? row("Hyperliquid", name, num(ctx.funding), HOUR_MS, next) : null;
      })
      .filter((r): r is FundingRow => r !== null);
  },
};

export const ADAPTERS: VenueAdapter[] = [binance, bybit, gate, kucoin, kraken, hyperliquid];
export const VENUE_NAMES = ADAPTERS.map((a) => a.venue);
