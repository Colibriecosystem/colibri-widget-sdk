# Раскладка: workspace и panels

> English version — [layout.en.md](layout.en.md).

`workspace` читает и меняет то, что пользователь видит на экране: окна терминала, вкладки, слоты
внутри вкладки и плавающие окна графиков. `panels` — прежний интерфейс к слотам одной вкладки: его
маршруты удаляются в терминале 1.4.0, новый код пишите на `workspace`.

Всё на этой странице требует разрешения `panels` — при установке пользователь видит его как открытие
и расстановку панелей. Это его экран: открывайте и переставляйте только по его просьбе и не забирайте
фокус из фона — поэтому `activate` везде по умолчанию выключен.

## <a id="model"></a>Как устроен экран

- **Окно.** Главное (`kind: "main"`, одно) и окна стаканов (`"book"`, сколько угодно). `id` окна
  постоянный и переживает перезапуск. `index` — только позиция: у главного окна 0, и он сдвигается,
  когда закрывают другое окно, — не храните его.
- **Вкладка.** `id` постоянный. `title` — то, что написано в заголовке: имя от пользователя, иначе
  монета и число панелей, иначе пусто.
- **Раскладка вкладки** (`layout`) — дерево. Узел — либо разбиение (`type: "split"`: `row` — рядом,
  `column` — друг под другом, `children` — дети), либо слот (`type: "slot"`). `share` — доля узла в
  родителе. Если во вкладке один слот, он и есть корень; у вкладки, где ещё ничего не было, `layout`
  нет.
- **Слот** — ячейка раскладки с постоянным `id`. Он переживает смену инструмента, очистку, смену вида
  (стакан ↔ график) и перезапуск. Что в нём — `content`, объединение по `kind`: `orderbook`, `chart`,
  `widget` или `empty`, и у каждого вида только свои поля. `contentId` — id того, что заполняет слот,
  и он меняется при новом выборе инструмента; у виджета `contentId` равен `handshake().instanceId`
  этого виджета.
- **Окна графиков** плавают рядом с раскладкой, а не в ней: одиночный график (`kind: "chart"`) или
  комбо-график на три таймфрейма (`"comboChart"`). Ими владеет вкладка, и они переживают перезапуск.
  На одну монету — не больше одного окна каждого вида.

Ограничения: `addSlots` (как и устаревшие `panels.add` и `panels.combo`) — не больше 30 вызовов в
минуту на виджет, дальше `429 too_many_panels`; в одном вызове — не больше 16 слотов. Поверх этого
действует общий лимит моста — 300 вызовов в минуту. Таймфреймы пишутся как `M1`, `M5`, `M15`, `H1`,
`H4`, `D1`.

## <a id="find-own-slot"></a>Где мой слот

