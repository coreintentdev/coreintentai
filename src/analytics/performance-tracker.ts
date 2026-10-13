import type { SignalRecord, PerformanceSnapshot } from "../types/index.js";
import type { AdaptiveRouter } from "../orchestrator/adaptive-router.js";
import type { ModelProvider, TaskIntent } from "../types/index.js";

export class PerformanceTracker {
  private signals: Map<string, SignalRecord> = new Map();
  private adaptiveRouter?: AdaptiveRouter;

  constructor(adaptiveRouter?: AdaptiveRouter) {
    this.adaptiveRouter = adaptiveRouter;
  }

  recordSignal(signal: SignalRecord): void {
    this.signals.set(signal.id, { ...signal });
  }

  resolveSignal(
    id: string,
    exitPrice: number,
    outcome: "win" | "loss" | "breakeven"
  ): SignalRecord | null {
    const signal = this.signals.get(id);
    if (!signal) return null;

    const resolvedAt = new Date().toISOString();
    const pnlPct = ((exitPrice - signal.entryPrice) / signal.entryPrice) * 100;
    const adjustedPnl =
      signal.action === "sell" || signal.action === "strong_sell"
        ? -pnlPct
        : pnlPct;

    const holdingPeriodMs =
      new Date(resolvedAt).getTime() - new Date(signal.generatedAt).getTime();

    const resolved: SignalRecord = {
      ...signal,
      exitPrice,
      outcome,
      pnlPct: adjustedPnl,
      resolvedAt,
      holdingPeriodMs,
    };

    this.signals.set(id, resolved);

    if (this.adaptiveRouter) {
      const qualityScore = outcome === "win" ? 0.9 : outcome === "breakeven" ? 0.5 : 0.2;
      this.adaptiveRouter.recordOutcome({
        intent: signal.intent as TaskIntent,
        provider: signal.provider as ModelProvider,
        success: outcome !== "loss",
        qualityScore,
      });
    }

    return resolved;
  }

  getSignal(id: string): SignalRecord | undefined {
    return this.signals.get(id);
  }

  getSnapshot(): PerformanceSnapshot {
    const all = Array.from(this.signals.values());
    const resolved = all.filter((s) => s.outcome !== "pending");
    const pending = all.filter((s) => s.outcome === "pending");
    const wins = resolved.filter((s) => s.outcome === "win");
    const losses = resolved.filter((s) => s.outcome === "loss");

    const winPnls = wins.map((s) => s.pnlPct ?? 0);
    const lossPnls = losses.map((s) => Math.abs(s.pnlPct ?? 0));

    const avgWinPct =
      winPnls.length > 0
        ? winPnls.reduce((a, b) => a + b, 0) / winPnls.length
        : 0;
    const avgLossPct =
      lossPnls.length > 0
        ? lossPnls.reduce((a, b) => a + b, 0) / lossPnls.length
        : 0;

    const winRate =
      resolved.length > 0 ? wins.length / resolved.length : 0;

    const grossWins = winPnls.reduce((a, b) => a + b, 0);
    const grossLosses = lossPnls.reduce((a, b) => a + b, 0);
    const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0;

    const lossRate =
      resolved.length > 0 ? losses.length / resolved.length : 0;
    const expectancy =
      resolved.length > 0
        ? (winRate * avgWinPct - lossRate * avgLossPct)
        : 0;

    const allPnls = resolved
      .filter((s) => s.pnlPct !== undefined)
      .map((s) => ({ ticker: s.ticker, pnlPct: s.pnlPct! }));

    const bestTrade =
      allPnls.length > 0
        ? allPnls.reduce((best, t) => (t.pnlPct > best.pnlPct ? t : best))
        : undefined;
    const worstTrade =
      allPnls.length > 0
        ? allPnls.reduce((worst, t) => (t.pnlPct < worst.pnlPct ? t : worst))
        : undefined;

    const byProvider = this.groupBy(resolved, "provider");
    const byIntent = this.groupBy(resolved, "intent");

    return {
      totalSignals: all.length,
      resolvedSignals: resolved.length,
      pendingSignals: pending.length,
      winRate,
      avgWinPct,
      avgLossPct,
      profitFactor: profitFactor === Infinity ? 999 : profitFactor,
      expectancy,
      bestTrade,
      worstTrade,
      byProvider,
      byIntent,
      generatedAt: new Date().toISOString(),
    };
  }

  getWinRateByProvider(provider: string): number {
    const providerSignals = Array.from(this.signals.values()).filter(
      (s) => s.provider === provider && s.outcome !== "pending"
    );
    if (providerSignals.length === 0) return 0;
    const wins = providerSignals.filter((s) => s.outcome === "win").length;
    return wins / providerSignals.length;
  }

  getSignalCount(): number {
    return this.signals.size;
  }

  getPendingSignals(): SignalRecord[] {
    return Array.from(this.signals.values()).filter(
      (s) => s.outcome === "pending"
    );
  }

  reset(): void {
    this.signals.clear();
  }

  private groupBy(
    signals: SignalRecord[],
    field: "provider" | "intent"
  ): Record<string, { signals: number; winRate: number; avgPnlPct: number }> {
    const groups = new Map<string, SignalRecord[]>();

    for (const s of signals) {
      const key = s[field];
      const group = groups.get(key) ?? [];
      group.push(s);
      groups.set(key, group);
    }

    const result: Record<
      string,
      { signals: number; winRate: number; avgPnlPct: number }
    > = {};

    for (const [key, group] of groups) {
      const wins = group.filter((s) => s.outcome === "win").length;
      const pnls = group
        .filter((s) => s.pnlPct !== undefined)
        .map((s) => s.pnlPct!);
      const avgPnl =
        pnls.length > 0
          ? pnls.reduce((a, b) => a + b, 0) / pnls.length
          : 0;

      result[key] = {
        signals: group.length,
        winRate: group.length > 0 ? wins / group.length : 0,
        avgPnlPct: avgPnl,
      };
    }

    return result;
  }
}
