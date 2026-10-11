import { useCallback, useEffect, useState } from "react";
import colibri, { ColibriError, connections, hasScope, markets, on, storage, stream, trading } from "./lib/colibri.js";
import type { Balance, BalanceData, Book, Connection, Order, OrdersData, Position, PositionsData } from "./lib/colibri.js";
import { format, stringsFor, type Strings } from "./i18n";

/**
 * A trading widget's skeleton: a connection's account, live, and a LIMIT order that leaves only
 * on an explicit, confirmed click.
 *
 * The rules this starter keeps, and a widget built from it should keep too:
 * - An order is sent from exactly one place: the Confirm button's click handler (`place` below).
 *   Never on load, from a timer, from a stream handler, from a restored setting or on a keypress.
 * - Price and size start EMPTY and are never filled from storage: a restored widget cannot be one
 *   click away from an order the user did not type.
 * - Changing anything the confirmation names closes it, so what is confirmed is what is sent.
 * - A demo connection is chosen first; a live one carries a red bar.
 *
 * The terminal adds its own guards on top: the `trading` permission, the per-connection grant in
 * Settings → Program → Local API, and the same order budgets a click in the terminal has.
 */

/** A positive decimal as the API wants it: digits and an optional fraction, nothing else. */
const DECIMAL = /^\d+(\.\d+)?$/;
const isPositive = (text: string) => DECIMAL.test(text) && Number(text) > 0;

type Side = "BUY" | "SELL";
type Notice = { ok: boolean; text: string } | null;

