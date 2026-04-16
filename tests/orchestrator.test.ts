import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Orchestrator } from "../src/orchestrator/index.js";
import * as modelFactory from "../src/models/index.js";
import type { CompletionResponse } from "../src/models/base.js";
import type { ModelProvider } from "../src/types/index.js";

/**
 * Integration tests for the Orchestrator.
 * Uses a mocked model factory to simulate provider behavior
 * without making real API calls.
 */

function mockResponse(
  provider: ModelProvider,
  content: string,
  latencyMs = 100
): CompletionResponse {
  return {
    content,
    provider,
    model: `${provider}-test-model`,
    tokenUsage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
    latencyMs,
    finishReason: "end_turn",
  };
}

function createMockAdapter(provider: ModelProvider) {
  return {
    provider,
    model: `${provider}-test`,
    complete: vi.fn(),
    ping: vi.fn().mockResolvedValue(true),
    config: {} as any,
  };
}

describe("Orchestrator Integration", () => {
  const mockClaude = createMockAdapter("claude");
  const mockGrok = createMockAdapter("grok");
  const mockPerplexity = createMockAdapter("perplexity");

  beforeEach(() => {
    vi.spyOn(modelFactory, "getAdapter").mockImplementation(
      (provider: ModelProvider) => {
        switch (provider) {
          case "claude":
            return mockClaude as any;
          case "grok":
            return mockGrok as any;
          case "perplexity":
            return mockPerplexity as any;
        }
      }
    );

    mockClaude.complete.mockReset();
    mockGrok.complete.mockReset();
    mockPerplexity.complete.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("basic execution", () => {
    it("routes a reasoning request to Claude", async () => {
      mockClaude.complete.mockResolvedValue(
        mockResponse("claude", "Deep analysis result")
      );

      const orch = new Orchestrator({
        cacheEnabled: false,
        circuitBreakerEnabled: false,
        adaptiveRoutingEnabled: false,
      });

      const result = await orch.execute({
        intent: "reasoning",
        prompt: "Analyze market conditions",
      });

      expect(result.provider).toBe("claude");
      expect(result.content).toBe("Deep analysis result");
      expect(result.fallbackUsed).toBe(false);
      expect(mockClaude.complete).toHaveBeenCalledOnce();
    });

    it("routes fast_analysis to Grok", async () => {
      mockGrok.complete.mockResolvedValue(
        mockResponse("grok", "Quick analysis")
      );

      const orch = new Orchestrator({
        cacheEnabled: false,
        circuitBreakerEnabled: false,
        adaptiveRoutingEnabled: false,
      });

      const result = await orch.execute({
        intent: "fast_analysis",
        prompt: "Quick read on TSLA",
      });

      expect(result.provider).toBe("grok");
      expect(result.content).toBe("Quick analysis");
    });

    it("routes research to Perplexity", async () => {
      mockPerplexity.complete.mockResolvedValue(
        mockResponse("perplexity", "Research findings")
      );

      const orch = new Orchestrator({
        cacheEnabled: false,
        circuitBreakerEnabled: false,
        adaptiveRoutingEnabled: false,
      });

      const result = await orch.execute({
        intent: "research",
        prompt: "Latest news on NVDA",
      });

      expect(result.provider).toBe("perplexity");
    });
  });

  describe("fallback behavior", () => {
    it("falls back to next provider on failure", async () => {
      mockGrok.complete.mockRejectedValue(new Error("Grok timeout"));
      mockClaude.complete.mockResolvedValue(
        mockResponse("claude", "Fallback sentiment analysis")
      );

      const orch = new Orchestrator({
        cacheEnabled: false,
        circuitBreakerEnabled: false,
        adaptiveRoutingEnabled: false,
        maxRetries: 1,
      });

      const result = await orch.execute({
        intent: "sentiment",
        prompt: "AAPL sentiment",
      });

      expect(result.provider).toBe("claude");
      expect(result.fallbackUsed).toBe(true);
      expect(result.metadata?.attemptedProviders).toContain("grok");
    });

    it("throws when all providers fail", async () => {
      mockClaude.complete.mockRejectedValue(new Error("Claude down"));
      mockGrok.complete.mockRejectedValue(new Error("Grok down"));

      const orch = new Orchestrator({
        cacheEnabled: false,
        circuitBreakerEnabled: false,
        adaptiveRoutingEnabled: false,
        maxRetries: 1,
      });

      await expect(
        orch.execute({
          intent: "reasoning",
          prompt: "This will fail",
        })
      ).rejects.toThrow("All providers failed");
    });
  });

  describe("caching", () => {
    it("returns cached response on second identical request", async () => {
      mockClaude.complete.mockResolvedValue(
        mockResponse("claude", "Cached result")
      );

      const orch = new Orchestrator({
        cacheEnabled: true,
        circuitBreakerEnabled: false,
        adaptiveRoutingEnabled: false,
      });

      const first = await orch.execute({
        intent: "reasoning",
        prompt: "Same prompt",
      });

      const second = await orch.execute({
        intent: "reasoning",
        prompt: "Same prompt",
      });

      expect(first.content).toBe("Cached result");
      expect(second.content).toBe("Cached result");
      expect(second.metadata?.cached).toBe(true);
      // Should only call the API once
      expect(mockClaude.complete).toHaveBeenCalledOnce();
    });

    it("does not cache when disabled", async () => {
      mockClaude.complete.mockResolvedValue(
        mockResponse("claude", "Not cached")
      );

      const orch = new Orchestrator({
        cacheEnabled: false,
        circuitBreakerEnabled: false,
        adaptiveRoutingEnabled: false,
      });

      await orch.execute({ intent: "reasoning", prompt: "Same prompt" });
      await orch.execute({ intent: "reasoning", prompt: "Same prompt" });

      expect(mockClaude.complete).toHaveBeenCalledTimes(2);
    });
  });

  describe("circuit breaker integration", () => {
    it("skips provider with open circuit", async () => {
      const orch = new Orchestrator({
        cacheEnabled: false,
        circuitBreakerEnabled: true,
        adaptiveRoutingEnabled: false,
        circuitBreakerConfig: {
          failureThreshold: 2,
          resetTimeoutMs: 60_000,
        },
        maxRetries: 1,
      });

      // Trip the Grok circuit breaker
      orch.circuitBreaker.recordFailure("grok");
      orch.circuitBreaker.recordFailure("grok");
      expect(orch.circuitBreaker.getState("grok")).toBe("open");

      // Sentiment normally goes to Grok first, but should skip it
      mockClaude.complete.mockResolvedValue(
        mockResponse("claude", "Sentiment via Claude")
      );

      const result = await orch.execute({
        intent: "sentiment",
        prompt: "AAPL sentiment",
      });

      expect(result.provider).toBe("claude");
      expect(mockGrok.complete).not.toHaveBeenCalled();
    });
  });

  describe("trace listeners", () => {
    it("delivers trace events to instance-level listeners", async () => {
      const events: Array<{ event: string }> = [];

      mockClaude.complete.mockResolvedValue(
        mockResponse("claude", "Traced result")
      );

      const orch = new Orchestrator({
        cacheEnabled: false,
        circuitBreakerEnabled: false,
        adaptiveRoutingEnabled: false,
        traceListeners: [(e) => events.push({ event: e.event })],
      });

      await orch.execute({ intent: "reasoning", prompt: "Trace me" });

      const eventTypes = events.map((e) => e.event);
      expect(eventTypes).toContain("request_start");
      expect(eventTypes).toContain("route_resolved");
      expect(eventTypes).toContain("provider_success");
      expect(eventTypes).toContain("request_complete");
    });
  });

  describe("cache with preferredProvider", () => {
    it("does not return cached response from different provider", async () => {
      mockClaude.complete.mockResolvedValue(
        mockResponse("claude", "Claude perspective")
      );
      mockGrok.complete.mockResolvedValue(
        mockResponse("grok", "Grok perspective")
      );

      const orch = new Orchestrator({
        cacheEnabled: true,
        circuitBreakerEnabled: false,
        adaptiveRoutingEnabled: false,
      });

      await orch.execute({
        intent: "sentiment",
        prompt: "AAPL outlook",
        preferredProvider: "claude",
      });

      const grokResult = await orch.execute({
        intent: "sentiment",
        prompt: "AAPL outlook",
        preferredProvider: "grok",
      });

      // Should NOT return Claude's cached response
      expect(grokResult.provider).toBe("grok");
      expect(grokResult.content).toBe("Grok perspective");
    });
  });

  describe("lifecycle hooks", () => {
    it("calls onRoute, onComplete callbacks", async () => {
      const onRoute = vi.fn();
      const onComplete = vi.fn();

      mockClaude.complete.mockResolvedValue(
        mockResponse("claude", "Test")
      );

      const orch = new Orchestrator({
        cacheEnabled: false,
        circuitBreakerEnabled: false,
        adaptiveRoutingEnabled: false,
        onRoute,
        onComplete,
      });

      await orch.execute({ intent: "reasoning", prompt: "Test" });

      expect(onRoute).toHaveBeenCalledOnce();
      expect(onComplete).toHaveBeenCalledOnce();
    });

    it("calls onError on failure", async () => {
      const onError = vi.fn();
      mockClaude.complete.mockRejectedValue(new Error("boom"));
      mockGrok.complete.mockRejectedValue(new Error("boom2"));

      const orch = new Orchestrator({
        cacheEnabled: false,
        circuitBreakerEnabled: false,
        adaptiveRoutingEnabled: false,
        onError,
        maxRetries: 1,
      });

      await expect(
        orch.execute({ intent: "reasoning", prompt: "fail" })
      ).rejects.toThrow();

      expect(onError).toHaveBeenCalledOnce();
    });
  });

  describe("health report", () => {
    it("returns subsystem health", async () => {
      mockClaude.complete.mockResolvedValue(
        mockResponse("claude", "Test")
      );

      const orch = new Orchestrator({
        cacheEnabled: true,
        circuitBreakerEnabled: true,
        adaptiveRoutingEnabled: true,
      });

      await orch.execute({
        intent: "reasoning",
        prompt: "Health check",
      });

      const health = orch.health();

      expect(health.circuitBreaker).toBeDefined();
      expect(health.circuitBreaker.claude).toBeDefined();
      expect(health.cache).toBeDefined();
      expect(health.cache.size).toBeGreaterThanOrEqual(0);
      expect(health.adaptiveRouter).toBeDefined();
    });
  });

  describe("consensus", () => {
    it("queries multiple providers with the same prompt", async () => {
      mockClaude.complete.mockResolvedValue(
        mockResponse("claude", "Claude says bullish")
      );
      mockGrok.complete.mockResolvedValue(
        mockResponse("grok", "Grok says neutral")
      );

      const orch = new Orchestrator({
        cacheEnabled: false,
        circuitBreakerEnabled: false,
        adaptiveRoutingEnabled: false,
      });

      const results = await orch.consensus(
        { intent: "sentiment", prompt: "AAPL outlook" },
        ["claude", "grok"]
      );

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.provider)).toContain("claude");
      expect(results.map((r) => r.provider)).toContain("grok");
    });
  });
});
