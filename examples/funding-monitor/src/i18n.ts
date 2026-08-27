/**
 * ru-first, en alongside. The language comes from the handshake and is read at boot — the host
 * pushes a `theme` event when it changes, which this widget re-reads.
 */
const ru = {
  title: "Фандинг-монитор",
  extremum: "Экстремум (годовых)",
  nextSettlement: "Ближайший расчёт",
  activeAlerts: "Активных алертов",
  venues: "Бирж",
  threshold: "порог",
  symbol: "Инструмент",
  venue: "Биржа",
  rate: "Ставка",
  annual: "Годовых",
  interval: "Интервал",
  settlesIn: "Расчёт через",
  loading: "Загрузка…",
  noData: "Нет данных",
  footerData: "данные: REST бирж через задекларированные домены · запросы выполняет терминал",
  footerAlerts: "алерты: уведомления терминала · работают в фоне",
  alertThreshold: "Порог алерта (годовых, %)",
  soundOn: "Уведомления включены",
  soundOff: "Уведомления выключены",
  settlementAlert: "расчёт через 5 мин",
  hours: "ч",
  failed: "недоступна",
};

const en: typeof ru = {
  title: "Funding Monitor",
  extremum: "Extreme (annualized)",
  nextSettlement: "Next settlement",
  activeAlerts: "Active alerts",
  venues: "Venues",
  threshold: "threshold",
  symbol: "Instrument",
  venue: "Venue",
  rate: "Rate",
  annual: "Annualized",
  interval: "Interval",
  settlesIn: "Settles in",
  loading: "Loading…",
  noData: "No data",
  footerData: "data: venue REST over declared domains · the terminal performs the requests",
  footerAlerts: "alerts: terminal notifications · fire in the background",
  alertThreshold: "Alert threshold (annualized, %)",
  soundOn: "Notifications on",
  soundOff: "Notifications off",
  settlementAlert: "settles in 5 min",
  hours: "h",
  failed: "unavailable",
};

export type Strings = typeof ru;

export function stringsFor(lang: string): Strings {
  return lang?.toLowerCase().startsWith("ru") ? ru : en;
}