`handshake().slotId` — постоянный id слота, в котором стоит виджет, или `null`, если виджет открыт
отдельным окном. Виджет переносят между слотами и между слотом и окном без перезапуска: `slotId`
обновляется до события [`surface`](bridge.md#event-surface), так что слушайте его. Сам слот и его
место в дереве даёт [`workspace.slot()`](#workspace-slot). Готовый рецепт — в
[recipes.md](../recipes.md#find-my-box).

```js
import { handshake, on, workspace } from "./colibri.js";

/** Ближайший стакан в том же разбиении, что и мой слот, или null. */
async function bookBesideMe() {
  const slotId = handshake().slotId;
  if (!slotId) return null; // открыт окном: рядом никого нет
  const { position } = await workspace.slot(slotId);
  if (!position.parent) return null; // единственный слот вкладки

  // Спускаемся от корня вкладки к родительскому разбиению по пути слота.
  const { tab } = await workspace.tab(position.tabId);
  let node = tab.layout;
  for (const i of position.path.slice(0, -1)) {
    if (node.type === "split") node = node.children[i];
  }
  if (node.type !== "split") return null;

  // От своего места наружу: сначала ближайшие соседи.
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

Ids здесь постоянные — храните их, а не индексы. Ответы на изменения несут затронутый объект в той
же форме, в какой его отдаёт чтение.

### <a id="workspace-get"></a>`workspace.get()`

```ts decl
get(params?: { windowId?: string; tabId?: string }): Promise<WorkspaceResponse>;
```

Разрешение: `panels`.

Весь экран одним чтением — [`WorkspaceResponse`](#types): каждое окно с его вкладками, у каждой
вкладки — раскладка и окна графиков, которыми она владеет. `{ windowId }` или `{ tabId }` сужают
ответ до одного окна или одной вкладки. Читайте целиком, чтобы составить карту, а дальше пользуйтесь
точечными чтениями — [`tab()`](#workspace-tab), [`slot()`](#workspace-slot).

### <a id="workspace-windows"></a>`workspace.windows()`

```ts decl
windows(): Promise<{ windows: WorkspaceWindowSummary[] }>;
```

Разрешение: `panels`.

Только окна, без вкладок: `id`, `index`, вид (`main` или `book`), активно ли окно, его прямоугольник
(`bounds`), закреплено ли оно и сколько в нём вкладок.

### <a id="workspace-activate-window"></a>`workspace.activateWindow()`

```ts decl
activateWindow(windowId: string): Promise<{ status: string; window: WorkspaceWindowSummary }>;
```

Разрешение: `panels`.

Поднять окно на передний план. Ответ — окно после изменения. Нет такого окна — `404 unknown_window`.

### <a id="workspace-tab"></a>`workspace.tab()`

```ts decl
tab(tabId: string): Promise<WorkspaceTabLookup>;
```

Разрешение: `panels`.

Одна вкладка — байт в байт как её узел в [`get()`](#workspace-get) — и где она: `windowId`,
`windowIndex` и сколько вкладок в окне. Нет такой — `404 unknown_tab`.

### <a id="workspace-create-tab"></a>`workspace.createTab()`

```ts decl
createTab(body?: { windowId?: string; title?: string; index?: number; activate?: boolean }): Promise<{
  status: string;
  tab: WorkspaceTab;
  position: WorkspaceTabLookup["position"];
}>;
```

Разрешение: `panels`.

Создать вкладку. Без `windowId` — в главном окне, без `index` — в конце, без `title` — с
автоматическим именем. `activate` по умолчанию `false`, чтобы инструмент в фоне не отнимал у
пользователя фокус. У новой вкладки нет `layout`, пока в неё ничего не добавили. Нет такого окна —
`404 unknown_window`.

### <a id="workspace-update-tab"></a>`workspace.updateTab()`

```ts decl
updateTab(
  tabId: string,
  body: { active?: true; raiseWindow?: boolean; title?: string | null; index?: number },
): Promise<{ status: string; tab: WorkspaceTab; position: WorkspaceTabLookup["position"] }>;
```

Разрешение: `panels`.

Переименовать, переставить, сделать активной — в одном вызове, в порядке `title` → `index` →
`active`. Нужно хотя бы одно поле, иначе `400 bad_request`. `title` работает как PATCH: нет поля —
имя не трогается, строка — переименовывает, `null` — возвращает автоматическое имя. **Не записывайте
обратно прочитанный `title`**: так автоматическое «BTC (3)» вместе со счётчиком застынет постоянным
именем. `active` принимает только `true`; `raiseWindow` (по умолчанию `true`) поднимает и окно вкладки.

### <a id="workspace-activate-tab"></a>`workspace.activateTab()`

```ts decl
activateTab(tabId: string, raiseWindow?: boolean): Promise<{
  status: string;
  tab: WorkspaceTab;
  position: WorkspaceTabLookup["position"];
}>;
```

Разрешение: `panels`.

Сделать вкладку активной — короткая запись `updateTab(tabId, { active: true, raiseWindow })`. Окно
вкладки тоже поднимается, если не передать `raiseWindow: false`.

### <a id="workspace-close-tab"></a>`workspace.closeTab()`

```ts decl
closeTab(tabId: string): Promise<{ status: string; tabId: string }>;
```

Разрешение: `panels`.

Закрыть вкладку вместе с её слотами, их потоками данных и окнами графиков — как кнопкой закрытия на
самой вкладке. Последняя вкладка окна стаканов закрывает и окно. Единственную вкладку главного окна
закрыть нельзя — у терминала нет состояния без вкладок: `409 last_tab`.

### <a id="workspace-add-slots"></a>`workspace.addSlots()`

```ts decl
addSlots(body: AddSlotsBody): Promise<{ status: string; slots: WorkspaceSlotNode[] }>;
```

Разрешение: `panels`.

**Добавляет** слоты и никогда не заменяет: слот, названный в `target`, — это опора. Он остаётся со
своим id, содержимым и живым потоком, только становится меньше. `target` — либо `{ slot, side }`
(рядом со слотом; `side` обязателен), либо `{ edge }` (у края вкладки: `left`/`right` — колонка во
всю высоту, `top`/`bottom` — строка во всю ширину), но не оба сразу — иначе `400 bad_request`. Без
`target` — `{ edge: "right" }`, без `tabId` — активная вкладка главного окна. Как именно найдётся место
рядом с опорой, решают сторона и виды содержимого, как при перетаскивании мышью.

`stack` (`row` или `column`, по умолчанию `column`) раскладывает новые слоты между собой. `share`
каждого слота — доля от того, что **осталось** после предыдущих, и приводится к 0,05–0,95; без долей
всё делится поровну. Слоты создаются сразу с содержимым: `{ kind: "empty" }` здесь отклоняется.
`connectionId` в стакане привязывает счёт и требует того же разрешения на торговлю, что и
[`trading`](account-and-trading.md#trading) (`403 trading_not_enabled`). Ответ — `201` и созданные
слоты в порядке запроса; про лимиты — в [«Как устроен экран»](#model).

<!-- check: prelude const mySlotId = "811deac4440b43f2a3223802234fbcb9"; -->
```js
import { workspace } from "./colibri.js";

// График под моим стаканом. Сам стакан остаётся на месте и с тем же id.
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

Разрешение: `panels`.

Один слот — в той же форме, что его лист в дереве, — и где он: `windowId`, `tabId`, `path` (индексы
от корня вкладки; пустой у корневого слота), `depth` и `parent` — ориентация родительского разбиения,
место слота в нём и число соседей. У корневого слота `parent` нет. Нет такого слота —
`404 unknown_slot`.

### <a id="workspace-set-slot"></a>`workspace.setSlot()`

```ts decl
setSlot(
  slotId: string,
  content: PlaceableContent | { kind: "empty" },
): Promise<{ status: string; slot: WorkspaceSlotNode }>;
```

Разрешение: `panels`.

Задать, что в **этом** слоте. Вызов идемпотентен: то же состояние ещё раз — ничего не меняет и всё
равно отвечает 200. Смена вида (стакан → график и обратно) сохраняет id слота; график, пристыкованный
рядом, — отдельный слот, его вызов не трогает. Слот с работающим виджетом не меняется ничем, очистка
тоже: `409 slot_occupied_by_widget`. `connectionId` в стакане требует разрешения на торговлю.

### <a id="workspace-clear-slot"></a>`workspace.clearSlot()`

```ts decl
clearSlot(slotId: string): Promise<{ status: string; slot: WorkspaceSlotNode }>;
```

Разрешение: `panels`.

Очистить слот: то же, что `setSlot(slotId, { kind: "empty" })`. Слот остаётся на экране со своим id,
и позже его можно заполнить снова. На слоте с виджетом — `409 slot_occupied_by_widget`.

### <a id="workspace-remove-slot"></a>`workspace.removeSlot()`

```ts decl
removeSlot(slotId: string): Promise<{ status: string; slotId: string }>;
```

Разрешение: `panels`.

Удалить слот. Это изменение структуры: слота больше нет, его id не вернётся, а график, пристыкованный
под стаканом, уходит вместе с ним. Слот с виджетом удалить можно — это намеренное удаление по id, — в
том числе ваш собственный: виджет при этом закроется.

### <a id="workspace-chart-windows"></a>`workspace.chartWindows()`

```ts decl
chartWindows(params?: { tabId?: string; kind?: "chart" | "comboChart" }): Promise<{ chartWindows: ChartWindow[] }>;
```

Разрешение: `panels`.

Плавающие окна графиков всех вкладок, у каждого — `tabId` вкладки-владельца. `{ tabId }` и `{ kind }`
сужают список. В раскладке вкладки этих окон нет: они висят рядом с ней и переживают перезапуск.

### <a id="workspace-open-chart-window"></a>`workspace.openChartWindow()`

```ts decl
openChartWindow(body: OpenChartWindowBody): Promise<{ status: string; chartWindow: ChartWindow }>;
```

Разрешение: `panels`.

Открыть окно графика монеты (`kind: "chart"`, один таймфрейм в `interval`) или комбо-график
(`"comboChart"`, ровно три таймфрейма в `intervals`). Поле чужого вида не отбрасывается молча, а
отклоняется `400 bad_request` — таймфрейм не пропадёт без следа. Окно одно на `(kind, exchange,
symbol)`: если такое уже открыто, терминал переносит его во вкладку `tabId`, показывает и отвечает 200
этим окном; новое окно — ответ 201.

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

Разрешение: `panels`.

Сменить монету или таймфрейм, перенести в другую вкладку, закрепить, заблокировать, включить
следование или поднять окно — [`UpdateChartWindowBody`](#types). Все поля необязательны, но хотя бы
одно нужно. `sync` есть только у комбо-графика, и включён он не больше чем у одного окна: включили
здесь — выключился у остальных, потому что клик по стакану должен попасть ровно в одно окно. Ответ
сообщает только об изменённом окне — если вы следите за `sync`, перечитайте список.

### <a id="workspace-close-chart-window"></a>`workspace.closeChartWindow()`

```ts decl
closeChartWindow(chartWindowId: string): Promise<{ status: string; chartWindowId: string }>;
```

Разрешение: `panels`.

Закрыть окно графика по его постоянному id. Нет такого — `404 unknown_chart_window`.

## <a id="panels"></a>panels — устарело

**Устарело.** Маршруты `/app/panels` удаляются в терминале 1.4.0. У каждого вызова ниже указана
замена в `workspace`; новый код пишите сразу на ней. Ответы `panels` — в форме версии 2 (одно дерево
`layout` на вкладку): SDK запрашивает её сам, см. [`API_VERSION`](bridge.md#api-version).

### <a id="panels-list"></a>`panels.list()`

```ts decl
list(params?: { tabId?: string; windowIndex?: number }): Promise<PanelsResponse>;
```

Разрешение: `panels`.

Замена — [`workspace.get()`](#workspace-get). Окна, их вкладки и дерево раскладки каждой вкладки —
[`PanelsResponse`](#types). Окна плавающих графиков и постоянные id окон здесь не видны.
`{ tabId }` оставляет одну вкладку (нет такой — `404 unknown_tab`), `{ windowIndex }` — одно окно по
позиции.

### <a id="panels-get"></a>`panels.get()`

```ts decl
get(slotId: string): Promise<SlotLookup>;
```

Разрешение: `panels`.

Замена — [`workspace.slot()`](#workspace-slot). Слот и где он: окно по позиции, вкладка, путь от
корня и родительское разбиение. Нет такого слота — `404 unknown_panel`.

### <a id="panels-self"></a>`panels.self()`

```ts decl
self(): Promise<SlotLookup>;
```

Разрешение: `panels`.

Замена — `workspace.slot(handshake().slotId)`, см. [«Где мой слот»](#find-own-slot). Свой слот
виджета. Если виджет открыт окном, SDK отклоняет вызов сам, не обращаясь к терминалу:
`ColibriError` с кодом `no_slot`.

### <a id="panels-siblings"></a>`panels.siblings()`

```ts decl
siblings(slotId?: string): Promise<{ orientation: "row" | "column" | null; index: number; siblings: LayoutNode[] }>;
```

Разрешение: `panels`.

Замена — [`workspace.slot()`](#workspace-slot) плюс [`workspace.tab()`](#workspace-tab): пройдите по
`position.path` до родителя, как в примере [«Где мой слот»](#find-own-slot). Соседи слота `slotId`
(без него — своего) по родительскому разбиению в порядке на экране, ось разбиения и место слота в
нём. У корневого слота соседей нет: пустой список и `orientation: null`.

### <a id="panels-add"></a>`panels.add()`

```ts decl
add(body: AddPanelsBody): Promise<SlotAction>;
```

Разрешение: `panels`.

Замена — [`workspace.addSlots()`](#workspace-add-slots). Тело — [`AddPanelsBody`](#types): стопка
содержимого в **`contents`** (массив, до 16 элементов), а не одно `content`. `target` —
`{ slotId, side, action }`: `side` по умолчанию `bottom`, `action` — `pair`, `row`, `column` или
`intoRow` (по умолчанию `pair`); без `target` стопка встаёт в корневую строку вкладки. `orientation`
по умолчанию `column`. Ответ — `201`: `slot` — первый слот, `slots` — все созданные.

### <a id="panels-set"></a>`panels.set()`

```ts decl
set(slotId: string, body: { content: PlaceableContent | { kind: "empty" }; connectionId?: string }): Promise<SlotAction>;
```

Разрешение: `panels`.

Замена — [`workspace.setSlot()`](#workspace-set-slot). Задать, что в слоте; `{ kind: "empty" }`
очищает. `connectionId` привязывает счёт к стакану и требует разрешения на торговлю. На слоте с
виджетом — `409 slot_occupied_by_widget`.

### <a id="panels-clear"></a>`panels.clear()`

```ts decl
clear(slotId: string): Promise<SlotAction>;
```

Разрешение: `panels`.

Замена — [`workspace.clearSlot()`](#workspace-clear-slot). Очистить слот, сохранив его id.

### <a id="panels-remove"></a>`panels.remove()`

```ts decl
remove(slotId: string): Promise<SlotAction>;
```

Разрешение: `panels`.

Замена — [`workspace.removeSlot()`](#workspace-remove-slot). Удалить слот вместе с пристыкованным
графиком.

### <a id="panels-combo"></a>`panels.combo()`

```ts decl
combo(body: unknown): Promise<unknown>;
```

Разрешение: `panels`.

Открыть монету на всех подключениях, где она есть, — по стакану на каждое: `{ symbol, target?, views?,
chart? }`, `target` — `tab` (по умолчанию) или `window`. Маршрут `/app/combos` в 1.4.0 **не**
удаляется, но обёртки в `workspace` у него нет: когда `panels` уйдёт из SDK, вызывайте его через
[`request("POST", "/app/combos", { body })`](bridge.md#request). Считается в лимит открытий —
30 в минуту.

## <a id="types"></a>Типы

Содержимое слота. Поля есть только у того вида, которому они что-то значат:

```ts decl
interface EmptyContent {
  kind: "empty";
}

interface OrderbookContent {
  kind: "orderbook";
  exchange: string;
  symbol: string;
  /** Id панели инструмента — меняется при новом выборе, в отличие от id слота. */
  contentId: string;
  /** Только если к стакану привязан счёт. */
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
  /** Id экземпляра — тот же, что в handshake().instanceId этого виджета. */
  contentId: string;
  name: string;
  /** false — заглушка неустановленного или отозванного виджета, которая держит место. */
  installed: boolean;
}

type SlotContent = EmptyContent | OrderbookContent | ChartContent | WidgetContent;

/** Что можно поставить: то же объединение без id, которые выдаёт терминал. Виджет через API не ставят. */
type PlaceableContent =
  | { kind: "orderbook"; exchange: string; symbol: string; connectionId?: string; share?: number }
  | { kind: "chart"; exchange: string; symbol: string; interval?: string; share?: number };
```

Окна, вкладки и дерево `workspace`:

```ts decl
/** Прямоугольник окна. При maximized: true — где окно окажется, когда его развернут обратно. */
interface Bounds {
  left: number;
  top: number;
  width: number;
  height: number;
  maximized: boolean;
}

/** Слот в дереве. */
interface WorkspaceSlotNode {
  type: "slot";
  surface: "slot";
  id: string;
  /** Доля в родителе; нет у корневого слота и в ответах на изменения. */
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

/** Плавающее окно графика: одна монета, один таймфрейм. */
interface SingleChartWindow {
  kind: "chart";
  surface: "window";
  /** Постоянный id — его принимают updateChartWindow и closeChartWindow. */
  id: string;
  /** Есть в chartWindows(); внутри своей вкладки не нужен. */
  tabId?: string;
  exchange: string;
  symbol: string;
  interval: string;
  contentId: string;
  bounds: Bounds;
  pinned: boolean;
  locked: boolean;
}

/** Комбо-график: одна монета на ТРЁХ таймфреймах, поэтому без contentId. */
interface ComboChartWindow {
  kind: "comboChart";
  surface: "window";
  id: string;
  tabId?: string;
  exchange: string;
  symbol: string;
  /** Ровно три, в порядке панелей. */
  intervals: string[];
  bounds: Bounds;
  pinned: boolean;
  locked: boolean;
  /** Следует за кликнутым стаканом. Включено не больше чем у одного окна. */
  sync: boolean;
}

type ChartWindow = SingleChartWindow | ComboChartWindow;

interface WorkspaceTab {
  /** Постоянный id вкладки. */
  id: string;
  index: number;
  active: boolean;
  /** Что написано в заголовке: имя пользователя, иначе монета и число панелей, иначе "". */
  title: string;
  /** Нет у вкладки, где ещё ничего не было. */
  layout?: WorkspaceNode;
  /** Окна графиков вкладки; пустой список, если их нет. */
  windows: ChartWindow[];
}

interface WorkspaceWindow {
  /** Постоянный id — переживает перезапуск, в отличие от index. */
  id: string;
  /** Позиция; у главного окна 0. СДВИГАЕТСЯ при закрытии другого окна — не храните. */
  index: number;
  kind: "main" | "book";
  active: boolean;
  bounds: Bounds;
  locked: boolean;
  tabs: WorkspaceTab[];
}

/** Окно без вкладок. */
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
    /** Индексы от корня вкладки; пустой у корневого слота. */
    path: number[];
    depth: number;
    /** Нет ровно тогда, когда слот — корень вкладки. */
    parent?: { orientation: "row" | "column"; index: number; count: number };
  };
}
```

Тела запросов `workspace`:

```ts decl
/** Куда встанут слоты: { slot, side } или { edge }, не оба. Ничего — правый край вкладки. */
type SlotTarget =
  | { slot: string; side: "left" | "right" | "top" | "bottom"; edge?: never }
  | { edge: "left" | "right" | "top" | "bottom"; slot?: never; side?: never };

/** Один новый слот. share — доля СЛОТА, от того, что осталось после предыдущих. */
interface NewSlot {
  content: PlaceableContent;
  share?: number;
}

interface AddSlotsBody {
  /** Вкладка; без неё — активная. */
  tabId?: string;
  /** Без него — { edge: "right" }. */
  target?: SlotTarget;
  /** Как новые слоты встают между собой; по умолчанию column. */
  stack?: "row" | "column";
  /** Не больше 16. */
  slots: NewSlot[];
  /** true — ещё и поднять окно. */
  activate?: boolean;
}

/** interval — только у chart, intervals (три) — только у comboChart. */
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
  /** Только chart. */
  interval?: string;
  /** Только comboChart — ровно три. */
  intervals?: [string, string, string];
  /** Перенести в другую вкладку. */
  tabId?: string;
  pinned?: boolean;
  locked?: boolean;
  /** Только comboChart; включено не больше чем у одного окна. */
  sync?: boolean;
  /** Поднять окно. Только true. */
  active?: true;
}
```

Устаревшие формы `panels`:

```ts decl
/** Разбиение: дети рядом (row) или друг под другом (column). */
interface SplitNode {
  type: "split";
  orientation: "row" | "column";
  /** Доля в родителе; нет у корня вкладки. */
  share?: number;
  children: LayoutNode[];
}

/** Слот: постоянная ячейка и то, что её заполняет. */
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
  /** null у вкладки, где ещё ничего не было. */
  layout: LayoutNode | null;
}

interface PanelWindow {
  /** Позиция; у главного окна 0. */
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
  /** Индексы от корня вкладки; пустой у корневого слота. */
  path: number[];
  depth: number;
  /** Нет у корневого слота. */
  parent?: { orientation: "row" | "column"; index: number; count: number };
}

interface SlotLookup {
  slot: SlotNode;
  position: SlotPosition;
}

interface SlotAction {
  status: string;
  slot?: SlotNode;
  /** Все слоты, созданные стопкой, в порядке запроса. */
  slots?: SlotNode[];
}

interface AddPanelsBody {
  /** Вкладка; без неё — активная. */
  tabId?: string;
  /** Куда встанет стопка; без него — в корневую строку вкладки. */
  target?: { slotId: string; side?: "left" | "right" | "top" | "bottom"; action?: "pair" | "row" | "column" | "intoRow" };
  /** Как элементы стопки встают между собой. */
  orientation?: "row" | "column";
  contents?: PlaceableContent[];
  /** Поднять окно терминала после добавления. */
  activate?: boolean;
}
```
