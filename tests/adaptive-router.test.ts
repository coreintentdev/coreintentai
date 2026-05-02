import { describe, it, expect, beforeEach } from "vitest";
import { AdaptiveRouter } from "../src/orchestrator/adaptive-router.js";

describe("AdaptiveRouter", () => {
  let router: AdaptiveRouter;

  beforeEach(() => {
    router = new AdaptiveRouter({ minSamples: 3 });
  });

  describe("static fallback", () => {
    it("returns static route when no performance data exists", () => {
      const route = router.resolveRoute("reasoning");
      expect(route.primary).toBe("claude");
      expect(route.fallbacks).toContain("grok");
    });

    it("returns static route when insufficient samples", () => {
      router.recordOutcome("claude", "reasoning", true, 500);
      router.recordOutcome("grok", "reasoning", true, 200);
      const route = router.resolveRoute("reasoning");
      expect(route.primary).toBe("claude");
    });

    it("respects preferred provider when no adaptive data", () => {
      const route = router.resolveRoute("reasoning", "perplexity");
      expect(route.primary).toBe("perplexity");
    });
  });

  describe("adaptive routing", () => {
    it("promotes faster provider after sufficient samples", () => {
      for (let i = 0; i < 5; i++) {
        router.recordOutcome("claude", "sentiment", true, 3000);
        router.recordOutcome("grok", "sentiment", true, 500);
      }

      const route = router.resolveRoute("sentiment");
      expect(route.primary).toBe("grok");
    });

    it("deprioritizes provider with low success rate", () => {
      for (let i = 0; i < 5; i++) {
        router.recordOutcome("grok", "reasoning", false, 200);
        router.recordOutcome("claude", "reasoning", true, 1500);
      }

      const route = router.resolveRoute("reasoning");
      expect(route.primary).toBe("claude");
    });

    it("balances success rate and latency", () => {
      for (let i = 0; i < 5; i++) {
        router.recordOutcome("claude", "signal", true, 4000);
        router.recordOutcome("grok", "signal", true, 400);
      }

      const route = router.resolveRoute("signal");
      expect(route.primary).toBe("grok");
    });

    it("keeps failing provider as fallback not primary", () => {
      for (let i = 0; i < 5; i++) {
        router.recordOutcome("perplexity", "research", false, 8000);
        router.recordOutcome("grok", "research", true, 1000);
        router.recordOutcome("claude", "research", true, 2000);
      }

      const route = router.resolveRoute("research");
      const chain = [route.primary, ...route.fallbacks];
      expect(chain[chain.length - 1]).toBe("perplexity");
    });
  });

  describe("recordOutcome", () => {
    it("tracks initial outcome", () => {
      router.recordOutcome("claude", "reasoning", true, 1000);
      const metrics = router.getMetrics();
      expect(metrics.get("claude:reasoning")).toBeDefined();
      expect(metrics.get("claude:reasoning")!.samples).toBe(1);
    });

    it("updates success rate with EMA decay", () => {
      router.recordOutcome("claude", "reasoning", true, 1000);
      router.recordOutcome("claude", "reasoning", false, 5000);
      const metrics = router.getMetrics();
      const record = metrics.get("claude:reasoning")!;
      expect(record.successRate).toBeLessThan(1.0);
      expect(record.successRate).toBeGreaterThan(0.0);
    });

    it("isolates metrics per intent", () => {
      router.recordOutcome("claude", "reasoning", true, 1000);
      router.recordOutcome("claude", "sentiment", false, 2000);
      const metrics = router.getMetrics();
      expect(metrics.get("claude:reasoning")!.successRate).toBe(1.0);
      expect(metrics.get("claude:sentiment")!.successRate).toBe(0.0);
    });
  });

  describe("getProviderScore", () => {
    it("returns null when insufficient samples", () => {
      router.recordOutcome("claude", "reasoning", true, 1000);
      expect(router.getProviderScore("claude", "reasoning")).toBeNull();
    });

    it("returns score when sufficient samples", () => {
      for (let i = 0; i < 3; i++) {
        router.recordOutcome("claude", "reasoning", true, 1000);
      }
      const score = router.getProviderScore("claude", "reasoning");
      expect(score).not.toBeNull();
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("gives higher score to faster provider", () => {
      for (let i = 0; i < 5; i++) {
        router.recordOutcome("claude", "reasoning", true, 3000);
        router.recordOutcome("grok", "reasoning", true, 500);
      }
      const claudeScore = router.getProviderScore("claude", "reasoning")!;
      const grokScore = router.getProviderScore("grok", "reasoning")!;
      expect(grokScore).toBeGreaterThan(claudeScore);
    });

    it("gives higher score to more reliable provider", () => {
      for (let i = 0; i < 5; i++) {
        router.recordOutcome("claude", "reasoning", true, 1500);
        router.recordOutcome("grok", "reasoning", i < 2, 1000);
      }
      const claudeScore = router.getProviderScore("claude", "reasoning")!;
      const grokScore = router.getProviderScore("grok", "reasoning")!;
      expect(claudeScore).toBeGreaterThan(grokScore);
    });
  });

  describe("getProviderRanking", () => {
    it("ranks all providers for an intent", () => {
      for (let i = 0; i < 5; i++) {
        router.recordOutcome("claude", "reasoning", true, 1500);
        router.recordOutcome("grok", "reasoning", true, 500);
        router.recordOutcome("perplexity", "reasoning", true, 2000);
      }

      const ranking = router.getProviderRanking("reasoning");
      expect(ranking).toHaveLength(3);
      expect(ranking[0].provider).toBe("grok");
      expect(ranking[0].score).not.toBeNull();
    });

    it("puts providers without data last", () => {
      for (let i = 0; i < 5; i++) {
        router.recordOutcome("claude", "reasoning", true, 1500);
      }

      const ranking = router.getProviderRanking("reasoning");
      const nullScores = ranking.filter((r) => r.score === null);
      expect(nullScores.length).toBe(2);
      expect(ranking[0].provider).toBe("claude");
    });
  });

  describe("reset", () => {
    it("clears all metrics", () => {
      router.recordOutcome("claude", "reasoning", true, 1000);
      router.recordOutcome("grok", "sentiment", true, 500);
      router.reset();
      expect(router.getMetrics().size).toBe(0);
    });
  });

  describe("configurable options", () => {
    it("respects custom minSamples", () => {
      const custom = new AdaptiveRouter({ minSamples: 10 });
      for (let i = 0; i < 9; i++) {
        custom.recordOutcome("grok", "reasoning", true, 200);
        custom.recordOutcome("claude", "reasoning", true, 2000);
      }
      expect(custom.getProviderScore("grok", "reasoning")).toBeNull();

      custom.recordOutcome("grok", "reasoning", true, 200);
      custom.recordOutcome("claude", "reasoning", true, 2000);
      expect(custom.getProviderScore("grok", "reasoning")).not.toBeNull();
    });

    it("respects custom weight configuration", () => {
      const latencyFocused = new AdaptiveRouter({
        minSamples: 3,
        latencyWeight: 0.9,
        successWeight: 0.1,
      });

      for (let i = 0; i < 5; i++) {
        latencyFocused.recordOutcome("claude", "reasoning", true, 5000);
        latencyFocused.recordOutcome("grok", "reasoning", true, 200);
      }

      const route = latencyFocused.resolveRoute("reasoning");
      expect(route.primary).toBe("grok");
    });
  });
});
