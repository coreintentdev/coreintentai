import { describe, it, expect, beforeEach } from "vitest";
import { AdaptiveRouter } from "../src/orchestrator/adaptive-router.js";

describe("AdaptiveRouter", () => {
  let router: AdaptiveRouter;

  beforeEach(() => {
    router = new AdaptiveRouter();
  });

  it("returns default route when no metrics recorded", () => {
    const route = router.resolveRoute("reasoning");
    expect(route.primary).toBe("claude");
  });

  it("maintains default routing with equal performance", () => {
    router.recordSuccess("claude", 500);
    router.recordSuccess("grok", 500);

    const route = router.resolveRoute("reasoning");
    expect(["claude", "grok"]).toContain(route.primary);
  });

  it("prefers faster provider when success rates are equal", () => {
    for (let i = 0; i < 10; i++) {
      router.recordSuccess("claude", 2000);
      router.recordSuccess("grok", 200);
    }

    const route = router.resolveRoute("fast_analysis");
    expect(route.primary).toBe("grok");
  });

  it("penalizes providers with failures", () => {
    for (let i = 0; i < 5; i++) {
      router.recordSuccess("claude", 500);
      router.recordSuccess("perplexity", 600);
      router.recordFailure("grok");
    }

    const route = router.resolveRoute("sentiment");
    expect(route.primary).toBe("claude");
  });

  it("tracks provider stats correctly", () => {
    router.recordSuccess("claude", 500);
    router.recordSuccess("claude", 700);
    router.recordFailure("claude");

    const stats = router.getProviderStats("claude");
    expect(stats.successRate).toBeCloseTo(2 / 3, 2);
    expect(stats.avgLatencyMs).toBe(600);
    expect(stats.circuitOpen).toBe(false);
  });

  it("opens circuit breaker after consecutive failures", () => {
    const breaker = new AdaptiveRouter({ circuitBreakerThreshold: 3 });

    breaker.recordFailure("grok");
    breaker.recordFailure("grok");
    expect(breaker.getProviderStats("grok").circuitOpen).toBe(false);

    breaker.recordFailure("grok");
    expect(breaker.getProviderStats("grok").circuitOpen).toBe(true);
  });

  it("excludes circuit-broken providers from routing", () => {
    const breaker = new AdaptiveRouter({
      circuitBreakerThreshold: 2,
      circuitBreakerCooldownMs: 60_000,
    });

    breaker.recordFailure("claude");
    breaker.recordFailure("claude");

    const route = breaker.resolveRoute("reasoning");
    expect(route.primary).toBe("grok");
    expect(route.fallbacks).not.toContain("claude");
  });

  it("falls back to default route when all providers circuit-broken", () => {
    const breaker = new AdaptiveRouter({ circuitBreakerThreshold: 1 });

    breaker.recordFailure("claude");
    breaker.recordFailure("grok");

    const route = breaker.resolveRoute("reasoning");
    expect(route.primary).toBe("claude");
  });

  it("resets consecutive failures on success", () => {
    router.recordFailure("claude");
    router.recordFailure("claude");
    router.recordSuccess("claude", 500);

    const stats = router.getProviderStats("claude");
    expect(stats.circuitOpen).toBe(false);
  });

  it("getAllStats returns stats for all providers", () => {
    router.recordSuccess("claude", 100);
    router.recordSuccess("grok", 200);

    const stats = router.getAllStats();
    expect(Object.keys(stats)).toEqual(["claude", "grok", "perplexity"]);
    expect(stats.claude.avgLatencyMs).toBe(100);
    expect(stats.grok.avgLatencyMs).toBe(200);
    expect(stats.perplexity.avgLatencyMs).toBe(0);
  });

  it("reset clears all metrics", () => {
    router.recordSuccess("claude", 500);
    router.recordFailure("grok");
    router.reset();

    const stats = router.getAllStats();
    expect(stats.claude.successRate).toBe(1);
    expect(stats.claude.avgLatencyMs).toBe(0);
    expect(stats.grok.successRate).toBe(1);
  });

  it("respects latency window size", () => {
    const small = new AdaptiveRouter({ latencyWindowSize: 3 });

    small.recordSuccess("claude", 1000);
    small.recordSuccess("claude", 1000);
    small.recordSuccess("claude", 1000);
    small.recordSuccess("claude", 100);
    small.recordSuccess("claude", 100);
    small.recordSuccess("claude", 100);

    const stats = small.getProviderStats("claude");
    expect(stats.avgLatencyMs).toBe(100);
  });

  it("handles correlation intent routing", () => {
    const route = router.resolveRoute("correlation");
    expect(route.primary).toBe("claude");
  });

  it("applies preferred provider override", () => {
    router.recordSuccess("perplexity", 100);

    const route = router.resolveRoute("research", "perplexity");
    expect(route.primary).toBe("perplexity");
  });
});
