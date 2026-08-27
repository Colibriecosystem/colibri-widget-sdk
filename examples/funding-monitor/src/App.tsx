import { useEffect, useMemo, useRef, useState } from "react";
import colibri, { on, storage } from "./lib/colibri.js";
import { ADAPTERS } from "./venues";
import type { FundingRow } from "./venues/types";
import { AlertTracker, pct } from "./alerts";
import { stringsFor } from "./i18n";

/** Poll cadence. Funding moves on an hourly-or-slower schedule; a minute is already generous. */
const POLL_MS = 60_000;

/** Spread the first load so six venues are not hit in the same instant on every widget start. */
const JITTER_MS = 4_000;

const STORAGE_KEY = { threshold: "threshold", alerts: "alerts" };

type VenueState = { rows: FundingRow[]; failed: boolean };

export default function App() {
  const { widgetId } = colibri.handshake();
  const [surface, setSurface] = useState(colibri.handshake().surface);
  const [lang, setLang] = useState(colibri.handshake().lang);
  useEffect(() => on("surface", (e: any) => setSurface(e.surface)), []);
  useEffect(() => on("theme", (e: any) => setLang(e.lang)), []);
  const s = stringsFor(lang);

  const [venues, setVenues] = useState<Record<string, VenueState>>({});
  const [threshold, setThreshold] = useState(25);
  const [alertsOn, setAlertsOn] = useState(true);
  const [now, setNow] = useState(Date.now());
  const alerts = useRef(new AlertTracker());

  // Settings survive a reload, which the dev loop does on every save.
  useEffect(() => {
    void (async () => {
      try {
        const [t, a] = await Promise.all([storage.get(STORAGE_KEY.threshold), storage.get(STORAGE_KEY.alerts)]);
        if (t !== null) setThreshold(Number(t) || 25);
        if (a !== null) setAlertsOn(a !== "off");
      } catch {
        // Storage is a convenience here; defaults are perfectly usable.
      }
    })();
  }, []);

  // One loop per venue rather than one for all six: a slow or failing venue must not hold up the
  // others, and each keeps its own last-good rows while it retries.
  useEffect(() => {
    let live = true;
    const timers: number[] = [];

    for (const adapter of ADAPTERS) {
      const tick = async () => {
        try {
          const rows = await adapter.load();
          if (live) setVenues((v) => ({ ...v, [adapter.venue]: { rows, failed: false } }));
        } catch {
          if (live) setVenues((v) => ({ ...v, [adapter.venue]: { rows: v[adapter.venue]?.rows ?? [], failed: true } }));
        }
      };

      timers.push(setTimeout(() => {
        void tick();
        timers.push(setInterval(() => void tick(), POLL_MS) as unknown as number);
      }, Math.random() * JITTER_MS) as unknown as number);
    }

    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      live = false;
      timers.forEach(clearTimeout);
      timers.forEach(clearInterval);
      clearInterval(clock);
    };
  }, []);

  const rows = useMemo(
    () => Object.values(venues).flatMap((v) => v.rows).sort((a, b) => Math.abs(b.annualized) - Math.abs(a.annualized)),
    [venues],
  );

  useEffect(() => {
    if (rows.length) void alerts.current.evaluate(rows, threshold, alertsOn, s);
  }, [rows, threshold, alertsOn, s]);

  const loadedVenues = Object.values(venues).filter((v) => v.rows.length > 0).length;
  const failedVenues = Object.entries(venues).filter(([, v]) => v.failed).map(([k]) => k);
  const extreme = rows[0];
  const nextSettlement = rows
    .map((r) => r.nextMs)
    .filter((t): t is number => t !== null && t > now)
    .sort((a, b) => a - b)[0];

  const compact = surface === "slot";

  return (
    <div style={S.root}>
      <div style={S.tiles(compact)}>
        <Tile label={s.extremum} value={extreme ? pct(extreme.annualized) : "—"}
          sub={extreme ? `${extreme.symbol} · ${extreme.venue}` : ""} tone={extreme?.annualized} />
        <Tile label={s.nextSettlement} value={nextSettlement ? countdown(nextSettlement - now) : "—"}
          sub={nextSettlement ? venuesSettlingAt(rows, nextSettlement) : ""} />
        <Tile label={s.activeAlerts} value={String(alerts.current.activeCount)}
          sub={`${s.threshold} ±${threshold}%`} />
        <Tile label={s.venues} value={`${loadedVenues}/${ADAPTERS.length}`}
          sub={failedVenues.length ? `${failedVenues.join(", ")} ${s.failed}` : "REST"} />
      </div>

      <div style={S.controls}>
        <label style={S.control}>
          {s.alertThreshold}
          <input type="number" min={0} step={5} value={threshold} style={S.input}
            onChange={(e) => {
              const v = Number(e.target.value) || 0;
              setThreshold(v);
              void storage.set(STORAGE_KEY.threshold, String(v)).catch(() => {});
            }} />
        </label>
        <button style={S.button}
          onClick={() => {
            const next = !alertsOn;
            setAlertsOn(next);
            void storage.set(STORAGE_KEY.alerts, next ? "on" : "off").catch(() => {});
          }}>
          {alertsOn ? s.soundOn : s.soundOff}
        </button>
      </div>

      <div style={S.tableWrap}>
        {rows.length === 0 ? (
          <div style={S.empty}>{loadedVenues === 0 && failedVenues.length === 0 ? s.loading : s.noData}</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <Th>{s.symbol}</Th>
                <Th>{s.venue}</Th>
                <Th align="right">{s.rate}</Th>
                <Th align="right">{s.annual}</Th>
                <Th align="right">{s.interval}</Th>
                <Th align="right">{s.settlesIn}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((r) => (
                <tr key={`${r.venue}|${r.symbol}`}>
                  <Td>{r.symbol}</Td>
                  <Td dim>{r.venue}</Td>
                  <Td align="right" tone={r.rate}>{(r.rate * 100).toFixed(4)}%</Td>
                  <Td align="right" tone={r.annualized} strong>{pct(r.annualized)}</Td>
                  <Td align="right" dim>{Math.round(r.intervalMs / 3_600_000)}{s.hours}</Td>
                  <Td align="right" dim>{r.nextMs ? countdown(r.nextMs - now) : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={S.footer}>
        <span>{s.footerData}</span>
        <span style={{ marginLeft: "auto" }}>{s.footerAlerts}</span>
      </div>
      <div style={S.id}>{widgetId}</div>
    </div>
  );
}

function venuesSettlingAt(rows: FundingRow[], at: number): string {
  const within = 60_000;
  return [...new Set(rows.filter((r) => r.nextMs !== null && Math.abs(r.nextMs - at) < within).map((r) => r.venue))]
    .slice(0, 3)
    .join(" · ");
}

function countdown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Sign is always shown alongside colour, so the table reads without relying on hue. */
function toneColor(v: number | undefined): string | undefined {
  if (v === undefined || v === 0) return undefined;
  return v > 0 ? "var(--colibri-role-bullish, #26a17b)" : "var(--colibri-role-bearish, #e05260)";
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: number }) {
  return (
    <div style={S.tile}>
      <div style={S.tileLabel}>{label}</div>
      <div style={{ ...S.tileValue, color: toneColor(tone) ?? "inherit" }}>{value}</div>
      <div style={S.tileSub}>{sub}</div>
    </div>
  );
}

const Th = ({ children, align }: { children: React.ReactNode; align?: "right" }) => (
  <th style={{ ...S.th, textAlign: align ?? "left" }}>{children}</th>
);

const Td = ({ children, align, dim, tone, strong }: {
  children: React.ReactNode; align?: "right"; dim?: boolean; tone?: number; strong?: boolean;
}) => (
  <td style={{
    ...S.td,
    textAlign: align ?? "left",
    color: toneColor(tone) ?? (dim ? "var(--colibri-role-dim-text, #8b93a3)" : "inherit"),
    fontWeight: strong ? 600 : 400,
  }}>{children}</td>
);

/**
 * Colours come from the host's SEMANTIC role tokens, so the widget follows a re-themed terminal.
 * Every one carries a fallback: the same page has to render standalone in a browser during
 * development, where nothing is pushed.
 */
const S = {
  root: {
    font: "calc(13px * var(--colibri-font-scale, 1))/1.45 system-ui, sans-serif",
    color: "var(--colibri-role-text, #d8dee9)",
    background: "var(--colibri-role-background, #0b0e13)",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  } as const,
  tiles: (compact: boolean) => ({
    display: "grid",
    gridTemplateColumns: compact ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
    gap: 1,
    background: "var(--colibri-role-divider, #2a2f3a)",
    flex: "0 0 auto",
  } as const),
  tile: { background: "var(--colibri-role-surface, #171b23)", padding: "8px 10px" } as const,
  tileLabel: { fontSize: "0.78em", color: "var(--colibri-role-dim-text, #8b93a3)" } as const,
  tileValue: { fontSize: "1.35em", fontWeight: 600, fontVariantNumeric: "tabular-nums" } as const,
  tileSub: { fontSize: "0.72em", color: "var(--colibri-role-dim-text, #8b93a3)" } as const,
  controls: {
    display: "flex", gap: 10, alignItems: "center", padding: "6px 10px",
    borderBottom: "1px solid var(--colibri-role-divider, #2a2f3a)", flex: "0 0 auto",
  } as const,
  control: { display: "flex", gap: 6, alignItems: "center", fontSize: "0.8em", color: "var(--colibri-role-dim-text, #8b93a3)" } as const,
  input: {
    font: "inherit", width: 64, padding: "2px 6px", color: "var(--colibri-role-text, #d8dee9)",
    background: "var(--colibri-role-surface, #171b23)", border: "1px solid var(--colibri-role-divider, #2a2f3a)", borderRadius: 3,
  } as const,
  button: {
    font: "inherit", fontSize: "0.8em", padding: "3px 8px", cursor: "pointer",
    color: "var(--colibri-role-text, #d8dee9)", background: "var(--colibri-role-surface, #171b23)",
    border: "1px solid var(--colibri-role-divider, #2a2f3a)", borderRadius: 3,
  } as const,
  tableWrap: { flex: "1 1 auto", overflow: "auto", minHeight: 0 } as const,
  table: { width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" } as const,
  th: {
    position: "sticky", top: 0, padding: "4px 10px", fontSize: "0.75em", fontWeight: 500,
    color: "var(--colibri-role-dim-text, #8b93a3)", background: "var(--colibri-role-surface, #171b23)",
    borderBottom: "1px solid var(--colibri-role-divider, #2a2f3a)",
  } as const,
  td: { padding: "3px 10px", borderBottom: "1px solid var(--colibri-role-divider, #1c2029)" } as const,
  empty: { padding: 16, color: "var(--colibri-role-dim-text, #8b93a3)" } as const,
  footer: {
    display: "flex", gap: 10, padding: "4px 10px", fontSize: "0.7em",
    color: "var(--colibri-role-dim-text, #8b93a3)",
    borderTop: "1px solid var(--colibri-role-divider, #2a2f3a)", flex: "0 0 auto",
  } as const,
  id: { display: "none" } as const,
};
