# Уведомления и ценовые алерты: notifications и signalLevels

> English version — [notifications.en.md](notifications.en.md).

`notifications` показывает пользователю уведомление терминала: всплывающее сообщение и звук.
`signalLevels` ставит ценовые алерты — уровни на стакане, которые срабатывают при пересечении цены.
Два канала потока присылают уведомления терминала и события алертов вживую.

Всё, что виджет отправляет пользователю, тот может заглушить: в окне «Уведомления», вкладка
«Виджеты», или в меню строки виджета в Nest. Заглушённый виджет продолжает работать, вызовы
отвечают успехом со статусом `muted`, но пользователь ничего не видит и не слышит. Шлите уведомление,
когда пользователь должен что-то заметить, а не на каждое изменение — иначе его заглушат первым.

## <a id="notifications"></a>notifications

### <a id="notifications-raise"></a>`notifications.raise()`

```ts decl
raise(body: { message: string; severity?: "info" | "success" | "warning" | "error"; source?: string }): Promise<{ status: "raised" | "muted" }>;
```

Разрешение: `notifications`.

Показать уведомление в терминале: всплывающее сообщение и звук — так, как пользователь настроил
уведомления от API и виджетов в настройках. `message` обязателен, не длиннее 500 символов. `severity`
— `info` (по умолчанию), `success`, `warning` или `error`; другое значение — `400 bad_request`.
`source`, если задан, терминал ставит перед текстом: «источник: сообщение». Ответ —
`{ status: "raised" }` или `{ status: "muted" }`, если пользователь заглушил виджет.

```js
import { notifications } from "./colibri.js";

await notifications.raise({ message: "BTCUSDT: спред шире 4 б.п.", severity: "warning" });
```

## <a id="signal-levels"></a>signalLevels

