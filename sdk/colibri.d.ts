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
  /**
   * The durable id of the SLOT hosting this widget, or `null` when `surface` is `"window"`.
   * Pass it to `panels.get()` (or call `panels.self()`) to find where you sit and what is beside
   * you — no user setup, nothing to paste.
   *
   * Updated in place BEFORE the `surface` event fires, exactly like `surface`: a widget can be
   * moved between boxes, and between a box and a window, without being restarted.
   */
  slotId: string | null;
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
  /** Response-shape version to ask for; defaults to {@link API_VERSION}. */
  apiVersion?: number;
}

/** The response-shape version this SDK reads (sent on every call). Needs a terminal that serves it. */
export declare const API_VERSION: number;

// ── /app/panels (api-version 2) ──────────────────────────────────────────────

/** A split: children laid out side by side (`row`) or stacked (`column`). */
export interface SplitNode {
  type: "split";
  orientation: "row" | "column";
  /** This node's fraction of its parent; absent on the tab root. */
  share?: number;
  children: LayoutNode[];
}

/** A slot — the durable box (`id` is the handle `panels.set/clear/remove` take) with what fills it. */
export interface SlotNode {
  type: "slot";
  id: string;
  /** This node's fraction of its parent; absent on a root slot and on action responses. */
  share?: number;
  content: SlotContent;
}

export type LayoutNode = SplitNode | SlotNode;

export interface EmptyContent {
  kind: "empty";
}

export interface OrderbookContent {
  kind: "orderbook";
  exchange: string;
  symbol: string;
  /** The per-instrument panel id — changes on a re-pick, unlike the slot `id`. */
  contentId: string;
  /** Present only when a trading account is bound. */
  connectionId?: string;
  viewOnly: boolean;
}

export interface ChartContent {
  kind: "chart";
  exchange: string;
  symbol: string;
  interval: string;
  contentId: string;
}

export interface WidgetContent {
  kind: "widget";
  widgetId: string;
  /** The widget instance id — the SAME value that widget's `handshake().instanceId` carries. */
  contentId: string;
  name: string;
  /** False for the not-installed / revoked placeholder that still holds the box. */
  installed: boolean;
}

/** What a slot holds — discriminated on `kind`; a field exists only when it means something for that kind. */
export type SlotContent = EmptyContent | OrderbookContent | ChartContent | WidgetContent;

export interface PanelTab {
  /** The durable tab id — the `tabId` an add targets. */
  id: string;
  index: number;
  /** Whether this is the tab its window shows. */
  active: boolean;
  /** The header label as rendered. */
  title: string;
  /** The whole layout tree; a single-box tab has a `SlotNode` root. Null for a never-laid-out tab. */
  layout: LayoutNode | null;
}

export interface PanelWindow {
  /** Positional — the main window is 0. */
  index: number;
  active: boolean;
  tabs: PanelTab[];
}

export interface PanelsResponse {
  windows: PanelWindow[];
}

export interface SlotPosition {
  window: number;
  tab: string;
  /** The index chain from the tab root. Empty for a root slot. */
  path: number[];
  depth: number;
  /** The parent split; absent for a root slot (a single-box tab). */
  parent?: { orientation: "row" | "column"; index: number; count: number };
}

/** `GET /app/panels/{id}` — the slot exactly as its leaf in the tree, plus where it sits. */
export interface SlotLookup {
  slot: SlotNode;
  position: SlotPosition;
}

/** Result of an add / set / clear / remove: the affected box(es) in the tree's own leaf shape. */
export interface SlotAction {
  status: string;
  slot?: SlotNode;
  /** Every box a stack add created, in request order. */
  slots?: SlotNode[];
}

/** One content to place — the read side's union minus the ids the terminal mints. A widget is never placed through the API. */
export type PlaceableContent =
  | { kind: "orderbook"; exchange: string; symbol: string; connectionId?: string; share?: number }
  | { kind: "chart"; exchange: string; symbol: string; interval?: string; share?: number };

export interface AddPanelsBody {
  /** Target tab; the active tab when omitted. */
  tabId?: string;
  /** Where the stack lands; omitted = appended to the tab's root row. */
  target?: { slotId: string; side?: "left" | "right" | "top" | "bottom"; action?: "pair" | "row" | "column" | "intoRow" };
  /** How the items stack relative to each other. */
  orientation?: "row" | "column";
  contents?: PlaceableContent[];
  /** Surface the terminal window afterwards. */
  activate?: boolean;
}

// ── the workspace surface (/app/workspace, /app/windows, /app/tabs, /app/slots, /app/chart-windows) ─

/**
 * A window rectangle. When `maximized` is true this is the last NON-maximized position — where the
 * window un-maximizes to, not where it sits on screen. The two are meaningless apart.
 */
export interface Bounds {
  left: number;
  top: number;
  width: number;
  height: number;
  maximized: boolean;
}

