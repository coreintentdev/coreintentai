import { describe, it, expect, beforeEach } from "vitest";
import { AdaptiveRouter } from "../src/orchestrator/adaptive-router.js";

describe("AdaptiveRouter", () => {
  let router: AdaptiveRouter;

  beforeEach(() => {
    router = new AdaptiveRouter({ minSamples: 3, decayHalfLifeMs: 3_600_000 });
  });

  describe("fallback to static routing", () => {
    it("uses static routes when no data exists", () => {
      const route = router.resolveRoute("reasoning");
      expect(route.primary).toBe("claude");
      expect(route.fallbacks).toEqual(["grok"]);
    });

    it("uses static routes when insufficient samples", () => {
      router.recordOutcome("grok", "reasoning", true, 100);
      router.recordOutcome("grok", "reasoning", true, 90);
      // Only 2 samples, need 3
      const route = router.resolveRoute("reasoning");
      expect(route.primary).toBe("claude");
    });

    it("respects preferred provider in static mode", () => {
      const route = router.resolveRoute("reasoning", "grok");
      expect(route.primary).toBe("grok");
    });
  });

  describe("adaptive routing", () => {
    it("promotes a provider with better success rate", () => {
      // Grok succeeds consistently for reasoning
      for (let i = 0; i < 5; i++) {
        router.recordOutcome("grok", "reasoning", true, 200);
      }
      // Claude fails frequently for reasoning
      for (let i = 0; i < 5; i++) {
        router.recordOutcome("claude", "reasoning", false, 500);
      }

      const route = router.resolveRoute("reasoning");
      expect(route.primary).toBe("grok");
    });

    it("promotes a faster provider when success rates are equal", () => {
      for (let i = 0; i < 5; i++) {
        router.recordOutcome("grok", "fast_analysis", true, 100);
        router.recordOutcome("claude", "fast_analysis", true, 2000);
      }

      const route = router.resolveRoute("fast_analysis");
      expect(route.primary).toBe("grok");
    });

    it("keeps all providers in the chain", () => {
      for (let i = 0; i < 5; i++) {
        router.recordOutcome("claude", "signal", true, 300);
        router.recordOutcome("grok", "signal", true, 200);
      }

      const route = router.resolveRoute("signal");
      const chain = [route.primary, ...route.fallbacks];
      expect(chain).toContain("claude");
      expect(chain).toContain("grok");
    });

    it("respects preferred provider with sufficient score", () => {
      for (let i = 0; i < 5; i++) {
        router.recordOutcome("claude", "reasoning", true, 300);
        router.recordOutcome("grok", "reasoning", true, 100);
      }

      const route = router.resolveRoute("reasoning", "claude");
      expect(route.primary).toBe("claude");
    });

    it("does not promote preferred provider with poor success rate", () => {
      for (let i = 0; i < 5; i++) {
        router.recordOutcome("grok", "reasoning", false, 500);
        router.recordOutcome("claude", "reasoning", true, 300);
      }

      // Grok has 0% success rate — should NOT be promoted even as preferred
      const route = router.resolveRoute("reasoning", "grok");
      expect(route.primary).toBe("claude");
    });

    it("routes different intents independently", () => {
      // Grok is better for sentiment
      for (let i = 0; i < 5; i++) {
        router.recordOutcome("grok", "sentiment", true, 100);
        router.recordOutcome("claude", "sentiment", true, 500);
      }
      // Claude is better for risk
      for (let i = 0; i < 5; i++) {
        router.recordOutcome("claude", "risk", true, 200);
        router.recordOutcome("grok", "risk", false, 300);
      }

      expect(router.resolveRoute("sentiment").primary).toBe("grok");
      expect(router.resolveRoute("risk").primary).toBe("claude");
    });
  });

  describe("getProviderChain", () => {
    it("returns flat provider array", () => {
      const chain = router.getProviderChain("research");
      expect(chain).toEqual(["perplexity", "grok", "claude"]);
    });

    it("adapts chain with performance data", () => {
      for (let i = 0; i < 5; i++) {
        router.recordOutcome("claude", "research", true, 200);
        router.recordOutcome("perplexity", "research", false, 1000);
        router.recordOutcome("grok", "research", true, 300);
      }

      const chain = router.getProviderChain("research");
      expect(chain[0]).toBe("claude");
    });
  });

  describe("getScores", () => {
    it("returns empty array when no data", () => {
      expect(router.getScores("reasoning")).toEqual([]);
    });

    it("returns scored providers sorted by score descending", () => {
      for (let i = 0; i < 5; i++) {
        router.recordOutcome("claude", "reasoning", true, 300);
        router.recordOutcome("grok", "reasoning", true, 100);
      }

      const scores = router.getScores("reasoning");
      expect(scores.length).toBe(2);
      expect(scores[0].sampleCount).toBe(5);
      expect(scores[0].successRate).toBeGreaterThan(0);
      // Scores should be in descending order
      expect(scores[0].score).toBeGreaterThanOrEqual(scores[1].score);
    });

    it("reports -1 avgLatency for providers with only failures", () => {
      for (let i = 0; i < 5; i++) {
        router.recordOutcome("perplexity", "reasoning", false, 5000);
      }

      const scores = router.getScores("reasoning");
      const ppx = scores.find((s) => s.provider === "perplexity");
      expect(ppx).toBeDefined();
      expect(ppx!.avgLatency).toBe(-1);
      expect(ppx!.successRate).toBe(0);
    });
  });

  describe("getStats", () => {
    it("returns aggregate statistics", () => {
      router.recordOutcome("claude", "reasoning", true, 300);
      router.recordOutcome("claude", "reasoning", true, 250);
      router.recordOutcome("grok", "sentiment", true, 100);
      router.recordOutcome("grok", "sentiment", false, 200);

      const stats = router.getStats();
      expect(stats.totalRecords).toBe(4);
      expect(stats.byIntent.reasoning).toBe(2);
      expect(stats.byIntent.sentiment).toBe(2);
      expect(stats.byProvider.claude.total).toBe(2);
      expect(stats.byProvider.claude.successRate).toBe(1);
      expect(stats.byProvider.grok.successRate).toBe(0.5);
    });
  });

  describe("record management", () => {
    it("prunes old records when maxRecords exceeded", () => {
      const smallRouter = new AdaptiveRouter({ maxRecords: 5, minSamples: 3 });
      for (let i = 0; i < 10; i++) {
        smallRouter.recordOutcome("claude", "reasoning", true, 100 + i);
      }

      expect(smallRouter.getStats().totalRecords).toBe(5);
    });

    it("resets all data", () => {
      router.recordOutcome("claude", "reasoning", true, 300);
      router.recordOutcome("grok", "sentiment", true, 100);
      router.reset();
      expect(router.getStats().totalRecords).toBe(0);
    });
  });
});
