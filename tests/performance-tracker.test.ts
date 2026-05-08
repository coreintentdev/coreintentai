import { describe, it, expect, beforeEach } from "vitest";
import { PerformanceTracker } from "../src/analytics/performance-tracker.js";
import { AdaptiveRouter } from "../src/orchestrator/adaptive-router.js";
import {
  SignalRecordSchema,
  PerformanceSnapshotSchema,
} from "../src/types/index.js";
import type { SignalRecord } from "../src/types/index.js";

function makeSignal(overrides: Partial<SignalRecord> = {}): SignalRecord {
  return {
    id: `sig-${Math.random().toString(36).slice(2, 8)}`,
    ticker: "AAPL",
    action: "buy",
    confidence: 0.8,
    entryPrice: 195,
    provider: "claude",
    intent: "signal",
    generatedAt: "2026-05-08T10:00:00.000Z",
    outcome: "pending",
    ...overrides,
  };
}

describe("PerformanceTracker", () => {
  let tracker: PerformanceTracker;

  beforeEach(() => {
    tracker = new PerformanceTracker();
  });

  describe("Signal Recording", () => {
    it("records a signal", () => {
      const signal = makeSignal({ id: "test-1" });
      tracker.recordSignal(signal);
      expect(tracker.getSignal("test-1")).toBeDefined();
      expect(tracker.getSignalCount()).toBe(1);
    });

    it("records multiple signals", () => {
      tracker.recordSignal(makeSignal({ id: "a" }));
      tracker.recordSignal(makeSignal({ id: "b" }));
      tracker.recordSignal(makeSignal({ id: "c" }));
      expect(tracker.getSignalCount()).toBe(3);
    });

    it("overwrites signal with same id", () => {
      tracker.recordSignal(makeSignal({ id: "dup", ticker: "AAPL" }));
      tracker.recordSignal(makeSignal({ id: "dup", ticker: "TSLA" }));
      expect(tracker.getSignalCount()).toBe(1);
      expect(tracker.getSignal("dup")?.ticker).toBe("TSLA");
    });

    it("returns undefined for unknown signal", () => {
      expect(tracker.getSignal("nonexistent")).toBeUndefined();
    });
  });

  describe("Signal Resolution", () => {
    it("resolves a winning signal", () => {
      tracker.recordSignal(makeSignal({ id: "win-1", entryPrice: 100 }));
      const resolved = tracker.resolveSignal("win-1", 110, "win");
      expect(resolved).not.toBeNull();
      expect(resolved!.outcome).toBe("win");
      expect(resolved!.pnlPct).toBeCloseTo(10);
      expect(resolved!.exitPrice).toBe(110);
      expect(resolved!.resolvedAt).toBeDefined();
    });

    it("resolves a losing signal", () => {
      tracker.recordSignal(makeSignal({ id: "loss-1", entryPrice: 100 }));
      const resolved = tracker.resolveSignal("loss-1", 90, "loss");
      expect(resolved!.outcome).toBe("loss");
      expect(resolved!.pnlPct).toBeCloseTo(-10);
    });

    it("resolves a breakeven signal", () => {
      tracker.recordSignal(makeSignal({ id: "be-1", entryPrice: 100 }));
      const resolved = tracker.resolveSignal("be-1", 100.5, "breakeven");
      expect(resolved!.outcome).toBe("breakeven");
      expect(resolved!.pnlPct).toBeCloseTo(0.5);
    });

    it("inverts PnL for sell signals", () => {
      tracker.recordSignal(
        makeSignal({ id: "sell-1", action: "sell", entryPrice: 100 })
      );
      const resolved = tracker.resolveSignal("sell-1", 90, "win");
      expect(resolved!.pnlPct).toBeCloseTo(10);
    });

    it("inverts PnL for strong_sell signals", () => {
      tracker.recordSignal(
        makeSignal({ id: "ss-1", action: "strong_sell", entryPrice: 100 })
      );
      const resolved = tracker.resolveSignal("ss-1", 110, "loss");
      // Price went up 10% against the short → -10% PnL
      expect(resolved!.pnlPct).toBeCloseTo(-10);
    });

    it("returns null for unknown signal resolution", () => {
      const result = tracker.resolveSignal("ghost", 100, "win");
      expect(result).toBeNull();
    });

    it("computes holding period", () => {
      const past = new Date("2026-05-01T10:00:00.000Z");
      tracker.recordSignal(
        makeSignal({ id: "hold-1", generatedAt: past.toISOString() })
      );
      const resolved = tracker.resolveSignal("hold-1", 200, "win");
      expect(resolved!.holdingPeriodMs).toBeGreaterThan(0);
    });
  });

  describe("Performance Snapshot", () => {
    it("returns empty snapshot for no signals", () => {
      const snap = tracker.getSnapshot();
      expect(snap.totalSignals).toBe(0);
      expect(snap.winRate).toBe(0);
      expect(snap.profitFactor).toBe(0);
      expect(snap.expectancy).toBe(0);
    });

    it("returns correct snapshot for pending-only signals", () => {
      tracker.recordSignal(makeSignal());
      tracker.recordSignal(makeSignal());
      const snap = tracker.getSnapshot();
      expect(snap.totalSignals).toBe(2);
      expect(snap.pendingSignals).toBe(2);
      expect(snap.resolvedSignals).toBe(0);
    });

    it("computes win rate correctly", () => {
      tracker.recordSignal(makeSignal({ id: "w1", entryPrice: 100 }));
      tracker.recordSignal(makeSignal({ id: "w2", entryPrice: 100 }));
      tracker.recordSignal(makeSignal({ id: "l1", entryPrice: 100 }));

      tracker.resolveSignal("w1", 110, "win");
      tracker.resolveSignal("w2", 120, "win");
      tracker.resolveSignal("l1", 90, "loss");

      const snap = tracker.getSnapshot();
      expect(snap.winRate).toBeCloseTo(2 / 3);
      expect(snap.resolvedSignals).toBe(3);
    });

    it("computes expectancy correctly with breakeven trades", () => {
      tracker.recordSignal(makeSignal({ id: "ex-w", entryPrice: 100 }));
      tracker.recordSignal(makeSignal({ id: "ex-l", entryPrice: 100 }));
      tracker.recordSignal(makeSignal({ id: "ex-b", entryPrice: 100 }));

      tracker.resolveSignal("ex-w", 110, "win");
      tracker.resolveSignal("ex-l", 95, "loss");
      tracker.resolveSignal("ex-b", 100, "breakeven");

      const snap = tracker.getSnapshot();
      // winRate = 1/3, lossRate = 1/3, avgWin = 10%, avgLoss = 5%
      // expectancy = (1/3)*10 - (1/3)*5 = 1.667
      expect(snap.expectancy).toBeCloseTo(1.667, 1);
    });

    it("computes profit factor correctly", () => {
      tracker.recordSignal(makeSignal({ id: "pf-w", entryPrice: 100 }));
      tracker.recordSignal(makeSignal({ id: "pf-l", entryPrice: 100 }));

      tracker.resolveSignal("pf-w", 120, "win");
      tracker.resolveSignal("pf-l", 95, "loss");

      const snap = tracker.getSnapshot();
      expect(snap.profitFactor).toBeCloseTo(20 / 5);
    });

    it("identifies best and worst trades", () => {
      tracker.recordSignal(makeSignal({ id: "best", entryPrice: 100 }));
      tracker.recordSignal(makeSignal({ id: "worst", entryPrice: 100 }));
      tracker.recordSignal(makeSignal({ id: "mid", entryPrice: 100 }));

      tracker.resolveSignal("best", 130, "win");
      tracker.resolveSignal("worst", 80, "loss");
      tracker.resolveSignal("mid", 105, "win");

      const snap = tracker.getSnapshot();
      expect(snap.bestTrade?.pnlPct).toBeCloseTo(30);
      expect(snap.worstTrade?.pnlPct).toBeCloseTo(-20);
    });

    it("groups by provider", () => {
      tracker.recordSignal(
        makeSignal({ id: "c1", provider: "claude", entryPrice: 100 })
      );
      tracker.recordSignal(
        makeSignal({ id: "g1", provider: "grok", entryPrice: 100 })
      );
      tracker.recordSignal(
        makeSignal({ id: "g2", provider: "grok", entryPrice: 100 })
      );

      tracker.resolveSignal("c1", 110, "win");
      tracker.resolveSignal("g1", 105, "win");
      tracker.resolveSignal("g2", 90, "loss");

      const snap = tracker.getSnapshot();
      expect(snap.byProvider["claude"]?.signals).toBe(1);
      expect(snap.byProvider["claude"]?.winRate).toBe(1);
      expect(snap.byProvider["grok"]?.signals).toBe(2);
      expect(snap.byProvider["grok"]?.winRate).toBe(0.5);
    });

    it("groups by intent", () => {
      tracker.recordSignal(
        makeSignal({ id: "i1", intent: "signal", entryPrice: 100 })
      );
      tracker.recordSignal(
        makeSignal({ id: "i2", intent: "sentiment", entryPrice: 100 })
      );

      tracker.resolveSignal("i1", 115, "win");
      tracker.resolveSignal("i2", 90, "loss");

      const snap = tracker.getSnapshot();
      expect(snap.byIntent["signal"]?.winRate).toBe(1);
      expect(snap.byIntent["sentiment"]?.winRate).toBe(0);
    });

    it("produces a schema-valid snapshot", () => {
      tracker.recordSignal(makeSignal({ id: "sv1", entryPrice: 100 }));
      tracker.resolveSignal("sv1", 110, "win");
      const snap = tracker.getSnapshot();
      const parsed = PerformanceSnapshotSchema.parse(snap);
      expect(parsed.totalSignals).toBe(1);
    });
  });

  describe("Provider Win Rate", () => {
    it("returns 0 for unknown provider", () => {
      expect(tracker.getWinRateByProvider("claude")).toBe(0);
    });

    it("returns correct win rate per provider", () => {
      tracker.recordSignal(
        makeSignal({ id: "p1", provider: "claude", entryPrice: 100 })
      );
      tracker.recordSignal(
        makeSignal({ id: "p2", provider: "claude", entryPrice: 100 })
      );
      tracker.resolveSignal("p1", 110, "win");
      tracker.resolveSignal("p2", 90, "loss");
      expect(tracker.getWinRateByProvider("claude")).toBe(0.5);
    });

    it("excludes pending signals from win rate", () => {
      tracker.recordSignal(
        makeSignal({ id: "pp1", provider: "grok", entryPrice: 100 })
      );
      tracker.recordSignal(
        makeSignal({ id: "pp2", provider: "grok", entryPrice: 100 })
      );
      tracker.resolveSignal("pp1", 120, "win");
      // pp2 still pending
      expect(tracker.getWinRateByProvider("grok")).toBe(1);
    });
  });

  describe("Pending Signals", () => {
    it("returns pending signals", () => {
      tracker.recordSignal(makeSignal({ id: "pd1" }));
      tracker.recordSignal(makeSignal({ id: "pd2" }));
      tracker.recordSignal(makeSignal({ id: "pd3", entryPrice: 100 }));
      tracker.resolveSignal("pd3", 110, "win");
      const pending = tracker.getPendingSignals();
      expect(pending).toHaveLength(2);
    });
  });

  describe("Adaptive Router Integration", () => {
    it("feeds outcomes to adaptive router on resolution", () => {
      const router = new AdaptiveRouter();
      const trackerWithRouter = new PerformanceTracker(router);

      trackerWithRouter.recordSignal(
        makeSignal({ id: "ar1", provider: "claude", intent: "signal", entryPrice: 100 })
      );
      trackerWithRouter.resolveSignal("ar1", 115, "win");

      const score = router.scoreProvider("signal", "claude");
      expect(score.sampleCount).toBe(1);
      expect(score.qualityScore).toBeGreaterThan(0.5);
    });

    it("records loss quality to adaptive router", () => {
      const router = new AdaptiveRouter();
      const trackerWithRouter = new PerformanceTracker(router);

      trackerWithRouter.recordSignal(
        makeSignal({ id: "ar2", provider: "grok", intent: "signal", entryPrice: 100 })
      );
      trackerWithRouter.resolveSignal("ar2", 85, "loss");

      const score = router.scoreProvider("signal", "grok");
      expect(score.sampleCount).toBe(1);
      expect(score.qualityScore).toBeLessThan(0.5);
    });

    it("does not pollute adaptive router latency tracking", () => {
      const router = new AdaptiveRouter();
      // Seed the router with a real latency observation
      router.recordOutcome({
        intent: "signal",
        provider: "claude",
        success: true,
        latencyMs: 2000,
      });

      const trackerWithRouter = new PerformanceTracker(router);
      trackerWithRouter.recordSignal(
        makeSignal({ id: "lat1", provider: "claude", intent: "signal", entryPrice: 100 })
      );
      trackerWithRouter.resolveSignal("lat1", 110, "win");

      const score = router.scoreProvider("signal", "claude");
      // Latency should remain near 2000ms, not be pulled toward 0
      expect(score.avgLatencyMs).toBeGreaterThan(1000);
    });
  });

  describe("Reset", () => {
    it("clears all signals", () => {
      tracker.recordSignal(makeSignal({ id: "r1" }));
      tracker.recordSignal(makeSignal({ id: "r2" }));
      expect(tracker.getSignalCount()).toBe(2);
      tracker.reset();
      expect(tracker.getSignalCount()).toBe(0);
    });
  });

  describe("SignalRecordSchema", () => {
    it("validates a complete signal record", () => {
      const record = {
        id: "sig-abc123",
        ticker: "AAPL",
        action: "buy",
        confidence: 0.85,
        entryPrice: 195,
        exitPrice: 210,
        stopLoss: 185,
        takeProfit: 220,
        provider: "claude",
        intent: "signal",
        generatedAt: "2026-05-08T10:00:00.000Z",
        resolvedAt: "2026-05-10T15:30:00.000Z",
        outcome: "win",
        pnlPct: 7.69,
        holdingPeriodMs: 193800000,
      };
      const parsed = SignalRecordSchema.parse(record);
      expect(parsed.ticker).toBe("AAPL");
      expect(parsed.outcome).toBe("win");
    });

    it("validates a minimal pending record", () => {
      const record = {
        id: "sig-min",
        ticker: "TSLA",
        action: "strong_buy",
        confidence: 0.92,
        entryPrice: 250,
        provider: "grok",
        intent: "fast_analysis",
        generatedAt: "2026-05-08T10:00:00.000Z",
        outcome: "pending",
      };
      const parsed = SignalRecordSchema.parse(record);
      expect(parsed.outcome).toBe("pending");
      expect(parsed.exitPrice).toBeUndefined();
    });

    it("accepts all signal actions", () => {
      const actions = [
        "strong_buy",
        "buy",
        "hold",
        "sell",
        "strong_sell",
      ] as const;
      for (const action of actions) {
        const record = {
          id: `act-${action}`,
          ticker: "X",
          action,
          confidence: 0.5,
          entryPrice: 100,
          provider: "claude",
          intent: "signal",
          generatedAt: "2026-05-08T10:00:00.000Z",
          outcome: "pending",
        };
        const parsed = SignalRecordSchema.parse(record);
        expect(parsed.action).toBe(action);
      }
    });

    it("accepts all outcome types", () => {
      const outcomes = ["win", "loss", "breakeven", "pending"] as const;
      for (const outcome of outcomes) {
        const record = {
          id: `out-${outcome}`,
          ticker: "X",
          action: "buy",
          confidence: 0.5,
          entryPrice: 100,
          provider: "claude",
          intent: "signal",
          generatedAt: "2026-05-08T10:00:00.000Z",
          outcome,
        };
        const parsed = SignalRecordSchema.parse(record);
        expect(parsed.outcome).toBe(outcome);
      }
    });

    it("rejects confidence out of range", () => {
      expect(() =>
        SignalRecordSchema.parse({
          id: "x",
          ticker: "X",
          action: "buy",
          confidence: 1.5,
          entryPrice: 100,
          provider: "x",
          intent: "x",
          generatedAt: "2026-05-08T10:00:00.000Z",
          outcome: "pending",
        })
      ).toThrow();
    });

    it("rejects zero entry price", () => {
      expect(() =>
        SignalRecordSchema.parse({
          id: "x",
          ticker: "X",
          action: "buy",
          confidence: 0.5,
          entryPrice: 0,
          provider: "x",
          intent: "x",
          generatedAt: "2026-05-08T10:00:00.000Z",
          outcome: "pending",
        })
      ).toThrow();
    });
  });
});