/** A docked box in the layout tree. Identical to `SlotNode` plus the explicit surface flag. */
export interface WorkspaceSlotNode {
  type: "slot";
  surface: "slot";
  id: string;
  /** This node's fraction of its parent; absent on a root slot and on action responses. */
  share?: number;
  content: SlotContent;
}

export interface WorkspaceSplitNode {
  type: "split";
  orientation: "row" | "column";
  share?: number;
  children: WorkspaceNode[];
}

export type WorkspaceNode = WorkspaceSplitNode | WorkspaceSlotNode;

/** A floating chart window — one symbol, one timeframe. */
export interface SingleChartWindow {
  kind: "chart";
  surface: "window";
  /** The durable window id — what `updateChartWindow` / `closeChartWindow` take. */
  id: string;
  /** Present on `chartWindows()`; absent when nested under its own tab, whose position says it. */
  tabId?: string;
  exchange: string;
  symbol: string;
  interval: string;
  contentId: string;
  bounds: Bounds;
  pinned: boolean;
  locked: boolean;
}

/** The combo chart window — one symbol across THREE timeframe panes, so no single `contentId`. */
export interface ComboChartWindow {
  kind: "comboChart";
  surface: "window";
  id: string;
  tabId?: string;
  exchange: string;
  symbol: string;
  /** Exactly three, pane order. */
  intervals: string[];
  bounds: Bounds;
  pinned: boolean;
  locked: boolean;
  /** Follow-the-clicked-orderbook. EXCLUSIVE: true on at most one combo window at a time. */
  sync: boolean;
}

export type ChartWindow = SingleChartWindow | ComboChartWindow;

export interface WorkspaceTab {
  /** The durable tab id. */
  id: string;
  index: number;
  active: boolean;
  /** The label the header actually renders — the user's name, else the coin + panel count, else "". */
  title: string;
  /** The docked tree; absent for a tab that has never been laid out. */
  layout?: WorkspaceNode;
  /** The floating chart windows this tab owns. Always present, empty when it owns none. */
  windows: ChartWindow[];
}

export interface WorkspaceWindow {
  /** The durable window id — survives a restart, unlike `index`. */
  id: string;
  /** Positional; the main window is 0. It SHIFTS when another window closes, so never store it. */
  index: number;
  kind: "main" | "book";
  active: boolean;
  bounds: Bounds;
  locked: boolean;
  tabs: WorkspaceTab[];
}

/** A window without its tab payload. */
export interface WorkspaceWindowSummary {
  id: string;
  index: number;
  kind: "main" | "book";
  active: boolean;
  bounds: Bounds;
  locked: boolean;
  tabCount: number;
}

export interface WorkspaceResponse {
  windows: WorkspaceWindow[];
}

export interface WorkspaceTabLookup {
  tab: WorkspaceTab;
  position: { windowId: string; windowIndex: number; tabCount: number };
}

export interface WorkspaceSlotLookup {
  slot: WorkspaceSlotNode;
  position: {
    windowId: string;
    tabId: string;
    /** The index chain from the tab root. Empty for a root slot. */
    path: number[];
    depth: number;
    /** Absent exactly when the slot is a root — a single-box tab. */
    parent?: { orientation: "row" | "column"; index: number; count: number };
  };
}

/**
 * Where a stack of boxes lands. `{slot, side}` and `{edge}` are MUTUALLY EXCLUSIVE — sending both
 * is `400 bad_request`, and sending neither appends to the tab's root row.
 *
 * There is deliberately no "mode": how the room is found beside an anchor is decided by the side
 * and the two content kinds, through the same table a drag-and-drop goes through.
 */
export type SlotTarget =
  | { slot: string; side?: "left" | "right" | "top" | "bottom"; edge?: never }
  | { edge: "left" | "right" | "top" | "bottom"; slot?: never; side?: never };

export interface AddSlotsBody {
  /** Target tab; the active tab when omitted. */
  tabId?: string;
  target?: SlotTarget;
  /** How the items stack relative to each other. */
  orientation?: "row" | "column";
  contents: Array<PlaceableContent & { share?: number }>;
  activate?: boolean;
}

/** `POST /app/chart-windows`. `interval` is chart-only, `intervals` (three) is comboChart-only. */
export type OpenChartWindowBody =
  | {
      kind: "chart";
      exchange: string;
      symbol: string;
      interval?: string;
      intervals?: never;
      tabId?: string;
      activate?: boolean;
    }
  | {
      kind: "comboChart";
      exchange: string;
      symbol: string;
      intervals?: [string, string, string];
      interval?: never;
      tabId?: string;
      activate?: boolean;
    };

