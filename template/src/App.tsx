import { useEffect, useState } from "react";
import colibri, { markets, on, storage, stream } from "./lib/colibri.js";

type Top = { bid?: string; ask?: string; error?: string };

/**
 * The whole point of the starter: live terminal data on screen with as little ceremony as
 * possible. It reads the book once for an immediate paint, then follows the stream — polling a
 * book route in a loop is what `rate_limited` exists to stop.
 *
 * Nothing here styles itself. The terminal pushes its palette in as CSS custom properties before
 * any of this code runs, so using `var(--colibri-*)` is what makes a widget look like part of the
 * app rather than a web page someone embedded.
 */
export default function App() {
  // Available synchronously — there is no ready event to wait for.
  const { widgetId, grantedScopes } = colibri.handshake();

  // Where this widget lives can CHANGE without it being recreated — dragging a widget window back
  // into the grid hands the live instance over, page and all. The handshake is a one-shot
  // bootstrap, so the move arrives as an event.
  const [surface, setSurface] = useState(colibri.handshake().surface);
  useEffect(() => on("surface", (e: any) => setSurface(e.surface)), []);

  const [symbol, setSymbol] = useState("BTCUSDT");
  const [top, setTop] = useState<Top>({});

  // Remember the last symbol across reloads. `storage` is per instance and survives a restart;
  // in-memory state does not survive the dev loop's reload, which is the point of the contrast.
  useEffect(() => {
    storage.get("symbol").then((saved) => {
      if (typeof saved === "string" && saved.length > 0) setSymbol(saved);
    });
  }, []);

  useEffect(() => {
    let live = true;
    void storage.set("symbol", symbol);

    markets
      .book("BinanceSpot", symbol, { depth: 1 })
      .then((b: any) => {
        if (live) setTop({ bid: b?.bids?.[0]?.price, ask: b?.asks?.[0]?.price });
      })
      .catch((e: any) => {
        if (live) setTop({ error: e?.code ?? "failed" });
      });

    const stop = stream.subscribe(
      "book",
      { exchange: "BinanceSpot", symbol, depth: 1 },
      (data: any) => {
        if (live) setTop({ bid: data?.bids?.[0]?.price, ask: data?.asks?.[0]?.price });
      },
    );

    return () => {
      live = false;
      stop();
    };
  }, [symbol]);

  return (
    <div
      style={{
        font: "13px/1.5 system-ui, sans-serif",
        color: "var(--colibri-role-text, #ddd)",
        background: "var(--colibri-role-background, #14171c)",
        padding: 16,
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      <h1 style={{ fontSize: 15, margin: "0 0 12px" }}>{widgetId}</h1>

      <input
        value={symbol}
        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
        style={{
          font: "inherit",
          padding: "4px 8px",
          color: "inherit",
          background: "var(--colibri-role-surface, #1c2027)",
          border: "1px solid var(--colibri-role-divider, #2a2f38)",
          borderRadius: 4,
        }}
      />

      <div style={{ marginTop: 12, fontVariantNumeric: "tabular-nums" }}>
        {top.error ? (
          <span style={{ color: "var(--colibri-role-bearish, #e05260)" }}>{top.error}</span>
        ) : (
          <>
            <span style={{ color: "var(--colibri-role-bullish, #26a17b)" }}>{top.bid ?? "—"}</span>
            {" / "}
            <span style={{ color: "var(--colibri-role-bearish, #e05260)" }}>{top.ask ?? "—"}</span>
          </>
        )}
      </div>

      <p style={{ marginTop: 16, opacity: 0.6, fontSize: 11 }}>
        surface: {surface} · scopes: {grantedScopes.join(", ") || "none"}
      </p>
    </div>
  );
}
