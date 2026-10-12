# Мост, функции и события терминала

> English version — [bridge.en.md](bridge.en.md).

Здесь то, что не принадлежит ни одной области API: вызов любого маршрута, сведения об экземпляре,
проверка разрешений, события терминала, класс ошибки и константы. В конце — типы, среди них
`ColibriBridge`, то есть сам `window.colibri`. Чем мост отличается от SDK — в
[справочнике](README.md#bridge-vs-sdk).

Вне терминала, например в обычном браузере, моста нет, и каждая функция здесь бросает обычный `Error`.

## <a id="functions"></a>Функции

### <a id="request"></a>`request()`

```ts decl
function request<T = unknown>(method: string, path: string, options?: RequestOptions): Promise<T>;

interface RequestOptions {
  /** Параметры запроса; значения `undefined` и `null` отбрасываются. */
  params?: Record<string, string | number | boolean | null | undefined>;
  /** JSON-тело для POST / PUT / PATCH. */
  body?: unknown;
  /** Версия формы ответа; по умолчанию {@link API_VERSION}. */
  apiVersion?: number;
}
```

Вызывает любой маршрут из [`ROUTES`](#routes): резолвится телом ответа при 2xx и отклоняется
[`ColibriError`](#colibri-error) при любом другом статусе. Функции областей, которые ходят в маршруты, —
`markets.book()` и остальные — обёртки над ним; берите `request()`, когда обёртки нет. Нужно то разрешение, что записано
у маршрута в `ROUTES`. Путь SDK не кодирует: части пути оборачивайте в `encodeURIComponent`, а
параметры передавайте в `params`.

```ts
import { request } from "./colibri.js";
import type { Book } from "./colibri.js";

const symbol = "BTCUSDT";
const book = await request<Book>("GET", `/markets/BinanceSpot/${encodeURIComponent(symbol)}/book`, {
  params: { depth: 20 },
});
console.log(book.bestBid, book.bestAsk);
```

### <a id="handshake"></a>`handshake()`

```ts decl
function handshake(): Handshake;

/** Что это за экземпляр; доступно синхронно, до первого скрипта страницы. */
interface Handshake {
  /** Версия API, которую отдаёт этот терминал; манифест может требовать минимум через `minApiVersion`. */
  apiVersion: number;
  widgetId: string;
  /** Id этого экземпляра; в нём же живут ваши ключи `storage`. */
  instanceId: string;
  surface: WidgetSurface;
  /**
   * Долговечный id ЯЧЕЙКИ, где стоит виджет, или `null`, когда `surface` — `"window"`.
   * Передайте его в `panels.get()` (или вызовите `panels.self()`), чтобы узнать, где вы и что
   * рядом, — без настройки пользователем и без вставки id.
   *
   * Обновляется на месте ДО события `surface`, как и `surface`: виджет можно переносить между
   * ячейками и между ячейкой и окном без перезапуска.
   */
  slotId: string | null;
  /** `dark` | `light`; при смене приходит и событием `theme`. */
  theme: string;
  /** Язык интерфейса (`en`, `ru`, …). */
  lang: string;
  grantedScopes: Scope[];
}
```

Возвращает сведения об экземпляре синхронно: мост кладёт их в страницу до первой строки вашего кода,
ждать события готовности не нужно. Это один и тот же объект на всю жизнь страницы: терминал
обновляет в нём `theme`, `lang`, `surface`, `slotId` и `grantedScopes` до соответствующего события,
так что `handshake().theme` всегда отдаёт текущую тему.

| Поле | Что это |
| --- | --- |
| `apiVersion` | Мажор контракта моста, сейчас 1; см. [версии](README.md#versions). |
| `widgetId` | `id` из манифеста. |
| `instanceId` | Долговечный id этого экземпляра. В нём живут ключи `storage`, поэтому у двух копий виджета свои настройки. |
| `surface` | `"slot"` — ячейка во вкладке, `"window"` — отдельное окно. |
| `slotId` | Долговечный id ячейки; `null` в окне. |
| `theme` | `"dark"` или `"light"`. |
| `lang` | Язык интерфейса терминала: `"ru"` или `"en"`. Языки могут добавиться — незнакомый показывайте по-английски. |
| `grantedScopes` | Разрешения, которые у виджета есть сейчас; см. [разрешения](README.md#permissions). |

```js
import { handshake } from "./colibri.js";

const { widgetId, instanceId, surface, lang } = handshake();
console.log(`${widgetId}/${instanceId}: ${surface}, язык ${lang}`);
```

### <a id="has-scope"></a>`hasScope()`

```ts decl
function hasScope(scope: Scope): boolean;
```

`true`, если разрешение у виджета есть сейчас. Читает живой `handshake().grantedScopes`, который
терминал обновляет до события [`grants`](#event-grants). Подходит, чтобы спрятать кнопку или раздел,
но не заменяет обработку `unauthorized`: разрешение могут выключить между проверкой и вызовом. Имена
разрешений — в [`SCOPES`](#scopes), разрешение канала — в [`CHANNEL_SCOPES`](#channel-scopes).

```js
import { hasScope } from "./colibri.js";

document.querySelector("#buy")?.toggleAttribute("disabled", !hasScope("trading"));
```

### <a id="on"></a>`on()`

```ts decl
function on<E extends HostEvent>(event: E, handler: (payload: HostEventPayloads[E]) => void): () => void;
```

Подписывает обработчик на [событие терминала](#events) и возвращает функцию отписки. Тип данных
выводится из имени события. Исключение из обработчика мост перехватывает молча, чтобы оно не сломало
ни мост, ни другие обработчики, — ловите и пишите в журнал сами.

```js
import { on } from "./colibri.js";

const off = on("visibility", (e) => {
  console.log(e.visible ? "виджет виден" : "виджет скрыт");
});

// Когда обработчик больше не нужен:
off();
```

## <a id="constants"></a>Класс ошибки и константы

### <a id="colibri-error"></a>`ColibriError`

```ts decl
/** Отказ терминала. Разбирайте `code`, никогда — `message`. */
class ColibriError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message?: string);
}
```

Отказ терминала. `status` похож на HTTP (401, 404, 503 …), у `storage.*` он всегда 0; `code` —
устойчивый код; `message` — пояснение для человека, его текст может меняться. Бросают его `request()`
и все функции областей при ответе не 2xx, `storage.*` со статусом 0 и `panels.self()` с кодом
`no_slot`. `net.fetch` не бросает никогда. Все коды и что с ними делать — в
[справочнике](README.md#errors).

```js
import { notifications, ColibriError } from "./colibri.js";

try {
  await notifications.raise({ message: "Спред шире 4 б.п.", severity: "warning" });
} catch (e) {
  if (!(e instanceof ColibriError)) throw e;
  if (e.code === "bridge_disabled") console.log("API выключен пользователем");
  else if (e.code === "unauthorized") console.log("нет разрешения notifications");
  else console.warn(e.status, e.code, e.message);
}
```

### <a id="api-version"></a>`API_VERSION`

```ts decl
const API_VERSION: number;
```

Версия формы ответа, которую читает этот SDK, — сейчас 2. SDK шлёт её с каждым вызовом. Это не
`handshake().apiVersion`: тот — мажор контракта, с которым сравнивается `minApiVersion` манифеста.
Две формы есть только у устаревшего семейства `/app/panels`, и с терминала 1.4.0 у него осталась одна —
v2. Передавать свою версию через `RequestOptions.apiVersion` незачем; версию, которой терминал не
отдаёт, он отклоняет кодом `unsupported_api_version`. Подробнее — [версии](README.md#versions).

### <a id="routes"></a>`ROUTES`

```ts decl
/** `[метод, путь, requiresToken, разрешение]` — таблица маршрутов терминала, закреплённая тестом. */
const ROUTES: ReadonlyArray<readonly [string, string, boolean, Scope]>;
```

Таблица маршрутов терминала: `[метод, путь, requiresToken, разрешение]`. Это данные, а не описание:
тест в терминале сверяет её с живыми маршрутами. Третий элемент относится к локальному HTTP-доступу
для программ на компьютере пользователя; виджета он не касается — через мост вызов решает только
разрешение. Пригодится, чтобы узнать разрешение маршрута, который вы вызываете через
[`request()`](#request).

```js
import { ROUTES } from "./colibri.js";

const tradingRoutes = ROUTES.filter(([, , , scope]) => scope === "trading").map(([method, path]) => `${method} ${path}`);
console.log(tradingRoutes);
```

### <a id="channels"></a>`CHANNELS`

```ts decl
const CHANNELS: readonly Channel[];
```

Все каналы потока: [`book`](market-data.md#channel-book), [`trades`](market-data.md#channel-trades),
[`funding`](market-data.md#channel-funding), [`positions`](account-and-trading.md#channel-positions),
[`orders`](account-and-trading.md#channel-orders), [`balance`](account-and-trading.md#channel-balance),
[`notifications`](notifications.md#channel-notifications) и
[`signalLevels`](notifications.md#channel-signal-levels). Подписка — `stream.subscribe()`.

### <a id="scopes"></a>`SCOPES`

```ts decl
/** Все имена разрешений — в том виде, в каком их принимает `permissions` в `widget.json`. */
const SCOPES: {
  readonly marketData: "marketData";
  readonly accountRead: "account:read";
  readonly trading: "trading";
  readonly panels: "panels";
  readonly notifications: "notifications";
  readonly signalLevels: "signalLevels";
  readonly storage: "storage";
};
```

Все семь имён разрешений. Берите константу вместо строки, и опечатку найдёт редактор:
`SCOPES.accountRead` — это `"account:read"`. Что открывает каждое разрешение — в
[справочнике](README.md#permissions).

### <a id="channel-scopes"></a>`CHANNEL_SCOPES`

```ts decl
/** канал → разрешение, которое его открывает. */
const CHANNEL_SCOPES: Readonly<Record<Channel, Scope>>;
```

Канал → разрешение, без которого на него не подписаться: `book`, `trades` и `funding` —
`marketData`; `positions`, `orders` и `balance` — `account:read`; `notifications` — `notifications`;
`signalLevels` — `signalLevels`.

```js
import { CHANNEL_SCOPES, hasScope, stream } from "./colibri.js";

if (hasScope(CHANNEL_SCOPES.book)) {
  stream.subscribe("book", { exchange: "BinanceSpot", symbol: "BTCUSDT" }, (book) => {
    console.log(book.bestBid, book.bestAsk);
  });
}
```

## <a id="events"></a>События терминала

Подписка — [`on()`](#on). Поля `handshake()` терминал обновляет до вызова обработчиков.

Сразу после загрузки страницы терминал присылает `theme`, `visibility`, `grants`, `surface` и `bridge`
с текущим состоянием — и снова после каждого перезапуска страницы. Поэтому обработчик, подписанный при
старте, получит событие и тогда, когда ничего не менялось: понимайте событие как «вот как сейчас», а не
как «что-то изменилось».

| Событие | Когда | Что обновлено в `handshake()` |
| --- | --- | --- |
| [`theme`](#event-theme) | тема, цвета, размер шрифта, язык | `theme`, `lang` |
| [`visibility`](#event-visibility) | виджет показали или скрыли | — |
| [`surface`](#event-surface) | виджет перенесли | `surface`, `slotId` |
| [`bridge`](#event-bridge) | API виджетов выключили или включили | — |
| [`grants`](#event-grants) | изменились разрешения | `grantedScopes` |
| [`streamReset`](#event-stream-reset) | терминал сбросил подписки | — |
| [`permissionRefused`](#event-permission-refused) | отказано в разрешении браузера | — |

### <a id="event-theme"></a>`theme`

```ts decl
/** `theme`: сменились палитра, язык или масштаб шрифта. `handshake()` обновлён раньше. */
interface ThemeEvent {
  type: "colibri:theme";
  /** `dark` | `light`. */
  theme: string;
  /** Все CSS-переменные, которые хост ставит на `<html>`: имя → значение. */
  vars: Record<string, string>;
  /** Язык интерфейса (`en`, `ru`, …). */
  lang: string;
  /** Масштаб шрифта терминала; он же `--colibri-font-scale`. */
  fontScale: number;
}
```

Приходит, когда пользователь сменил тему, цвета палитры, размер шрифта или язык интерфейса. К вызову
обработчика `handshake().theme` и `handshake().lang` уже обновлены, а CSS-переменные и атрибуты
`data-theme` и `data-colibri-lang` на `<html>` уже переставлены. Стили на переменных следуют за темой
сами; подписывайтесь, если рисуете на `<canvas>` — цвета там нужно перечитать — или перерисовываете
текст на новом языке. `e.vars` — все переменные цвета, имя → значение. Переменные —
[на странице темы](theme.md), рецепт — [следовать теме](../recipes.md#follow-theme).

```js
import { on } from "./colibri.js";

on("theme", (e) => {
  const css = getComputedStyle(document.documentElement);
  const text = css.getPropertyValue("--colibri-role-text").trim() || "#d8dee9";
  console.log(e.theme, e.lang, e.fontScale, text);
});
```

### <a id="event-visibility"></a>`visibility`

```ts decl
/** `visibility`: виджет показали или скрыли. Скрытый виджет продолжает работать. */
interface VisibilityEvent {
  type: "colibri:visibility";
  visible: boolean;
}
```

Приходит, когда виджет показали или скрыли — например, пользователь переключил вкладку. Скрытый виджет
не замораживается: таймеры, сокеты и подписки работают дальше, терминал ничего за вас не
останавливает. Пока `visible` ложно, остановите дорогую работу — анимацию, частую перерисовку, лишние
запросы; когда виджет снова виден, перерисуйте один раз по последним данным. Поля в `handshake()` для
этого нет: текущее состояние приходит этим же событием сразу после загрузки.

```js
import { on } from "./colibri.js";

let visible = true;
on("visibility", (e) => {
  visible = e.visible;
  if (visible) requestAnimationFrame(() => console.log("перерисовать один раз"));
});
```

### <a id="event-surface"></a>`surface`

```ts decl
/** `surface`: виджет перенесли между ячейками или между ячейкой и окном. Он не перезапускается. */
interface SurfaceEvent {
  type: "colibri:surface";
  surface: WidgetSurface;
  /** Долговечный id новой ячейки; `null` (или нет поля) в окне. */
  slotId?: string | null;
}
```

Приходит, когда виджет перенесли в другую ячейку или между ячейкой и окном. Экземпляр при этом не
пересоздаётся: страница, её состояние в памяти и `storage` остаются, и это событие — единственное
уведомление о переезде. К вызову обработчика `handshake().surface` и `handshake().slotId` уже
обновлены. Если виджет опирается на соседей по раскладке, перечитайте свою ячейку —
[`workspace.slot()`](layout.md#workspace-slot); в окне ячейки нет, и `slotId` равен `null` или
отсутствует. Рецепт — [найти свою ячейку](../recipes.md#find-my-box).

```js
import { on, workspace } from "./colibri.js";

on("surface", async (e) => {
  if (!e.slotId) return; // в окне ячейки нет
  const { position } = await workspace.slot(e.slotId);
  console.log("теперь во вкладке", position.tabId);
});
```

### <a id="event-bridge"></a>`bridge`

```ts decl
/** `bridge`: пользователь выключил или снова включил API виджетов. */
interface BridgeEvent {
  type: "colibri:bridge";
  enabled: boolean;
}
```

Приходит, когда пользователь выключил или снова включил API виджетов в настройках. Пока API выключен,
виджет работает, но каждый вызов и `storage.*` отклоняются с кодом `bridge_disabled`, `net.fetch`
отвечает `ok: false` с тем же кодом, а подписки потока сброшены. Покажите, что данные не обновляются, и
не повторяйте вызовы в цикле. Когда `enabled` снова `true`, `stream.subscribe` переподписывается сам;
разовые запросы повторите сами. Поля в `handshake()` нет: текущее состояние приходит этим событием сразу
после загрузки. Рецепт — [мост выключен](../recipes.md#bridge-off).

```js
import { on } from "./colibri.js";

on("bridge", (e) => {
  document.body.classList.toggle("api-off", !e.enabled);
});
```

### <a id="event-grants"></a>`grants`

```ts decl
/** `grants`: изменились разрешения виджета. `handshake().grantedScopes` обновлён раньше. */
interface GrantsEvent {
  type: "colibri:grants";
  scopes: Scope[];
}
```

Приходит, когда изменились разрешения виджета — например, пользователь выключил или вернул разрешение
в «Моих виджетах». `e.scopes` — весь набор, который есть теперь; `handshake().grantedScopes` уже
обновлён, так что [`hasScope()`](#has-scope) отвечает по-новому. Спрячьте то, что больше не работает,
и верните то, что снова доступно. Терминал проверяет каждый вызов сам, так что виджет, который это
событие не слушает, узнает об отзыве по ответу `unauthorized`. Подробнее — [разрешения](README.md#permissions),
рецепт — [разрешение отозвали](../recipes.md#revoked-scope).

```js
import { on, hasScope } from "./colibri.js";

on("grants", (e) => {
  console.log("разрешения теперь:", e.scopes.join(", "));
  document.querySelector("#positions")?.toggleAttribute("hidden", !hasScope("account:read"));
});
```

### <a id="event-stream-reset"></a>`streamReset`

```ts decl
/** `streamReset`: хост сбросил все подписки; `stream.subscribe` подписывается заново сам. */
interface StreamResetEvent {
  type: "colibri:stream-reset";
  reason: string;
}
```

Приходит, когда терминал сбросил все подписки виджета: выключили API виджетов или страница не успевала
принимать кадры. `stream.subscribe` подписывается заново сам; если вы работаете с потоком напрямую через
`window.colibri.stream`, переподпишитесь сами. Кадры за время сброса потеряны: `book`, `positions`,
`orders` и `balance` следующим кадром придут целиком, а пропущенные сделки канала `trades` не
повторятся. `reason` — текст для журнала, а не код: не ветвитесь по нему.

```js
import { on } from "./colibri.js";

on("streamReset", (e) => {
  console.info("поток сброшен:", e.reason);
});
```

### <a id="event-permission-refused"></a>`permissionRefused`

```ts decl
/** Почему терминал отказал в разрешении браузера — см. CAPABILITIES, «Разрешения браузера». */
type PermissionRefusedReason = "forbidden" | "foreign-origin" | "undeclared" | "not-granted" | "no-user-gesture";

/** Данные `permissionRefused`: в каком разрешении браузера отказал терминал и почему. */
interface PermissionRefusedEvent {
  type: "colibri:permission-refused";
  /** Имя разрешения из списка (`camera`, `clipboard-read`, …) или `unknown`. */
  permission: string;
  /** Собственный номер вида разрешения в браузере. */
  kind: number;
  reason: PermissionRefusedReason;
  /** Строка по-английски, которую терминал также написал в консоль страницы. */
  message: string;
}
```

Приходит, когда терминал отказал странице в разрешении браузера — микрофоне, камере, буфере обмена и
других. Приходит и при выключенном API виджетов. Страница при этом получает обычную ошибку браузера
`NotAllowedError`, а в консоли DevTools появляется одна строка `console.warn` на каждую пару
«разрешение и причина». По `reason` видно, что делать: `undeclared` — объявить разрешение в
[`browserPermissions`](manifest.md#manifest-browser-permissions), `not-granted` — подсказать
пользователю включить его, `no-user-gesture` — просить из обработчика клика или клавиши. Все причины и
правила — в [CAPABILITIES.md](../../CAPABILITIES.md#разрешения-браузера).

```js
import { on } from "./colibri.js";

on("permissionRefused", (e) => {
  if (e.reason === "not-granted") console.log(`Разрешите «${e.permission}» в настройках виджета`);
});
```

## <a id="types"></a>Типы

Где живёт виджет и какие бывают разрешения:

```ts decl
/** Где живёт экземпляр виджета. */
type WidgetSurface = "slot" | "window";

/** Словарь разрешений. У виджета есть только то, что объявлено в манифесте И разрешено пользователем. */
type Scope =
  | "marketData"
  | "account:read"
  | "trading"
  | "panels"
  | "notifications"
  | "signalLevels"
  | "storage";
```

Имена событий и данные каждого — описание самих событий выше:

```ts decl
type HostEvent = "theme" | "visibility" | "surface" | "bridge" | "grants" | "streamReset" | "permissionRefused";

/** событие → данные, которые получает его обработчик. */
interface HostEventPayloads {
  theme: ThemeEvent;
  visibility: VisibilityEvent;
  surface: SurfaceEvent;
  bridge: BridgeEvent;
  grants: GrantsEvent;
  streamReset: StreamResetEvent;
  permissionRefused: PermissionRefusedEvent;
}
```

`ColibriBridge` — это сам `window.colibri`. В `colibri.d.ts` он объявлен как необязательное поле
`Window`: вне терминала его нет. Его `request` резолвится `{ status, body }` при любом статусе,
`storage` отвечает `{ ok, code }`, а `stream` и `on` передают кадры и события без разбора — SDK
поверх них описан на этой странице и в [справочнике](README.md#bridge-vs-sdk). Типы `NetFetchResult`
и `StreamFrame` — на страницах [хранилища и сети](storage-and-net.md) и
[рыночных данных](market-data.md).

```ts decl
/** «Сырой» канал, который кладёт хост. Именованные функции SDK — сахар ровно над ним. */
interface ColibriBridge {
  handshake: Handshake;
  apiVersion: number;
  widgetId: string;
  instanceId: string;
  /** Геттер: переезд между ячейкой и окном переписывает его на месте. */
  readonly surface: WidgetSurface;
  /** Долговечный id ячейки, `null` в окне; геттер, как `surface`. */
  readonly slotId: string | null;
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
```