export interface UpdateChartWindowBody {
  exchange?: string;
  symbol?: string;
  /** `chart` only. */
  interval?: string;
  /** `comboChart` only — exactly three. */
  intervals?: [string, string, string];
  /** Re-home to another tab. */
  tabId?: string;
  pinned?: boolean;
  locked?: boolean;
  /** `comboChart` only. Exclusive across combo windows. */
  sync?: boolean;
  /** Raise it. Only `true` — "unraise" names no destination. */
  active?: true;
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
  /** The workspace: every window → tab → its layout tree. `tabId` / `windowIndex` scope it. */
  list(params?: { tabId?: string; windowIndex?: number }): Promise<PanelsResponse>;
  /** One slot and where it sits. */
  get(slotId: string): Promise<SlotLookup>;
  /** This widget's own box + its position. Rejects with code `no_slot` when in a window. */
  self(): Promise<SlotLookup>;
  /**
   * The boxes sharing a parent split with `slotId` (this widget's own box when omitted), in
   * on-screen order — "the orderbook next to me" is the nearest `content.kind === "orderbook"`
   * walking outward from `index`. A root slot has no siblings.
   */
  siblings(slotId?: string): Promise<{ orientation: "row" | "column" | null; index: number; siblings: LayoutNode[] }>;
  add(body: AddPanelsBody): Promise<SlotAction>;
  /** Set what one box holds: `{ content: PlaceableContent }`; `{ content: { kind: "empty" } }` clears. */
  set(slotId: string, body: { content: PlaceableContent | { kind: "empty" }; connectionId?: string }): Promise<SlotAction>;
  clear(slotId: string): Promise<SlotAction>;
  remove(slotId: string): Promise<SlotAction>;
  combo(body: unknown): Promise<unknown>;
};

export declare const workspace: {
  /** Every window, its tabs, each tab's layout tree and the chart windows it owns. */
  get(params?: { windowId?: string; tabId?: string }): Promise<WorkspaceResponse>;
  /** The windows alone, without any tab payload. */
  windows(): Promise<{ windows: WorkspaceWindowSummary[] }>;
  /** Raise a window to the front. */
  activateWindow(windowId: string): Promise<{ status: string; window: WorkspaceWindowSummary }>;
  /** One tab, byte-identical to its node in `get()`. */
  tab(tabId: string): Promise<WorkspaceTabLookup>;
  /** Create a tab. `activate` defaults to false so a background tool never steals the user's focus. */
  createTab(body?: { windowId?: string; title?: string; index?: number; activate?: boolean }): Promise<{
    status: string;
    tab: WorkspaceTab;
    position: WorkspaceTabLookup["position"];
  }>;
  /**
   * Activate, rename or reorder. `title` is PATCH-shaped: omit to leave it, a string renames, and
   * `null` clears it back to the automatic coin + count label.
   */
  updateTab(
    tabId: string,
    body: { active?: true; raiseWindow?: boolean; title?: string | null; index?: number },
  ): Promise<{ status: string; tab: WorkspaceTab; position: WorkspaceTabLookup["position"] }>;
  /** Bring a tab to the front. Raises its window too unless `raiseWindow: false`. */
  activateTab(tabId: string, raiseWindow?: boolean): Promise<{
    status: string;
    tab: WorkspaceTab;
    position: WorkspaceTabLookup["position"];
  }>;
  /** Close a tab and everything it owns. Rejects `409 last_tab` for the main window's only tab. */
  closeTab(tabId: string): Promise<{ status: string; tabId: string }>;
  /** ADD boxes. The box named in `target` is an ANCHOR: it survives with its id and feed intact. */
  addSlots(body: AddSlotsBody): Promise<{ status: string; slots: WorkspaceSlotNode[] }>;
  /** One box and where it sits. */
  slot(slotId: string): Promise<WorkspaceSlotLookup>;
  /** Set what THIS box holds. Idempotent; a kind transition keeps the same slot id. */
  setSlot(
    slotId: string,
    content: PlaceableContent | { kind: "empty" },
  ): Promise<{ status: string; slot: WorkspaceSlotNode }>;
  /** Clear a box, keeping it and its id so it can be filled again later. */
  clearSlot(slotId: string): Promise<{ status: string; slot: WorkspaceSlotNode }>;
  /** Remove a box. Structural: the box is gone and its id retired. */
  removeSlot(slotId: string): Promise<{ status: string; slotId: string }>;
  /** The floating chart windows across every tab, each with the `tabId` that owns it. */
  chartWindows(params?: { tabId?: string; kind?: "chart" | "comboChart" }): Promise<{ chartWindows: ChartWindow[] }>;
  /**
   * Open a coin's chart window or its 3-pane combo chart. Dedupe is by `(kind, exchange, symbol)`:
   * a pair already open is re-homed and shown, answering 200 rather than opening a second one.
   */
  openChartWindow(body: OpenChartWindowBody): Promise<{ status: string; chartWindow: ChartWindow }>;
  /** Retarget, re-interval, re-home, pin, lock, sync or raise one. At least one field required. */
  updateChartWindow(
    chartWindowId: string,
    body: UpdateChartWindowBody,
  ): Promise<{ status: string; chartWindow: ChartWindow }>;
  /** Close one chart window by its durable id. */
  closeChartWindow(chartWindowId: string): Promise<{ status: string; chartWindowId: string }>;
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
  request(method: string, path: string, opts?: { query?: string; body?: unknown; apiVersion?: number }): Promise<{ status: number; body: unknown }>;
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