export default function App() {
  const [lang, setLang] = useState(colibri.handshake().lang);
  useEffect(() => on("theme", (e: any) => setLang(e.lang)), []);
  const s = stringsFor(lang);

  // Permissions can change while the widget runs (the user edits them in My widgets).
  const readScopes = () => ({ trade: hasScope("trading"), account: hasScope("account:read") });
  const [scopes, setScopes] = useState(readScopes);
  useEffect(() => on("grants", () => setScopes(readScopes())), []);

  // The widget keeps running while the API is switched off; it just cannot call.
  const [bridgeOn, setBridgeOn] = useState(true);
  useEffect(() => on("bridge", (e: any) => setBridgeOn(!!e.enabled)), []);

  const [notice, setNotice] = useState<Notice>(null);

  // ── which connection and coin ─────────────────────────────────────────────────────────────
  const [list, setList] = useState<Connection[] | null>(null);
  const [connectionId, setConnectionId] = useState("");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [restored, setRestored] = useState(false);

  // The choice survives a restart. Restoring it never sends anything.
  useEffect(() => {
    void (async () => {
      try {
        const [savedConnection, savedSymbol] = await Promise.all([storage.get("connection"), storage.get("symbol")]);
        if (savedConnection) setConnectionId(savedConnection);
        if (savedSymbol) setSymbol(savedSymbol);
      } catch {
        // Storage is a convenience here; the defaults work.
      }
      setRestored(true);
    })();
  }, []);

  // `apiTradingEnabled` changes when the user grants trading in Settings; "Refresh" re-reads it.
  const loadConnections = useCallback(async () => {
    try {
      setList((await connections.list()).connections);
    } catch (e) {
      setList([]);
      setNotice({ ok: false, text: errorText(e, stringsFor(colibri.handshake().lang)) });
    }
  }, []);
  useEffect(() => void loadConnections(), [loadConnections]);

  // No saved choice, or it is gone: a demo connection first, then any that can trade.
  useEffect(() => {
    if (!list || !restored || list.some((c) => c.id === connectionId)) return;
    const pick = list.find((c) => c.demo && !c.viewOnly) ?? list.find((c) => !c.viewOnly) ?? list[0];
    setConnectionId(pick?.id ?? "");
  }, [list, restored, connectionId]);

  useEffect(() => {
    if (restored && connectionId) void storage.set("connection", connectionId).catch(() => {});
  }, [restored, connectionId]);
  useEffect(() => {
    if (restored && symbol) void storage.set("symbol", symbol).catch(() => {});
  }, [restored, symbol]);

  const conn = list?.find((c) => c.id === connectionId) ?? null;

  // ── the top of the book, on the connection's own venue ────────────────────────────────────
  const [top, setTop] = useState<{ bid: string | null; ask: string | null }>({ bid: null, ask: null });
  const exchange = conn?.exchange;
  useEffect(() => {
    setTop({ bid: null, ask: null });
    if (!exchange || !symbol) return;
    let live = true;
    const paint = (book: Book) => {
      if (live) setTop({ bid: book.bestBid, ask: book.bestAsk });
    };
    markets.book(exchange, symbol, { depth: 1 }).then(paint).catch(() => {});
    const stop = stream.subscribe("book", { exchange, symbol, depth: 1, hz: 4 }, (data) => paint(data as Book));
    return () => {
      live = false;
      stop();
    };
  }, [exchange, symbol]);

  // ── the account: a snapshot, then the streams (every frame is the FULL set) ────────────────
  const [balances, setBalances] = useState<Balance[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => {
    setBalances([]);
    setPositions([]);
    setOrders([]);
    if (!connectionId || !scopes.account) return;
    let live = true;
    const id = connectionId;
    connections.balances(id).then((d) => live && setBalances(d.balances)).catch(() => {});
    connections.positions(id).then((d) => live && setPositions(d.positions)).catch(() => {});
    connections.orders(id).then((d) => live && setOrders(d.orders)).catch(() => {});
    const stops = [
      stream.subscribe("balance", { connectionId: id }, (d) => live && setBalances((d as BalanceData).balances)),
      stream.subscribe("positions", { connectionId: id }, (d) => live && setPositions((d as PositionsData).positions)),
      stream.subscribe("orders", { connectionId: id }, (d) => live && setOrders((d as OrdersData).orders)),
    ];
    return () => {
      live = false;
      stops.forEach((stop) => stop());
    };
  }, [connectionId, scopes.account]);

  // ── the order ticket ──────────────────────────────────────────────────────────────────────
  // Price and size start empty and are never restored: see the rules at the top.
  const [price, setPrice] = useState("");
  const [size, setSize] = useState("");
  const [confirming, setConfirming] = useState<Side | null>(null);
  const [sending, setSending] = useState(false);

  // A confirmation names a connection, a coin, a price and a size; changing any of them closes it.
  useEffect(() => setConfirming(null), [connectionId, symbol, price, size]);

  const gate = !conn
    ? s.gateNoConnection
    : !scopes.trade
      ? s.gateNoScope
      : conn.viewOnly
        ? s.gateViewOnly
        : !conn.apiTradingEnabled
          ? s.gateNotGranted
          : null;
  const ticketReady = !gate && bridgeOn && symbol.length > 0 && isPositive(price) && isPositive(size);

  /** The ONLY place an order is sent: the Confirm button's click handler. */
  async function place(side: Side) {
    if (!conn || !ticketReady || sending) return;
    setSending(true);
    setNotice(null);
    try {
      const accepted = await trading.place(conn.id, { symbol, side, type: "Limit", price, sizeBase: size });
      // Accepted means ENQUEUED: the exchange's answer arrives on the `orders` stream above.
      setNotice({ ok: true, text: format(s.accepted, accepted.clientOrderId) });
      setSize(""); // a second order needs its size typed again
    } catch (e) {
      setNotice({ ok: false, text: errorText(e, s) });
    } finally {
      setSending(false);
      setConfirming(null);
    }
  }

  async function cancel(order: Order) {
    if (!conn) return;
    try {
      await trading.cancel(conn.id, order.clientOrderId, order.symbol);
      setNotice({ ok: true, text: format(s.cancelSent, order.clientOrderId) });
    } catch (e) {
      setNotice({ ok: false, text: errorText(e, s) });
    }
  }

  return (
    <div className="app">
      {!bridgeOn && <div className="gate">{s.bridgeOff}</div>}

      <div className="row">
        <span className="dim">{s.connection}</span>
        <select value={connectionId} onChange={(e) => setConnectionId(e.target.value)}>
          {(list ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {connectionLabel(c)}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => void loadConnections()}>
          {s.refresh}
        </button>
        {conn?.demo && <span className="demo">{s.demo}</span>}
      </div>
      {list?.length === 0 && <div className="gate">{s.noConnections}</div>}
      {conn && !conn.demo && <div className="live">{s.live}</div>}

      <div className="row">
        <span className="dim">{s.symbol}</span>
        <input value={symbol} spellCheck={false} onChange={(e) => setSymbol(e.target.value.trim().toUpperCase())} />
        <span className="num buy">
          {s.bid} {top.bid ?? "—"}
        </span>
        <span className="num sell">
          {s.ask} {top.ask ?? "—"}
        </span>
      </div>

      {gate ? (
        <div className="gate">{gate}</div>
      ) : (
        <>
          <div className="row">
            <span className="dim">{s.price}</span>
            <input className="num" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.trim())} />
            <button type="button" disabled={!top.bid} onClick={() => top.bid && setPrice(top.bid)}>
              {s.bestBid}
            </button>
            <button type="button" disabled={!top.ask} onClick={() => top.ask && setPrice(top.ask)}>
              {s.bestAsk}
            </button>
          </div>
          <div className="row">
            <span className="dim">{s.size}</span>
            <input className="num" inputMode="decimal" value={size} onChange={(e) => setSize(e.target.value.trim())} />
            <button type="button" className="side-buy" disabled={!ticketReady} onClick={() => setConfirming("BUY")}>
              {s.buy}
            </button>
            <button type="button" className="side-sell" disabled={!ticketReady} onClick={() => setConfirming("SELL")}>
              {s.sell}
            </button>
          </div>

          {confirming && conn && ticketReady && (
            <div className="confirm">
              <b className={confirming === "BUY" ? "buy" : "sell"} style={{ gridColumn: "1 / -1" }}>
                {confirming === "BUY" ? s.confirmBuy : s.confirmSell}
              </b>
              <span className="dim">{s.connection}</span>
              <span>{connectionLabel(conn)}</span>
              <span className="dim">{s.symbol}</span>
              <span>{symbol}</span>
              <span className="dim">{s.price}</span>
              <span className="num">{price}</span>
              <span className="dim">{s.size}</span>
              <span className="num">{size}</span>
              <span className="dim">{s.notional}</span>
              <span className="num">{notional(price, size)}</span>
              <div className="actions">
                {/* type="button" and no <form>: Enter never submits, only this click does. */}
                <button
                  type="button"
                  className={confirming === "BUY" ? "side-buy" : "side-sell"}
                  disabled={sending}
                  onClick={() => void place(confirming)}
                >
                  {s.confirmDo}
                </button>
                <button type="button" onClick={() => setConfirming(null)}>
                  {s.cancel}
                </button>
              </div>
            </div>
          )}
          <div className="dim">{s.hint}</div>
        </>
      )}

      {notice && <div className={notice.ok ? "notice-ok" : "notice-error"}>{notice.text}</div>}

      {scopes.account ? (
        <Account s={s} balances={balances} positions={positions} orders={orders} canCancel={!gate} onCancel={cancel} />
      ) : (
        <div className="dim">{s.noAccountScope}</div>
      )}
    </div>
  );
}

