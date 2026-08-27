/**
 * TypeScript definitions for the Colibri widget API.
 *
 * The route surface these types cover is pinned against the terminal's live route table by a
 * unit test, so this file and the API cannot drift apart. Payload shapes are intentionally
 * `unknown`-ish where the API returns venue data: the wire is documented in
 * docs/functionality/16-local-api-and-widgets.md, and narrowing it here would freeze shapes
 * that are still allowed to grow additively within an apiVersion.
 */

/** Where a widget instance lives. */
export type WidgetSurface = "slot" | "window";

/** The scope vocabulary. A widget holds only what its manifest declares AND the user consented to. */
export type Scope =
  | "marketData"
  | "account:read"
  | "trading"
  | "panels"
  | "notifications"
  | "signalLevels"
  | "storage";

/** Live `/stream` channels. */
export type Channel =
  | "book"
  | "trades"
  | "funding"
  | "positions"
  | "orders"
  | "balance"
  | "notifications"
  | "signalLevels";

/** What the instance is, available synchronously before any page script runs. */
export interface Handshake {
  /** The API version this terminal serves; a manifest may demand a minimum via `minApiVersion`. */
  apiVersion: number;
  widgetId: string;
  /** This surface's instance id — also the namespace your `storage` keys live in. */
  instanceId: string;
  surface: WidgetSurface;
  /** `dark` | `light`; also delivered on the `theme` event when it changes. */
  theme: string;
  /** UI language tag (`en`, `ru`, …). */
  lang: string;
  grantedScopes: Scope[];
}

/** A refusal from the terminal. Switch on `code`, never on `message`. */
export declare class ColibriError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message?: string);
}

export interface RequestOptions {
  /** Query parameters; `undefined` / `null` values are dropped. */
  params?: Record<string, string | number | boolean | null | undefined>;
  /** JSON body for POST / PUT / PATCH. */
  body?: unknown;
}

/** `[method, path, requiresToken, scope]` — the terminal's route table, test-pinned. */
export declare const ROUTES: ReadonlyArray<readonly [string, string, boolean, Scope]>;
export declare const CHANNELS: readonly Channel[];

/** One raw call; resolves the body on 2xx, rejects with {@link ColibriError} otherwise. */
export declare function request<T = unknown>(method: string, path: string, options?: RequestOptions): Promise<T>;

export declare function handshake(): Handshake;
export declare function hasScope(scope: Scope): boolean;

export declare const markets: {
  exchanges(): Promise<unknown>;
  symbols(exchange: string): Promise<unknown>;
  book(exchange: string, symbol: string, params?: RequestOptions["params"]): Promise<unknown>;
  clusters(exchange: string, symbol: string, params?: RequestOptions["params"]): Promise<unknown>;
  funding(exchange: string, symbol: string): Promise<unknown>;
  orderbookSettings(exchange: string): Promise<unknown>;
  patchOrderbookSettings(exchange: string, patch: unknown): Promise<unknown>;
};

export declare const connections: {
  list(): Promise<unknown>;
  get(id: string): Promise<unknown>;
  positions(id: string): Promise<unknown>;
  orders(id: string): Promise<unknown>;
  balances(id: string): Promise<unknown>;
  /** Closed-trade history, newest close first. `fromMs`/`toMs` bound the close time, half-open. */
  trades(
    id: string,
    params?: { page?: number; pageSize?: number; symbol?: string; fromMs?: number; toMs?: number },
  ): Promise<unknown>;
  /** One closed trade with its individual fills. */
  trade(id: string, tradeId: number | string): Promise<unknown>;
};

export declare const panels: {
  list(params?: RequestOptions["params"]): Promise<unknown>;
  add(body: unknown): Promise<unknown>;
  set(slotId: string, body: unknown): Promise<unknown>;
  clear(slotId: string): Promise<unknown>;
  remove(slotId: string): Promise<unknown>;
  combo(body: unknown): Promise<unknown>;
};

export declare const notifications: {
  raise(body: { message: string; severity?: "info" | "success" | "warning" | "error"; title?: string }): Promise<unknown>;
};

export declare const signalLevels: {
  list(params?: RequestOptions["params"]): Promise<unknown>;
  create(body: unknown): Promise<unknown>;
  remove(id: string): Promise<unknown>;
  removeBySymbol(params: RequestOptions["params"]): Promise<unknown>;
  clearTriggered(): Promise<unknown>;
  signal(body: unknown): Promise<unknown>;
};

/** Durable, quota'd, per-instance. Wiped when the widget is uninstalled. */
export declare const storage: {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
};

/** The answer to a {@link net.fetch}. `ok` is false only when the call never reached the venue. */
export interface NetFetchResult {
  ok: boolean;
  /** The venue's HTTP status, or 0 when the call never got that far. */
  status: number;
  /** The response TEXT — the host does not parse a venue's payload for you. */
  body: string | null;
  contentType?: string;
  /** `egress_denied` | `rate_limited` | `net_failed` | `net_timeout` | `net_too_large` | `bad_request`. */
  code?: string;
  message?: string;
}

/**
 * Venue requests the TERMINAL performs for you, against your declared-and-granted `egress` hosts.
 * The way past venues that ship no CORS headers; https + GET/POST only, redirects never followed.
 */
export declare const net: {
  fetch(url: string, init?: { method?: "GET" | "POST"; body?: string; contentType?: string }): Promise<NetFetchResult>;
};

export interface StreamFrame {
  type: string;
  data: unknown;
}

export declare const stream: {
  /** Subscribe; returns an unsubscribe function. Re-subscribes itself after a bridge re-enable or reset. */
  subscribe(
    channel: Channel,
    args: Record<string, unknown> | undefined,
    handler: (data: unknown, frame: StreamFrame) => void,
  ): () => void;
  /** Every frame, acks and errors included. */
  onAny(handler: (frame: StreamFrame) => void): () => void;
};

export type HostEvent = "theme" | "visibility" | "surface" | "bridge" | "grants" | "streamReset";

/** Subscribe to a host event; returns an unsubscribe function. */
export declare function on(event: HostEvent, handler: (payload: never) => void): () => void;

/** The raw tunnel the host injects. The named exports above are sugar over exactly this. */
export interface ColibriBridge {
  handshake: Handshake;
  apiVersion: number;
  widgetId: string;
  instanceId: string;
  surface: WidgetSurface;
  readonly theme: string;
  readonly lang: string;
  readonly grantedScopes: Scope[];
  request(method: string, path: string, opts?: { query?: string; body?: unknown }): Promise<{ status: number; body: unknown }>;
  storage: {
    get(key: string): Promise<{ ok: boolean; value: string | null; code?: string }>;
    set(key: string, value: string): Promise<{ ok: boolean; code?: string }>;
    remove(key: string): Promise<{ ok: boolean; code?: string }>;
    keys(): Promise<{ ok: boolean; keys?: string[]; code?: string }>;
    clear(): Promise<{ ok: boolean; code?: string }>;
  };
  net: {
    fetch(url: string, init?: { method?: "GET" | "POST"; body?: string; contentType?: string }): Promise<NetFetchResult>;
  };
  stream: {
    subscribe(channel: Channel, args?: Record<string, unknown>): void;
    unsubscribe(channel: Channel, args?: Record<string, unknown>): void;
    on(handler: (frame: StreamFrame) => void): void;
    off(handler: (frame: StreamFrame) => void): void;
  };
  on(event: HostEvent, handler: (payload: never) => void): void;
  off(event: HostEvent, handler: (payload: never) => void): void;
}

declare global {
  interface Window {
    colibri?: ColibriBridge;
  }
}
