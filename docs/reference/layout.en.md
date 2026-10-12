# Layout: workspace and panels

> Русская версия — [layout.md](layout.md).

`workspace` reads and changes what the user sees on screen: the terminal's windows, their tabs, the
slots inside a tab, and the floating chart windows. `panels` is the older interface to the slots of
one tab: its routes are removed in terminal 1.4.0, so write new code against `workspace`.

Everything on this page needs the `panels` scope — at install the user sees it as opening and
arranging panels. It is their screen: open and rearrange only when they ask, and never steal focus
from the background — which is why `activate` is off by default everywhere.

## <a id="model"></a>How the screen is built

- **Window.** The main window (`kind: "main"`, exactly one) and book windows (`"book"`, any number). A
  window's `id` is durable and survives a restart. `index` is only a position: the main window is 0,
  and it shifts when another window closes — never store it.
- **Tab.** The `id` is durable. `title` is what the header shows: the user's name for it, else the
  coin and the panel count, else empty.
- **A tab's layout** (`layout`) is a tree. A node is either a split (`type: "split"`: `row` side by
  side, `column` stacked, with `children`) or a slot (`type: "slot"`). `share` is the node's fraction
  of its parent. A tab with a single slot has that slot as its root; a tab that has never held
  anything has no `layout`.
- **A slot** is a cell of the layout with a durable `id`. It survives an instrument change, a clear,
  a change of kind (book ↔ chart) and a restart. What fills it is `content`, a union on `kind`:
  `orderbook`, `chart`, `widget` or `empty`, each with only its own fields. `contentId` is the id of
  what fills the slot and changes on a new instrument pick; for a widget, `contentId` equals that
  widget's `handshake().instanceId`.
- **Chart windows** float beside the layout rather than in it: a single chart (`kind: "chart"`) or a
  three-timeframe combo chart (`"comboChart"`). A tab owns them, and they survive a restart. One coin
  has at most one window of each kind.

Limits: `addSlots` (like the deprecated `panels.add` and `panels.combo`) allows at most 30 calls a
minute per widget, then `429 too_many_panels`; one call creates at most 16 slots. The bridge's general
limit of 300 calls a minute applies on top. Timeframes are written `M1`, `M5`, `M15`, `H1`, `H4`, `D1`.

## <a id="find-own-slot"></a>Where my slot is

