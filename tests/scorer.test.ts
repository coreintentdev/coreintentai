import { describe, it, expect, beforeEach } from "vitest";
import { AdaptiveScorer } from "../src/orchestrator/scorer.js";

describe("Adaptive Model Scorer", () => {
  let scorer: AdaptiveScorer;

  beforeEach(() => {
    scorer = new AdaptiveScorer(50);
  });

  describe("recording outcomes", () => {
    it("tracks successful requests", () => {
      scorer.record({
        provider: "claude",
        intent: "reasoning",
        latencyMs: 2000,
        success: true,
        parseSuccess: true,
      });

      const metrics = scorer.getMetrics("claude")!;
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successCount).toBe(1);
      expect(metrics.failureCount).toBe(0);
      expect(metrics.avgLatencyMs).toBe(2000);
    });

    it("tracks failed requests", () => {
      scorer.record({
        provider: "grok",
        intent: "fast_analysis",
        latencyMs: 30000,
        success: false,
      });

      const metrics = scorer.getMetrics("grok")!;
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.failureCount).toBe(1);
      expect(metrics.consecutiveFailures).toBe(1);
    });

    it("resets consecutive failures on success", () => {
      scorer.record({
        provider: "claude",
        intent: "reasoning",
        latencyMs: 30000,
        success: false,
      });
      scorer.record({
        provider: "claude",
        intent: "reasoning",
        latencyMs: 30000,
        success: false,
      });
      expect(scorer.getMetrics("claude")!.consecutiveFailures).toBe(2);

      scorer.record({
        provider: "claude",
        intent: "reasoning",
        latencyMs: 2000,
        success: true,
      });
      expect(scorer.getMetrics("claude")!.consecutiveFailures).toBe(0);
    });

    it("computes rolling average latency", () => {
      scorer.record({
        provider: "grok",
        intent: "fast_analysis",
        latencyMs: 1000,
        success: true,
      });
      scorer.record({
        provider: "grok",
        intent: "fast_analysis",
        latencyMs: 3000,
        success: true,
      });

      const metrics = scorer.getMetrics("grok")!;
      expect(metrics.avgLatencyMs).toBe(2000);
    });

    it("tracks token usage", () => {
      scorer.record({
        provider: "claude",
        intent: "reasoning",
        latencyMs: 2000,
        success: true,
        tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
      });

      const metrics = scorer.getMetrics("claude")!;
      expect(metrics.avgTokensPerRequest).toBe(300);
    });

    it("tracks parse success rate", () => {
      scorer.record({
        provider: "claude",
        intent: "signal",
        latencyMs: 2000,
        success: true,
        parseSuccess: true,
      });
      scorer.record({
        provider: "claude",
        intent: "signal",
        latencyMs: 2500,
        success: true,
        parseSuccess: false,
      });

      const metrics = scorer.getMetrics("claude")!;
      expect(metrics.parseSuccessRate).toBe(0.5);
    });
  });

  describe("circuit breaker", () => {
    it("opens circuit after consecutive failures", () => {
      for (let i = 0; i < 3; i++) {
        scorer.record({
          provider: "perplexity",
          intent: "research",
          latencyMs: 30000,
          success: false,
        });
      }

      expect(scorer.isCircuitOpen("perplexity")).toBe(true);
    });

    it("does not open circuit for intermittent failures", () => {
      scorer.record({
        provider: "grok",
        intent: "sentiment",
        latencyMs: 30000,
        success: false,
      });
      scorer.record({
        provider: "grok",
        intent: "sentiment",
        latencyMs: 1000,
        success: true,
      });
      scorer.record({
        provider: "grok",
        intent: "sentiment",
        latencyMs: 30000,
        success: false,
      });

      expect(scorer.isCircuitOpen("grok")).toBe(false);
    });
  });

  describe("adaptive routing", () => {
    it("returns default route with no data", () => {
      const route = scorer.adaptiveRoute("reasoning");
      expect(route.primary).toBeDefined();
      expect(route.fallbacks.length).toBeGreaterThan(0);
    });

    it("promotes faster provider when it has better metrics", () => {
      for (let i = 0; i < 10; i++) {
        scorer.record({
          provider: "grok",
          intent: "reasoning",
          latencyMs: 500,
          success: true,
          parseSuccess: true,
        });
        scorer.record({
          provider: "claude",
          intent: "reasoning",
          latencyMs: 5000,
          success: true,
          parseSuccess: true,
        });
      }

      const route = scorer.adaptiveRoute("reasoning");
      expect(route.primary).toBe("grok");
    });

    it("demotes provider with high failure rate", () => {
      for (let i = 0; i < 10; i++) {
        scorer.record({
          provider: "grok",
          intent: "sentiment",
          latencyMs: 500,
          success: false,
        });
        scorer.record({
          provider: "claude",
          intent: "sentiment",
          latencyMs: 3000,
          success: true,
          parseSuccess: true,
        });
      }

      const route = scorer.adaptiveRoute("sentiment");
      expect(route.primary).toBe("claude");
    });

    it("excludes providers with open circuits", () => {
      for (let i = 0; i < 3; i++) {
        scorer.record({
          provider: "perplexity",
          intent: "research",
          latencyMs: 30000,
          success: false,
        });
      }

      for (let i = 0; i < 5; i++) {
        scorer.record({
          provider: "claude",
          intent: "research",
          latencyMs: 3000,
          success: true,
          parseSuccess: true,
        });
      }

      const route = scorer.adaptiveRoute("research");
      expect(route.primary).not.toBe("perplexity");
    });

    it("respects preferred provider override", () => {
      const route = scorer.adaptiveRoute("reasoning", "perplexity");
      const allProviders = [route.primary, ...route.fallbacks];
      expect(allProviders).toContain("perplexity");
    });
  });

  describe("health snapshot", () => {
    it("reports all providers as healthy initially", () => {
      const health = scorer.healthSnapshot();
      expect(health).toHaveLength(3);
      for (const h of health) {
        expect(h.healthy).toBe(true);
        expect(h.circuitOpen).toBe(false);
        expect(h.successRate).toBe(1);
      }
    });

    it("flags unhealthy provider after failures", () => {
      for (let i = 0; i < 5; i++) {
        scorer.record({
          provider: "grok",
          intent: "fast_analysis",
          latencyMs: 30000,
          success: false,
        });
      }

      const health = scorer.healthSnapshot();
      const grok = health.find((h) => h.provider === "grok")!;
      expect(grok.healthy).toBe(false);
      expect(grok.successRate).toBe(0);
      expect(grok.circuitOpen).toBe(true);
    });
  });

  describe("getAllMetrics", () => {
    it("returns metrics for all three providers", () => {
      const all = scorer.getAllMetrics();
      expect(all).toHaveLength(3);
      const providers = all.map((m) => m.provider);
      expect(providers).toContain("claude");
      expect(providers).toContain("grok");
      expect(providers).toContain("perplexity");
    });
  });

  describe("reset", () => {
    it("clears all metrics", () => {
      scorer.record({
        provider: "claude",
        intent: "reasoning",
        latencyMs: 2000,
        success: true,
      });

      scorer.reset();

      const metrics = scorer.getMetrics("claude")!;
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successCount).toBe(0);
    });
  });
});
