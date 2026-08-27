/** ru-first, en alongside — the language comes from the handshake and follows the host's event. */
const ru = {
  title: "Радар ликвидаций",
  legendLong: "лонги",
  legendShort: "шорты",
  dataSource: "данные: собственные WS-подключения к биржам",
  sound: "звук ≥",
  waiting: "Ожидание ликвидаций…",
  symbol: "Инструмент",
  venue: "Биржа",
  side: "Сторона",
  price: "Цена",
  size: "Размер",
  time: "Время",
  long: "Лонг",
  short: "Шорт",
  threshold: "Порог звука ($)",
  soundOn: "Звук включён",
  soundOff: "Звук выключен",
  liquidated: "ликвидация",
  perMin: "/мин",
  total: "за 5 мин",
  statusLive: "поток",
  statusSilent: "нет данных",
  statusFailed: "недоступна",
  statusConnecting: "подключение",
  statusWaiting: "ждём принтов",
};

const en: typeof ru = {
  title: "Liquidation Radar",
  legendLong: "longs",
  legendShort: "shorts",
  dataSource: "data: the widget's own venue WebSockets",
  sound: "sound ≥",
  waiting: "Waiting for liquidations…",
  symbol: "Instrument",
  venue: "Venue",
  side: "Side",
  price: "Price",
  size: "Size",
  time: "Time",
  long: "Long",
  short: "Short",
  threshold: "Sound threshold ($)",
  soundOn: "Sound on",
  soundOff: "Sound off",
  liquidated: "liquidated",
  perMin: "/min",
  total: "in 5 min",
  statusLive: "live",
  statusSilent: "no data",
  statusFailed: "unavailable",
  statusConnecting: "connecting",
  statusWaiting: "awaiting prints",
};

export type Strings = typeof ru;

export function stringsFor(lang: string): Strings {
  return lang?.toLowerCase().startsWith("ru") ? ru : en;
}
