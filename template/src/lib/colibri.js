/**
 * colibri.js — the typed client for the Colibri widget API.
 *
 * This is SUGAR over `window.colibri`, never a second contract: the host injects the raw
 * tunnel before any page script runs, and everything here is a thin wrapper that calls it.
 * A widget can ignore this file entirely and speak `window.colibri` directly.
 *
 * No build step, no dependencies, no bundler — drop it next to your page and import it.
 *
 * @see README.md
 */

/**
 * Every permission a widget can be granted. Declare the ones you need in `widget.json`'s
 * `permissions` array; the user grants them at install, and `colibri.handshake.grantedScopes`
 * tells you what you actually hold (it is re-pushed if the user changes it — listen for
 * `grants`). An unrecognised name is REJECTED at install, never silently ignored.
 */
export const SCOPES = {
  marketData: "marketData",
  accountRead: "account:read",
  trading: "trading",
  panels: "panels",
  notifications: "notifications",
  signalLevels: "signalLevels",
  storage: "storage",
};

/**
 * The Local API route table, as the terminal serves it: [method, path, requiresToken, scope].
 *
 * This is not documentation — a unit test in the terminal compares it against the live route
 * table (`LocalApiRouter.DescribeRoutes()`), so the SDK cannot drift from the API it wraps.
 * `requiresToken` is the loopback HTTP door's bearer tier and does not apply to widgets; over
 * the bridge a call is allowed by `scope` alone. A call outside your granted scopes answers the
 * ordinary unauthorized shape — deliberately identical to any other unauthorized call, so it
 * says nothing about which scope was missing.
 */
export const ROUTES = [
  ["GET", "/exchanges", false, "marketData"],
  ["GET", "/exchanges/{exchange}/symbols", false, "marketData"],
  ["GET", "/markets/{exchange}/{symbol}/book", false, "marketData"],
  ["GET", "/markets/{exchange}/{symbol}/clusters", false, "marketData"],
  ["GET", "/markets/{exchange}/{symbol}/funding", false, "marketData"],
  ["GET", "/exchanges/{exchange}/orderbook-settings", false, "panels"],
  ["PATCH", "/exchanges/{exchange}/orderbook-settings", false, "panels"],
  ["GET", "/connections", false, "account:read"],
  ["GET", "/connections/{id}", false, "account:read"],
  ["GET", "/connections/{id}/positions", false, "account:read"],
  ["GET", "/connections/{id}/orders", false, "account:read"],
  ["GET", "/connections/{id}/balances", false, "account:read"],
  ["GET", "/connections/{id}/trades", false, "account:read"],
  ["GET", "/connections/{id}/trades/{tradeId}", false, "account:read"],
  ["POST", "/connections/{id}/orders", true, "trading"],
  ["DELETE", "/connections/{id}/orders/{clientOrderId}", true, "trading"],
  ["DELETE", "/connections/{id}/orders", true, "trading"],
  ["DELETE", "/connections/{id}/positions", true, "trading"],
  ["DELETE", "/orders", true, "trading"],
  ["DELETE", "/positions", true, "trading"],
  ["GET", "/app/panels", false, "panels"],
  ["GET", "/app/panels/{id}", false, "panels"],
  ["POST", "/app/panels", false, "panels"],
  ["PUT", "/app/panels/{id}", false, "panels"],
  ["DELETE", "/app/panels/{id}", false, "panels"],
  ["POST", "/app/combos", false, "panels"],
  ["POST", "/notifications", false, "notifications"],
  ["POST", "/signals", false, "notifications"],
  ["GET", "/signal-levels", false, "signalLevels"],
  ["POST", "/signal-levels", false, "signalLevels"],
  ["DELETE", "/signal-levels/triggered", false, "signalLevels"],
  ["DELETE", "/signal-levels/{id}", false, "signalLevels"],
  ["DELETE", "/signal-levels", false, "signalLevels"],
];

/**
 * Every `/stream` channel a widget may subscribe, with the scope it needs. Pinned against the
 * terminal the same way as ROUTES.
 */
export const CHANNELS = ["book", "trades", "funding", "positions", "orders", "balance", "notifications", "signalLevels"];

/** channel → the scope that unlocks it. */
export const CHANNEL_SCOPES = {
  book: "marketData",
  trades: "marketData",
  funding: "marketData",
  positions: "account:read",
  orders: "account:read",
  balance: "account:read",
  notifications: "notifications",
  signalLevels: "signalLevels",
};

