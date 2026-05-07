import { describe, it, expect, beforeEach } from "vitest";
import { AdaptiveRouter } from "../src/orchestrator/adaptive-router.js";
import { CircuitBreaker } from "../src/orchestrator/circuit-breaker.js";

describe("AdaptiveRouter", () => {
  let router: AdaptiveRouter;

  beforeEach(() => {
    router = new AdaptiveRouter({ explorationRate: 0 });
  });

  describe("scoreProvider", () => {
    it("returns default scores for unknown provider", () => {
      const score = router.scoreProvider("sentiment", "claude");
      expect(score.provider).toBe("claude");
      expect(score.sampleCount).toBe(0);
      expect(score.qualityScore).toBe(0.5);
    });

    it("updates quality score after recording outcomes", () => {
      router.recordOutcome({
        intent: "sentiment",
        provider: "grok",
        success: true,
        latencyMs: 200,
        qualityScore: 0.9,
      });

      const score = router.scoreProvider("sentiment", "grok");
      expect(score.sampleCount).toBe(1);
      expect(score.qualityScore).toBeGreaterThan(0.5);
    });

    it("tracks success rate correctly", () => {
      for (let i = 0; i < 8; i++) {
        router.recordOutcome({
          intent: "signal",
          provider: "claude",
          success: true,
          latencyMs: 500,
        });
      }
      for (let i = 0; i < 2; i++) {
        router.recordOutcome({
          intent: "signal",
          provider: "claude",
          success: false,
          latencyMs: 1000,
        });
      }

      const score = router.scoreProvider("signal", "claude");
      expect(score.successRate).toBe(0.8);
      expect(score.sampleCount).toBe(10);
    });

    it("computes average latency", () => {
      router.recordOutcome({ intent: "research", provider: "perplexity", success: true, latencyMs: 100 });
      router.recordOutcome({ intent: "research", provider: "perplexity", success: true, latencyMs: 300 });

      const score = router.scoreProvider("research", "perplexity");
      expect(score.avgLatencyMs).toBe(200);
    });
  });

  describe("rankProviders", () => {
    it("returns candidates in order when no data exists", () => {
      const ranked = router.rankProviders("sentiment", ["grok", "claude", "perplexity"]);
      expect(ranked).toHaveLength(3);
    });

    it("ranks the better-performing provider first", () => {
      for (let i = 0; i < 10; i++) {
        router.recordOutcome({
          intent: "sentiment",
          provider: "grok",
          success: true,
          latencyMs: 150,
          qualityScore: 0.95,
        });
        router.recordOutcome({
          intent: "sentiment",
          provider: "claude",
          success: true,
          latencyMs: 800,
          qualityScore: 0.6,
        });
      }

      const ranked = router.rankProviders("sentiment", ["claude", "grok"]);
      expect(ranked[0]).toBe("grok");
    });

    it("prioritizes exploration-needed providers (low sample count)", () => {
      for (let i = 0; i < 10; i++) {
        router.recordOutcome({
          intent: "general",
          provider: "claude",
          success: true,
          latencyMs: 500,
          qualityScore: 0.8,
        });
      }

      const ranked = router.rankProviders("general", ["claude", "grok"]);
      expect(ranked[0]).toBe("grok");
    });

    it("respects circuit breaker ranking", () => {
      const cb = new CircuitBreaker({ failureThreshold: 1 });
      cb.recordFailure("grok");

      for (let i = 0; i < 10; i++) {
        router.recordOutcome({
          intent: "sentiment",
          provider: "grok",
          success: true,
          latencyMs: 100,
          qualityScore: 0.99,
        });
        router.recordOutcome({
          intent: "sentiment",
          provider: "claude",
          success: true,
          latencyMs: 500,
          qualityScore: 0.7,
        });
      }

      const ranked = router.rankProviders("sentiment", ["grok", "claude"], cb);
      expect(ranked[ranked.length - 1]).toBe("grok");
    });
  });

  describe("exploration", () => {
    it("sometimes shuffles providers for exploration", () => {
      const explorationRouter = new AdaptiveRouter({ explorationRate: 1.0 });
      const results = new Set<string>();

      for (let i = 0; i < 20; i++) {
        const ranked = explorationRouter.rankProviders("sentiment", ["claude", "grok", "perplexity"]);
        results.add(ranked.join(","));
      }

      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe("confidence escalation", () => {
    it("detects when escalation is needed", () => {
      expect(router.shouldEscalate(0.3)).toBe(true);
      expect(router.shouldEscalate(0.5)).toBe(false);
      expect(router.shouldEscalate(0.9)).toBe(false);
    });

    it("respects the escalation threshold", () => {
      const customRouter = new AdaptiveRouter({ escalationThreshold: 0.6 });
      expect(customRouter.shouldEscalate(0.5)).toBe(true);
      expect(customRouter.shouldEscalate(0.7)).toBe(false);
    });

    it("returns null when no escalation configured", () => {
      const noEscalation = new AdaptiveRouter({ confidenceEscalation: false });
      expect(noEscalation.shouldEscalate(0.1)).toBe(false);
    });

    it("returns an escalation target different from current provider", () => {
      const target = router.getEscalationTarget("sentiment", "grok");
      expect(target).not.toBe("grok");
      expect(target).not.toBeNull();
    });
  });

  describe("getInsights", () => {
    it("returns empty map when no data", () => {
      const insights = router.getInsights();
      expect(insights.size).toBe(0);
    });

    it("returns per-intent provider scores", () => {
      router.recordOutcome({ intent: "sentiment", provider: "grok", success: true, latencyMs: 200 });
      router.recordOutcome({ intent: "signal", provider: "claude", success: true, latencyMs: 500 });

      const insights = router.getInsights();
      expect(insights.has("sentiment")).toBe(true);
      expect(insights.has("signal")).toBe(true);

      const sentimentScores = insights.get("sentiment")!;
      expect(sentimentScores).toHaveLength(1);
      expect(sentimentScores[0].provider).toBe("grok");
    });
  });

  describe("recordOutcome", () => {
    it("caps quality score history at 100 entries", () => {
      for (let i = 0; i < 150; i++) {
        router.recordOutcome({
          intent: "reasoning",
          provider: "claude",
          success: true,
          latencyMs: 500,
          qualityScore: 0.8,
        });
      }

      const score = router.scoreProvider("reasoning", "claude");
      expect(score.sampleCount).toBe(150);
      expect(score.avgLatencyMs).toBe(500);
    });

    it("applies exponential decay to recent quality", () => {
      router.recordOutcome({ intent: "general", provider: "claude", success: true, latencyMs: 500, qualityScore: 1.0 });
      const score1 = router.scoreProvider("general", "claude");

      router.recordOutcome({ intent: "general", provider: "claude", success: false, latencyMs: 5000, qualityScore: 0.0 });
      const score2 = router.scoreProvider("general", "claude");

      expect(score2.qualityScore).toBeLessThan(score1.qualityScore);
    });
  });

  describe("reset", () => {
    it("clears all recorded data", () => {
      router.recordOutcome({ intent: "sentiment", provider: "grok", success: true, latencyMs: 200 });
      expect(router.getInsights().size).toBe(1);

      router.reset();
      expect(router.getInsights().size).toBe(0);
    });
  });

  describe("intent isolation", () => {
    it("tracks stats independently per intent", () => {
      for (let i = 0; i < 10; i++) {
        router.recordOutcome({ intent: "sentiment", provider: "grok", success: true, latencyMs: 100, qualityScore: 0.95 });
        router.recordOutcome({ intent: "reasoning", provider: "grok", success: false, latencyMs: 5000, qualityScore: 0.1 });
      }

      const sentimentScore = router.scoreProvider("sentiment", "grok");
      const reasoningScore = router.scoreProvider("reasoning", "grok");

      expect(sentimentScore.successRate).toBe(1.0);
      expect(reasoningScore.successRate).toBe(0.0);
    });
  });
});
