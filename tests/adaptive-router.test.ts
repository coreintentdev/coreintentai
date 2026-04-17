import { describe, it, expect, beforeEach } from "vitest";
import { AdaptiveRouter } from "../src/orchestrator/adaptive-router.js";
import { ProviderHealthMonitor } from "../src/orchestrator/health.js";

describe("AdaptiveRouter", () => {
  let monitor: ProviderHealthMonitor;
  let router: AdaptiveRouter;

  beforeEach(() => {
    monitor = new ProviderHealthMonitor({ minSamplesForStats: 3 });
    router = new AdaptiveRouter(monitor);
  });

  describe("resolve", () => {
    it("follows static routing when no health data exists", () => {
      const route = router.resolve("reasoning");
      expect(route.primary).toBe("claude");
      expect(route.fallbacks).toContain("grok");
    });

    it("follows static routing for research intent", () => {
      const route = router.resolve("research");
      expect(route.primary).toBe("perplexity");
    });

    it("follows static routing for fast_analysis", () => {
      const route = router.resolve("fast_analysis");
      expect(route.primary).toBe("grok");
    });

    it("adapts when primary provider is unhealthy", () => {
      monitor.recordSuccess("claude", 100);
      monitor.recordFailure("claude");
      monitor.recordFailure("claude");

      const route = router.resolve("reasoning");
      expect(route.primary).toBe("grok");
      expect(route.adaptiveOverride).toBe(true);
    });

    it("respects preferred provider", () => {
      const route = router.resolve("reasoning", "grok");
      expect(route.primary).toBe("grok");
    });

    it("includes scores for all providers", () => {
      const route = router.resolve("reasoning");
      expect(route.scores.length).toBeGreaterThan(0);
      for (const score of route.scores) {
        expect(score.provider).toBeDefined();
        expect(score.score).toBeGreaterThanOrEqual(0);
        expect(score.reasons.length).toBeGreaterThan(0);
      }
    });
  });

  describe("scoreProvider", () => {
    it("scores healthy providers higher than unhealthy ones", () => {
      for (let i = 0; i < 5; i++) {
        monitor.recordSuccess("claude", 200);
        monitor.recordFailure("grok");
      }

      const claudeScore = router.scoreProvider("claude", "reasoning");
      const grokScore = router.scoreProvider("grok", "reasoning");

      expect(claudeScore.score).toBeGreaterThan(grokScore.score);
    });

    it("factors in intent affinity", () => {
      const claudeReasoning = router.scoreProvider("claude", "reasoning");
      const grokReasoning = router.scoreProvider("grok", "reasoning");

      expect(claudeReasoning.reasons).toContain("affinity=1.00");
      expect(grokReasoning.reasons).toContain("affinity=0.60");
    });

    it("factors in latency", () => {
      for (let i = 0; i < 5; i++) {
        monitor.recordSuccess("claude", 10000);
        monitor.recordSuccess("grok", 500);
      }

      const claudeScore = router.scoreProvider("claude", "fast_analysis");
      const grokScore = router.scoreProvider("grok", "fast_analysis");

      expect(grokScore.score).toBeGreaterThan(claudeScore.score);
    });
  });

  describe("getProviderChain", () => {
    it("returns full chain in priority order", () => {
      const chain = router.getProviderChain("reasoning");
      expect(chain.length).toBeGreaterThanOrEqual(2);
      expect(chain[0]).toBe("claude");
    });

    it("adjusts chain when providers are unhealthy", () => {
      monitor.recordSuccess("claude", 100);
      monitor.recordFailure("claude");
      monitor.recordFailure("claude");

      const chain = router.getProviderChain("reasoning");
      expect(chain[0]).not.toBe("claude");
    });

    it("handles preferred provider in chain", () => {
      const chain = router.getProviderChain("reasoning", "perplexity");
      expect(chain[0]).toBe("perplexity");
    });
  });

  describe("monitor access", () => {
    it("exposes the underlying health monitor", () => {
      expect(router.monitor).toBe(monitor);
    });
  });
});
