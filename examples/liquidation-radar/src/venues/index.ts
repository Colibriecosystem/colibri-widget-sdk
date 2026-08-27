import { num, resilientSocket, venueJson, type LiqPrint, type VenueFeed, type VenueStatus } from "./types";

/** Instrument metadata a venue needs before its sizes mean anything. Fetched once, then cached. */
async function contractSizes(url: string, read: (row: any) => [string, number] | null): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const data = await venueJson(url);
    const list = Array.isArray(data) ? data : ((data as any)?.data ?? (data as any)?.result?.list ?? []);
    for (const row of Array.isArray(list) ? list : []) {
      const pair = read(row);
      if (pair && Number.isFinite(pair[1]) && pair[1] > 0) map.set(pair[0], pair[1]);
    }
  } catch {
    // A missing table means sizes fall back to 1× — visibly wrong for a few contracts is better
    // than a venue that shows nothing.
  }
  return map;
}

/**
 * Binance USDⓈ-M — ONE market-wide stream for every symbol.
 *
 * `o.S` is the FORCED ORDER's side, so a BUY means a short was bought back: the opposite reading
 * from Bybit and Bitget, which report the position's side. Quantities are already base-asset.
 */
const binance: VenueFeed = {
  venue: "Binance",
  start(onPrint, onStatus) {
    return resilientSocket({
      url: "wss://fstream.binance.com/stream?streams=!forceOrder@arr",
      onStatus,
      onOpen: () => {},
      onMessage: (m) => {
        const o = m?.data?.o;
        if (!o?.s) return;
        const price = num(o.ap ?? o.p);
        const qty = num(o.q);
        if (!Number.isFinite(price) || !Number.isFinite(qty)) return;
        onPrint({
          venue: "Binance",
          symbol: String(o.s),
          side: String(o.S).toUpperCase() === "BUY" ? "short" : "long",
          price,
          qty,
          notionalUsd: price * qty,
          ts: num(o.T) || Date.now(),
        });
      },
    });
  },
};

/**
 * OKX — one subscription covers every SWAP, linear and inverse.
 *
 * The only venue that states the liquidated side outright (`posSide`), so it is used in preference
 * to deriving it from `side`. `sz` is a CONTRACT count; `ctVal` turns it into base units.
 */
const okx: VenueFeed = {
  venue: "OKX",
  start(onPrint, onStatus) {
    let ctVal = new Map<string, number>();
    void contractSizes("https://www.okx.com/api/v5/public/instruments?instType=SWAP", (r) =>
      r?.instId ? [String(r.instId), num(r.ctVal)] : null,
    ).then((m) => (ctVal = m));

    return resilientSocket({
      url: "wss://ws.okx.com:8443/ws/v5/public",
      onStatus,
      keepAlive: { everyMs: 25_000, frame: () => "ping" },
      onOpen: (send) => send({ op: "subscribe", args: [{ channel: "liquidation-orders", instType: "SWAP" }] }),
      onMessage: (m) => {
        if (m?.arg?.channel !== "liquidation-orders" || !Array.isArray(m.data)) return;
        for (const inst of m.data) {
          const instId = String(inst?.instId ?? "");
          for (const d of Array.isArray(inst?.details) ? inst.details : []) {
            const price = num(d.bkPx);
            const contracts = num(d.sz);
            if (!instId || !Number.isFinite(price) || !Number.isFinite(contracts)) continue;
            const qty = contracts * (ctVal.get(instId) ?? 1);
            onPrint({
              venue: "OKX",
              symbol: instId,
              side: String(d.posSide ?? "").toLowerCase() === "long" ? "long"
                : String(d.posSide ?? "").toLowerCase() === "short" ? "short"
                  : String(d.side ?? "").toLowerCase() === "buy" ? "short" : "long",
              price,
              qty,
              notionalUsd: price * qty,
              ts: num(d.ts) || Date.now(),
            });
          }
        }
      },
    });
  },
};

/**
 * Bitget — a platform-wide topic per product line, so three subscriptions cover the venue.
 *
 * `side` is the POSITION side, and `amount` is already QUOTE notional rather than a quantity —
 * dividing it back out is what makes the size column comparable with the other venues.
 */
