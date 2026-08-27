import { useEffect, useMemo, useRef, useState } from "react";
import colibri, { on, signalLevels, storage } from "./lib/colibri.js";
import { FEEDS, type LiqPrint, type VenueStatus } from "./venues";
import { stringsFor } from "./i18n";

/** How many prints the table keeps. Enough to read a cascade; bounded so a burst cannot grow it. */
const MAX_ROWS = 300;

/** How long a venue may be connected without EVER delivering before it is called silent. */
const SILENT_AFTER_MS = 120_000;

const STORAGE_KEY = { threshold: "threshold", sound: "sound" };

export default function App() {
  const [lang, setLang] = useState(colibri.handshake().lang);
  useEffect(() => on("theme", (e: any) => setLang(e.lang)), []);
  const s = stringsFor(lang);

  const [prints, setPrints] = useState<LiqPrint[]>([]);
  const [status, setStatus] = useState<Record<string, VenueStatus>>({});
  const [lastPrintAt, setLastPrintAt] = useState<Record<string, number>>({});
  const [connectedSince, setConnectedSince] = useState<Record<string, number>>({});
  const [threshold, setThreshold] = useState(500_000);
  const [soundOn, setSoundOn] = useState(true);
  const [now, setNow] = useState(Date.now());

  // Read once at boot; the settings ref is what the socket callbacks see, because those closures
  // are created once and would otherwise capture the initial values forever.
  const settings = useRef({ threshold, soundOn, s });
  settings.current = { threshold, soundOn, s };
  const lastChime = useRef(0);

  useEffect(() => {
    void (async () => {
      try {
        const [t, snd] = await Promise.all([storage.get(STORAGE_KEY.threshold), storage.get(STORAGE_KEY.sound)]);
        if (t !== null) setThreshold(Number(t) || 500_000);
        if (snd !== null) setSoundOn(snd !== "off");
      } catch {
        // Defaults are fine.
      }
    })();
  }, []);

  useEffect(() => {
    const teardowns = FEEDS.map((feed) =>
      feed.start(
        (print) => {
          setPrints((rows) => [print, ...rows].slice(0, MAX_ROWS));
          setLastPrintAt((m) => ({ ...m, [print.venue]: Date.now() }));
          setStatus((m) => ({ ...m, [print.venue]: "live" }));
          announce(print, settings.current, lastChime);
        },
        (st) => {
          setStatus((m) => ({ ...m, [feed.venue]: m[feed.venue] === "live" && st === "connected" ? "live" : st }));
          // The grace period runs from the last time the socket came up, so a reconnect restarts
          // it rather than inheriting the previous session's clock.
          setConnectedSince((m) => {
            if (st === "connected") return { ...m, [feed.venue]: Date.now() };
            if (st === "connecting" || st === "failed") {
              const next = { ...m };
              delete next[feed.venue];
              return next;
            }
            return m;
          });
        },
      ),
    );

    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      teardowns.forEach((t) => t());
      clearInterval(clock);
    };
  }, []);

  const recent = useMemo(() => prints.filter((p) => now - p.ts < 5 * 60_000), [prints, now]);
  const longs = recent.filter((p) => p.side === "long").reduce((a, p) => a + p.notionalUsd, 0);
  const shorts = recent.filter((p) => p.side === "short").reduce((a, p) => a + p.notionalUsd, 0);
  const max = Math.max(longs, shorts, 1);

  return (
    <div style={S.root}>
      <div style={S.buckets}>
        <Bucket label={`${s.legendLong} · ${s.total}`} value={usd(longs)} ratio={longs / max} tone="long" />
        <Bucket label={`${s.legendShort} · ${s.total}`} value={usd(shorts)} ratio={shorts / max} tone="short" />
      </div>

      <div style={S.controls}>
        <label style={S.control}>
          {s.threshold}
          <input type="number" min={0} step={50_000} value={threshold} style={S.input}
            onChange={(e) => {
              const v = Number(e.target.value) || 0;
              setThreshold(v);
              void storage.set(STORAGE_KEY.threshold, String(v)).catch(() => {});
            }} />
        </label>
        <button style={S.button}
          onClick={() => {
            const next = !soundOn;
            setSoundOn(next);
            void storage.set(STORAGE_KEY.sound, next ? "on" : "off").catch(() => {});
          }}>
          {soundOn ? s.soundOn : s.soundOff}
        </button>
        <div style={S.status}>
          {FEEDS.map((f) => (
            <VenueChip key={f.venue} venue={f.venue}
              status={effectiveStatus(status[f.venue], lastPrintAt[f.venue], connectedSince[f.venue], now)} s={s} />
          ))}
        </div>
      </div>

      <div style={S.tableWrap}>
        {prints.length === 0 ? (
          <div style={S.empty}>{s.waiting}</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <Th>{s.time}</Th><Th>{s.venue}</Th><Th>{s.symbol}</Th>
                <Th>{s.side}</Th><Th align="right">{s.price}</Th><Th align="right">{s.size}</Th>
              </tr>
            </thead>
            <tbody>
              {prints.map((p, i) => (
                <tr key={`${p.venue}|${p.symbol}|${p.ts}|${i}`}>
                  <Td dim>{clock(p.ts)}</Td>
                  <Td dim>{p.venue}</Td>
                  <Td>{p.symbol}</Td>
                  <Td side={p.side}>{p.side === "long" ? s.long : s.short}</Td>
                  <Td align="right" dim>{p.price.toPrecision(6)}</Td>
                  <Td align="right" side={p.side} strong={p.notionalUsd >= threshold}>{usd(p.notionalUsd)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={S.footer}>
        <span><Dot tone="long" /> {s.legendLong} · <Dot tone="short" /> {s.legendShort}</span>
        <span>{s.dataSource}</span>
        <span style={{ marginLeft: "auto" }}>{soundOn ? `🔊 ${s.sound} ${usd(threshold)}` : ""}</span>
      </div>
    </div>
  );
}

/**
 * A print at or over the threshold becomes a terminal signal — the reason this widget keeps
 * working on a hidden tab. `/signals` rather than `/notifications` deliberately: a cascade would
 * otherwise put a toast on screen for every print.
 *
 * The cooldown is what makes it usable during exactly the event people care about; a liquidation
 * cascade produces dozens of qualifying prints a second and each one would cost a round trip
 * against the widget's own rate budget.
 */
function announce(
  print: LiqPrint,
  cfg: { threshold: number; soundOn: boolean; s: ReturnType<typeof stringsFor> },
  lastChime: { current: number },
): void {
  if (!cfg.soundOn || print.notionalUsd < cfg.threshold) return;
  const now = Date.now();
  if (now - lastChime.current < 2_000) return;
  lastChime.current = now;

  const side = print.side === "long" ? cfg.s.long : cfg.s.short;
  void signalLevels
    .signal({
      exchange: print.venue,
      symbol: print.symbol,
      text: `${side} ${cfg.s.liquidated} ${usd(print.notionalUsd)} @ ${print.price.toPrecision(6)}`,
    })
    .catch(() => {
      // A refused signal must never interrupt the feed.
    });
}

/**
 * "Connected" is not "working". A socket can complete its handshake, accept every subscription and
 * then deliver nothing at all — measured on a real machine against Binance, where even a control
 * stream stayed silent while control messages round-tripped.
 *
 * What distinguishes that from a calm market is whether the venue has EVER delivered, not how long
 * ago it last did. Liquidations are sporadic — a market-wide feed can easily go minutes between
 * prints — so a "quiet for N seconds" rule would flag every venue on a calm night and make the
 * indicator worthless. Once a venue has printed once it is proven, and stays proven until the
 * socket itself reports trouble.
 */
function effectiveStatus(
  status: VenueStatus | undefined,
  lastPrint: number | undefined,
  connectedSince: number | undefined,
  now: number,
): VenueStatus | "silent" | "waiting" {
  if (status === undefined) return "connecting";
  if (status !== "live" && status !== "connected") return status;
  if (lastPrint !== undefined) return "live";
  if (connectedSince !== undefined && now - connectedSince > SILENT_AFTER_MS) return "silent";
  return "waiting";
}

function VenueChip({ venue, status, s }: {
  venue: string; status: VenueStatus | "silent" | "waiting"; s: ReturnType<typeof stringsFor>;
}) {
  const tone =
    status === "live" ? "var(--colibri-role-bullish, #26a17b)"
      : status === "failed" || status === "silent" ? "var(--colibri-role-bearish, #e05260)"
        : "var(--colibri-role-dim-text, #8b93a3)";
  const label =
    status === "live" ? s.statusLive
      : status === "failed" ? s.statusFailed
        : status === "silent" ? s.statusSilent
          : status === "waiting" ? s.statusWaiting
            : s.statusConnecting;
  return <span style={S.chip} title={`${venue}: ${label}`}><span style={{ color: tone }}>●</span> {venue}</span>;
}

const Dot = ({ tone }: { tone: "long" | "short" }) => <span style={{ color: sideColor(tone) }}>●</span>;

/**
 * The terminal's own convention, taken from its palette so a re-theme carries: amber for a
 * liquidated LONG (a forced sell), cyan for a liquidated SHORT.
 */
function sideColor(side: "long" | "short"): string {
  return side === "long" ? "var(--colibri-liq-sell-fill, #fbbf24)" : "var(--colibri-liq-buy-fill, #22d3ee)";
}

function usd(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

const clock = (ts: number) => new Date(ts).toTimeString().slice(0, 8);

function Bucket({ label, value, ratio, tone }: { label: string; value: string; ratio: number; tone: "long" | "short" }) {
  return (
    <div style={S.bucket}>
      <div style={S.bucketHead}>
        <span style={S.tileLabel}>{label}</span>
        <span style={{ ...S.bucketValue, color: sideColor(tone) }}>{value}</span>
      </div>
      <div style={S.barTrack}>
        <div style={{ ...S.barFill, width: `${Math.max(2, ratio * 100)}%`, background: sideColor(tone) }} />
      </div>
    </div>
  );
}

const Th = ({ children, align }: { children: React.ReactNode; align?: "right" }) => (
  <th style={{ ...S.th, textAlign: align ?? "left" }}>{children}</th>
);

const Td = ({ children, align, dim, side, strong }: {
  children: React.ReactNode; align?: "right"; dim?: boolean; side?: "long" | "short"; strong?: boolean;
}) => (
  <td style={{
    ...S.td,
    textAlign: align ?? "left",
    color: side ? sideColor(side) : dim ? "var(--colibri-role-dim-text, #8b93a3)" : "inherit",
    fontWeight: strong ? 700 : 400,
  }}>{children}</td>
);

/** Every colour is a host token with a fallback, so the page also renders standalone in a browser. */
const S = {
  root: {
    font: "calc(13px * var(--colibri-font-scale, 1))/1.45 system-ui, sans-serif",
    color: "var(--colibri-role-text, #d8dee9)",
    background: "var(--colibri-role-background, #0b0e13)",
    height: "100vh", display: "flex", flexDirection: "column", boxSizing: "border-box",
  } as const,
  buckets: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--colibri-role-divider, #2a2f3a)", flex: "0 0 auto" } as const,
  bucket: { background: "var(--colibri-role-surface, #171b23)", padding: "6px 10px" } as const,
  bucketHead: { display: "flex", alignItems: "baseline", justifyContent: "space-between" } as const,
  bucketValue: { fontSize: "1.2em", fontWeight: 600, fontVariantNumeric: "tabular-nums" } as const,
  barTrack: { height: 3, marginTop: 4, background: "var(--colibri-role-divider, #2a2f3a)", borderRadius: 2 } as const,
  barFill: { height: "100%", borderRadius: 2 } as const,
  tileLabel: { fontSize: "0.75em", color: "var(--colibri-role-dim-text, #8b93a3)" } as const,
  controls: {
    display: "flex", gap: 10, alignItems: "center", padding: "5px 10px", flexWrap: "wrap",
    borderBottom: "1px solid var(--colibri-role-divider, #2a2f3a)", flex: "0 0 auto",
  } as const,
  control: { display: "flex", gap: 6, alignItems: "center", fontSize: "0.78em", color: "var(--colibri-role-dim-text, #8b93a3)" } as const,
  input: {
    font: "inherit", width: 88, padding: "2px 6px", color: "var(--colibri-role-text, #d8dee9)",
    background: "var(--colibri-role-surface, #171b23)", border: "1px solid var(--colibri-role-divider, #2a2f3a)", borderRadius: 3,
  } as const,
  button: {
    font: "inherit", fontSize: "0.78em", padding: "3px 8px", cursor: "pointer",
    color: "var(--colibri-role-text, #d8dee9)", background: "var(--colibri-role-surface, #171b23)",
    border: "1px solid var(--colibri-role-divider, #2a2f3a)", borderRadius: 3,
  } as const,
  status: { display: "flex", gap: 8, marginLeft: "auto", fontSize: "0.72em", color: "var(--colibri-role-dim-text, #8b93a3)" } as const,
  chip: { whiteSpace: "nowrap" } as const,
  tableWrap: { flex: "1 1 auto", overflow: "auto", minHeight: 0 } as const,
  table: { width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" } as const,
  th: {
    position: "sticky", top: 0, padding: "4px 10px", fontSize: "0.72em", fontWeight: 500,
    color: "var(--colibri-role-dim-text, #8b93a3)", background: "var(--colibri-role-surface, #171b23)",
    borderBottom: "1px solid var(--colibri-role-divider, #2a2f3a)",
  } as const,
  td: { padding: "2px 10px", borderBottom: "1px solid var(--colibri-role-divider, #1c2029)" } as const,
  empty: { padding: 16, color: "var(--colibri-role-dim-text, #8b93a3)" } as const,
  footer: {
    display: "flex", gap: 12, padding: "4px 10px", fontSize: "0.7em",
    color: "var(--colibri-role-dim-text, #8b93a3)",
    borderTop: "1px solid var(--colibri-role-divider, #2a2f3a)", flex: "0 0 auto",
  } as const,
};
