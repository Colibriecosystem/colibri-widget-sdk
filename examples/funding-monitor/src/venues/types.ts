/**
 * One venue's funding, normalized.
 *
 * Every venue publishes a rate PER FUNDING INTERVAL, and the intervals differ — 8 h on most,
 * 1 h on Kraken and Hyperliquid, and on KuCoin it varies per contract. Comparing raw rates across
 * venues is therefore meaningless, which is why this widget sorts on the annualized figure and
 * every adapter has to report the interval it actually found rather than assume one.
 */
export type FundingRow = {
  venue: string;
  /** The venue's own symbol, shown as-is — a widget should not invent a canonical spelling. */
  symbol: string;
  /** Fraction per interval, signed. 0.0001 = +0.01 %. */
  rate: number;
  /** The funding interval in ms. */
  intervalMs: number;
  /** Epoch ms of the next settlement, or null when the venue does not say. */
  nextMs: number | null;
  /** rate scaled to a year — the only cross-venue comparable number. */
  annualized: number;
};

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;
export const EIGHT_HOURS_MS = 8 * HOUR_MS;

export function annualize(rate: number, intervalMs: number): number {
  if (!Number.isFinite(rate) || !Number.isFinite(intervalMs) || intervalMs <= 0) return 0;
  return rate * (YEAR_MS / intervalMs);
}

/** Next wall-clock top of the hour — the settlement time for venues that publish none. */
export function nextTopOfHour(now = Date.now()): number {
  return Math.ceil(now / HOUR_MS) * HOUR_MS;
}

export function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : NaN;
}

export type VenueAdapter = {
  /** Shown in the table and in the venue filter. */
  venue: string;
  /** Throws on failure; the caller isolates one venue's failure from the rest. */
  load(): Promise<FundingRow[]>;
};

/**
 * A venue request the TERMINAL performs, against this widget's declared egress.
 *
 * Not `window.fetch`: two of the six venues here (KuCoin and Kraken Futures) send no CORS headers
 * at all, so a page simply cannot read them — the reason `colibri.net.fetch` exists.
 */
export async function venueJson(url: string, init?: { method?: "GET" | "POST"; body?: string }): Promise<unknown> {
  const colibri = window.colibri;
  if (!colibri) throw new Error("no host bridge");

  const r = await colibri.net.fetch(url, init);
  if (!r.ok) throw new Error(r.code ?? "net_failed");
  if (r.status < 200 || r.status >= 300) throw new Error(`HTTP ${r.status}`);
  if (!r.body) throw new Error("empty response");
  return JSON.parse(r.body);
}
