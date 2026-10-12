# Рецепты

> English version — [recipes.en.md](recipes.en.md).

Короткие ответы на частые задачи. В каждом рецепте — цель, нужное разрешение, код, на чём
спотыкаются и где читать дальше. Код — модуль страницы, `colibri.js` лежит рядом с ней, как в
[шаблонах](../starters/). Каждый вызов подробно описан в [справочнике](reference/README.md).

| Задача | Разрешение |
| --- | --- |
| [Стакан: сразу и вживую](#order-book) | `marketData` |
| [Лента сделок](#last-trades) | `marketData` |
| [Позиции и баланс счёта](#positions-and-balance) | `account:read` |
| [Заявка, которая не уйдёт сама](#place-order-safely) | `trading`, `account:read` |
| [Цвета терминала](#follow-theme) | не нужно |
| [Язык терминала](#follow-language) | не нужно |
| [Настройки, которые переживут перезапуск](#save-settings) | `storage` |
| [Данные с других бирж](#outside-data) | хосты в `egress` |
| [Разрешение отозвали на ходу](#revoked-scope) | любое |
| [Пользователь выключил API](#bridge-off) | не нужно |
| [Где мой слот и кто рядом](#find-my-box) | `panels` |

## <a id="order-book"></a>Стакан: сразу и вживую

Показать стакан сразу, а дальше держать его живым. Разрешение: `marketData`.

```js
import { markets, stream } from "./colibri.js";

const exchange = "BinanceSpot";
const symbol = "BTCUSDT";
const $ = (id) => document.getElementById(id);

function paint(book) {
  if (book.exchange !== exchange || book.symbol !== symbol) return; // кадр чужой подписки
  const bid = book.bids[0];
  const ask = book.asks[0];
  // Цены и объёмы — строки. Показывайте их как есть, в число переводите только для арифметики.
  $("bid").textContent = bid ? `${bid.price} × ${bid.baseQty}` : "—";
  $("ask").textContent = ask ? `${ask.price} × ${ask.baseQty}` : "—";
  const tick = Number(book.tickSize);
  const spread = bid && ask ? Math.round((Number(ask.price) - Number(bid.price)) / tick) : null;
  $("spread").textContent = spread === null ? "—" : `${spread} тик.`;
}

// Первая отрисовка — сразу. Пока у терминала нет стакана, ответ — not_ready, и его догонит поток.
markets.book(exchange, symbol, { depth: 20 }).then(paint).catch(() => {});

// Дальше — живые снимки: 20 уровней на сторону, не чаще 4 раз в секунду.
const stop = stream.subscribe("book", { exchange, symbol, depth: 20, hz: 4 }, paint);
// stop() — когда стакан больше не нужен: подписка держит символ открытым у терминала.
```

На чём спотыкаются:

- **Кадр `book` — полный снимок, а не разница.** Заменяйте им прежний стакан целиком.
- **Числа — десятичные строки.** `"64012.50"` и `"64012.5"` — одна цена: сравнивайте после
  `Number()`, а показывайте строку, в ней столько знаков, сколько дала биржа.
- **Обработчик видит все кадры канала.** Подписались на два символа — оба придут в оба обработчика,
  поэтому `paint` первым делом сверяет `exchange` и `symbol`. `depth` — от 1 до 1000, `hz` — от 1
  до 10, большее значение урезается.

Справочник: [`markets.book()`](reference/market-data.md#markets-book),
[`stream.subscribe()`](reference/market-data.md#stream-subscribe),
[канал `book`](reference/market-data.md#channel-book). Пример:
[шаблон «Простой»](../starters/plain/), [торговый шаблон](../starters/trading/).

## <a id="last-trades"></a>Лента сделок

Показать последние сделки по символу. Разрешение: `marketData`.

```js
import { stream } from "./colibri.js";

const exchange = "BinanceSpot";
const symbol = "BTCUSDT";
const KEEP = 200; // сколько последних сделок держать
const tape = []; // своё кольцо: старые в начале, новые в конце

stream.subscribe("trades", { exchange, symbol }, (frame) => {
  if (frame.exchange !== exchange || frame.symbol !== symbol) return;
  // В кадре — только сделки с прошлого кадра, старые первыми. Это прирост, а не снимок.
  tape.push(...frame.trades);
  if (tape.length > KEEP) tape.splice(0, tape.length - KEEP);
  schedule();
});

// Кадры идут чаще, чем стоит перерисовывать: не больше одной отрисовки на кадр экрана.
let queued = false;
function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    const rows = tape.slice(-30).reverse().map((t) => {
      const time = new Date(t.timeMs).toLocaleTimeString();
      const side = t.isBuy ? "buy" : "sell";
      return `<tr class="${side}"><td>${time}</td><td>${t.price}</td><td>${t.qty}</td></tr>`;
    });
    document.getElementById("tape").innerHTML = rows.join("");
  });
}
```

На чём спотыкаются:

- **Кадр — прирост.** Таблица, перерисованная из одного кадра, покажет одну-две строки: копите
  сделки у себя и обрезайте буфер сами.
- **Истории у потока нет.** Лента начинается с момента подписки. Объёмы по ценам за прошедшие часы
  отдаёт [`markets.clusters()`](reference/market-data.md#markets-clusters).
- **`isBuy` — сторона агрессора:** `true` — покупатель ударил по аску. Некоторые биржи присылают
  по сделке на каждое исполнение, поэтому кадров бывает много — рисуйте не чаще кадра экрана.

Справочник: [канал `trades`](reference/market-data.md#channel-trades),
[`stream.subscribe()`](reference/market-data.md#stream-subscribe). Пример:
[шаблон «График»](../starters/chart/) строит свечи из этой ленты.

## <a id="positions-and-balance"></a>Позиции и баланс счёта

Показать позиции и балансы одного подключения и держать их живыми. Разрешение: `account:read`.

```js
import { connections, hasScope, stream } from "./colibri.js";

const $ = (id) => document.getElementById(id);
const state = { positions: null, balances: null };
const set = (key, value) => { state[key] = value; render(); };

function follow(id) {
  // Сначала подписка, потом снимок: так снимок не перетрёт более свежий кадр потока.
  stream.subscribe("positions", { connectionId: id }, (d) => {
    if (d.connectionId === id) set("positions", d.positions);
  });
  stream.subscribe("balance", { connectionId: id }, (d) => {
    if (d.connectionId === id) set("balances", d.balances);
  });
  connections.positions(id).then((d) => state.positions ?? set("positions", d.positions));
  connections.balances(id).then((d) => state.balances ?? set("balances", d.balances));
}

function render() {
  // quantity — со знаком: плюс — лонг, минус — шорт.
  const open = (state.positions ?? []).map((p) => `${p.symbol} ${p.quantity} @ ${p.entryPrice}`);
  const assets = (state.balances ?? [])
    .filter((b) => Number(b.free) + Number(b.locked) > 0)
    .map((b) => `${b.asset} ${b.free} (+${b.locked} в заявках)`);
  $("positions").textContent = open.join("\n") || "позиций нет";
  $("balances").textContent = assets.join("\n");
}

if (!hasScope("account:read")) {
  $("positions").textContent = "Виджету не выдано разрешение видеть счёт.";
} else {
  // Подключение выбирает пользователь; для краткости здесь — первое из списка.
  const { connections: list } = await connections.list();
  if (list.length > 0) follow(list[0].id);
  else $("positions").textContent = "Подключений нет: их добавляют в окне «Подключения».";
}
```

На чём спотыкаются:

- **Каждый кадр `positions` и `balance` — весь набор.** Заменяйте прежний список, а не дописывайте
  к нему. Пустой список значит «позиций нет», а не «ничего не изменилось».
- **Числа — строки**, `quantity` — со знаком. Складывайте после `Number()`.
- **Разрешение могут отозвать на ходу.** Без `account:read` вызовы отвечают `unauthorized`, а
  подписка получает отказ — см. [рецепт про отзыв](#revoked-scope).

Справочник: [`connections.list()`](reference/account-and-trading.md#connections-list),
[`connections.positions()`](reference/account-and-trading.md#connections-positions),
[`connections.balances()`](reference/account-and-trading.md#connections-balances),
[канал `positions`](reference/account-and-trading.md#channel-positions),
[канал `balance`](reference/account-and-trading.md#channel-balance). Пример:
[торговый шаблон](../starters/trading/).

## <a id="place-order-safely"></a>Заявка, которая не уйдёт сама

Дать пользователю поставить лимитную заявку так, чтобы она ушла только по его явному
подтверждению. Разрешения: `trading` — для заявки, `account:read` — для потока `orders`.

Это схема [торгового шаблона](../starters/trading/), сжатая до сути. Держите её и в своём виджете:

- **Сначала демо-подключение.** У живого — заметная полоса «LIVE — реальные деньги».
- **Только лимитная заявка** — ни рыночных, ни «снять все», ни «закрыть всё». В SDK эти массовые
  действия есть (`trading.cancelAll()`, `trading.closePositions()`); если они нужны вашему виджету,
  держите их за таким же подтверждением.
- **Цена и объём начинаются пустыми** и никогда не восстанавливаются из `storage`: перезапущенный
  виджет не может оказаться в одном клике от заявки, которую никто не набирал.
- **Шаг подтверждения показывает всё**: подключение, символ, сторону, цену, объём. Любая правка
  закрывает его — подтверждают ровно то, что уйдёт.
- **Отправляет только отдельная кнопка «Подтвердить»** — `<button type="button">` без `<form>`,
  так что Enter её не нажмёт. Никогда — при открытии, по таймеру, из обработчика потока, из
  сохранённых настроек или по клавише.

```html
<div id="live" hidden>LIVE — реальные деньги</div>
<input id="price" inputmode="decimal"> <input id="size" inputmode="decimal">
<button type="button" id="buy">Купить…</button>
<div id="confirm" hidden>
  <span id="summary"></span>
  <button type="button" id="confirm-do">Подтвердить</button>
  <button type="button" id="cancel">Отмена</button>
</div>
<div id="status"></div> <pre id="mine"></pre>
```

```js
import { connections, hasScope, stream, trading } from "./colibri.js";

const $ = (id) => document.getElementById(id);
const read = (id) => { const e = $(id); return e instanceof HTMLInputElement ? e.value : ""; };
const DECIMAL = /^\d+(\.\d+)?$/;
const REFUSED = {
  trading_not_enabled: "Виджету не дали торговать этим подключением: см. «Торговые подключения».",
  not_ready: "Подключение ещё не готово — повторите через пару секунд.",
  budget_exceeded: "Заявка больше лимита, который пользователь задал виджету.",
  rate_limited: "Слишком много запросов — подождите.",
};
const { connections: list } = await connections.list(); // демо-подключение — первым
const conn = list.find((c) => c.demo && !c.viewOnly) ?? list.find((c) => !c.viewOnly);
if (!conn) throw new Error("нет подключения, через которое можно торговать");
$("live").hidden = conn.demo; // у живого — полоса «LIVE — реальные деньги»

let pending = null; // «Купить…» ничего не отправляет: только показывает, что уйдёт
$("buy").addEventListener("click", () => {
  const price = read("price"), size = read("size");
  if (!hasScope("trading") || !DECIMAL.test(price) || !DECIMAL.test(size)) return;
  pending = { symbol: "BTCUSDT", side: "BUY", type: "Limit", price, sizeBase: size };
  $("summary").textContent = `${conn.label || conn.exchange}: купить ${size} BTCUSDT по ${price}`;
  $("confirm").hidden = false;
});
const close = () => { pending = null; $("confirm").hidden = true; };
for (const id of ["price", "size"]) $(id).addEventListener("input", close);
$("cancel").addEventListener("click", close);
const mine = new Set(); // «Подтвердить» — единственное место, откуда уходит заявка
$("confirm-do").addEventListener("click", async () => {
  const order = pending;
  close();
  if (!order) return;
  try { mine.add((await trading.place(conn.id, order)).clientOrderId); } // 202 — в очереди
  catch (e) { $("status").textContent = REFUSED[e.code] ?? e.message; } // по code, не по тексту
});
// Ответ биржи — в потоке orders, где только рабочие заявки; свою узнаёте по clientOrderId.
stream.subscribe("orders", { connectionId: conn.id }, (d) => {
  const own = d.orders.filter((o) => mine.has(o.clientOrderId));
  $("mine").textContent = own.map((o) => `${o.side} ${o.filledQuantity}/${o.quantity}`).join("\n");
});
```

На чём спотыкаются:

- **`202` — «в очереди», а не «исполнено».** Ответ биржи приходит в поток `orders`. Заявка, которая
  из него пропала, больше не работает: она исполнена, снята или отклонена. Исполнение видно по
  позициям.
- **Торговлю разрешают самому виджету, для каждого подключения отдельно** — в его разрешениях, в
  разделе «Торговые подключения», вместе с лимитами на заявку и на минуту. Заранее виджет этого не
  знает: `apiTradingEnabled` у подключения — про внешние программы, а не про виджеты. Узнаёт он по
  отказу `trading_not_enabled` (403) — тогда скажите пользователю, где это разрешить.
- **Остальные отказы — тоже по `code`, никогда по тексту.** `not_ready` (503) — подключение ещё не
  готово; `budget_exceeded` (403) — заявка больше лимита на заявку или на минуту, который
  пользователь задал виджету; `rate_limited` (429) — слишком много вызовов. Покажите это
  пользователю и не повторяйте в цикле.

Справочник: [`trading.place()`](reference/account-and-trading.md#trading-place),
[канал `orders`](reference/account-and-trading.md#channel-orders),
[`connections.list()`](reference/account-and-trading.md#connections-list),
[ошибки](reference/README.md#errors). Пример: [торговый шаблон](../starters/trading/),
файл `src/App.tsx`.

## <a id="follow-theme"></a>Цвета терминала

Выглядеть родным в любой теме пользователя, светлой или тёмной. Разрешение не нужно.

Терминал кладёт палитру в CSS-переменные на `<html>` до того, как выполнится код страницы, и
обновляет их при каждой смене темы, цветов, размера шрифта или языка. Берите **роли** —
`--colibri-role-*`; второе значение в `var()` нужно, только чтобы страница открывалась вне
терминала:

```css
body {
  background: var(--colibri-role-background, #0b0e13);
  color: var(--colibri-role-text, #d8dee9);
  font-size: calc(13px * var(--colibri-font-scale, 1));
}
.card  {
  background: var(--colibri-role-surface, #171b23);
  border: 1px solid var(--colibri-role-divider, #2a2f3a);
}
.muted { color: var(--colibri-role-dim-text, #8b93a3); }
.buy   { color: var(--colibri-role-bullish, #4caf50); }
.sell  { color: var(--colibri-role-bearish, #e05252); }
.link  { color: var(--colibri-role-accent, #4c8dff); }
:root[data-theme="light"] .logo { filter: invert(1); }
```

Код нужен только там, где `var()` не работает, — например, на canvas:

```js
import { on } from "./colibri.js";

function palette() {
  const css = getComputedStyle(document.documentElement);
  const pick = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return {
    up: pick("--colibri-role-bullish", "#26a17b"),
    down: pick("--colibri-role-bearish", "#e05260"),
    grid: pick("--colibri-role-divider", "#2a2f38"),
    scale: Number(pick("--colibri-font-scale", "1")) || 1,
  };
}

let colors = palette();
function redraw() {
  // … перерисовать canvas цветами colors
}

// Когда приходит событие, переменные на <html> уже новые.
on("theme", (e) => {
  colors = palette();
  console.log(`тема ${e.theme}, шрифт ×${e.fontScale}`);
  redraw();
});
```

На чём спотыкаются:

- **Отдельных переменных «покупка» и «продажа» нет.** Их цвета — роли `--colibri-role-bullish` и
  `--colibri-role-bearish`. Весь список ролей — в [справочнике по теме](reference/theme.md#roles).
- **`--colibri-<элемент>` — это части стакана терминала**, а не цвета интерфейса. Для своих кнопок,
  фона и текста берите роли: их всего десять, и они осмысленны в любой палитре.
- **Не зашивайте фон в код.** Пользователь может выбрать светлую тему; `data-theme` на `<html>`
  (`dark` или `light`) нужен только для того, что не выражается цветом, — например, картинок.

Справочник: [роли](reference/theme.md#roles), [атрибуты `<html>`](reference/theme.md#attributes),
[событие `theme`](reference/bridge.md#event-theme). Пример: все четыре
[шаблона](../starters/); [«График»](../starters/chart/) рисует на canvas.

## <a id="follow-language"></a>Язык терминала

Показывать текст на языке терминала и переключаться вместе с ним. Разрешение не нужно.

```html
<h1 data-t="title"></h1>
<p data-t="empty"></p>
```

```js
import { handshake, on } from "./colibri.js";

// Каждый ключ — в обеих таблицах.
const TEXT = {
  ru: { title: "Фандинг", empty: "Нет данных", updated: "Обновлено в {0}" },
  en: { title: "Funding", empty: "No data", updated: "Updated at {0}" },
};
const pickLang = (tag) => (tag === "ru" ? "ru" : "en"); // всё, кроме русского, — по-английски
let lang = pickLang(handshake().lang);
const t = (key, ...args) => TEXT[lang][key].replace(/\{(\d)\}/g, (_, i) => String(args[i]));

function paintLabels() {
  for (const el of document.querySelectorAll("[data-t]")) {
    el.textContent = t(el.getAttribute("data-t"));
  }
}

// Язык меняется на ходу, без перезагрузки виджета, — вместе с событием theme.
on("theme", (e) => {
  lang = pickLang(e.lang);
  paintLabels();
});
paintLabels();
console.log(t("updated", new Date().toLocaleTimeString(lang)));
```

На чём спотыкаются:

- **Отдельного события языка нет.** Новый язык приходит полем `lang` события `theme`;
  `handshake().lang` к этому моменту уже обновлён.
- **Язык — не только `ru` и `en`.** Выберите язык по умолчанию для всех остальных.
- **Для CSS язык есть и на `<html>`:** `data-colibri-lang`, например
  `:root[data-colibri-lang="ru"] .label { width: 9em; }`.

Справочник: [`handshake()`](reference/bridge.md#handshake),
[событие `theme`](reference/bridge.md#event-theme), [язык](reference/theme.md#language). Пример:
[шаблон «Простой»](../starters/plain/) — таблица в странице;
[торговый шаблон](../starters/trading/) — `src/i18n.ts`.

## <a id="save-settings"></a>Настройки, которые переживут перезапуск

Запомнить выбор пользователя: биржу, символ, порог. Разрешение: `storage`.

```js
import { storage } from "./colibri.js";

// В storage лежат строки: объект — через JSON.
const DEFAULTS = { exchange: "BinanceSpot", symbol: "BTCUSDT", alertAbove: "" };

async function load() {
  try {
    const raw = await storage.get("settings");
    return { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULTS }; // нет разрешения или запись испорчена — работаем на умолчаниях
  }
}

async function save(settings) {
  try {
    await storage.set("settings", JSON.stringify(settings));
  } catch (e) {
    console.warn("настройки не сохранились:", e.code ?? e);
  }
}

let settings = await load();
// … пользователь выбрал другой символ:
settings = { ...settings, symbol: "ETHUSDT" };
await save(settings);
```

На чём спотыкаются:

- **Хранилище своё у каждого экземпляра.** Два экземпляра одного виджета не видят ключей друг
  друга. Оно переживает перезапуск и обновление виджета и стирается, когда виджет удаляют.
- **Состояние в памяти не переживает перезагрузку**, а при разработке виджет перезагружается на
  каждое сохранение файла. Всё, что пользователю было бы обидно вводить заново, — в `storage`, а не
  в `localStorage`: тот один на все экземпляры виджета, потому что origin у них общий.
- **Заявки не восстанавливаются.** Подключение и символ сохранять можно, цену и объём заявки —
  нельзя: см. [безопасную заявку](#place-order-safely).

Справочник: [`storage.get()`](reference/storage-and-net.md#storage-get),
[`storage.set()`](reference/storage-and-net.md#storage-set). Пример:
[шаблон «Простой»](../starters/plain/) хранит биржу и символ,
[торговый](../starters/trading/) — подключение и символ.

## <a id="outside-data"></a>Данные с других бирж

Брать данные, которых у терминала нет: другая биржа, весь рынок, фандинг по шести площадкам.
Разрешение не нужно — нужны хосты в `egress` манифеста.

`markets.*` отдаёт то, что открыто у самого терминала: символ держится, пока его держит панель или
подписка. Скан всей биржи на этом не построить — подключайтесь к бирже сами. Пользователь видит
список `egress` при установке:

```json
{
  "egress": ["futures.kraken.com", "fstream.binance.com"]
}
```

```js
import { net } from "./colibri.js";

// REST — через терминал: у Kraken Futures нет CORS-заголовков, обычный fetch() не пройдёт.
async function venueJson(url) {
  const r = await net.fetch(url);
  if (!r.ok) throw new Error(r.code); // не дошли до биржи: egress_denied, rate_limited, …
  if (r.status >= 300) throw new Error(`HTTP ${r.status}`); // дошли, но биржа ответила ошибкой
  return JSON.parse(r.body); // body — текст: разбираете вы
}
const { tickers } = await venueJson("https://futures.kraken.com/derivatives/api/v3/tickers");
console.log(`тикеров: ${tickers.length}`);

// WebSocket — прямо из страницы, но только к хосту из egress.
const ws = new WebSocket("wss://fstream.binance.com/stream?streams=!forceOrder@arr");
ws.onmessage = (m) => console.log(JSON.parse(m.data)); // ликвидации по всему рынку
```

На чём спотыкаются:

- **Сокет к хосту не из `egress` падает сразу**, с `SecurityError`: терминал отдаёт страницу с
  `Content-Security-Policy: connect-src`, собранным из этого списка. Заблокированный хост виден в
  отчёте F12. Хост без порта покрывает любой порт, `ws.okx.com:8443` — только 8443.
- **`net.fetch` — только `https`, только GET и POST**, редиректы не выполняются: 3xx приходит как
  есть. `ok: true` значит «дошли до биржи», а не «2xx», — статус проверяйте сами. Лимит — 60
  вызовов в минуту на экземпляр.
- **Переподключение — ваше.** Сокет рвётся; переподключайтесь с паузой и шлите биржевой heartbeat,
  если биржа его ждёт: браузер не отправляет WebSocket-пинги сам.

Справочник: [`net.fetch()`](reference/storage-and-net.md#net-fetch),
[`egress`](reference/manifest.md#manifest-egress), [откуда брать рыночные
данные](reference/market-data.md#market-data-sources). Пример:
[«Фандинг-монитор»](../examples/funding-monitor/) ходит в REST через `net.fetch`,
[«Радар ликвидаций»](../examples/liquidation-radar/) держит свои сокеты. Проверка Nest:
[`egress-ws.undeclared-host`](../CHECKS.md#egress-wsundeclared-host).

## <a id="revoked-scope"></a>Разрешение отозвали на ходу

Пережить отзыв разрешения: показать, чего больше нет, вместо падения. Разрешение: любое — здесь
`account:read`.

```js
import { ColibriError, connections, hasScope, on } from "./colibri.js";

const $ = (id) => document.getElementById(id);

// Разрешения меняются, пока виджет работает: пользователь правит их в «Мои виджеты».
function applyScopes() {
  const canSee = hasScope("account:read");
  $("account").hidden = !canSee;
  $("no-account").hidden = canSee; // «Виджету не выдано разрешение видеть счёт»
  if (canSee) void refresh();
}

async function refresh() {
  try {
    const { connections: list } = await connections.list();
    $("account").textContent = list.map((c) => c.label || c.exchange).join(", ");
  } catch (e) {
    // Отозвали между проверкой и вызовом — то же состояние, а не ошибка.
    if (e instanceof ColibriError && e.code === "unauthorized") $("no-account").hidden = false;
    else throw e;
  }
}

on("grants", applyScopes); // к этому моменту handshake().grantedScopes уже новый
applyScopes();
```

На чём спотыкаются:

- **`unauthorized` (401) не говорит, какого разрешения не хватило**, — намеренно. Проверяйте
  `hasScope()` до вызова и слушайте событие `grants`.
- **Остановите то, что жило на этом разрешении:** опросы, подписки на его каналы, кнопки, которые
  без него не сработают.
- **Не падайте на старте.** Виджет без части разрешений должен показать то, что может, и сказать,
  где выдать остальное.

Справочник: [`hasScope()`](reference/bridge.md#has-scope),
[событие `grants`](reference/bridge.md#event-grants), [разрешения](reference/README.md#permissions).
Пример: [торговый шаблон](../starters/trading/) прячет заявку и счёт без разрешений.

## <a id="bridge-off"></a>Пользователь выключил API

Пережить выключенный API: виджет работает, но вызовы терминала не проходят. Разрешение не нужно.

Пользователь может выключить API для всех виджетов: Nest → «Настройки» → «Мост API (bridge)».
Виджет при этом не останавливается — каждый вызов отвечает `bridge_disabled` (503).

```js
import { ColibriError, markets, on } from "./colibri.js";

const banner = document.getElementById("bridge-off"); // «API для виджетов выключен»
const last = document.getElementById("last");

async function load() {
  try {
    const book = await markets.book("BinanceSpot", "BTCUSDT", { depth: 1 });
    last.textContent = book.lastPrice;
    banner.hidden = true;
  } catch (e) {
    if (e instanceof ColibriError && e.code === "bridge_disabled") banner.hidden = false;
    else throw e;
  }
}

// Включили или выключили — приходит событие bridge. Опрашивать в цикле не нужно.
on("bridge", (e) => {
  banner.hidden = e.enabled;
  if (e.enabled) void load(); // разовые чтения повторите; подписки stream.subscribe вернутся сами
});
void load();
```

На чём спотыкаются:

- **В `handshake()` состояния моста нет.** О выключенном API на старте скажет первый же отказ
  `bridge_disabled`; дальше — событие `bridge` на каждом переключении.
- **Подписки `stream.subscribe` восстанавливаются сами**, когда API включают снова. Кто говорит с
  `window.colibri` напрямую, подписывается заново сам.
- **Это выбор пользователя, а не сбой.** Спокойная строка вместо красной ошибки, и никаких
  повторов в цикле.

Справочник: [событие `bridge`](reference/bridge.md#event-bridge),
[`ColibriError`](reference/bridge.md#colibri-error), [ошибки](reference/README.md#errors). Пример:
[шаблон «Простой»](../starters/plain/), [торговый шаблон](../starters/trading/).

## <a id="find-my-box"></a>Где мой слот и кто рядом

Узнать, в каком слоте стоит виджет и что в соседних, — например, найти стакан рядом и следить за
его символом. Разрешение: `panels`.

```js
import { handshake, on, workspace } from "./colibri.js";

// Соседи — слоты в том же разбиении, что и мой.
async function neighbours() {
  const slotId = handshake().slotId;
  if (!slotId) return []; // в отдельном окне slotId — null: соседей нет
  const { position } = await workspace.slot(slotId);
  if (!position.parent) return []; // мой слот на вкладке один
  const { tab } = await workspace.tab(position.tabId);
  let node = tab.layout; // от корня вкладки — к моему разбиению
  for (const i of position.path.slice(0, -1)) {
    if (node.type === "split") node = node.children[i];
  }
  return node.type === "split" ? node.children.filter((_, i) => i !== position.parent.index) : [];
}

// «Стакан рядом со мной» — первый сосед-стакан.
async function bookNextToMe() {
  for (const box of await neighbours()) {
    if (box.type === "slot" && box.content.kind === "orderbook") return box.content;
  }
  return null;
}

async function follow() {
  const book = await bookNextToMe();
  document.getElementById("target").textContent = book ? `${book.exchange} ${book.symbol}` : "—";
}

// Виджет переносят в другой слот или в окно без перезапуска — тогда приходит surface.
on("surface", () => void follow());
void follow();
```

На чём спотыкаются:

- **`panels.*` устарел** и в терминале 1.4.0 удаляется. Новый код — на `workspace`.
- **Раскладку пользователь меняет без события.** `surface` приходит, только когда переносят сам
  виджет. Если важно, что сейчас рядом, перечитайте раскладку перед действием.
- **Сосед — только слот в том же разбиении.** Стакан двумя уровнями выше соседом не считается: для
  этого обходите всё дерево вкладки из `workspace.tab()`.

Справочник: [`handshake()`](reference/bridge.md#handshake),
[событие `surface`](reference/bridge.md#event-surface),
[`workspace.slot()`](reference/layout.md#workspace-slot),
[`workspace.tab()`](reference/layout.md#workspace-tab). В шаблонах этого нет.
