# Счёт и торговля: connections и trading

> English version — [account-and-trading.en.md](account-and-trading.en.md).

Ради этого SDK и нужен: таких данных нет ни у кого, кроме терминала. `connections` читает счета
пользователя — подключения к биржам, позиции, рабочие ордера, балансы, историю закрытых сделок.
`trading` ставит и снимает ордера через эти подключения. Ключи бирж мост не пересекает никогда:
виджет видит id подключения, площадку и флаги, но не учётные данные.

Числа на проводе — десятичные строки, время — unix-миллисекунды.

## <a id="connections"></a>connections

Чтение счёта. Оно ничего не двигает, но раскрывает размеры, PnL и балансы — поэтому это отдельное
разрешение `account:read`, и пользователь видит его отдельной строкой при установке. Если виджет
просит и `account:read`, и адреса в `egress`, окно установки требует ещё одного подтверждения: данные
счёта плюс сеть — это то, что можно унести с компьютера.

Для того, что меняется, подписывайтесь на [каналы счёта](#live-channels): они присылают то же самое,
что и эти вызовы, но сами и сразу.

```js
import { connections } from "./colibri.js";

const { connections: list } = await connections.list();
const account = list.find((c) => !c.viewOnly);  // подключение с ключами
const { positions } = await connections.positions(account.id);
```

### <a id="connections-list"></a>`connections.list()`

```ts decl
list(): Promise<{ connections: Connection[] }>;
```

Разрешение: `account:read`.

Все подключения пользователя — [`Connection`](#types). `id` — ключ для всех остальных вызовов и для
каналов счёта. `viewOnly: true` — ключей нет или торговля в подключении выключена: по нему видны
только данные. `demo: true` — демо-счёт или тестовая сеть биржи; если ваш виджет торгует, предлагайте
его первым.

### <a id="connections-get"></a>`connections.get()`

```ts decl
get(id: string): Promise<Connection>;
```

Разрешение: `account:read`.

Одно подключение. Нет такого — `404 unknown_connection`: пользователь мог удалить подключение, пока
виджет хранил его id.

### <a id="connections-positions"></a>`connections.positions()`

```ts decl
positions(id: string): Promise<PositionsData>;
```

Разрешение: `account:read`.

Открытые позиции по всем символам подключения — [`PositionsData`](#types). `quantity` со знаком:
больше нуля — лонг. Живые позиции — канал [`positions`](#channel-positions).

### <a id="connections-orders"></a>`connections.orders()`

```ts decl
orders(id: string): Promise<OrdersData>;
```

Разрешение: `account:read`.

Рабочие ордера подключения, обычные и триггерные, — [`OrdersData`](#types). `clientOrderId` —
то, чем ордер снимают через [`trading.cancel()`](#trading-cancel). Живой список — канал
[`orders`](#channel-orders).

### <a id="connections-balances"></a>`connections.balances()`

```ts decl
balances(id: string): Promise<BalanceData>;
```

Разрешение: `account:read`.

Балансы по активам — [`BalanceData`](#types): `free` — свободно, `locked` — зарезервировано под
ордера. Живые балансы — канал [`balance`](#channel-balance).

### <a id="connections-trades"></a>`connections.trades()`

```ts decl
trades(
  id: string,
  params?: { page?: number; pageSize?: number; symbol?: string; fromMs?: number; toMs?: number },
): Promise<unknown>;
```

Разрешение: `account:read`.

История закрытых сделок — собственная запись терминала, у биржи её в таком виде нет. Новые сначала:
`{ connectionId, trades, page, pageSize, totalCount, totalPages }`. В строке — `id`, сторона (`Long`
или `Short`), цены входа и выхода, количество, оборот, `netPnl`, `pnlPercent`, комиссия, фандинг и
время открытия и закрытия. `page` считается с 1, `pageSize` — 1–500 (по умолчанию 100). `fromMs` и
`toMs` ограничивают время закрытия полуинтервалом `[fromMs, toMs)`, так что соседние окна не
считают сделку на стыке дважды. Строка может уточниться после записи: сначала терминал считает её сам,
потом переписывает цифрами биржи — перечитывайте, а не кэшируйте навсегда.

### <a id="connections-trade"></a>`connections.trade()`

```ts decl
trade(id: string, tradeId: number | string): Promise<unknown>;
```

Разрешение: `account:read`.

Одна закрытая сделка вместе с исполнениями: `{ connectionId, trade, fills }`, исполнения — от раннего
к позднему, у каждого цена, количество в монетах и в валюте котировки, комиссия, сторона, время и id
сделки на бирже. Несуществующая сделка и сделка другого подключения отвечают одинаково —
`404`: иначе ответ раскрывал бы, что есть за пределами этого подключения.

## <a id="trading"></a>trading

Ордера через подключение пользователя — тем же путём, что и клик в терминале, с теми же правилами
каждой биржи. Прежде чем писать торговый код, прочтите правила ниже: их соблюдает терминал, и обойти
их нельзя.

**Два ключа.** Нужно разрешение `trading` в манифесте **и** разрешение пользователя на конкретное
подключение для вашего виджета. Его дают в окне установки, в разделе «Торговые подключения»: там
отмечают счета, на которых виджет может торговать, и задают лимиты. Без отметки любой вызов
`trading.*` по этому подключению получает `403 trading_not_enabled`. Поле
[`Connection.apiTradingEnabled`](#types) говорит о другом разрешении — для внешних программ Local API
(«Настройки → Программа → Local API») — и разрешение вашего виджета не показывает.

**Лимиты.** У каждого разрешения на торговлю есть лимит на один ордер в долларах и на число ордеров в
минуту: по умолчанию 250 $ и 12 ордеров (числа — в
[CAPABILITIES.md](../../CAPABILITIES.md#жёсткие-границы)). Пользователь задаёт их в том же окне и
может снять совсем.
Ордер сверх лимита отклоняется `403 budget_exceeded` до того, как попадёт в очередь. Считаются только
новые ордера: отмены и закрытия лимиты не трогают — иначе лимит мог бы запереть пользователя в позиции.
Рыночный ордер в монетах (`sizeBase`) терминал оценивает по текущей цене; если цены ещё нет, ордер
отклоняется тем же кодом — указывайте `sizeQuote`.

**Ответ — это очередь, а не биржа.** Каждый вызов отвечает `{ status: "accepted" }` в тот момент, когда
команда поставлена в очередь. Ответ биржи приходит в канал [`orders`](#channel-orders) (для закрытия —
ещё и в [`positions`](#channel-positions)): следите за `clientOrderId` там. `503 not_ready` значит,
что подключение ещё прогревается, — повторите позже. Неизвестное подключение — `404 unknown_connection`.

**Только по клику.** Ставьте ордер только потому, что пользователь попросил об этом сейчас: нажал
кнопку и подтвердил. Никогда — при загрузке, по таймеру, из обработчика потока, из сохранённых
настроек или по клавише. Цену и объём не восстанавливайте из `storage`. Как это устроено целиком —
в [рецепте](../recipes.md#place-order-safely) и в шаблоне [`starters/trading`](../../starters/trading/).

<!-- check: prelude declare const confirmButton: HTMLButtonElement; declare const connectionId: string; declare const ticket: { symbol: string; price: string; size: string }; declare function showPending(clientOrderId: string): void; declare function showError(text: string): void; -->
```js
import { trading, ColibriError } from "./colibri.js";

// Единственное место, откуда уходит ордер: нажатие «Подтвердить».
confirmButton.addEventListener("click", async () => {
  try {
    const { clientOrderId } = await trading.place(connectionId, {
      symbol: ticket.symbol,
      side: "BUY",
      type: "Limit",
      price: ticket.price,
      sizeBase: ticket.size,
    });
    showPending(clientOrderId); // поставлен в очередь; ответ биржи придёт в канал orders
  } catch (e) {
    if (!(e instanceof ColibriError)) throw e;
    if (e.code === "budget_exceeded") showError(e.message);      // лимит, заданный пользователем
    else if (e.code === "trading_not_enabled") showError("Разрешите виджету торговлю на этом счёте.");
    else showError(e.message);
  }
});
```

### <a id="trading-place"></a>`trading.place()`

```ts decl
place(id: string, order: PlaceOrder): Promise<PlaceOrderAccepted>;
```

Разрешение: `trading`.

Лимитный или рыночный ордер — [`PlaceOrder`](#types). Размер — ровно одно из двух: `sizeQuote`
(«потратить 100 USDT») или `sizeBase` («0.01 монеты»). `price` обязательна для `Limit` и запрещена
для `Market`. `reduceOnly` на фьючерсах — ордер, который только уменьшает позицию. Неверная форма —
`400 bad_request`. Ответ — [`PlaceOrderAccepted`](#types): `clientOrderId` нового ордера, по нему его
и снимают.

### <a id="trading-cancel"></a>`trading.cancel()`

```ts decl
cancel(id: string, clientOrderId: string, symbol: string): Promise<{ status: "accepted" }>;
```

Разрешение: `trading`.

Снять один ордер по `clientOrderId` — тому, что вернул `place()` или что видно в
[`connections.orders()`](#connections-orders). `symbol` обязателен: по нему отмена уходит на биржу.
Ордер пропадёт из канала [`orders`](#channel-orders), когда биржа подтвердит отмену.

### <a id="trading-cancel-all"></a>`trading.cancelAll()`

```ts decl
cancelAll(id: string, params?: { symbol?: string }): Promise<{ status: "accepted" }>;
```

Разрешение: `trading`.

Снять рабочие ордера подключения: с `{ symbol }` — только этого символа, **без него — по ВСЕМ
символам счёта**, обычные и триггерные. Позиции не трогает. Пропущенный `symbol` — это не «текущий
символ», а весь счёт: передавайте его явно, если имели в виду один.

### <a id="trading-close-positions"></a>`trading.closePositions()`

```ts decl
closePositions(id: string): Promise<{ status: "accepted" }>;
```

Разрешение: `trading`.

Закрыть **все** открытые позиции подключения **по рынку** и снять оставшиеся ордера — то же, что
горячая клавиша «закрыть всё», но для одного счёта. Рыночное закрытие идёт с проскальзыванием, а
затронет оно все символы. Вызывайте только по явной команде пользователя и с подтверждением, где
сказано, что закроется всё.

## <a id="live-channels"></a>Каналы счёта

Три канала, все с аргументами `{ connectionId }` и разрешением `account:read`. Каждый кадр — **полное**
состояние, той же формы, что ответ соответствующего вызова: старое просто заменяйте новым. Кадр
приходит, когда что-то изменилось. Обработчик видит кадры всех ваших подписок на канал, поэтому
сверяйте `data.connectionId`. Как подписываться — в [`stream.subscribe()`](market-data.md#stream-subscribe).

```js
import { connections, stream } from "./colibri.js";

const connectionId = (await connections.list()).connections[0].id;
let orders = (await connections.orders(connectionId)).orders;

const stop = stream.subscribe("orders", { connectionId }, (data) => {
  if (data.connectionId !== connectionId) return;
  orders = data.orders; // полный список, а не изменения
});
```

### <a id="channel-positions"></a>Канал `positions`

Разрешение: `account:read`. Аргументы: `{ connectionId }`.

Кадр — [`PositionsData`](#types): все открытые позиции подключения. Пустой список — позиций нет.
Сюда же приходит результат [`trading.closePositions()`](#trading-close-positions).

### <a id="channel-orders"></a>Канал `orders`

Разрешение: `account:read`. Аргументы: `{ connectionId }`.

Кадр — [`OrdersData`](#types): все рабочие ордера подключения. Здесь появляется ордер, принятый
[`trading.place()`](#trading-place), — ищите его `clientOrderId`, — и здесь видно его состояние
(`status`, `filledQuantity`). Ордер, пропавший из списка, больше не работает: он исполнен или снят.

### <a id="channel-balance"></a>Канал `balance`

Разрешение: `account:read`. Аргументы: `{ connectionId }`.

Кадр — [`BalanceData`](#types): все балансы подключения, свободные и зарезервированные.

## <a id="types"></a>Типы

Подключение и то, что на нём лежит:

```ts decl
/** Одно подключение (счёт на бирже). Учётные данные не передаются никогда. */
interface Connection {
  id: string;
  /** Площадка — тот же id, что в markets.exchanges(). */
  exchange: string;
  marketType: string;
  /** Имя, которое дал пользователь; может быть пустым. */
  label: string;
  /** Демо-счёт или тестовая сеть. */
  demo: boolean;
  /** Нет ключей или торговля выключена — только данные. */
  viewOnly: boolean;
  /** Разрешение на торговлю для внешних программ Local API, не для виджета. */
  apiTradingEnabled: boolean;
}

interface Position {
  symbol: string;
  exchange: string;
  /** LONG | SHORT. */
  side: string;
  /** Количество в монетах СО ЗНАКОМ: больше нуля — лонг. */
  quantity: string;
  entryPrice: string;
}

/** Один рабочий ордер. */
interface Order {
  /** То, чем ордер снимают, — id, который вернул trading.place. */
  clientOrderId: string;
  /** Id на бирже, когда она подтвердила ордер. */
  exchangeOrderId: string | null;
  symbol: string;
  exchange: string;
  /** BUY | SELL. */
  side: string;
  /** Limit, Market, StopLoss, … */
  type: string;
  /** New, PartiallyFilled, … */
  status: string;
  price: string;
  quantity: string;
  filledQuantity: string;
}

interface Balance {
  asset: string;
  free: string;
  locked: string;
}
```

Ответы и кадры каналов — всегда полный набор:

```ts decl
/** connections.positions() и кадр канала positions. */
interface PositionsData {
  connectionId: string;
  positions: Position[];
}

/** connections.orders() и кадр канала orders. */
interface OrdersData {
  connectionId: string;
  orders: Order[];
}

/** connections.balances() и кадр канала balance. */
interface BalanceData {
  connectionId: string;
  balances: Balance[];
}
```

Ордер и ответ на него:

```ts decl
/** trading.place: ровно одно из sizeQuote / sizeBase; price — только и обязательно для Limit. */
interface PlaceOrder {
  symbol: string;
  side: "BUY" | "SELL";
  type: "Limit" | "Market";
  /** Десятичная строка. Обязательна для Limit, запрещена для Market. */
  price?: string;
  /** Потратить столько в валюте котировки ("100" USDT). */
  sizeQuote?: string;
  /** Купить или продать столько монет. */
  sizeBase?: string;
  /** Фьючерсы: ордер только уменьшает позицию. */
  reduceOnly?: boolean;
}

/** Ордер поставлен в ОЧЕРЕДЬ, а не исполнен: следите за clientOrderId в канале orders. */
interface PlaceOrderAccepted {
  clientOrderId: string;
  status: "accepted";
}
```
