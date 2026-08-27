/**
 * One liquidation print, normalized across venues.
 *
 * `side` is WHICH SIDE GOT LIQUIDATED, not the side of the forced order — venues disagree about
 * which of the two they report, and picking one meaning and converting into it at the edge is the
 * only way the table can be read at a glance. Binance and OKX report the ORDER side (a forced BUY
 * closes a short), while Bybit, Bitget and OKX's `posSide` report the POSITION side. Getting this
 * backwards inverts every colour on screen and is invisible without a venue UI beside it.
 */
export type LiqPrint = {
  venue: string;
  symbol: string;
  /** "long" = a long position was liquidated (forced SELL). */
  side: "long" | "short";
  price: number;
  /** Base-asset quantity, after any contract conversion. */
  qty: number;
  notionalUsd: number;
  ts: number;
};

export type VenueFeed = {
  venue: string;
  /** Opens sockets and calls `onPrint` for each liquidation. Returns a teardown. */
  start(onPrint: (p: LiqPrint) => void, onStatus: (s: VenueStatus) => void): () => void;
};

/**
 * `connected` and `live` are deliberately different states. A socket can complete its handshake,
 * accept every subscription, and then deliver nothing at all — measured on this machine against
 * Binance, where even a control stream stayed silent while control messages round-tripped. A feed
 * that only reported "connected" would look healthy while showing an empty table forever.
 */
export type VenueStatus = "connecting" | "connected" | "live" | "failed";

export function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : NaN;
}

/** A venue request the TERMINAL performs, against this widget's declared egress. */
export async function venueJson(url: string): Promise<unknown> {
  const colibri = window.colibri;
  if (!colibri) throw new Error("no host bridge");
  const r = await colibri.net.fetch(url);
  if (!r.ok) throw new Error(r.code ?? "net_failed");
  if (!r.body) throw new Error("empty response");
  return JSON.parse(r.body);
}

/**
 * A socket that re-dials with backoff and reports what it is actually doing.
 *
 * Browsers cannot send WebSocket control pings, so every venue that expects a heartbeat needs an
 * application-level one sent from here — and the widget keeps running on a hidden tab, so these
 * timers have to survive being out of sight.
 */
export function resilientSocket(opts: {
  url: string;
  onOpen: (send: (msg: unknown) => void) => void;
  onMessage: (msg: any) => void;
  onStatus: (s: VenueStatus) => void;
  /** Application-level keep-alive, if the venue wants one. */
  keepAlive?: { everyMs: number; frame: () => unknown };
}): () => void {
  let ws: WebSocket | null = null;
  let stopped = false;
  let attempt = 0;
  let reconnectTimer: number | undefined;
  let pingTimer: number | undefined;

  const send = (msg: unknown) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(typeof msg === "string" ? msg : JSON.stringify(msg));
  };

  const dial = () => {
    if (stopped) return;
    opts.onStatus("connecting");
    try {
      ws = new WebSocket(opts.url);
    } catch {
      schedule();
      return;
    }

    ws.onopen = () => {
      attempt = 0;
      opts.onStatus("connected");
      opts.onOpen(send);
      if (opts.keepAlive) {
        clearInterval(pingTimer);
        pingTimer = setInterval(() => send(opts.keepAlive!.frame()), opts.keepAlive.everyMs) as unknown as number;
      }
    };

    ws.onmessage = (e) => {
      try {
        opts.onMessage(JSON.parse(String(e.data)));
      } catch {
        // A venue that sends a bare "pong" is not an error worth surfacing.
      }
    };

    ws.onerror = () => opts.onStatus("failed");
    ws.onclose = () => {
      clearInterval(pingTimer);
      if (!stopped) schedule();
    };
  };

  const schedule = () => {
    opts.onStatus("failed");
    // Escalating, capped, and jittered — a venue that is down for everyone should not be hammered
    // by every terminal running this widget in the same second.
    const delay = Math.min(30_000, 1_000 * 2 ** Math.min(attempt++, 5)) * (0.75 + Math.random() * 0.5);
    reconnectTimer = setTimeout(dial, delay) as unknown as number;
  };

  dial();
  return () => {
    stopped = true;
    clearTimeout(reconnectTimer);
    clearInterval(pingTimer);
    try {
      ws?.close();
    } catch {
      // Already gone.
    }
  };
}
