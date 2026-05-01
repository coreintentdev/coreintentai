import { describe, it, expect, beforeEach } from "vitest";
import { AdaptiveRouter } from "../src/orchestrator/adaptive-router.js";
import type { ModelProvider, TaskIntent } from "../src/types/index.js";

describe("AdaptiveRouter", () => {
  let router: AdaptiveRouter;

  beforeEach(() => {
    router = new AdaptiveRouter({
      explorationRate: 0,
      minSamples: 3,
      decayHalfLifeMs: 1000 * 60 * 60,
    });
  });

  describe("selectProvider", () => {
    it("returns the only available provider", () => {
      expect(router.selectProvider("reasoning", ["claude"])).toBe("claude");
    });

    it("throws with no providers", () => {
      expect(() => router.selectProvider("reasoning", [])).toThrow(
        "No providers available"
      );
    });

    it("favors static primary when insufficient samples", () => {
      const counts: Record<string, number> = { claude: 0, grok: 0 };
      for (let i = 0; i < 100; i++) {
        const r = new AdaptiveRouter({ explorationRate: 0, minSamples: 5 });
        const pick = r.selectProvider("reasoning", ["claude", "grok"], "claude");
        counts[pick]++;
      }
      expect(counts["claude"]).toBe(100);
    });

    it("selects provider with best success rate after sufficient samples", () => {
      for (let i = 0; i < 10; i++) {
        router.record({ intent: "reasoning", provider: "claude", success: true, latencyMs: 500 });
        router.record({ intent: "reasoning", provider: "grok", success: i < 3, latencyMs: 200 });
      }

      const pick = router.selectProvider("reasoning", ["claude", "grok"]);
      expect(pick).toBe("claude");
    });

    it("considers latency in scoring", () => {
      for (let i = 0; i < 10; i++) {
        router.record({ intent: "fast_analysis", provider: "claude", success: true, latencyMs: 5000 });
        router.record({ intent: "fast_analysis", provider: "grok", success: true, latencyMs: 100 });
      }

      const pick = router.selectProvider("fast_analysis", ["claude", "grok"]);
      expect(pick).toBe("grok");
    });

    it("tracks intents independently", () => {
      for (let i = 0; i < 10; i++) {
        router.record({ intent: "reasoning", provider: "claude", success: true, latencyMs: 300 });
        router.record({ intent: "reasoning", provider: "grok", success: false, latencyMs: 100 });
        router.record({ intent: "fast_analysis", provider: "grok", success: true, latencyMs: 50 });
        router.record({ intent: "fast_analysis", provider: "claude", success: false, latencyMs: 2000 });
      }

      expect(router.selectProvider("reasoning", ["claude", "grok"])).toBe("claude");
      expect(router.selectProvider("fast_analysis", ["claude", "grok"])).toBe("grok");
    });
  });

  describe("exploration", () => {
    it("explores with configured rate", () => {
      const exploringRouter = new AdaptiveRouter({ explorationRate: 1.0, minSamples: 3 });

      for (let i = 0; i < 10; i++) {
        exploringRouter.record({ intent: "reasoning", provider: "claude", success: true, latencyMs: 100 });
      }

      const picks = new Set<ModelProvider>();
      for (let i = 0; i < 200; i++) {
        picks.add(exploringRouter.selectProvider("reasoning", ["claude", "grok", "perplexity"]));
      }
      expect(picks.size).toBeGreaterThan(1);
    });
  });

  describe("rankProviders", () => {
    it("ranks by score descending", () => {
      for (let i = 0; i < 10; i++) {
        router.record({ intent: "sentiment", provider: "grok", success: true, latencyMs: 80 });
        router.record({ intent: "sentiment", provider: "claude", success: true, latencyMs: 300 });
        router.record({ intent: "sentiment", provider: "perplexity", success: i < 5, latencyMs: 500 });
      }

      const ranked = router.rankProviders("sentiment", ["claude", "grok", "perplexity"]);
      expect(ranked[0]).toBe("grok");
      expect(ranked[ranked.length - 1]).toBe("perplexity");
    });

    it("returns all providers even with no data", () => {
      const ranked = router.rankProviders("reasoning", ["claude", "grok"]);
      expect(ranked).toHaveLength(2);
    });
  });

  describe("getStats", () => {
    it("returns zero stats for unknown combinations", () => {
      const stats = router.getStats("reasoning", "claude");
      expect(stats.attempts).toBe(0);
      expect(stats.successes).toBe(0);
    });

    it("tracks successes and failures", () => {
      router.record({ intent: "signal", provider: "claude", success: true, latencyMs: 200 });
      router.record({ intent: "signal", provider: "claude", success: true, latencyMs: 300 });
      router.record({ intent: "signal", provider: "claude", success: false, latencyMs: 100 });

      const stats = router.getStats("signal", "claude");
      expect(stats.attempts).toBeGreaterThan(2.5);
      expect(stats.successes).toBeGreaterThan(1.5);
      expect(stats.recentLatencies).toEqual([200, 300, 100]);
    });
  });

  describe("getPerformanceSummary", () => {
    it("returns summary for recorded data", () => {
      router.record({ intent: "reasoning", provider: "claude", success: true, latencyMs: 200 });
      router.record({ intent: "reasoning", provider: "claude", success: true, latencyMs: 300 });
      router.record({ intent: "fast_analysis", provider: "grok", success: true, latencyMs: 50 });

      const summary = router.getPerformanceSummary();
      expect(summary.has("reasoning:claude")).toBe(true);
      expect(summary.has("fast_analysis:grok")).toBe(true);

      const claudeReasoning = summary.get("reasoning:claude")!;
      expect(claudeReasoning.successRate).toBe(1);
      expect(claudeReasoning.samples).toBeGreaterThanOrEqual(1);
    });

    it("returns empty summary with no data", () => {
      const summary = router.getPerformanceSummary();
      expect(summary.size).toBe(0);
    });
  });

  describe("export/import", () => {
    it("exports and imports weights", () => {
      router.record({ intent: "reasoning", provider: "claude", success: true, latencyMs: 200 });
      router.record({ intent: "reasoning", provider: "claude", success: true, latencyMs: 300 });

      const exported = router.exportWeights();
      expect(exported).toHaveLength(2);

      const newRouter = new AdaptiveRouter({ explorationRate: 0, minSamples: 1 });
      newRouter.importWeights(exported);

      const stats = newRouter.getStats("reasoning", "claude");
      expect(stats.attempts).toBeGreaterThan(0);
    });

    it("respects maxHistorySize on import", () => {
      const small = new AdaptiveRouter({ maxHistorySize: 5, explorationRate: 0 });
      const records = Array.from({ length: 20 }, (_, i) => ({
        intent: "reasoning" as TaskIntent,
        provider: "claude" as ModelProvider,
        success: true,
        latencyMs: i * 10,
        timestamp: Date.now() - (20 - i) * 1000,
      }));

      small.importWeights(records);
      expect(small.historySize).toBeLessThanOrEqual(5);
    });
  });

  describe("reset", () => {
    it("clears all history", () => {
      router.record({ intent: "reasoning", provider: "claude", success: true, latencyMs: 100 });
      expect(router.historySize).toBe(1);
      router.reset();
      expect(router.historySize).toBe(0);
    });
  });

  describe("history trimming", () => {
    it("trims history when exceeding max size", () => {
      const small = new AdaptiveRouter({ maxHistorySize: 10, explorationRate: 0 });
      for (let i = 0; i < 15; i++) {
        small.record({ intent: "reasoning", provider: "claude", success: true, latencyMs: 100 });
      }
      expect(small.historySize).toBeLessThanOrEqual(10);
    });
  });
});
