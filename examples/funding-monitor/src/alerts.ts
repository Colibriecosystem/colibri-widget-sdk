import { notifications } from "./lib/colibri.js";
import type { FundingRow } from "./venues/types";
import type { Strings } from "./i18n";

/**
 * Turns the table into terminal notifications, which is the half of this widget that has to keep
 * working while nobody is looking at it: hidden widgets keep running at full cadence, so a
 * settlement alert has to fire from a tab the user is not on.
 *
 * Both rules are edge-triggered and latched. A funding rate sits above a threshold for hours, and
 * a settlement window is minutes wide with a 60 s poll inside it — firing on every poll would make
 * the alert worthless and burn the widget's own rate budget for it.
 */
export class AlertTracker {
  /** Symbols currently above the threshold, so re-crossing is what fires, not staying. */
  private readonly armed = new Set<string>();

  /** Settlement notices already sent, keyed by the settlement instant itself. */
  private readonly settled = new Set<string>();

  /** How close to settlement counts as "about to settle". */
  static readonly SettlementWindowMs = 5 * 60 * 1000;

  activeCount = 0;

  /** Fire whatever this snapshot newly warrants. Never throws — an alert must not break a render. */
  async evaluate(rows: FundingRow[], thresholdPct: number, enabled: boolean, s: Strings, now = Date.now()): Promise<void> {
    const over = rows.filter((r) => Math.abs(r.annualized) * 100 >= thresholdPct);
    this.activeCount = over.length;

    const stillOver = new Set(over.map(key));
    for (const k of [...this.armed]) {
      if (!stillOver.has(k)) this.armed.delete(k);
    }

    if (!enabled) {
      // Keep the latches in step while muted, or unmuting would fire a burst for every row that
      // crossed while nobody was listening.
      for (const r of over) this.armed.add(key(r));
      return;
    }

    for (const r of over) {
      const k = key(r);
      if (!this.armed.has(k)) {
        this.armed.add(k);
        await this.raise(`${r.venue} ${r.symbol}: ${pct(r.annualized)} ${s.annual.toLowerCase()}`);
      }

      if (r.nextMs !== null && r.nextMs - now <= AlertTracker.SettlementWindowMs && r.nextMs > now) {
        const sk = `${k}@${r.nextMs}`;
        if (!this.settled.has(sk)) {
          this.settled.add(sk);
          await this.raise(`${r.venue} ${r.symbol}: ${s.settlementAlert} (${pct(r.annualized)})`);
        }
      }
    }

    // The settlement latch is keyed by instant, so it would grow forever; anything in the past is
    // unreachable by definition.
    for (const sk of [...this.settled]) {
      const at = Number(sk.split("@").pop());
      if (Number.isFinite(at) && at < now) this.settled.delete(sk);
    }
  }

  private async raise(message: string): Promise<void> {
    try {
      await notifications.raise({ message, severity: "warning" });
    } catch {
      // A refused or rate-limited notification is not worth breaking the table over.
    }
  }
}

const key = (r: FundingRow) => `${r.venue}|${r.symbol}`;

export function pct(annualized: number): string {
  const v = annualized * 100;
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toFixed(1)}%`;
}