/** Thrown when a call reaches the terminal and the terminal refuses it. */
export class ColibriError extends Error {
  constructor(status, code, message) {
    super(message || code || "colibri: request failed");
    this.name = "ColibriError";
    /** HTTP-shaped status (401 unauthorized, 404 not_found, 503 bridge_disabled, …). */
    this.status = status;
    /** Stable machine-readable code — switch on this, never on the message. */
    this.code = code;
  }
}

function bridge() {
  if (!globalThis.colibri) {
    throw new Error("colibri: the host bridge is not present (is this page running inside Colibri?)");
  }
  return globalThis.colibri;
}

function query(params) {
  if (!params) return "";
  const parts = [];
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (value !== undefined && value !== null) {
      parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(value)));
    }
  }
  return parts.join("&");
}

/**
 * The response-shape version this SDK is written against, sent on EVERY call (the terminal
 * reads it from the bridge envelope; over HTTP it is the `api-version` header). Today only the
 * `/app/panels` family has two shapes; every other route ignores it. A terminal older than the
 * one that introduced v2 ignores the field and answers v1 — so this SDK needs a terminal that
 * serves v2 (check `supportedApiVersions` on `GET /ping`, or `handshake().apiVersion`).
 * From terminal 1.3.0 the header is ignored and v2 is the only shape.
 */
export const API_VERSION = 2;

/**
 * One raw call. Resolves with the response body on 2xx and REJECTS with a `ColibriError`
 * otherwise — so `await` reads naturally and a forgotten error check cannot silently pass a
 * failure off as data.
 */
export async function request(method, path, options) {
  const opts = options || {};
  const response = await bridge().request(method, path, {
    query: query(opts.params),
    body: opts.body,
    apiVersion: opts.apiVersion === undefined ? API_VERSION : opts.apiVersion,
  });
  if (response.status >= 200 && response.status < 300) {
    return response.body;
  }
  const body = response.body || {};
  throw new ColibriError(response.status, body.code, body.message);
}

/** What this instance is and may do — available synchronously, before your first line runs. */
export function handshake() {
  return bridge().handshake;
}

/** True when the widget was granted `scope` (design §2 vocabulary). */
export function hasScope(scope) {
  return (bridge().grantedScopes || []).indexOf(scope) >= 0;
}

/** Market data the terminal already has open. A widget's OWN venue connections are the bulk path. */
export const markets = {
  exchanges: () => request("GET", "/exchanges"),
  symbols: (exchange) => request("GET", `/exchanges/${encodeURIComponent(exchange)}/symbols`),
  book: (exchange, symbol, params) =>
    request("GET", `/markets/${encodeURIComponent(exchange)}/${encodeURIComponent(symbol)}/book`, { params }),
  clusters: (exchange, symbol, params) =>
    request("GET", `/markets/${encodeURIComponent(exchange)}/${encodeURIComponent(symbol)}/clusters`, { params }),
  funding: (exchange, symbol) =>
    request("GET", `/markets/${encodeURIComponent(exchange)}/${encodeURIComponent(symbol)}/funding`),
  orderbookSettings: (exchange) => request("GET", `/exchanges/${encodeURIComponent(exchange)}/orderbook-settings`),
  patchOrderbookSettings: (exchange, patch) =>
    request("PATCH", `/exchanges/${encodeURIComponent(exchange)}/orderbook-settings`, { body: patch }),
};

/** Account reads. These expose sizes, PnL and balances — they move nothing. */
export const connections = {
  list: () => request("GET", "/connections"),
  get: (id) => request("GET", `/connections/${encodeURIComponent(id)}`),
  positions: (id) => request("GET", `/connections/${encodeURIComponent(id)}/positions`),
  orders: (id) => request("GET", `/connections/${encodeURIComponent(id)}/orders`),
  balances: (id) => request("GET", `/connections/${encodeURIComponent(id)}/balances`),
  /**
   * One page of this connection's closed-trade history, newest close first.
   * @param {string} id
   * @param {{page?: number, pageSize?: number, symbol?: string, fromMs?: number, toMs?: number}} [params]
   *   `fromMs`/`toMs` bound the CLOSE time, half-open: `[fromMs, toMs)`.
   */
  trades: (id, params) => request("GET", `/connections/${encodeURIComponent(id)}/trades`, { params }),
  /** One closed trade with its individual fills. */
  trade: (id, tradeId) =>
    request("GET", `/connections/${encodeURIComponent(id)}/trades/${encodeURIComponent(tradeId)}`),
};

