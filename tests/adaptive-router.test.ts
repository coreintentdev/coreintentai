import { describe, it, expect, beforeEach, vi } from "vitest";
import { AdaptiveRouter } from "../src/orchestrator/adaptive-router.js";
import type { ModelProvider, TaskIntent } from "../src/types/index.js";

describe("AdaptiveRouter", () => {
  let router: AdaptiveRouter;

  beforeEach(() => {
    router = new AdaptiveRouter({
      windowSize: 50,
      minSamples: 5,
      ttlMs: 3_600_000,
    });
  });

  describe("recordOutcome", () => {
    it("records and retrieves performance data", () => {
      router.recordOutcome("reasoning", "claude", {
        success: true,
        latencyMs: 200,
        costUsd: 0.003,
      });

      const score = router.getScore("reasoning", "claude");
      expect(score).not.toBeNull();
      expect(score!.successRate).toBe(1);
      expect(score!.avgLatencyMs).toBe(200);
      expect(score!.avgCostUsd).toBe(0.003);
      expect(score!.sampleCount).toBe(1);
    });

    it("computes aggregate statistics", () => {
      router.recordOutcome("reasoning", "claude", {
        success: true,
        latencyMs: 100,
        costUsd: 0.002,
      });
      router.recordOutcome("reasoning", "claude", {
        success: true,
        latencyMs: 300,
        costUsd: 0.004,
      });
      router.recordOutcome("reasoning", "claude", {
        success: false,
        latencyMs: 5000,
        costUsd: 0,
      });

      const score = router.getScore("reasoning", "claude");
      expect(score!.successRate).toBeCloseTo(2 / 3);
      expect(score!.avgLatencyMs).toBeCloseTo(1800);
      expect(score!.avgCostUsd).toBeCloseTo(0.002);
      expect(score!.sampleCount).toBe(3);
    });

    it("trims records beyond window size", () => {
      const router = new AdaptiveRouter({ windowSize: 5, minSamples: 1 });

      for (let i = 0; i < 10; i++) {
        router.recordOutcome("reasoning", "claude", {
          success: true,
          latencyMs: i * 100,
          costUsd: 0.001,
        });
      }

      const score = router.getScore("reasoning", "claude");
      expect(score!.sampleCount).toBe(5);
      // Last 5 records: latency 500,600,700,800,900 → avg 700
      expect(score!.avgLatencyMs).toBe(700);
    });
  });

  describe("compositeScore", () => {
    it("returns null below minimum samples", () => {
      router.recordOutcome("reasoning", "claude", {
        success: true,
        latencyMs: 200,
        costUsd: 0.003,
      });

      expect(router.compositeScore("reasoning", "claude")).toBeNull();
    });

    it("returns score above minimum samples", () => {
      feedSamples(router, "reasoning", "claude", 10, {
        successRate: 1.0,
        avgLatencyMs: 200,
        avgCostUsd: 0.003,
      });

      const score = router.compositeScore("reasoning", "claude");
      expect(score).not.toBeNull();
      expect(score!).toBeGreaterThan(0);
    });

    it("higher success rate yields higher score", () => {
      feedSamples(router, "reasoning", "claude", 10, {
        successRate: 1.0,
        avgLatencyMs: 200,
        avgCostUsd: 0.003,
      });
      feedSamples(router, "reasoning", "grok", 10, {
        successRate: 0.5,
        avgLatencyMs: 200,
        avgCostUsd: 0.003,
      });

      const claudeScore = router.compositeScore("reasoning", "claude")!;
      const grokScore = router.compositeScore("reasoning", "grok")!;
      expect(claudeScore).toBeGreaterThan(grokScore);
    });

    it("lower latency yields higher score (all else equal)", () => {
      feedSamples(router, "sentiment", "grok", 10, {
        successRate: 1.0,
        avgLatencyMs: 50,
        avgCostUsd: 0.003,
      });
      feedSamples(router, "sentiment", "claude", 10, {
        successRate: 1.0,
        avgLatencyMs: 500,
        avgCostUsd: 0.003,
      });

      const grokScore = router.compositeScore("sentiment", "grok")!;
      const claudeScore = router.compositeScore("sentiment", "claude")!;
      expect(grokScore).toBeGreaterThan(claudeScore);
    });

    it("lower cost yields higher score (all else equal)", () => {
      feedSamples(router, "research", "perplexity", 10, {
        successRate: 1.0,
        avgLatencyMs: 200,
        avgCostUsd: 0.001,
      });
      feedSamples(router, "research", "claude", 10, {
        successRate: 1.0,
        avgLatencyMs: 200,
        avgCostUsd: 0.05,
      });

      const pplxScore = router.compositeScore("research", "perplexity")!;
      const claudeScore = router.compositeScore("research", "claude")!;
      expect(pplxScore).toBeGreaterThan(claudeScore);
    });
  });

  describe("getOptimizedChain", () => {
    it("falls back to static routing with insufficient data", () => {
      const chain = router.getOptimizedChain("reasoning");
      expect(chain).toEqual(["claude", "grok"]);
    });

    it("falls back to static routing when only some providers have data", () => {
      feedSamples(router, "reasoning", "claude", 10, {
        successRate: 1.0,
        avgLatencyMs: 200,
        avgCostUsd: 0.003,
      });
      // grok has no data

      const chain = router.getOptimizedChain("reasoning");
      expect(chain).toEqual(["claude", "grok"]);
    });

    it("reorders chain based on performance data", () => {
      feedSamples(router, "sentiment", "grok", 10, {
        successRate: 0.5,
        avgLatencyMs: 1000,
        avgCostUsd: 0.05,
      });
      feedSamples(router, "sentiment", "claude", 10, {
        successRate: 1.0,
        avgLatencyMs: 200,
        avgCostUsd: 0.003,
      });
      feedSamples(router, "sentiment", "perplexity", 10, {
        successRate: 0.9,
        avgLatencyMs: 300,
        avgCostUsd: 0.002,
      });

      const chain = router.getOptimizedChain("sentiment");
      // Claude should be first (perfect success, low latency, low cost)
      expect(chain[0]).toBe("claude");
      // Grok should be last (50% success, high latency, high cost)
      expect(chain[chain.length - 1]).toBe("grok");
    });

    it("respects preferredProvider", () => {
      const chain = router.getOptimizedChain("reasoning", "perplexity");
      expect(chain[0]).toBe("perplexity");
    });
  });

  describe("TTL expiration", () => {
    it("excludes expired records", () => {
      const router = new AdaptiveRouter({
        windowSize: 50,
        minSamples: 1,
        ttlMs: 100,
      });

      router.recordOutcome("reasoning", "claude", {
        success: true,
        latencyMs: 200,
        costUsd: 0.003,
      });

      vi.useFakeTimers();
      vi.advanceTimersByTime(200);

      const score = router.getScore("reasoning", "claude");
      expect(score).toBeNull();

      vi.useRealTimers();
    });
  });

  describe("getSnapshot", () => {
    it("returns scores for all tracked combinations", () => {
      feedSamples(router, "reasoning", "claude", 5, {
        successRate: 1.0,
        avgLatencyMs: 200,
        avgCostUsd: 0.003,
      });
      feedSamples(router, "sentiment", "grok", 5, {
        successRate: 0.9,
        avgLatencyMs: 50,
        avgCostUsd: 0.001,
      });

      const snap = router.getSnapshot();
      expect(snap.size).toBe(2);
      expect(snap.has("reasoning:claude")).toBe(true);
      expect(snap.has("sentiment:grok")).toBe(true);
    });
  });

  describe("reset", () => {
    it("clears all history", () => {
      feedSamples(router, "reasoning", "claude", 5, {
        successRate: 1.0,
        avgLatencyMs: 200,
        avgCostUsd: 0.003,
      });

      router.reset();

      expect(router.getScore("reasoning", "claude")).toBeNull();
      expect(router.getSnapshot().size).toBe(0);
    });
  });

  describe("intent isolation", () => {
    it("tracks different intents independently", () => {
      feedSamples(router, "reasoning", "claude", 10, {
        successRate: 1.0,
        avgLatencyMs: 500,
        avgCostUsd: 0.005,
      });
      feedSamples(router, "fast_analysis", "claude", 10, {
        successRate: 0.8,
        avgLatencyMs: 100,
        avgCostUsd: 0.002,
      });

      const reasoningScore = router.getScore("reasoning", "claude");
      const fastScore = router.getScore("fast_analysis", "claude");

      expect(reasoningScore!.successRate).toBe(1.0);
      expect(fastScore!.successRate).toBe(0.8);
      expect(reasoningScore!.avgLatencyMs).toBe(500);
      expect(fastScore!.avgLatencyMs).toBe(100);
    });
  });

  describe("custom weights", () => {
    it("latency-weighted router prioritizes speed", () => {
      const latencyRouter = new AdaptiveRouter({
        minSamples: 5,
        weights: { successRate: 0.1, latency: 0.8, cost: 0.1 },
      });

      feedSamples(latencyRouter, "sentiment", "grok", 10, {
        successRate: 0.9,
        avgLatencyMs: 50,
        avgCostUsd: 0.003,
      });
      feedSamples(latencyRouter, "sentiment", "claude", 10, {
        successRate: 1.0,
        avgLatencyMs: 500,
        avgCostUsd: 0.003,
      });

      const grokScore = latencyRouter.compositeScore("sentiment", "grok")!;
      const claudeScore = latencyRouter.compositeScore("sentiment", "claude")!;
      // Grok is faster, should win despite slightly lower success rate
      expect(grokScore).toBeGreaterThan(claudeScore);
    });
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function feedSamples(
  router: AdaptiveRouter,
  intent: TaskIntent,
  provider: ModelProvider,
  count: number,
  profile: { successRate: number; avgLatencyMs: number; avgCostUsd: number }
): void {
  const successCount = Math.round(count * profile.successRate);
  for (let i = 0; i < count; i++) {
    const success = i < successCount;
    router.recordOutcome(intent, provider, {
      success,
      latencyMs: profile.avgLatencyMs,
      costUsd: success ? profile.avgCostUsd : 0,
    });
  }
}
