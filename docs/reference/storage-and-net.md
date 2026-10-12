# Хранилище и сеть: storage и net

> English version — [storage-and-net.en.md](storage-and-net.en.md).

`storage` — долговременное хранилище ключ-значение, которое держит терминал. `net.fetch` — запрос к
бирже, который выполняет терминал от имени виджета, когда страница сама его сделать не может.

## <a id="storage"></a>storage

Хранилище своё у каждого экземпляра виджета: ключи живут в пространстве `handshake().instanceId`, и
две копии виджета в двух слотах не видят ключей друг друга. Данные переживают перезагрузку страницы,
перезапуск терминала и обновление виджета и стираются, когда виджет удаляют.

- **Квота — 5 МБ на виджет**, на все его экземпляры вместе. Запись сверх неё отклоняется с кодом
  `quota_exceeded`, и хранилище остаётся ровно таким, каким было до неё.
- **Ключ** — непустая строка до 256 символов. **Значение** — строка: объект сохраняйте через
  `JSON.stringify`, читайте через `JSON.parse`.
- **Ошибки** — `ColibriError` со `status` 0 и кодом хоста: `unauthorized` — у виджета нет разрешения
  `storage`, `bad_request` — пустой или слишком длинный ключ, `quota_exceeded`, `bridge_disabled` —
  пользователь выключил мост, `internal` — не удалось записать на диск.

Предпочитайте его `localStorage`. `localStorage` общий для всех экземпляров виджета (у виджета один
origin), и терминал за его сохранность не отвечает: это кэш браузера. Он годится для мелочей, но не
для того, что пользователю было бы обидно настраивать заново. Рецепт — в
[recipes.md](../recipes.md#save-settings).

```js
import { storage } from "./colibri.js";

const defaults = { exchange: "BinanceSpot", symbol: "BTCUSDT" };
const saved = await storage.get("market");
const market = saved ? JSON.parse(saved) : defaults;

// Пользователь выбрал другой символ — запомните.
market.symbol = "ETHUSDT";
await storage.set("market", JSON.stringify(market));
```

### <a id="storage-get"></a>`storage.get()`

```ts decl
get(key: string): Promise<string | null>;
```

Разрешение: `storage`.

Значение ключа или `null`, если такого ключа у экземпляра нет. При первом запуске экземпляра
хранилище пусто — держите значения по умолчанию в коде.

### <a id="storage-set"></a>`storage.set()`

```ts decl
set(key: string, value: string): Promise<void>;
```

Разрешение: `storage`.

Записать значение, заменив прежнее. Квота проверяется до записи: отказ `quota_exceeded` ничего не
меняет ни на диске, ни в памяти. Не пишите на каждое движение мыши — пишите, когда пользователь
закончил менять.

### <a id="storage-remove"></a>`storage.remove()`

```ts decl
remove(key: string): Promise<void>;
```

Разрешение: `storage`.

Удалить ключ. Удаление несуществующего ключа — не ошибка.

### <a id="storage-keys"></a>`storage.keys()`

```ts decl
keys(): Promise<string[]>;
```

Разрешение: `storage`.

Все ключи этого экземпляра — без служебного префикса, ровно в том виде, в каком вы их записали.
Ключей других экземпляров здесь нет.

### <a id="storage-clear"></a>`storage.clear()`

```ts decl
clear(): Promise<void>;
```

Разрешение: `storage`.

Удалить все ключи этого экземпляра. Другие экземпляры виджета не затрагиваются — например, для кнопки
«сбросить настройки».

## <a id="net"></a>net

Рыночные данные — забота виджета ([почему](market-data.md#market-data-sources)), и биржевые
WebSocket'ы работают прямо со страницы. С REST иначе: многие биржи не отдают CORS-заголовков вообще
(среди них KuCoin и Kraken Futures), и никакой код на странице этого не обойдёт. `net.fetch` — выход:
запрос выполняет терминал, и CORS тут ни при чём.

### <a id="net-fetch"></a>`net.fetch()`

```ts decl
fetch(url: string, init?: { method?: "GET" | "POST"; body?: string; contentType?: string }): Promise<NetFetchResult>;
```

Разрешение: `egress`.

Это не разрешение из `permissions`, а список [`egress`](manifest.md#manifest-egress) манифеста плюс
согласие пользователя: хост должен быть **и** объявлен в манифесте текущей версии, **и** разрешён
пользователем. Хост, который вы убрали из манифеста, недоступен, даже если пользователь когда-то его
разрешил.

Правила, о которые спотыкаются чаще всего:

- **Только `https`, только GET и POST.** Адрес — абсолютный; логин и пароль в адресе отклоняются.
- **Хост не из `egress`** — `egress_denied`. Запись без порта покрывает любой порт, с портом — только
  его; `*.example.com` покрывает поддомены, но не сам `example.com`.
- **Редиректы не выполняются**: 3xx возвращается вам как есть. Список разрешённых хостов, который
  проверяет только первый переход, ничего не разрешает.
- **Лимит — 60 запросов в минуту на экземпляр**, дальше `rate_limited`. Тело запроса — до 256 КБ, ответ —
  до 8 МБ (`net_too_large`), ожидание — до 15 секунд (`net_timeout`). Сетевой сбой — `net_failed`.
- **Тело ответа — ТЕКСТ.** Терминал не разбирает ответ биржи: `JSON.parse` — ваш. Если вы передали
  `body` без `contentType`, запрос уходит как `application/json`.
- Куки не передаются; запрос уходит с компьютера тем же путём, что и собственный трафик страницы.

Вызов не бросает исключений на эти случаи: он возвращает [`NetFetchResult`](#types) с `ok: false` и
кодом в `code`. `ok: true` значит, что биржа ответила, — но, возможно, ошибкой: смотрите `status`.
Выключенный мост — `ok: false` и `bridge_disabled`.

WebSocket'ы `net.fetch` не нужен: открывайте их со страницы. Терминал отдаёт документ с
`Content-Security-Policy: connect-src`, собранным из `'self'` и каждого хоста `egress` (в виде
`https://` и `wss://`), поэтому сокет к необъявленному хосту бросает `SecurityError` уже при создании.
Готовый рецепт — в [recipes.md](../recipes.md#outside-data).

```js
import { net } from "./colibri.js";

const r = await net.fetch("https://api.kucoin.com/api/v1/market/allTickers");
if (!r.ok) throw new Error(`терминал не выполнил запрос: ${r.code}`);
if (r.status !== 200) throw new Error(`биржа ответила ${r.status}`);
const tickers = JSON.parse(r.body).data.ticker;

const p = await net.fetch("https://api.example-venue.com/v1/quote", {
  method: "POST",
  body: JSON.stringify({ symbols: ["BTCUSDT"] }),
});
```

## <a id="types"></a>Типы

```ts decl
/** Ответ net.fetch. ok: false — до биржи запрос не дошёл или ответ не принят. */
interface NetFetchResult {
  ok: boolean;
  /** HTTP-статус биржи или 0, если до неё не дошло. */
  status: number;
  /** ТЕКСТ ответа — терминал его не разбирает. */
  body: string | null;
  contentType?: string;
  /** egress_denied | rate_limited | net_failed | net_timeout | net_too_large | bad_request. */
  code?: string;
  message?: string;
}
```