/**
 * Terminal panels — the workspace as ONE layout tree per tab (api-version 2): a node is
 * `{type:"split", orientation:"row"|"column", share?, children}` or
 * `{type:"slot", id, share?, content}`, and `content` is a union on `kind`
 * (`orderbook` | `chart` | `widget` | `empty`) carrying only the fields that mean something for
 * that kind. `content.contentId` is the UNIFORM identity of what fills a box — for a widget it is
 * the same value as `handshake().instanceId`, so a widget can find ITSELF in the tree by one
 * field name whatever kind it is looking at.
 */
export const panels = {
  list: (params) => request("GET", "/app/panels", { params }),
  get: (slotId) => request("GET", `/app/panels/${encodeURIComponent(slotId)}`),
  /**
   * This widget's OWN box, with where it sits — the path from its tab's root, its parent split's
   * axis and its index among its siblings. Use it to find your neighbours (the orderbook beside
   * you, say) instead of asking the user to paste a panel id.
   *
   * Rejects when the widget is in its own WINDOW rather than a slot: a window is not in the grid,
   * so there is nothing to be beside. Read `handshake().slotId` if you want to test that yourself,
   * and listen to the `surface` event — a widget can be moved between boxes, and between a box and
   * a window, without being restarted.
   */
  self: () => {
    const slotId = bridge().handshake.slotId;
    return slotId
      ? panels.get(slotId)
      : Promise.reject(new ColibriError(400, "no_slot", "This widget is not in a slot (surface: window)."));
  },
  /**
   * The boxes that share a parent split with `slotId` (this widget's own box when omitted), in
   * on-screen order, plus the split's axis and this box's index in it. This is "the orderbook
   * next to me": walk `siblings` from `index` outward and take the first `content.kind ===
   * "orderbook"`. A root slot (a single-box tab) has no siblings and answers an empty list.
   */
  siblings: async (slotId) => {
    const self = await (slotId ? panels.get(slotId) : panels.self());
    const position = self.position;
    if (!position.parent) {
      return { orientation: null, index: 0, siblings: [] };
    }
    const tree = await panels.list({ tabId: position.tab });
    let node = tree.windows[0].tabs[0].layout;
    const parentPath = position.path.slice(0, -1);
    for (let i = 0; i < parentPath.length; i++) {
      node = node.children[parentPath[i]];
    }
    return { orientation: position.parent.orientation, index: position.parent.index, siblings: node.children };
  },
  add: (body) => request("POST", "/app/panels", { body }),
  set: (slotId, body) => request("PUT", `/app/panels/${encodeURIComponent(slotId)}`, { body }),
  clear: (slotId) => request("PUT", `/app/panels/${encodeURIComponent(slotId)}`, { body: {} }),
  remove: (slotId) => request("DELETE", `/app/panels/${encodeURIComponent(slotId)}`),
  combo: (body) => request("POST", "/app/combos", { body }),
};

/** Raise a terminal notification (toast + the configured sound). */
export const notifications = {
  raise: (body) => request("POST", "/notifications", { body }),
};

/** Price alerts drawn on the ladder, and the market-signal log. */
export const signalLevels = {
  list: (params) => request("GET", "/signal-levels", { params }),
  create: (body) => request("POST", "/signal-levels", { body }),
  remove: (id) => request("DELETE", `/signal-levels/${encodeURIComponent(id)}`),
  removeBySymbol: (params) => request("DELETE", "/signal-levels", { params }),
  clearTriggered: () => request("DELETE", "/signal-levels/triggered"),
  signal: (body) => request("POST", "/signals", { body }),
};

/**
 * Durable per-instance key/value storage, quota'd by the host and wiped when the widget is
 * uninstalled. Prefer it over localStorage for anything you would miss.
 */
export const storage = {
  async get(key) {
    const r = await bridge().storage.get(key);
    if (!r.ok) throw new ColibriError(0, r.code, "colibri: storage get failed");
    return r.value;
  },
  async set(key, value) {
    const r = await bridge().storage.set(key, value);
    if (!r.ok) throw new ColibriError(0, r.code, "colibri: storage set failed");
  },
  async remove(key) {
    const r = await bridge().storage.remove(key);
    if (!r.ok) throw new ColibriError(0, r.code, "colibri: storage delete failed");
  },
  async keys() {
    const r = await bridge().storage.keys();
    if (!r.ok) throw new ColibriError(0, r.code, "colibri: storage keys failed");
    return r.keys || [];
  },
  async clear() {
    const r = await bridge().storage.clear();
    if (!r.ok) throw new ColibriError(0, r.code, "colibri: storage clear failed");
  },
};