`handshake().slotId` is the durable id of the slot your widget sits in, or `null` when the widget is
open as a window of its own. A widget is moved between slots, and between a slot and a window,
without a restart: `slotId` is updated before the [`surface`](bridge.en.md#event-surface) event, so
listen for it. The slot itself and its place in the tree come from
[`workspace.slot()`](#workspace-slot). The ready recipe is on
[recipes.en.md](../recipes.en.md#find-my-box).

```js
import { handshake, on, workspace } from "./colibri.js";

/** The nearest order book in the same split as my slot, or null. */
async function bookBesideMe() {
  const slotId = handshake().slotId;
  if (!slotId) return null; // open as a window: nothing is beside it
  const { position } = await workspace.slot(slotId);
  if (!position.parent) return null; // the tab's only slot

  // Walk down from the tab's root to the parent split along the slot's path.
  const { tab } = await workspace.tab(position.tabId);
  let node = tab.layout;
  for (const i of position.path.slice(0, -1)) {
    if (node.type === "split") node = node.children[i];
  }
  if (node.type !== "split") return null;

  // Outward from my own place: the nearest neighbours first.
  const me = position.parent.index;
  for (let d = 1; d < node.children.length; d++) {
    for (const s of [node.children[me - d], node.children[me + d]]) {
      if (s?.type === "slot" && s.content.kind === "orderbook") return s;
    }
  }
  return null;
}

let book = await bookBesideMe();
on("surface", async () => (book = await bookBesideMe()));
```

## <a id="workspace"></a>workspace

Ids here are durable — store them, not indexes. A change answers with the affected object in the
same shape a read returns it.

### <a id="workspace-get"></a>`workspace.get()`

```ts decl
get(params?: { windowId?: string; tabId?: string }): Promise<WorkspaceResponse>;
```

Scope: `panels`.

The whole screen in one read — [`WorkspaceResponse`](#types): every window with its tabs, and for
each tab its layout and the chart windows it owns. `{ windowId }` or `{ tabId }` narrows the answer to
one window or one tab. Read it whole to build a map, then use the targeted reads —
[`tab()`](#workspace-tab), [`slot()`](#workspace-slot).

### <a id="workspace-windows"></a>`workspace.windows()`

```ts decl
windows(): Promise<{ windows: WorkspaceWindowSummary[] }>;
```

Scope: `panels`.

The windows alone, without tabs: `id`, `index`, the kind (`main` or `book`), whether it is active,
its rectangle (`bounds`), whether it is locked, and how many tabs it has.

### <a id="workspace-activate-window"></a>`workspace.activateWindow()`

```ts decl
activateWindow(windowId: string): Promise<{ status: string; window: WorkspaceWindowSummary }>;
```

Scope: `panels`.

Bring a window to the front. The reply is the window after the change. No such window is
`404 unknown_window`.

### <a id="workspace-tab"></a>`workspace.tab()`

```ts decl
tab(tabId: string): Promise<WorkspaceTabLookup>;
```

Scope: `panels`.

One tab — byte-identical to its node in [`get()`](#workspace-get) — and where it is: `windowId`,
`windowIndex` and how many tabs the window has. No such tab is `404 unknown_tab`.

### <a id="workspace-create-tab"></a>`workspace.createTab()`

```ts decl
createTab(body?: { windowId?: string; title?: string; index?: number; activate?: boolean }): Promise<{
  status: string;
  tab: WorkspaceTab;
  position: WorkspaceTabLookup["position"];
}>;
```

Scope: `panels`.

Create a tab. Without `windowId` it goes to the main window, without `index` to the end, without
`title` it gets the automatic name. `activate` defaults to `false` so that a background tool never
takes the user's focus. A new tab has no `layout` until something is added to it. No such window is
`404 unknown_window`.

### <a id="workspace-update-tab"></a>`workspace.updateTab()`

```ts decl
updateTab(
  tabId: string,
  body: { active?: true; raiseWindow?: boolean; title?: string | null; index?: number },
): Promise<{ status: string; tab: WorkspaceTab; position: WorkspaceTabLookup["position"] }>;
```

Scope: `panels`.

Rename, reorder and activate — in one call, applied `title` → `index` → `active`. At least one field
is required, else `400 bad_request`. `title` is PATCH-shaped: absent leaves the name alone, a string
renames, `null` restores the automatic name. **Never write back a `title` you read**: that freezes the
automatic "BTC (3)", counter and all, as a permanent name. `active` takes only `true`; `raiseWindow`
(default `true`) also raises the tab's window.

### <a id="workspace-activate-tab"></a>`workspace.activateTab()`

```ts decl
activateTab(tabId: string, raiseWindow?: boolean): Promise<{
  status: string;
  tab: WorkspaceTab;
  position: WorkspaceTabLookup["position"];
}>;
```

Scope: `panels`.

Make a tab active — shorthand for `updateTab(tabId, { active: true, raiseWindow })`. The tab's window
is raised too unless you pass `raiseWindow: false`.

### <a id="workspace-close-tab"></a>`workspace.closeTab()`

```ts decl
closeTab(tabId: string): Promise<{ status: string; tabId: string }>;
```

Scope: `panels`.

Close a tab together with its slots, their data feeds and its chart windows — as the tab's own close
button does. The last tab of a book window closes that window too. The main window's only tab cannot
be closed — the terminal has no zero-tab state: `409 last_tab`.

### <a id="workspace-add-slots"></a>`workspace.addSlots()`

```ts decl
addSlots(body: AddSlotsBody): Promise<{ status: string; slots: WorkspaceSlotNode[] }>;
```

Scope: `panels`.

**Adds** slots and never replaces one: the slot named in `target` is an anchor. It keeps its id, its
content and its live feed, and only gets smaller. `target` is either `{ slot, side }` (beside a slot;
`side` is required) or `{ edge }` (at the tab's edge: `left`/`right` is a full-height column,
`top`/`bottom` a full-width row), never both — that is `400 bad_request`. No `target` means
`{ edge: "right" }`, no `tabId` means the main window's active tab. How the room is found beside the
anchor is decided by the side and the content kinds, exactly as for a mouse drag.

`stack` (`row` or `column`, default `column`) arranges the new slots among themselves. Each slot's
`share` is a fraction of what is **left** after the previous ones, clamped to 0.05–0.95; with no
shares everything splits evenly. Slots are created with their content: `{ kind: "empty" }` is refused
here. A `connectionId` in an order book binds an account and needs the same trading grant as
[`trading`](account-and-trading.en.md#trading) (`403 trading_not_enabled`). The reply is `201` with the
created slots in request order; the limits are in [How the screen is built](#model).

<!-- check: prelude const mySlotId = "811deac4440b43f2a3223802234fbcb9"; -->
```js
import { workspace } from "./colibri.js";

// A chart under my order book. The book itself stays put, with the same id.
const { slots } = await workspace.addSlots({
  target: { slot: mySlotId, side: "bottom" },
  slots: [{ content: { kind: "chart", exchange: "BinanceSpot", symbol: "BTCUSDT", interval: "M5" } }],
});
const chartSlotId = slots[0].id;
```

### <a id="workspace-slot"></a>`workspace.slot()`

```ts decl
slot(slotId: string): Promise<WorkspaceSlotLookup>;
```

Scope: `panels`.

One slot — in the same shape as its leaf in the tree — and where it is: `windowId`, `tabId`, `path`
(indexes from the tab's root; empty for a root slot), `depth`, and `parent` — the parent split's
orientation, the slot's place in it and the sibling count. A root slot has no `parent`. No such slot
is `404 unknown_slot`.

### <a id="workspace-set-slot"></a>`workspace.setSlot()`

```ts decl
setSlot(
  slotId: string,
  content: PlaceableContent | { kind: "empty" },
): Promise<{ status: string; slot: WorkspaceSlotNode }>;
```

Scope: `panels`.

Set what **this** slot holds. The call is idempotent: the same state again changes nothing and still
answers 200. A change of kind (book → chart and back) keeps the slot's id; a chart docked beside it is
a slot of its own, and this call leaves it alone. A slot holding a running widget cannot be changed
in any way, a clear included: `409 slot_occupied_by_widget`. A `connectionId` in an order book needs
the trading grant.

### <a id="workspace-clear-slot"></a>`workspace.clearSlot()`

```ts decl
clearSlot(slotId: string): Promise<{ status: string; slot: WorkspaceSlotNode }>;
```

Scope: `panels`.

Clear a slot: the same as `setSlot(slotId, { kind: "empty" })`. The slot stays on screen with its id,
ready to be filled again later. On a widget's slot: `409 slot_occupied_by_widget`.

### <a id="workspace-remove-slot"></a>`workspace.removeSlot()`

```ts decl
removeSlot(slotId: string): Promise<{ status: string; slotId: string }>;
```

Scope: `panels`.

Remove a slot. This is structural: the slot is gone, its id never comes back, and a chart docked under
an order book goes with it. A widget's slot can be removed — a deliberate removal by id — your own
included, and your widget closes with it.

### <a id="workspace-chart-windows"></a>`workspace.chartWindows()`

```ts decl
chartWindows(params?: { tabId?: string; kind?: "chart" | "comboChart" }): Promise<{ chartWindows: ChartWindow[] }>;
```

Scope: `panels`.

The floating chart windows of every tab, each with its owning tab's `tabId`. `{ tabId }` and
`{ kind }` narrow the list. These windows are not in a tab's layout: they float beside it and survive
a restart.

### <a id="workspace-open-chart-window"></a>`workspace.openChartWindow()`

```ts decl
openChartWindow(body: OpenChartWindowBody): Promise<{ status: string; chartWindow: ChartWindow }>;
```

Scope: `panels`.

Open a coin's chart window (`kind: "chart"`, one timeframe in `interval`) or its combo chart
(`"comboChart"`, exactly three timeframes in `intervals`). The other kind's field is not dropped
silently but refused `400 bad_request`, so a timeframe never vanishes without a trace. There is one
window per `(kind, exchange, symbol)`: when one is already open, the terminal moves it to the `tabId`
tab, shows it and answers 200 with that window; a new window answers 201.

```js
import { workspace } from "./colibri.js";

const { chartWindow } = await workspace.openChartWindow({
  kind: "comboChart",
  exchange: "BinanceSpot",
  symbol: "ETHUSDT",
  intervals: ["M5", "M15", "H1"],
});
```

### <a id="workspace-update-chart-window"></a>`workspace.updateChartWindow()`

```ts decl
updateChartWindow(
  chartWindowId: string,
  body: UpdateChartWindowBody,
): Promise<{ status: string; chartWindow: ChartWindow }>;
```

Scope: `panels`.

Change the coin or the timeframe, move it to another tab, pin it, lock it, turn follow on, or raise
it — [`UpdateChartWindowBody`](#types). Every field is optional, but at least one is required. `sync`
exists on the combo chart only and is on for at most one window: turning it on here turns it off
everywhere else, because a click on a book must reach exactly one window. The reply reports only the
window you changed — if you track `sync`, re-read the list.

### <a id="workspace-close-chart-window"></a>`workspace.closeChartWindow()`

```ts decl
closeChartWindow(chartWindowId: string): Promise<{ status: string; chartWindowId: string }>;
```

Scope: `panels`.

Close a chart window by its durable id. No such window is `404 unknown_chart_window`.

## <a id="panels"></a>panels — deprecated

**Deprecated.** The `/app/panels` routes are removed in terminal 1.4.0. Every call below names its
`workspace` replacement; write new code against that straight away. `panels` answers in the version 2
shape (one `layout` tree per tab): the SDK asks for it itself, see [`API_VERSION`](bridge.en.md#api-version).

### <a id="panels-list"></a>`panels.list()`

```ts decl
list(params?: { tabId?: string; windowIndex?: number }): Promise<PanelsResponse>;
```

Scope: `panels`.

Replaced by [`workspace.get()`](#workspace-get). The windows, their tabs and each tab's layout tree —
[`PanelsResponse`](#types). Floating chart windows and durable window ids are not visible here.
`{ tabId }` keeps one tab (none such is `404 unknown_tab`), `{ windowIndex }` one window by position.

### <a id="panels-get"></a>`panels.get()`

```ts decl
get(slotId: string): Promise<SlotLookup>;
```

Scope: `panels`.

Replaced by [`workspace.slot()`](#workspace-slot). A slot and where it is: the window by position,
the tab, the path from the root and the parent split. No such slot is `404 unknown_panel`.

### <a id="panels-self"></a>`panels.self()`

```ts decl
self(): Promise<SlotLookup>;
```

Scope: `panels`.

Replaced by `workspace.slot(handshake().slotId)`, see [Where my slot is](#find-own-slot). The
widget's own slot. When the widget is open as a window, the SDK refuses the call itself without
asking the terminal: a `ColibriError` with the code `no_slot`.

### <a id="panels-siblings"></a>`panels.siblings()`

```ts decl
siblings(slotId?: string): Promise<{ orientation: "row" | "column" | null; index: number; siblings: LayoutNode[] }>;
```

Scope: `panels`.

Replaced by [`workspace.slot()`](#workspace-slot) plus [`workspace.tab()`](#workspace-tab): walk
`position.path` to the parent, as the example in [Where my slot is](#find-own-slot) does. The
siblings of `slotId` (your own slot when omitted) in its parent split, in on-screen order, with the
split's axis and the slot's place in it. A root slot has no siblings: an empty list and
`orientation: null`.

### <a id="panels-add"></a>`panels.add()`

```ts decl
add(body: AddPanelsBody): Promise<SlotAction>;
```

Scope: `panels`.

Replaced by [`workspace.addSlots()`](#workspace-add-slots). The body is an [`AddPanelsBody`](#types): a
stack of content in **`contents`** (an array, up to 16 items), not a single `content`. `target` is
`{ slotId, side, action }`: `side` defaults to `bottom`, `action` is `pair`, `row`, `column` or
`intoRow` (default `pair`); with no `target` the stack joins the tab's root row. `orientation`
defaults to `column`. The reply is `201`: `slot` is the first slot, `slots` every slot created.

### <a id="panels-set"></a>`panels.set()`

```ts decl
set(slotId: string, body: { content: PlaceableContent | { kind: "empty" }; connectionId?: string }): Promise<SlotAction>;
```

Scope: `panels`.

Replaced by [`workspace.setSlot()`](#workspace-set-slot). Set what a slot holds; `{ kind: "empty" }`
clears it. `connectionId` binds an account to an order book and needs the trading grant. On a
widget's slot: `409 slot_occupied_by_widget`.

### <a id="panels-clear"></a>`panels.clear()`

```ts decl
clear(slotId: string): Promise<SlotAction>;
```

Scope: `panels`.

Replaced by [`workspace.clearSlot()`](#workspace-clear-slot). Clear a slot, keeping its id.

### <a id="panels-remove"></a>`panels.remove()`

```ts decl
remove(slotId: string): Promise<SlotAction>;
```

Scope: `panels`.

Replaced by [`workspace.removeSlot()`](#workspace-remove-slot). Remove a slot together with its docked
chart.

### <a id="panels-combo"></a>`panels.combo()`

```ts decl
combo(body: unknown): Promise<unknown>;
```

Scope: `panels`.

Open a coin on every connection that lists it — one order book per connection: `{ symbol, target?,
views?, chart? }`, where `target` is `tab` (the default) or `window`. The `/app/combos` route is
**not** removed in 1.4.0, but `workspace` has no wrapper for it: once `panels` leaves the SDK, call it
through [`request("POST", "/app/combos", { body })`](bridge.en.md#request). It counts against the
open limit — 30 a minute.

## <a id="types"></a>Types

Slot content. A field exists only on the kind it means something to:

```ts decl
interface EmptyContent {
  kind: "empty";
}

interface OrderbookContent {
  kind: "orderbook";
  exchange: string;
  symbol: string;
  /** The per-instrument panel id — changes on a re-pick, unlike the slot id. */
  contentId: string;
  /** Present only when a trading account is bound. */
  connectionId?: string;
  viewOnly: boolean;
}

interface ChartContent {
  kind: "chart";
  exchange: string;
  symbol: string;
  interval: string;
  contentId: string;
}

interface WidgetContent {
  kind: "widget";
  widgetId: string;
  /** The widget instance id — the SAME value that widget's handshake().instanceId carries. */
  contentId: string;
  name: string;
  /** False for the not-installed / revoked placeholder that still holds the slot. */
  installed: boolean;
}

type SlotContent = EmptyContent | OrderbookContent | ChartContent | WidgetContent;

/** What can be placed: the read side's union minus the ids the terminal mints. A widget is never placed through the API. */
type PlaceableContent =
  | { kind: "orderbook"; exchange: string; symbol: string; connectionId?: string; share?: number }
  | { kind: "chart"; exchange: string; symbol: string; interval?: string; share?: number };
```

The `workspace` windows, tabs and tree:

```ts decl
/** A window rectangle. With maximized: true, it is where the window goes when un-maximized. */
interface Bounds {
  left: number;
  top: number;
  width: number;
  height: number;
  maximized: boolean;
}

/** A slot in the tree. */
interface WorkspaceSlotNode {
  type: "slot";
  surface: "slot";
  id: string;
  /** Fraction of its parent; absent on a root slot and on change replies. */
  share?: number;
  content: SlotContent;
}

interface WorkspaceSplitNode {
  type: "split";
  orientation: "row" | "column";
  share?: number;
  children: WorkspaceNode[];
}

type WorkspaceNode = WorkspaceSplitNode | WorkspaceSlotNode;

/** A floating chart window: one coin, one timeframe. */
interface SingleChartWindow {
  kind: "chart";
  surface: "window";
  /** The durable id — what updateChartWindow and closeChartWindow take. */
  id: string;
  /** Present on chartWindows(); not needed inside its own tab. */
  tabId?: string;
  exchange: string;
  symbol: string;
  interval: string;
  contentId: string;
  bounds: Bounds;
  pinned: boolean;
  locked: boolean;
}

/** The combo chart: one coin across THREE timeframes, so no single contentId. */
interface ComboChartWindow {
  kind: "comboChart";
  surface: "window";
  id: string;
  tabId?: string;
  exchange: string;
  symbol: string;
  /** Exactly three, in pane order. */
  intervals: string[];
  bounds: Bounds;
  pinned: boolean;
  locked: boolean;
  /** Follows the clicked order book. On for at most one window. */
  sync: boolean;
}

type ChartWindow = SingleChartWindow | ComboChartWindow;

interface WorkspaceTab {
  /** The durable tab id. */
  id: string;
  index: number;
  active: boolean;
  /** What the header shows: the user's name, else the coin + panel count, else "". */
  title: string;
  /** Absent on a tab that has never held anything. */
  layout?: WorkspaceNode;
  /** The tab's chart windows; empty when it owns none. */
  windows: ChartWindow[];
}

interface WorkspaceWindow {
  /** The durable id — survives a restart, unlike index. */
  id: string;
  /** Positional; the main window is 0. It SHIFTS when another window closes — never store it. */
  index: number;
  kind: "main" | "book";
  active: boolean;
  bounds: Bounds;
  locked: boolean;
  tabs: WorkspaceTab[];
}

/** A window without its tabs. */
interface WorkspaceWindowSummary {
  id: string;
  index: number;
  kind: "main" | "book";
  active: boolean;
  bounds: Bounds;
  locked: boolean;
  tabCount: number;
}

interface WorkspaceResponse {
  windows: WorkspaceWindow[];
}

interface WorkspaceTabLookup {
  tab: WorkspaceTab;
  position: { windowId: string; windowIndex: number; tabCount: number };
}

interface WorkspaceSlotLookup {
  slot: WorkspaceSlotNode;
  position: {
    windowId: string;
    tabId: string;
    /** Indexes from the tab's root; empty for a root slot. */
    path: number[];
    depth: number;
    /** Absent exactly when the slot is the tab's root. */
    parent?: { orientation: "row" | "column"; index: number; count: number };
  };
}
```

The `workspace` request bodies:

```ts decl
/** Where the slots land: { slot, side } or { edge }, never both. Neither — the tab's right edge. */
type SlotTarget =
  | { slot: string; side?: "left" | "right" | "top" | "bottom"; edge?: never }
  | { edge: "left" | "right" | "top" | "bottom"; slot?: never; side?: never };

/** One new slot. share belongs to the SLOT and is a fraction of what the previous ones left. */
interface NewSlot {
  content: PlaceableContent;
  share?: number;
}

interface AddSlotsBody {
  /** The tab; the active one when omitted. */
  tabId?: string;
  /** Omitted is { edge: "right" }. */
  target?: SlotTarget;
  /** How the new slots arrange among themselves; default column. */
  stack?: "row" | "column";
  /** At most 16. */
  slots: NewSlot[];
  /** True also raises the window. */
  activate?: boolean;
}

/** interval is chart-only, intervals (three) is comboChart-only. */
type OpenChartWindowBody =
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

interface UpdateChartWindowBody {
  exchange?: string;
  symbol?: string;
  /** chart only. */
  interval?: string;
  /** comboChart only — exactly three. */
  intervals?: [string, string, string];
  /** Move to another tab. */
  tabId?: string;
  pinned?: boolean;
  locked?: boolean;
  /** comboChart only; on for at most one window. */
  sync?: boolean;
  /** Raise the window. Only true. */
  active?: true;
}
```

The deprecated `panels` shapes:

```ts decl
/** A split: children side by side (row) or stacked (column). */
interface SplitNode {
  type: "split";
  orientation: "row" | "column";
  /** Fraction of its parent; absent on the tab root. */
  share?: number;
  children: LayoutNode[];
}

/** A slot: the durable cell and what fills it. */
interface SlotNode {
  type: "slot";
  id: string;
  share?: number;
  content: SlotContent;
}

type LayoutNode = SplitNode | SlotNode;

interface PanelTab {
  id: string;
  index: number;
  active: boolean;
  title: string;
  /** null for a tab that has never held anything. */
  layout: LayoutNode | null;
}

interface PanelWindow {
  /** Positional; the main window is 0. */
  index: number;
  active: boolean;
  tabs: PanelTab[];
}

interface PanelsResponse {
  windows: PanelWindow[];
}

interface SlotPosition {
  window: number;
  tab: string;
  /** Indexes from the tab's root; empty for a root slot. */
  path: number[];
  depth: number;
  /** Absent for a root slot. */
  parent?: { orientation: "row" | "column"; index: number; count: number };
}

interface SlotLookup {
  slot: SlotNode;
  position: SlotPosition;
}

interface SlotAction {
  status: string;
  slot?: SlotNode;
  /** Every slot a stack created, in request order. */
  slots?: SlotNode[];
}

interface AddPanelsBody {
  /** The tab; the active one when omitted. */
  tabId?: string;
  /** Where the stack lands; omitted = the tab's root row. */
  target?: { slotId: string; side?: "left" | "right" | "top" | "bottom"; action?: "pair" | "row" | "column" | "intoRow" };
  /** How the stack's items arrange among themselves. */
  orientation?: "row" | "column";
  contents?: PlaceableContent[];
  /** Raise the terminal window afterwards. */
  activate?: boolean;
}
```