function Account(props: {
  s: Strings;
  balances: Balance[];
  positions: Position[];
  orders: Order[];
  canCancel: boolean;
  onCancel: (order: Order) => void;
}) {
  const { s, positions, orders } = props;
  const balances = props.balances.filter((b) => Number(b.free) + Number(b.locked) > 0).slice(0, 10);
  return (
    <>
      <h2>{s.orders}</h2>
      {orders.length === 0 ? (
        <div className="dim">{s.none}</div>
      ) : (
        <table className="num">
          <tbody>
            {orders.map((o) => (
              <tr key={o.clientOrderId}>
                <td>{o.symbol}</td>
                <td className={o.side === "BUY" ? "buy" : "sell"}>{o.side}</td>
                <td>{o.type}</td>
                <td>{o.price}</td>
                <td>
                  {o.filledQuantity}/{o.quantity}
                </td>
                <td className="dim">{o.status}</td>
                <td>
                  <button type="button" disabled={!props.canCancel} onClick={() => props.onCancel(o)}>
                    {s.remove}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>{s.positions}</h2>
      {positions.length === 0 ? (
        <div className="dim">{s.none}</div>
      ) : (
        <table className="num">
          <tbody>
            {positions.map((p) => (
              <tr key={p.symbol + p.side}>
                <td>{p.symbol}</td>
                <td className={Number(p.quantity) >= 0 ? "buy" : "sell"}>{p.side}</td>
                <td>{p.quantity}</td>
                <td className="dim">{p.entryPrice}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>{s.balances}</h2>
      {balances.length === 0 ? (
        <div className="dim">{s.none}</div>
      ) : (
        <table className="num">
          <tbody>
            {balances.map((b) => (
              <tr key={b.asset}>
                <td>{b.asset}</td>
                <td>{b.free}</td>
                <td className="dim">{b.locked}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function connectionLabel(c: Connection): string {
  return `${c.label || c.exchange} · ${c.marketType}`;
}

function notional(price: string, size: string): string {
  return (Number(price) * Number(size)).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** A refusal in the author's words. Switch on `code`, never on the message. */
function errorText(e: unknown, s: Strings): string {
  if (e instanceof ColibriError) {
    switch (e.code) {
      case "trading_not_enabled":
        return s.errNotGranted;
      case "not_ready":
        return s.errNotReady;
      case "rate_limited":
        return s.errRateLimited;
      case "unauthorized":
        return s.errUnauthorized;
      case "bad_request":
      case "permission_denied":
        return format(s.errRefused, e.message);
      default:
        return format(s.errOther, e.code ?? e.status, e.message);
    }
  }
  return format(s.errOther, "", e instanceof Error ? e.message : String(e));
}