const bitget: VenueFeed = {
  venue: "Bitget",
  start(onPrint, onStatus) {
    return resilientSocket({
      url: "wss://ws.bitget.com/v3/ws/public",
      onStatus,
      keepAlive: { everyMs: 30_000, frame: () => "ping" },
      onOpen: (send) => {
        for (const instType of ["usdt-futures", "usdc-futures", "coin-futures"]) {
          send({ op: "subscribe", args: [{ instType, topic: "liquidation" }] });
        }
      },
      onMessage: (m) => {
        if (m?.arg?.topic !== "liquidation" || !Array.isArray(m.data)) return;
        for (const d of m.data) {
          const price = num(d.price);
          const notional = num(d.amount);
          if (!d?.symbol || !Number.isFinite(price) || price <= 0 || !Number.isFinite(notional)) continue;
          onPrint({
            venue: "Bitget",
            symbol: String(d.symbol),
            side: String(d.side).toLowerCase() === "buy" ? "long" : "short",
            price,
            qty: notional / price,
            notionalUsd: notional,
            ts: num(d.ts) || Date.now(),
          });
        }
      },
    });
  },
};

/**
 * Gate — `["!all"]` makes one subscription cover every USDT perp.
 *
 * `size` is a SIGNED contract count and the sign is the whole signal: positive is a forced buy,
 * so a short was liquidated. `quanto_multiplier` converts contracts to base.
 */
const gate: VenueFeed = {
  venue: "Gate",
  start(onPrint, onStatus) {
    let qmult = new Map<string, number>();
    void contractSizes("https://api.gateio.ws/api/v4/futures/usdt/contracts", (r) =>
      r?.name ? [String(r.name), num(r.quanto_multiplier)] : null,
    ).then((m) => (qmult = m));

    return resilientSocket({
      url: "wss://fx-ws.gateio.ws/v4/ws/usdt",
      onStatus,
      keepAlive: { everyMs: 10_000, frame: () => ({ time: Math.floor(Date.now() / 1000), channel: "futures.ping" }) },
      onOpen: (send) =>
        send({
          time: Math.floor(Date.now() / 1000),
          channel: "futures.public_liquidates",
          event: "subscribe",
          payload: ["!all"],
        }),
      onMessage: (m) => {
        if (m?.channel !== "futures.public_liquidates" || m?.event !== "update") return;
        const list = Array.isArray(m.result) ? m.result : [m.result];
        for (const d of list) {
          const price = num(d?.price);
          const size = num(d?.size);
          if (!d?.contract || !Number.isFinite(price) || !Number.isFinite(size)) continue;
          const qty = Math.abs(size) * (qmult.get(String(d.contract)) ?? 1);
          onPrint({
            venue: "Gate",
            symbol: String(d.contract),
            side: size > 0 ? "short" : "long",
            price,
            qty,
            notionalUsd: price * qty,
            ts: num(d.time) || Date.now(),
          });
        }
      },
    });
  },
};

/**
 * Bybit — the one venue with no market-wide topic: it needs the instrument list and a subscription
 * per symbol. 843 linear instruments arrive in a single page and all of them fit on ONE socket in
 * chunks of 50 args, which is the venue's per-frame cap.
 *
 * `S` is the POSITION side, inverted from Binance's reading of the same letter.
 */
const bybit: VenueFeed = {
  venue: "Bybit",
  start(onPrint, onStatus) {
    let symbols: string[] = [];
    let teardown: (() => void) | null = null;
    let stopped = false;

    onStatus("connecting");
    void (async () => {
      try {
        const data: any = await venueJson("https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000");
        symbols = (data?.result?.list ?? [])
          .filter((i: any) => i?.status === "Trading" && i?.symbol)
          .map((i: any) => String(i.symbol));
      } catch {
        onStatus("failed");
        return;
      }

      if (stopped || symbols.length === 0) {
        if (!stopped) onStatus("failed");
        return;
      }

      teardown = resilientSocket({
        url: "wss://stream.bybit.com/v5/public/linear",
        onStatus,
        keepAlive: { everyMs: 20_000, frame: () => ({ op: "ping" }) },
        onOpen: (send) => {
          for (let i = 0; i < symbols.length; i += 50) {
            send({ op: "subscribe", args: symbols.slice(i, i + 50).map((s) => `allLiquidation.${s}`) });
          }
        },
        onMessage: (m) => {
          if (typeof m?.topic !== "string" || !m.topic.startsWith("allLiquidation") || !Array.isArray(m.data)) return;
          for (const d of m.data) {
            const price = num(d.p);
            const qty = num(d.v);
            if (!d?.s || !Number.isFinite(price) || !Number.isFinite(qty)) continue;
            onPrint({
              venue: "Bybit",
              symbol: String(d.s),
              side: String(d.S).toLowerCase() === "buy" ? "long" : "short",
              price,
              qty,
              notionalUsd: price * qty,
              ts: num(d.T) || Date.now(),
            });
          }
        },
      });
    })();

    return () => {
      stopped = true;
      teardown?.();
    };
  },
};

export const FEEDS: VenueFeed[] = [binance, okx, bitget, gate, bybit];
export const VENUE_NAMES = FEEDS.map((f) => f.venue);
export type { VenueStatus, LiqPrint };