/**
 * Venue requests the TERMINAL performs for you, against the hosts your manifest declares in
 * `egress` and the user granted at consent.
 *
 * Market data is widget-owned: you bring your own venue connections. Venue WebSockets work from
 * the page directly — to hosts in `egress` only: the terminal serves your document with a
 * `Content-Security-Policy: connect-src` built from that list, so `new WebSocket(...)` to an
 * undeclared host throws a `SecurityError` at construction (a host declared without a port covers
 * any port; `ws.okx.com:8443` covers only 8443). Venue REST often does not work from the page —
 * many venues send no CORS headers at all (KuCoin and Kraken Futures among them), and no amount of
 * page-side code can get around that. `net.fetch` is the way through: the host makes the call, so
 * CORS never enters into it.
 *
 * Rules worth knowing before you debug a refusal: https only; GET and POST only; the URL's host
 * must be covered by a declared-AND-granted `egress` entry (`code: "egress_denied"` otherwise);
 * redirects are never followed — a 3xx is returned to you as-is, because an allowlist that only
 * covers the first hop is not an allowlist; and there is a per-instance rate cap
 * (`code: "rate_limited"`).
 *
 * The response `body` is TEXT — the host does not parse a venue's payload for you.
 *
 *   const r = await colibri.net.fetch("https://futures.kraken.com/derivatives/api/v3/tickers");
 *   if (!r.ok) throw new Error(r.code);
 *   const tickers = JSON.parse(r.body).tickers;
 */
export const net = {
  /**
   * @param {string} url absolute https URL
   * @param {{method?: "GET"|"POST", body?: string, contentType?: string}} [init]
   * @returns {Promise<{ok: boolean, status: number, body: string|null, contentType?: string, code?: string, message?: string}>}
   */
  fetch: (url, init) => bridge().net.fetch(url, init),
};

/**
 * Live channels. Subscriptions are re-issued automatically when the bridge is re-enabled or the
 * host resets the stream, so a widget does not have to notice either — there is no reconnect
 * loop to write, because an in-process bridge cannot "disconnect".
 */
export const stream = {
  _subs: [],
  _wired: false,

  _wire() {
    if (this._wired) return;
    this._wired = true;
    const b = bridge();
    b.on("bridge", (e) => {
      if (e && e.enabled) this._resubscribe();
    });
    b.on("streamReset", () => this._resubscribe());
  },

  _resubscribe() {
    const b = bridge();
    for (const sub of this._subs) {
      b.stream.subscribe(sub.channel, sub.args);
    }
  },

  /**
   * Subscribe and receive matching frames. Returns an unsubscribe function.
   * `handler` sees the raw frame `{ type, data }` — byte-identical to what an external
   * WebSocket client gets.
   */
  subscribe(channel, args, handler) {
    this._wire();
    const b = bridge();
    const record = { channel, args: args || {} };
    const listener = (frame) => {
      if (frame && frame.type === channel) handler(frame.data, frame);
    };
    this._subs.push(record);
    b.stream.on(listener);
    b.stream.subscribe(channel, record.args);

    return () => {
      b.stream.off(listener);
      b.stream.unsubscribe(channel, record.args);
      const i = this._subs.indexOf(record);
      if (i >= 0) this._subs.splice(i, 1);
    };
  },

  /** Every frame, including acks and errors — for debugging or a custom router. */
  onAny(handler) {
    bridge().stream.on(handler);
    return () => bridge().stream.off(handler);
  },
};

/**
 * Host events: `theme` (palette / language / font scale changed), `visibility`,
 * `surface` (you moved between a slot and a window — the instance is NOT recreated, so this is
 * the only notice you get, and `handshake().surface` is updated before it fires),
 * `bridge` (the API toggle moved), `grants` (your scopes changed), `streamReset`.
 */
export function on(event, handler) {
  bridge().on(event, handler);
  return () => bridge().off(event, handler);
}

export default {
  ROUTES,
  CHANNELS,
  CHANNEL_SCOPES,
  SCOPES,
  ColibriError,
  request,
  handshake,
  hasScope,
  markets,
  connections,
  panels,
  notifications,
  signalLevels,
  storage,
  net,
  stream,
  on,
};
