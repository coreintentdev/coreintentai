import { describe, it, expect, beforeEach } from "vitest";
import { PerformanceTracker } from "../src/orchestrator/performance.js";

function makeObs(overrides: Partial<Parameters<PerformanceTracker["record"]>[0]> = {}) {
  return {
    provider: "claude" as const,
    intent: "reasoning" as const,
    latencyMs: 500,
    success: true,
    tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
    ...overrides,
  };
}

describe("PerformanceTracker", () => {
  let tracker: PerformanceTracker;

  beforeEach(() => {
    tracker = new PerformanceTracker();
  });

  describe("Recording", () => {
    it("records observations and returns report", () => {
      tracker.record(makeObs());
      const report = tracker.getReport("claude", "reasoning");
      expect(report).not.toBeNull();
      expect(report!.totalRequests).toBe(1);
      expect(report!.successRate).toBe(1);
    });

    it("tracks multiple observations", () => {
      tracker.record(makeObs({ latencyMs: 200 }));
      tracker.record(makeObs({ latencyMs: 400 }));
      tracker.record(makeObs({ latencyMs: 600 }));

      const report = tracker.getReport("claude", "reasoning");
      expect(report!.totalRequests).toBe(3);
      expect(report!.avgLatencyMs).toBe(400);
    });

    it("tracks failures separately", () => {
      tracker.record(makeObs({ success: true }));
      tracker.record(makeObs({ success: true }));
      tracker.record(makeObs({ success: false }));

      const report = tracker.getReport("claude", "reasoning");
      expect(report!.successRate).toBeCloseTo(2 / 3);
    });

    it("tracks different providers separately", () => {
      tracker.record(makeObs({ provider: "claude", latencyMs: 500 }));
      tracker.record(makeObs({ provider: "grok", latencyMs: 200 }));

      const claudeReport = tracker.getReport("claude", "reasoning");
      const grokReport = tracker.getReport("grok", "reasoning");

      expect(claudeReport!.avgLatencyMs).toBe(500);
      expect(grokReport!.avgLatencyMs).toBe(200);
    });

    it("tracks different intents separately", () => {
      tracker.record(makeObs({ intent: "reasoning" }));
      tracker.record(makeObs({ intent: "sentiment" }));

      const r1 = tracker.getReport("claude", "reasoning");
      const r2 = tracker.getReport("claude", "sentiment");

      expect(r1!.totalRequests).toBe(1);
      expect(r2!.totalRequests).toBe(1);
    });

    it("returns null for unknown provider/intent", () => {
      const report = tracker.getReport("claude", "reasoning");
      expect(report).toBeNull();
    });
  });

  describe("Percentiles", () => {
    it("calculates latency percentiles", () => {
      for (let i = 1; i <= 100; i++) {
        tracker.record(makeObs({ latencyMs: i * 10 }));
      }

      const report = tracker.getReport("claude", "reasoning")!;
      expect(report.p50LatencyMs).toBe(510);
      expect(report.p95LatencyMs).toBe(960);
      expect(report.p99LatencyMs).toBe(1000);
    });
  });

  describe("Scoring", () => {
    it("scores higher for better success rate", () => {
      const t1 = new PerformanceTracker();
      for (let i = 0; i < 10; i++) t1.record(makeObs({ success: true }));

      const t2 = new PerformanceTracker();
      for (let i = 0; i < 5; i++) t2.record(makeObs({ success: true }));
      for (let i = 0; i < 5; i++) t2.record(makeObs({ success: false }));

      const score1 = t1.getReport("claude", "reasoning")!.score;
      const score2 = t2.getReport("claude", "reasoning")!.score;
      expect(score1).toBeGreaterThan(score2);
    });

    it("scores higher for lower latency", () => {
      const t1 = new PerformanceTracker();
      for (let i = 0; i < 10; i++) t1.record(makeObs({ latencyMs: 100 }));

      const t2 = new PerformanceTracker();
      for (let i = 0; i < 10; i++) t2.record(makeObs({ latencyMs: 15000 }));

      const score1 = t1.getReport("claude", "reasoning")!.score;
      const score2 = t2.getReport("claude", "reasoning")!.score;
      expect(score1).toBeGreaterThan(score2);
    });
  });

  describe("Rankings", () => {
    it("ranks providers by composite score", () => {
      for (let i = 0; i < 10; i++) {
        tracker.record(makeObs({ provider: "claude", latencyMs: 800, success: true }));
        tracker.record(makeObs({ provider: "grok", latencyMs: 200, success: true }));
      }

      const ranking = tracker.rankProviders("reasoning");
      expect(ranking.rankings).toHaveLength(2);
      expect(ranking.rankings[0].provider).toBe("grok");
    });

    it("penalizes providers with low success rate", () => {
      for (let i = 0; i < 10; i++) {
        tracker.record(makeObs({ provider: "claude", latencyMs: 1000, success: true }));
      }
      for (let i = 0; i < 10; i++) {
        tracker.record(makeObs({ provider: "grok", latencyMs: 100, success: i < 3 }));
      }

      const ranking = tracker.rankProviders("reasoning");
      expect(ranking.rankings[0].provider).toBe("claude");
    });

    it("returns empty rankings for unknown intent", () => {
      const ranking = tracker.rankProviders("reasoning");
      expect(ranking.rankings).toHaveLength(0);
    });
  });

  describe("Recommended Provider", () => {
    it("recommends the best-performing provider", () => {
      for (let i = 0; i < 10; i++) {
        tracker.record(makeObs({ provider: "claude", latencyMs: 500 }));
        tracker.record(makeObs({ provider: "grok", latencyMs: 100 }));
      }

      const rec = tracker.getRecommendedProvider("reasoning");
      expect(rec).toBe("grok");
    });

    it("requires minimum observations", () => {
      tracker.record(makeObs({ provider: "claude", latencyMs: 100 }));

      const rec = tracker.getRecommendedProvider("reasoning", 5);
      expect(rec).toBeNull();
    });

    it("returns null for unknown intent", () => {
      const rec = tracker.getRecommendedProvider("reasoning");
      expect(rec).toBeNull();
    });
  });

  describe("Full Report", () => {
    it("returns all tracked provider/intent combinations", () => {
      tracker.record(makeObs({ provider: "claude", intent: "reasoning" }));
      tracker.record(makeObs({ provider: "grok", intent: "reasoning" }));
      tracker.record(makeObs({ provider: "claude", intent: "sentiment" }));

      const report = tracker.getFullReport();
      expect(report).toHaveLength(3);
    });

    it("returns reports sorted by score descending", () => {
      for (let i = 0; i < 5; i++) {
        tracker.record(makeObs({ provider: "claude", latencyMs: 2000 }));
        tracker.record(makeObs({ provider: "grok", latencyMs: 100 }));
      }

      const report = tracker.getFullReport();
      expect(report[0].score).toBeGreaterThanOrEqual(report[1].score);
    });
  });

  describe("Summary", () => {
    it("returns correct summary stats", () => {
      for (let i = 0; i < 5; i++) {
        tracker.record(makeObs({ provider: "claude", intent: "reasoning" }));
        tracker.record(makeObs({ provider: "grok", intent: "sentiment" }));
      }

      const summary = tracker.getSummary();
      expect(summary.totalObservations).toBe(10);
      expect(summary.intentsTracked).toBe(2);
      expect(summary.providersTracked.size).toBe(2);
      expect(summary.topPerformers).toHaveLength(2);
    });
  });

  describe("Reset", () => {
    it("clears all tracked data", () => {
      tracker.record(makeObs());
      tracker.reset();

      const report = tracker.getReport("claude", "reasoning");
      expect(report).toBeNull();
      expect(tracker.getFullReport()).toHaveLength(0);
    });
  });
});
