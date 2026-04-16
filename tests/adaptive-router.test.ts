import { describe, it, expect, beforeEach } from "vitest";
import { AdaptiveRouter } from "../src/orchestrator/adaptive-router.js";

describe("AdaptiveRouter", () => {
  let router: AdaptiveRouter;

  beforeEach(() => {
    router = new AdaptiveRouter({
      minSamples: 3, // Low threshold for testing
      maxObservations: 50,
    });
  });

  describe("cold start", () => {
    it("returns static route table when no data exists", () => {
      const chain = router.getProviderChain("reasoning");
      expect(chain[0]).toBe("claude"); // Static default
    });

    it("respects preferred provider override", () => {
      const chain = router.getProviderChain("reasoning", "grok");
      expect(chain[0]).toBe("grok");
    });

    it("falls back to static when below minSamples", () => {
      router.record({
        provider: "grok",
        intent: "reasoning",
        latencyMs: 100,
        success: true,
        totalTokens: 500,
      });
      router.record({
        provider: "grok",
        intent: "reasoning",
        latencyMs: 100,
        success: true,
        totalTokens: 500,
      });
      // Only 2 samples, threshold is 3
      const chain = router.getProviderChain("reasoning");
      expect(chain[0]).toBe("claude"); // Still static
    });
  });

  describe("adaptive scoring", () => {
    it("promotes a faster provider even when static primary is slower", () => {
      // Static primary for reasoning is Claude.
      for (let i = 0; i < 5; i++) {
        router.record({
          provider: "claude",
          intent: "reasoning",
          latencyMs: 3000,
          success: true,
          totalTokens: 500,
        });
      }

      for (let i = 0; i < 5; i++) {
        router.record({
          provider: "grok",
          intent: "reasoning",
          latencyMs: 200,
          success: true,
          totalTokens: 500,
        });
      }

      const chain = router.getProviderChain("reasoning");
      expect(chain[0]).toBe("grok");
    });

    it("promotes a consistently faster provider", () => {
      // Record Claude as slow
      for (let i = 0; i < 5; i++) {
        router.record({
          provider: "claude",
          intent: "sentiment",
          latencyMs: 3000,
          success: true,
          totalTokens: 1000,
        });
      }

      // Record Grok as fast
      for (let i = 0; i < 5; i++) {
        router.record({
          provider: "grok",
          intent: "sentiment",
          latencyMs: 200,
          success: true,
          totalTokens: 500,
        });
      }

      const chain = router.getProviderChain("sentiment");
      // Grok should be ranked higher (faster, cheaper, same success rate)
      expect(chain[0]).toBe("grok");
    });

    it("demotes a provider with high failure rate", () => {
      // Claude: 100% success
      for (let i = 0; i < 5; i++) {
        router.record({
          provider: "claude",
          intent: "signal",
          latencyMs: 2000,
          success: true,
          totalTokens: 800,
        });
      }

      // Grok: 40% success (should be demoted despite lower latency)
      for (let i = 0; i < 5; i++) {
        router.record({
          provider: "grok",
          intent: "signal",
          latencyMs: 1500,
          success: i < 2, // Only first 2 succeed
          totalTokens: 700,
        });
      }

      const chain = router.getProviderChain("signal");
      expect(chain[0]).toBe("claude"); // Higher success rate wins
    });

    it("keeps provider with no data at end of chain", () => {
      // Only record data for Claude and Grok
      for (let i = 0; i < 5; i++) {
        router.record({
          provider: "claude",
          intent: "research",
          latencyMs: 1000,
          success: true,
          totalTokens: 600,
        });
        router.record({
          provider: "grok",
          intent: "research",
          latencyMs: 800,
          success: true,
          totalTokens: 400,
        });
      }

      const chain = router.getProviderChain("research");
      // Perplexity (no data) should be last
      expect(chain[chain.length - 1]).toBe("perplexity");
    });
  });

  describe("summary", () => {
    it("returns empty summary with no data", () => {
      const summary = router.getSummary();
      expect(summary).toHaveLength(0);
    });

    it("returns stats for recorded providers", () => {
      for (let i = 0; i < 5; i++) {
        router.record({
          provider: "claude",
          intent: "reasoning",
          latencyMs: 1000 + i * 100,
          success: true,
          totalTokens: 500,
        });
      }

      const summary = router.getSummary();
      expect(summary).toHaveLength(1);
      expect(summary[0].provider).toBe("claude");
      expect(summary[0].intent).toBe("reasoning");
      expect(summary[0].samples).toBe(5);
      expect(summary[0].successRate).toBe(1);
      expect(summary[0].avgLatencyMs).toBeGreaterThan(0);
    });
  });

  describe("reset", () => {
    it("clears all metrics", () => {
      for (let i = 0; i < 5; i++) {
        router.record({
          provider: "claude",
          intent: "reasoning",
          latencyMs: 1000,
          success: true,
          totalTokens: 500,
        });
      }

      router.reset();
      const summary = router.getSummary();
      expect(summary).toHaveLength(0);
    });
  });
});
