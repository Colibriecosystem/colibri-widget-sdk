/** On-screen text in the terminal's language. Add a key to both tables. */
const ru = {
  connection: "Подключение",
  refresh: "Обновить",
  noConnections: "Подключений нет. Добавьте биржу в окне «Подключения» терминала.",
  demo: "демо",
  live: "LIVE — реальные деньги",
  symbol: "Монета",
  bid: "Бид",
  ask: "Аск",
  price: "Цена",
  size: "Объём, монет",
  bestBid: "Лучший бид",
  bestAsk: "Лучший аск",
  buy: "Купить…",
  sell: "Продать…",
  confirmBuy: "Купить по лимиту",
  confirmSell: "Продать по лимиту",
  confirmDo: "Подтвердить",
  cancel: "Отмена",
  notional: "Сумма",
  hint: "Заявка уходит только по «Подтвердить». Сам виджет не отправляет ничего: ни при открытии, ни по таймеру.",
  accepted: "Заявка принята терминалом ({0}). Ответ биржи появится в списке заявок.",
  cancelSent: "Снятие {0} отправлено.",
  balances: "Балансы",
  positions: "Позиции",
  orders: "Заявки",
  none: "нет",
  remove: "Снять",
  gateNoConnection: "Выберите подключение.",
  gateNoScope: "Виджету не выдано разрешение на торговлю. Его можно дать в «Мои виджеты».",
  gateViewOnly: "Это подключение только для просмотра: торговать через него нельзя.",
  noAccountScope: "Виджету не выдано разрешение видеть счёт.",
  errNotGranted: "Терминал отказал: этому виджету не разрешено торговать на этом подключении. Разрешите его в «Торговых подключениях» виджета.",
  errBudget: "Терминал не пропустил заявку: она больше лимита на ордер или на ордера в минуту, которые вы дали виджету.",
  errNotReady: "Подключение ещё не готово — повторите через пару секунд.",
  errRateLimited: "Слишком много запросов — подождите немного.",
  errUnauthorized: "У виджета нет нужного разрешения.",
  errRefused: "Терминал не пропустил заявку: {0}",
  errOther: "Ошибка {0}: {1}",
  bridgeOff: "API для виджетов выключен: Nest → «Настройки» → «Мост API (bridge)».",
};

type Strings = typeof ru;

const en: Strings = {
  connection: "Connection",
  refresh: "Refresh",
  noConnections: "No connections. Add an exchange in the terminal's Connections window.",
  demo: "demo",
  live: "LIVE — real money",
  symbol: "Coin",
  bid: "Bid",
  ask: "Ask",
  price: "Price",
  size: "Size, coins",
  bestBid: "Best bid",
  bestAsk: "Best ask",
  buy: "Buy…",
  sell: "Sell…",
  confirmBuy: "Buy at a limit",
  confirmSell: "Sell at a limit",
  confirmDo: "Confirm",
  cancel: "Cancel",
  notional: "Total",
  hint: "An order goes out only on Confirm. The widget sends nothing by itself: not when it opens, not on a timer.",
  accepted: "The terminal accepted the order ({0}). The exchange's answer appears in the orders list.",
  cancelSent: "Cancel of {0} sent.",
  balances: "Balances",
  positions: "Positions",
  orders: "Orders",
  none: "none",
  remove: "Cancel",
  gateNoConnection: "Choose a connection.",
  gateNoScope: "The widget was not granted trading. You can grant it in My widgets.",
  gateViewOnly: "This connection is view-only: it cannot trade.",
  noAccountScope: "The widget was not granted to see the account.",
  errNotGranted: "Refused: this widget may not trade on this connection. Allow it under the widget's Trading accounts.",
  errBudget: "Refused: the order is over the per-order or per-minute limit you gave this widget.",
  errNotReady: "The connection is not ready yet — try again in a couple of seconds.",
  errRateLimited: "Too many requests — wait a little.",
  errUnauthorized: "The widget lacks the permission this needs.",
  errRefused: "The terminal refused the order: {0}",
  errOther: "Error {0}: {1}",
  bridgeOff: "The widget API is off: Nest → Settings → API bridge.",
};

export type { Strings };

export function stringsFor(lang: string): Strings {
  return lang === "ru" ? ru : en;
}

/** `format("a {0} b", x)` — the placeholders the tables above use. */
export function format(text: string, ...args: unknown[]): string {
  return text.replace(/\{(\d)\}/g, (_, i) => String(args[Number(i)]));
}