Ценовой алерт — уровень на площадке и символе: он рисуется на стакане и срабатывает при пересечении
цены, открыта панель этого символа или нет. Сработав, он поднимает уведомление терминала и событие в
канале [`signalLevels`](#channel-signal-levels). Алерты переживают перезапуск и не привязаны к
подключению — это чисто рыночная отметка.

Уровень срабатывает **один раз**. С `oneShot: true` он после этого удаляется; с `oneShot: false` (по
умолчанию) остаётся с `isTriggered: true` и временем срабатывания, пока его не уберёт
[`clearTriggered()`](#signal-levels-clear-triggered).

Набор общий для всех, кто ставит алерты через API, — для всех виджетов и внешних программ:
`list()` вернёт и чужие уровни, а `removeBySymbol()` и `clearTriggered()` удалят и их. Храните id своих
уровней и удаляйте по id, если не хотите задеть чужие.

```js
import { signalLevels } from "./colibri.js";

const level = await signalLevels.create({
  exchange: "BinanceSpot",
  symbol: "BTCUSDT",
  price: "100000",
  direction: "above",
  note: "пробой круглого уровня",
  oneShot: true,
});
```

### <a id="signal-levels-list"></a>`signalLevels.list()`

```ts decl
list(params?: RequestOptions["params"]): Promise<unknown>;
```

Разрешение: `signalLevels`.

Алерты — `{ levels: SignalLevel[] }` (см. [`SignalLevel`](#types)). `{ exchange }` и `{ symbol }`
сужают список; неизвестная площадка — `400 bad_request`. Чтобы следить за набором, подпишитесь на
канал [`signalLevels`](#channel-signal-levels): он сразу присылает текущий набор и дальше — каждое
изменение.

### <a id="signal-levels-create"></a>`signalLevels.create()`

```ts decl
create(body: unknown): Promise<unknown>;
```

Разрешение: `signalLevels`.

Поставить алерт. Тело: `exchange`, `symbol`, `price` — обязательны, `price` — положительная
десятичная строка; `direction` — `above`, `below` или `cross` (по умолчанию `cross`, регистр не
важен); `note` — текст, который покажет уведомление при срабатывании; `oneShot` — по умолчанию
`false`. Ответ — `201` и созданный [`SignalLevel`](#types): его `id` нужен для удаления. Неверное тело
— `400 bad_request`.

### <a id="signal-levels-remove"></a>`signalLevels.remove()`

```ts decl
remove(id: string): Promise<unknown>;
```

Разрешение: `signalLevels`.

Удалить один алерт по `id`. Ответ — `{ removed: 1 }`; нет такого — `404 not_found`.

### <a id="signal-levels-remove-by-symbol"></a>`signalLevels.removeBySymbol()`

```ts decl
removeBySymbol(params: RequestOptions["params"]): Promise<unknown>;
```

Разрешение: `signalLevels`.

Удалить все алерты одного символа: `{ exchange, symbol }`, оба обязательны (иначе `400 bad_request`).
Ответ — `{ removed: n }`, 0 — ничего не нашлось. Удаляет и уровни, которые поставили не вы.

### <a id="signal-levels-clear-triggered"></a>`signalLevels.clearTriggered()`

```ts decl
clearTriggered(): Promise<unknown>;
```

Разрешение: `signalLevels`.

Убрать все сработавшие алерты (`isTriggered: true`) — на всех площадках и символах. Пара к поведению
по умолчанию, при котором сработавший уровень остаётся. Ответ — `{ removed: n }`.

### <a id="signal-levels-signal"></a>`signalLevels.signal()`

```ts decl
signal(body: unknown): Promise<unknown>;
```

Разрешение: `notifications`.

Это не алерт, а рыночный сигнал: строка в журнале сигналов терминала (окно «Уведомления», вкладки
«Сигналы» и «API») со звуком и счётчиком на колокольчике. Поэтому и разрешение у него — `notifications`, а
не `signalLevels`. Тело: `{ exchange, symbol, text }`, все обязательны, `text` — что произошло, не
длиннее 200 символов. Ответ — `{ status: "raised" }` или `{ status: "muted" }`.

## <a id="live-channels"></a>Каналы

Оба канала общие для всего терминала: подписка без аргументов. Кадры этих каналов не теряются, даже
если страница не успевает их читать. Как подписываться — в
[`stream.subscribe()`](market-data.md#stream-subscribe).

### <a id="channel-notifications"></a>Канал `notifications`

Разрешение: `notifications`. Аргументов нет.

Каждое уведомление терминала — [`StreamNotification`](#types): исполнения и отмены ордеров, состояние
потоков данных, рыночные сигналы, сообщения других виджетов. Кадры приходят с типом
`"notification"`, в единственном числе; `stream.subscribe` это учитывает сам. Сразу после подписки
приходят недавние уведомления (ограниченный журнал), потом живые — поэтому не стоит поднимать звук на
каждый кадр после подписки. `connectionId` и `connectionLabel` — подключение, к которому относится
уведомление, без учётных данных. `severity` приходит с заглавной: `Info`, `Success`, `Warning`, `Error`.

```js
import { stream } from "./colibri.js";

stream.subscribe("notifications", undefined, (n) => {
  if (n.kind === "OrderFilled") console.log("исполнено:", n.symbol, n.message);
});
```

### <a id="channel-signal-levels"></a>Канал `signalLevels`

Разрешение: `signalLevels`. Аргументов нет.

Жизнь ценовых алертов. Кадр приходит с типом `"signalLevel"`, а что случилось — в `frame.event`:
`placed` (поставлен), `removed` (удалён) или `triggered` (сработал). `data` — сам
[`SignalLevel`](#types). Сразу после подписки весь текущий набор приходит событиями `placed` — так
список собирается без отдельного `list()`. Событие лежит в кадре, а не в `data`, поэтому берите второй
аргумент обработчика.

```js
import { stream } from "./colibri.js";

const levels = new Map();
stream.subscribe("signalLevels", undefined, (level, frame) => {
  if (frame.event === "removed") levels.delete(level.id);
  else levels.set(level.id, level); // placed или triggered
});
```

## <a id="types"></a>Типы

```ts decl
/** Кадр канала notifications: одно уведомление терминала. Учётные данные не передаются. */
interface StreamNotification {
  /** Вид уведомления, например OrderFilled. */
  kind: string;
  severity: "Info" | "Success" | "Warning" | "Error";
  message: string;
  symbol: string | null;
  connectionId: string | null;
  connectionLabel: string | null;
}

/** Один ценовой алерт, как его несёт канал signalLevels (что случилось — в frame.event). */
interface SignalLevel {
  id: string;
  exchange: string;
  symbol: string;
  price: string;
  direction: "Above" | "Below" | "Cross";
  note: string | null;
  /** true — удаляется после срабатывания; иначе остаётся с isTriggered до clearTriggered(). */
  oneShot: boolean;
  createdMs: number;
  isTriggered: boolean;
  triggeredMs: number | null;
}
```
