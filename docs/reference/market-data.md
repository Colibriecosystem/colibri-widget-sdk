# Рыночные данные: markets и stream

> English version — [market-data.en.md](market-data.en.md).

Здесь две части API: `markets` отдаёт снимок по запросу, `stream` присылает живые кадры, пока вы
подписаны. Каналы счёта (`positions`, `orders`, `balance`) описаны в
[account-and-trading.md](account-and-trading.md#channel-positions), уведомления и ценовые алерты — в
[notifications.md](notifications.md#channel-notifications).

Каждое число на проводе — десятичная строка (`"64950.10"`): так не теряется точность тика. Переводите
в число там, где считаете. Время — unix-миллисекунды в полях `…Ms`.

## <a id="market-data-sources"></a>Откуда берутся рыночные данные

Прочтите это до того, как писать скринер.

**Рыночные данные — забота вашего виджета.** `markets.*` и рыночные каналы отдают то, что держит
открытым терминал: символ живёт, пока его удерживает панель или вызывающая сторона, и отпускается,
когда больше не нужен. По устройству это привязано к панелям, и на скан всей биржи оно не отвечает.
Для того, чем оно является, всё поддерживается полностью: стакан, который пользователь и так смотрит,
каталог площадок, история кластеров. Пользуйтесь, но не стройте на этом основную функцию виджета.

Для сканирования, скрининга и любых данных, которых у терминала нет, подключайтесь к бирже сами.
Перечислите хосты в [`egress`](manifest.md#manifest-egress) манифеста и открывайте свои WebSocket'ы
прямо со страницы — но только к этим хостам. Терминал отдаёт ваш документ с
`Content-Security-Policy: connect-src`, собранным из списка, поэтому сокет к необъявленному хосту
бросает `SecurityError` уже при создании. Заблокированный хост терминал считает и пишет в лог — это
видно в отчёте F12: туда и смотрите, если поток «молча» не открывается. Хост без порта покрывает
любой порт; `ws.okx.com:8443` — только 8443.

С REST сложнее: **KuCoin и Kraken Futures не отдают CORS-заголовки вообще**, и прочитать их со
страницы нельзя никак. Такой запрос выполняет терминал — [`net.fetch`](storage-and-net.md#net-fetch),
по тем доменам, которые пользователь видел при установке:

```js
import { net } from "./colibri.js";

const r = await net.fetch("https://futures.kraken.com/derivatives/api/v3/tickers");
if (!r.ok) throw new Error(r.code);          // egress_denied · rate_limited · net_timeout · …
const tickers = JSON.parse(r.body).tickers;  // body — это ТЕКСТ, разбираете вы
```

Только `https`, только GET и POST, хост должен быть в `egress`, редиректы не выполняются, у каждого
экземпляра свой лимит частоты. Все правила — в [storage-and-net.md](storage-and-net.md#net-fetch),
готовый рецепт — в [recipes.md](../recipes.md#outside-data).

Живые примеры обоих подходов лежат в `examples/`:
[«Радар ликвидаций»](../../examples/liquidation-radar/) берёт биржевые WebSocket'ы напрямую,
[«Фандинг-монитор»](../../examples/funding-monitor/) ходит в REST через терминал.

## <a id="markets"></a>markets

Снимки по запросу. Для того, что меняется, подписывайтесь на [поток](#stream): опрос быстро
съедает лимит в 300 вызовов моста в минуту на виджет, а подписка его не тратит.

```js
import { markets } from "./colibri.js";

const book = await markets.book("BinanceSpot", "BTCUSDT", { depth: 20 });
const spread = Number(book.bestAsk) - Number(book.bestBid);
```

### <a id="markets-exchanges"></a>`markets.exchanges()`

```ts decl
exchanges(): Promise<unknown>;
```

Разрешение: `marketData`.

Каталог площадок, которые знает терминал: `{ exchanges: [{ id, name, marketType, trading }] }`.
`id` — ровно та строка, которую принимает каждый параметр `exchange` (`BinanceSpot`,
`BinanceLinearFutures`); `trading: false` помечает площадку, где есть только рыночные данные. Берите
id отсюда, а не из своего кода: набор площадок зависит от версии терминала у пользователя.

### <a id="markets-symbols"></a>`markets.symbols()`

```ts decl
symbols(exchange: string): Promise<unknown>;
```

Разрешение: `marketData`.

Все инструменты площадки: `{ exchange, symbols: [{ symbol, name, baseAsset, quoteAsset, tickSize,
stepSize }] }`. `symbol` — значение для каждого параметра `symbol`, `tickSize` и `stepSize` — шаг цены
и шаг количества. Неизвестная площадка — `400 bad_request`.

### <a id="markets-book"></a>`markets.book()`

```ts decl
book(exchange: string, symbol: string, params?: RequestOptions["params"]): Promise<Book>;
```

Разрешение: `marketData`.

Снимок стакана — [`Book`](#types). Уровни отсортированы от лучшей цены (asks по возрастанию, bids по
убыванию), у каждого — количество в монетах и объём в долларах. `params.depth` — уровней на сторону:
1–1000 (по умолчанию 50) или `"full"`; `full` ограничен 5000 уровнями, и если стакан длиннее, в ответе
появляется `truncated: true`. Первый запрос открывает символ в терминале: пока стакан не ожил, ответ —
`503 not_ready`, повторите через секунду. Живой стакан — канал [`book`](#channel-book).

### <a id="markets-clusters"></a>`markets.clusters()`

```ts decl
clusters(exchange: string, symbol: string, params?: RequestOptions["params"]): Promise<unknown>;
```

Разрешение: `marketData`.

Кластеры (футпринт): сырые 15-секундные корзины от старой к новой — `{ exchange, symbol, tickSize,
buckets }`. У корзины `startUnixSec` (в секундах, не в миллисекундах), итоги покупок и продаж в
долларах и в монетах и `levels` — те же суммы по каждой цене. `params.limit` — сколько последних
корзин: 1–17280 (весь буфер, 72 часа), по умолчанию 240 (последний час). Крупные таймфреймы собирайте
сами, складывая корзины. До первой сделки список пуст.

### <a id="markets-funding"></a>`markets.funding()`

```ts decl
funding(exchange: string, symbol: string): Promise<Funding>;
```

Разрешение: `marketData`.

Ставка финансирования бессрочного контракта — [`Funding`](#types): `rate` строкой (`"0.0001"` —
это 0,01 %) и время следующего расчёта. Спот и контракт, по которому ставку ещё не получили, отвечают
`404 unavailable`. Изменения ставки приходят в канал [`funding`](#channel-funding).

### <a id="markets-orderbook-settings"></a>`markets.orderbookSettings()`

```ts decl
orderbookSettings(exchange: string): Promise<unknown>;
```

Разрешение: `panels`.

Настройки стакана на уровне площадки, сведённые к действующим значениям — с ними откроется новая
панель этой площадки: `{ exchange, settings }`. В `settings` — единицы размера и объёма (`sizeUnit`,
`depthUnit`: `Usd` или `Base`), пороги ленты, подсветки и кластеров (`minTradeUsd`, `largeVolumeUsd`,
…), агрегация цены, видимость ленты и ликвидаций, процент безубыточного стопа и авто-OCO. Это
настройки пользователя, а не данные рынка, поэтому и разрешение — `panels`.

### <a id="markets-patch-orderbook-settings"></a>`markets.patchOrderbookSettings()`

```ts decl
patchOrderbookSettings(exchange: string, patch: unknown): Promise<unknown>;
```

Разрешение: `panels`.

Частичное изменение тех же настроек: меняются только переданные поля, ответ повторяет их. Ошибка в
любом поле отклоняет весь запрос до изменений (`400 bad_request`). Открытые панели площадки
подхватывают изменение сразу, как после сохранения в окне настроек. Это настройки всех панелей
пользователя на этой площадке — меняйте их только по его явному действию.

## <a id="stream"></a>stream

Живые каналы. Один вызов `subscribe` — одна подписка; кадры идут в обработчик, пока вы не
отпишетесь. Переподключаться не нужно: мост работает внутри процесса и «отвалиться» не может, а
подписки SDK восстанавливает сам — после того как пользователь снова включил мост (событие
[`bridge`](bridge.md#event-bridge)) и после [`streamReset`](bridge.md#event-stream-reset).

| Канал | Аргументы | Разрешение | Что приходит |
| --- | --- | --- | --- |
| [`book`](#channel-book) | `{ exchange, symbol, depth?, hz? }` | `marketData` | Полный снимок стакана, когда он изменился, не чаще `hz` раз в секунду |
| [`trades`](#channel-trades) | `{ exchange, symbol }` | `marketData` | Только новые сделки с прошлого кадра |
| [`funding`](#channel-funding) | `{ exchange, symbol }` | `marketData` | Ставка, когда она изменилась |
| [`positions`](account-and-trading.md#channel-positions), [`orders`](account-and-trading.md#channel-orders), [`balance`](account-and-trading.md#channel-balance) | `{ connectionId }` | `account:read` | Полный снимок, когда что-то изменилось |
| [`notifications`](notifications.md#channel-notifications) | нет | `notifications` | Уведомления терминала: сначала недавние, потом живые |
| [`signalLevels`](notifications.md#channel-signal-levels) | нет | `signalLevels` | События ценовых алертов: сначала текущий набор, потом живые |

Обратите внимание на разницу: `trades` присылает **приращение** — сделки с прошлого кадра, от старой
к новой, и ленту копите вы. Каналы счёта присылают **полное состояние** каждый раз — его вы просто
заменяете.

### <a id="stream-subscribe"></a>`stream.subscribe()`

```ts decl
subscribe<C extends Channel>(
  channel: C,
  args: Record<string, unknown> | undefined,
  handler: (data: ChannelData[C], frame: StreamFrame<ChannelData[C]>) => void,
): () => void;
```

Разрешение: своё у каждого канала, см. `CHANNEL_SCOPES`.

Возвращает функцию отписки — вызовите её, когда данные больше не нужны: сменился символ, закрылся
вид. Обработчик получает `data` кадра (тип по каналу — [`ChannelData`](#types)) и сам кадр.

- **Обработчик видит КАЖДЫЙ кадр своего канала**, а не только своей подписки. Подписались на два
  символа — оба придут в оба обработчика, поэтому проверяйте `data.symbol` (в каналах счёта —
  `data.connectionId`).
- **Подписка — это канал плюс его ключ** (`exchange` + `symbol` или `connectionId`). Вторая подписка
  с тем же ключом отклоняется, а отписка одной снимает его для всех обработчиков. Подписывайтесь один
  раз и раздавайте данные сами. `depth` и `hz` в ключ не входят: второй `book` того же символа с
  другой глубиной не применится.
- **Аргументы.** Рыночные каналы — `{ exchange, symbol }`, у `book` ещё `depth` и `hz`; каналы счёта
  — `{ connectionId }`; `notifications` и `signalLevels` — без аргументов (`undefined`).
- **Ошибки не бросаются.** Отказ приходит кадром `{ type: "error", data: { code, message } }`, и
  увидеть его можно только через [`onAny`](#stream-on-any): `unauthorized` — у виджета нет разрешения
  канала, `bad_request` — неизвестный канал, нет ключа или такая подписка уже есть, `rate_limited` —
  у экземпляра уже 64 подписки.
- Если страница не успевает читать, рыночные кадры и кадры счёта заменяются более свежими; уведомления
  и события алертов не теряются.

<!-- check: prelude declare function render(bid: string, ask: string): void; -->
```js
import { stream } from "./colibri.js";

const exchange = "BinanceSpot";
const symbol = "BTCUSDT";

const stop = stream.subscribe("book", { exchange, symbol, depth: 20, hz: 5 }, (book) => {
  if (book.exchange !== exchange || book.symbol !== symbol) return; // кадр другой вашей подписки
  render(book.bids[0]?.price, book.asks[0]?.price);
});

// Символ сменился или вид закрыт — отпишитесь.
stop();
```

### <a id="stream-on-any"></a>`stream.onAny()`

```ts decl
onAny(handler: (frame: StreamFrame) => void): () => void;
```

Разрешение: не нужно.

Каждый кадр потока: данные всех каналов, подтверждения (`subscribed`, `unsubscribed`) и ошибки.
Сам ни на что не подписывает. Нужен для отладки и для своего маршрутизатора кадров — и это
единственное место, где видны отказы в подписке. Возвращает функцию, которая снимает обработчик.

```js
import { stream } from "./colibri.js";

const off = stream.onAny((frame) => {
  if (frame.type === "error") console.warn("поток отказал:", frame.data);
});
```

## <a id="live-channels"></a>Каналы

### <a id="channel-book"></a>Канал `book`

Разрешение: `marketData`. Аргументы: `{ exchange, symbol, depth?, hz? }`.

Каждый кадр — **полный** снимок стакана, той же формы, что и [`markets.book()`](#markets-book):
[`Book`](#types), не разница с прошлым. Кадр приходит, только когда стакан изменился, и не чаще `hz`
раз в секунду: `hz` — 1–10, по умолчанию 10. `depth` — уровней на сторону, 1–1000, по умолчанию 50;
значение вне пределов терминал приводит к границе, а не отклоняет. Пока вы подписаны, терминал держит
символ открытым. Для виджета, которому нужна только цена, хватит `depth: 1` и `hz: 4`.

### <a id="channel-trades"></a>Канал `trades`

Разрешение: `marketData`. Аргументы: `{ exchange, symbol }`.

Кадр — [`TradesFrame`](#types): `{ exchange, symbol, trades }`. Это **приращение**: в `trades` только
сделки, пришедшие с прошлого кадра, от старой к новой. Истории при подписке нет — первый кадр несёт то,
что случилось после неё. Ленту, свечи и объёмы копите сами. Кадры идут пачками, до десяти в секунду;
ликвидации в этот канал не попадают. `isBuy: true` — агрессором был покупатель.

### <a id="channel-funding"></a>Канал `funding`

Разрешение: `marketData`. Аргументы: `{ exchange, symbol }`.

Кадр — [`Funding`](#types), той же формы, что и [`markets.funding()`](#markets-funding). Приходит,
когда ставка или время следующего расчёта изменились. Для спота и для контракта, по которому ставки
ещё нет, кадров не будет.

## <a id="types"></a>Типы

Каналы потока:

```ts decl
type Channel =
  | "book"
  | "trades"
  | "funding"
  | "positions"
  | "orders"
  | "balance"
  | "notifications"
  | "signalLevels";
```

Стакан. Каждое число — десятичная строка:

```ts decl
/** Один уровень стакана. */
interface BookLevel {
  price: string;
  /** Количество в монетах. */
  baseQty: string;
  /** Объём в долларах. */
  usdVolume: string;
}

/** markets.book() и кадр канала book: asks по возрастанию, bids по убыванию. */
interface Book {
  exchange: string;
  symbol: string;
  tickSize: string;
  /** "0" до первой сделки. */
  lastPrice: string;
  /** null, если сторона пуста. */
  bestBid: string | null;
  bestAsk: string | null;
  bids: BookLevel[];
  asks: BookLevel[];
}
```

Сделки и финансирование:

```ts decl
/** Одна сделка. */
interface Trade {
  price: string;
  /** Количество в монетах. */
  qty: string;
  /** true — агрессором был покупатель. */
  isBuy: boolean;
  /** Время биржи, unix-миллисекунды. */
  timeMs: number;
}

/** Кадр канала trades: сделки с прошлого кадра, от старой к новой. */
interface TradesFrame {
  exchange: string;
  symbol: string;
  trades: Trade[];
}

/** markets.funding() и кадр канала funding. */
interface Funding {
  exchange: string;
  symbol: string;
  /** "0.0001" — это 0,01 %. */
  rate: string;
  /** Следующий расчёт, unix-миллисекунды. */
  nextFundingTimeMs: number;
}
```

Что приходит в обработчик и как выглядит кадр:

```ts decl
/** Канал → data его кадров. */
interface ChannelData {
  book: Book;
  trades: TradesFrame;
  funding: Funding;
  positions: PositionsData;
  orders: OrdersData;
  balance: BalanceData;
  notifications: StreamNotification;
  signalLevels: SignalLevel;
}

/** Кадр потока как он есть: данные, подтверждения и ошибки. */
interface StreamFrame<T = unknown> {
  type: string;
  data: T;
  /** Только signalLevels: placed | removed | triggered. */
  event?: string;
  /** Номер запроса, который повторяют подтверждение и ошибка. */
  id?: string | null;
}
```

`PositionsData`, `OrdersData` и `BalanceData` описаны в
[account-and-trading.md](account-and-trading.md#types), `StreamNotification` и `SignalLevel` — в
[notifications.md](notifications.md#types).
