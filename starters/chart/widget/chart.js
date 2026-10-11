// chart.js — candles built from the live `trades` stream and drawn on a canvas.
//
// No chart library and no build: one canvas, redrawn only when something changed. The terminal
// has no candle-history route for widgets, so the chart starts empty and fills from the moment it
// opens; for history, fetch a venue's klines yourself through colibri.net.fetch and the manifest's
// `egress` (see the README).

/** Prints are kept as one-second candles and merged into longer timeframes when drawn. */
const BASE_MS = 1000;
/** One hour of seconds — enough for 600 candles of 5s and 60 of 1m. */
const KEEP_BASE = 3600;
/** Never more candles on screen than this, however wide the widget is. */
const MAX_SHOWN = 600;
/** CSS pixels per candle, body plus gap. */
const SPACING = 7;
/** CSS pixels kept on the right for the price axis. */
const AXIS_W = 70;
/** The volume bars' share of the height. */
const VOLUME_SHARE = 0.18;

/**
 * @param {HTMLCanvasElement} canvas the drawing surface; its CSS size decides the chart's size
 * @param {HTMLElement} readout where the hovered (or the last) candle's OHLCV is written
 */
export function createChart(canvas, readout) {
  const ctx = canvas.getContext("2d");
  /** @type {{t: number, o: number, h: number, l: number, c: number, v: number}[]} oldest first */
  let base = [];
  let timeframeMs = BASE_MS;
  let bid = null;
  let ask = null;
  let decimals = 2;
  /** True once the book's tick size has set `decimals`; until then prints decide it. */
  let tickKnown = false;
  let colors = readColors();
  let hover = null;
  let visible = true;
  let scheduled = false;

  /**
   * The terminal's palette arrives as CSS variables; a canvas cannot use var(), so the colours are
   * read once here and again on every `theme` event.
   */
  function readColors() {
    const css = getComputedStyle(document.documentElement);
    const pick = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    return {
      up: pick("--colibri-role-bullish", "#26a17b"),
      down: pick("--colibri-role-bearish", "#e05260"),
      upMuted: pick("--colibri-role-bullish-muted", "rgba(38,161,123,0.35)"),
      downMuted: pick("--colibri-role-bearish-muted", "rgba(224,82,96,0.35)"),
      text: pick("--colibri-role-dim-text", "#8b93a3"),
      grid: pick("--colibri-role-divider", "#2a2f38"),
      accent: pick("--colibri-role-accent", "#4c8dff"),
      background: pick("--colibri-role-background", "#0b0e13"),
      scale: Number(pick("--colibri-font-scale", "1")) || 1,
    };
  }

  /** Redraw on the next frame, once, however many changes arrive before it. */
  function invalidate() {
    if (scheduled || !visible) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      draw();
    });
  }

  function merge(candle, price, qty) {
    candle.h = Math.max(candle.h, price);
    candle.l = Math.min(candle.l, price);
    candle.c = price;
    candle.v += qty;
  }

  /** A batch from the `trades` stream: `{price, qty, isBuy, timeMs}`, oldest first. */
  function addTrades(trades) {
    for (const trade of trades) {
      const price = Number(trade.price);
      const qty = Number(trade.qty);
      if (!Number.isFinite(price) || !Number.isFinite(qty)) continue;
      const t = Math.floor(trade.timeMs / BASE_MS) * BASE_MS;
      const last = base[base.length - 1];
      if (last && t < last.t) {
        // A late print belongs to the second it happened in, if that second is still kept.
        for (let i = base.length - 1; i >= 0 && base[i].t >= t; i--) {
          if (base[i].t === t) merge(base[i], price, qty);
        }
        continue;
      }
      if (last && t === last.t) merge(last, price, qty);
      else base.push({ t, o: price, h: price, l: price, c: price, v: qty });
      if (!tickKnown) decimals = Math.max(decimals, (trade.price.split(".")[1] || "").length);
    }
    if (base.length > KEEP_BASE) base.splice(0, base.length - KEEP_BASE);
    invalidate();
  }

  /** The book's tick size decides how many decimals a price is printed with. */
  function setTickSize(tickSize) {
    const fraction = String(tickSize).replace(/0+$/, "").split(".")[1] || "";
    decimals = fraction.length;
    tickKnown = true;
  }

  function setQuote(bestBid, bestAsk) {
    bid = bestBid == null ? null : Number(bestBid);
    ask = bestAsk == null ? null : Number(bestAsk);
    invalidate();
  }

  /** The base seconds merged into the timeframe on screen. */
  function candles() {
    if (timeframeMs === BASE_MS) return base.slice(-MAX_SHOWN);
    const out = [];
    for (const b of base) {
      const t = Math.floor(b.t / timeframeMs) * timeframeMs;
      const last = out[out.length - 1];
      if (last && last.t === t) {
        last.h = Math.max(last.h, b.h);
        last.l = Math.min(last.l, b.l);
        last.c = b.c;
        last.v += b.v;
      } else out.push({ ...b, t });
    }
    return out.slice(-MAX_SHOWN);
  }

  /** Round axis steps: 1, 2 or 5 times a power of ten. */
  function niceTicks(lo, hi, count) {
    const raw = (hi - lo) / count;
    const power = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) || raw;
    const ticks = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
    return ticks;
  }

  const fmt = (price) => price.toFixed(decimals);
  const fmtVolume = (v) => (v >= 1000 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toPrecision(3));
  const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour12: false });

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const plotW = Math.max(0, w - AXIS_W);
    const shown = candles().slice(-Math.max(1, Math.floor(plotW / SPACING)));
    if (!shown.length || plotW === 0) {
      readout.textContent = "";
      return;
    }

    const volumeTop = h * (1 - VOLUME_SHARE);
    const priceBottom = volumeTop - 8;
    let lo = Infinity;
    let hi = -Infinity;
    let maxVolume = 0;
    for (const c of shown) {
      lo = Math.min(lo, c.l);
      hi = Math.max(hi, c.h);
      maxVolume = Math.max(maxVolume, c.v);
    }
    for (const quote of [bid, ask]) {
      if (quote != null && Number.isFinite(quote)) {
        lo = Math.min(lo, quote);
        hi = Math.max(hi, quote);
      }
    }
    const pad = (hi - lo) * 0.08 || Math.max(hi * 0.0005, Math.pow(10, -decimals));
    lo -= pad;
    hi += pad;
    const y = (price) => 6 + ((hi - price) / (hi - lo)) * (priceBottom - 6);
    const left = plotW - shown.length * SPACING;
    const centerOf = (i) => left + i * SPACING + SPACING / 2;

    ctx.font = `${Math.round(11 * colors.scale)}px "Segoe UI", system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.lineWidth = 1;

    // The price grid and its labels.
    for (const tick of niceTicks(lo, hi, 5)) {
      const ty = Math.round(y(tick)) + 0.5;
      ctx.strokeStyle = colors.grid;
      ctx.beginPath();
      ctx.moveTo(0, ty);
      ctx.lineTo(plotW, ty);
      ctx.stroke();
      ctx.fillStyle = colors.text;
      ctx.fillText(fmt(tick), plotW + 6, ty);
    }

    // Volume, then the candles over it.
    shown.forEach((c, i) => {
      const barH = maxVolume > 0 ? (c.v / maxVolume) * (h - volumeTop - 2) : 0;
      ctx.fillStyle = c.c >= c.o ? colors.upMuted : colors.downMuted;
      ctx.fillRect(left + i * SPACING + 1, h - barH, SPACING - 2, barH);
    });
    shown.forEach((c, i) => {
      const color = c.c >= c.o ? colors.up : colors.down;
      const cx = Math.round(centerOf(i)) + 0.5;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx, y(c.h));
      ctx.lineTo(cx, y(c.l));
      ctx.stroke();
      const top = y(Math.max(c.o, c.c));
      ctx.fillStyle = color;
      ctx.fillRect(left + i * SPACING + 1, top, SPACING - 2, Math.max(1, y(Math.min(c.o, c.c)) - top));
    });

    // The best bid and ask as dashed lines.
    ctx.setLineDash([3, 3]);
    for (const [quote, color] of [
      [bid, colors.up],
      [ask, colors.down],
    ]) {
      if (quote == null || !Number.isFinite(quote)) continue;
      const qy = Math.round(y(quote)) + 0.5;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, qy);
      ctx.lineTo(plotW, qy);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // The last price, labelled on the axis.
    const last = shown[shown.length - 1];
    const ly = Math.round(y(last.c));
    ctx.fillStyle = last.c >= last.o ? colors.up : colors.down;
    ctx.fillRect(plotW + 2, ly - 9, AXIS_W - 4, 18);
    ctx.fillStyle = colors.background;
    ctx.fillText(fmt(last.c), plotW + 6, ly);

    // The crosshair, and the readout of the candle under it (or of the last one).
    let picked = last;
    if (hover && hover.x < plotW) {
      const i = Math.floor((hover.x - left) / SPACING);
      if (i >= 0 && i < shown.length) {
        picked = shown[i];
        ctx.strokeStyle = colors.accent;
        ctx.beginPath();
        ctx.moveTo(Math.round(centerOf(i)) + 0.5, 0);
        ctx.lineTo(Math.round(centerOf(i)) + 0.5, h);
        ctx.moveTo(0, Math.round(hover.y) + 0.5);
        ctx.lineTo(plotW, Math.round(hover.y) + 0.5);
        ctx.stroke();
      }
    }
    readout.textContent =
      `${fmtTime(picked.t)}  O ${fmt(picked.o)}  H ${fmt(picked.h)}  L ${fmt(picked.l)}  C ${fmt(picked.c)}  V ${fmtVolume(picked.v)}`;
  }

  new ResizeObserver(invalidate).observe(canvas);
  canvas.addEventListener("mousemove", (e) => {
    const box = canvas.getBoundingClientRect();
    hover = { x: e.clientX - box.left, y: e.clientY - box.top };
    invalidate();
  });
  canvas.addEventListener("mouseleave", () => {
    hover = null;
    invalidate();
  });

  return {
    addTrades,
    setQuote,
    setTickSize,
    /** @param {number} seconds 1, 5, 15 or 60 */
    setTimeframe(seconds) {
      timeframeMs = seconds * 1000;
      invalidate();
    },
    /** Forget every candle — a new market starts empty. */
    clear() {
      base = [];
      bid = ask = null;
      decimals = 2;
      tickKnown = false;
      invalidate();
    },
    /** Re-read the palette after a theme change. */
    restyle() {
      colors = readColors();
      invalidate();
    },
    /** A hidden widget keeps collecting prints but draws nothing until it is shown again. */
    setVisible(isVisible) {
      visible = isVisible;
      invalidate();
    },
  };
}
