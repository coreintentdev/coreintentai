import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Orchestrator } from "../src/orchestrator/index.js";
import { Telemetry } from "../src/telemetry/index.js";
import { AdaptiveRouter } from "../src/orchestrator/adaptive-router.js";
import * as modelsModule from "../src/models/index.js";
import type { CompletionResponse } from "../src/models/base.js";

function makeMockResponse(
  content: string,
  provider: "claude" | "grok" | "perplexity" = "claude"
): CompletionResponse {
  return {
    content,
    provider,
    model: `mock-${provider}`,
    tokenUsage: { inputTokens: 500, outputTokens: 1000, totalTokens: 1500 },
    latencyMs: 50,
    finishReason: "end_turn",
  };
}

function makeCachedResponse(): CompletionResponse {
  return {
    content: "cached response",
    provider: "claude",
    model: "mock-claude",
    tokenUsage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
    latencyMs: 30,
    finishReason: "end_turn",
    cacheMetrics: {
      cacheReadInputTokens: 800,
      cacheCreationInputTokens: 0,
    },
  };
}

describe("Orchestrator + Telemetry", () => {
  let mockAdapter: {
    complete: ReturnType<typeof vi.fn>;
    ping: ReturnType<typeof vi.fn>;
    provider: string;
    model: string;
  };

  beforeEach(() => {
    mockAdapter = {
      complete: vi.fn(),
      ping: vi.fn().mockResolvedValue(true),
      provider: "claude",
      model: "mock-claude",
    };
    vi.spyOn(modelsModule, "getAdapter").mockReturnValue(mockAdapter as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits telemetry events on successful request", async () => {
    const tel = new Telemetry();
    const startListener = vi.fn();
    const completeListener = vi.fn();
    tel.on("request_start", startListener);
    tel.on("request_complete", completeListener);

    mockAdapter.complete.mockResolvedValue(makeMockResponse("ok"));

    const orch = new Orchestrator({ telemetry: tel });
    await orch.execute({ intent: "reasoning", prompt: "test" });

    expect(startListener).toHaveBeenCalledOnce();
    expect(completeListener).toHaveBeenCalledOnce();

    const snap = tel.getSnapshot();
    expect(snap.totalRequests).toBe(1);
    expect(snap.successfulRequests).toBe(1);
    expect(snap.totalCostUsd).toBeGreaterThan(0);
  });

  it("emits telemetry error events on failure", async () => {
    const tel = new Telemetry();
    const errorListener = vi.fn();
    tel.on("request_error", errorListener);

    mockAdapter.complete.mockRejectedValue(new Error("API down"));

    const orch = new Orchestrator({
      telemetry: tel,
      maxRetries: 1,
      fallbackEnabled: false,
    });

    await expect(
      orch.execute({ intent: "reasoning", prompt: "test" })
    ).rejects.toThrow();

    expect(errorListener).toHaveBeenCalledOnce();
    expect(tel.getSnapshot().failedRequests).toBe(1);
  });

  it("emits cache_hit when cacheMetrics are present", async () => {
    const tel = new Telemetry();
    const cacheListener = vi.fn();
    tel.on("cache_hit", cacheListener);

    mockAdapter.complete.mockResolvedValue(makeCachedResponse());

    const orch = new Orchestrator({ telemetry: tel, enableCaching: true });
    await orch.execute({ intent: "reasoning", prompt: "test" });

    expect(cacheListener).toHaveBeenCalledOnce();
    const event = cacheListener.mock.calls[0][0];
    expect(event.cacheReadTokens).toBe(800);
  });

  it("tracks cost across multiple requests", async () => {
    const tel = new Telemetry();
    mockAdapter.complete.mockResolvedValue(makeMockResponse("ok"));

    const orch = new Orchestrator({ telemetry: tel });
    await orch.execute({ intent: "reasoning", prompt: "a" });
    await orch.execute({ intent: "sentiment", prompt: "b" });
    await orch.execute({ intent: "research", prompt: "c" });

    const snap = tel.getSnapshot();
    expect(snap.totalRequests).toBe(3);
    expect(snap.successfulRequests).toBe(3);
    expect(snap.totalCostUsd).toBeGreaterThan(0);
    expect(snap.latencyP50Ms).toBeGreaterThanOrEqual(0);
  });

  it("includes thinking and cacheMetrics in response metadata", async () => {
    const tel = new Telemetry();
    mockAdapter.complete.mockResolvedValue({
      ...makeMockResponse("result"),
      thinking: "Step 1: ...",
      cacheMetrics: {
        cacheReadInputTokens: 500,
        cacheCreationInputTokens: 100,
      },
    });

    const orch = new Orchestrator({ telemetry: tel });
    const result = await orch.execute({ intent: "reasoning", prompt: "test" });

    expect(result.metadata?.thinking).toBe("Step 1: ...");
    expect(result.metadata?.cacheMetrics).toEqual({
      cacheReadInputTokens: 500,
      cacheCreationInputTokens: 100,
    });
  });
});

describe("Orchestrator + AdaptiveRouter", () => {
  let mockAdapter: {
    complete: ReturnType<typeof vi.fn>;
    ping: ReturnType<typeof vi.fn>;
    provider: string;
    model: string;
  };

  beforeEach(() => {
    mockAdapter = {
      complete: vi.fn(),
      ping: vi.fn().mockResolvedValue(true),
      provider: "claude",
      model: "mock-claude",
    };
    vi.spyOn(modelsModule, "getAdapter").mockReturnValue(mockAdapter as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records outcomes in adaptive router on success", async () => {
    const ar = new AdaptiveRouter();
    mockAdapter.complete.mockResolvedValue(makeMockResponse("ok"));

    const orch = new Orchestrator({ adaptiveRouter: ar });
    await orch.execute({ intent: "reasoning", prompt: "test" });

    const score = ar.getScore("reasoning", "claude");
    expect(score).not.toBeNull();
    expect(score!.successRate).toBe(1);
    expect(score!.sampleCount).toBe(1);
  });

  it("records failure outcomes in adaptive router", async () => {
    const ar = new AdaptiveRouter();
    mockAdapter.complete.mockRejectedValue(new Error("fail"));

    const orch = new Orchestrator({
      adaptiveRouter: ar,
      maxRetries: 1,
      fallbackEnabled: false,
    });

    await expect(
      orch.execute({ intent: "reasoning", prompt: "test" })
    ).rejects.toThrow();

    const score = ar.getScore("reasoning", "claude");
    expect(score).not.toBeNull();
    expect(score!.successRate).toBe(0);
  });

  it("uses adaptive routing when sufficient data exists", async () => {
    const ar = new AdaptiveRouter({ minSamples: 2 });

    // Pre-populate with data showing grok is better for sentiment
    for (let i = 0; i < 5; i++) {
      ar.recordOutcome("sentiment", "grok", {
        success: true,
        latencyMs: 50,
        costUsd: 0.001,
      });
      ar.recordOutcome("sentiment", "claude", {
        success: true,
        latencyMs: 500,
        costUsd: 0.01,
      });
      ar.recordOutcome("sentiment", "perplexity", {
        success: true,
        latencyMs: 300,
        costUsd: 0.005,
      });
    }

    mockAdapter.complete.mockResolvedValue(makeMockResponse("ok", "grok"));

    const onRoute = vi.fn();
    const orch = new Orchestrator({ adaptiveRouter: ar, onRoute });
    await orch.execute({ intent: "sentiment", prompt: "test" });

    // The adaptive router should have reordered the chain
    const routedProviders = onRoute.mock.calls[0][1];
    expect(routedProviders[0]).toBe("grok");
  });

  it("records failures for all providers when all fail", async () => {
    const ar = new AdaptiveRouter();
    mockAdapter.complete.mockRejectedValue(new Error("fail"));

    const orch = new Orchestrator({
      adaptiveRouter: ar,
      maxRetries: 1,
      fallbackEnabled: true,
    });

    await expect(
      orch.execute({ intent: "reasoning", prompt: "test" })
    ).rejects.toThrow();

    // Both claude and grok (the fallback chain for reasoning) should be penalized
    const claudeScore = ar.getScore("reasoning", "claude");
    const grokScore = ar.getScore("reasoning", "grok");
    expect(claudeScore).not.toBeNull();
    expect(grokScore).not.toBeNull();
    expect(claudeScore!.successRate).toBe(0);
    expect(grokScore!.successRate).toBe(0);
  });

  it("records intermediate failures on success path with fallback", async () => {
    const ar = new AdaptiveRouter();
    const callCount = { n: 0 };
    mockAdapter.complete.mockImplementation(() => {
      callCount.n++;
      if (callCount.n === 1) {
        return Promise.reject(new Error("Auth error"));
      }
      return Promise.resolve(makeMockResponse("Fallback response", "grok"));
    });

    const orch = new Orchestrator({
      adaptiveRouter: ar,
      maxRetries: 1,
      fallbackEnabled: true,
    });

    await orch.execute({ intent: "reasoning", prompt: "test" });

    // Claude failed, grok succeeded — both should be recorded
    const claudeScore = ar.getScore("reasoning", "claude");
    const grokScore = ar.getScore("reasoning", "grok");
    expect(claudeScore).not.toBeNull();
    expect(grokScore).not.toBeNull();
    expect(claudeScore!.successRate).toBe(0);
    expect(grokScore!.successRate).toBe(1);
  });

  it("falls back to static routing with insufficient data", async () => {
    const ar = new AdaptiveRouter({ minSamples: 100 });
    mockAdapter.complete.mockResolvedValue(makeMockResponse("ok"));

    const onRoute = vi.fn();
    const orch = new Orchestrator({ adaptiveRouter: ar, onRoute });
    await orch.execute({ intent: "reasoning", prompt: "test" });

    // Should use static routing: claude first for reasoning
    const routedProviders = onRoute.mock.calls[0][1];
    expect(routedProviders[0]).toBe("claude");
  });
});

describe("Orchestrator + Telemetry + AdaptiveRouter combined", () => {
  let mockAdapter: {
    complete: ReturnType<typeof vi.fn>;
    ping: ReturnType<typeof vi.fn>;
    provider: string;
    model: string;
  };

  beforeEach(() => {
    mockAdapter = {
      complete: vi.fn(),
      ping: vi.fn().mockResolvedValue(true),
      provider: "claude",
      model: "mock-claude",
    };
    vi.spyOn(modelsModule, "getAdapter").mockReturnValue(mockAdapter as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("telemetry and adaptive router both receive data", async () => {
    const tel = new Telemetry();
    const ar = new AdaptiveRouter();

    mockAdapter.complete.mockResolvedValue(makeMockResponse("ok"));

    const orch = new Orchestrator({ telemetry: tel, adaptiveRouter: ar });
    await orch.execute({ intent: "reasoning", prompt: "test" });

    expect(tel.getSnapshot().successfulRequests).toBe(1);
    expect(ar.getScore("reasoning", "claude")!.sampleCount).toBe(1);
  });

  it("enableCaching and enableThinking flow through to request", async () => {
    mockAdapter.complete.mockResolvedValue(makeMockResponse("ok"));

    const orch = new Orchestrator({
      enableCaching: true,
      enableThinking: true,
      thinkingBudget: 4000,
    });

    await orch.execute({ intent: "reasoning", prompt: "test" });

    const callArgs = mockAdapter.complete.mock.calls[0][0];
    expect(callArgs.enableCaching).toBe(true);
    expect(callArgs.enableThinking).toBe(true);
    expect(callArgs.thinkingBudget).toBe(4000);
  });

  it("getters return configured instances", () => {
    const tel = new Telemetry();
    const ar = new AdaptiveRouter();
    const orch = new Orchestrator({ telemetry: tel, adaptiveRouter: ar });

    expect(orch.getTelemetry()).toBe(tel);
    expect(orch.getAdaptiveRouter()).toBe(ar);
    expect(orch.getCircuitBreaker()).not.toBeNull();
  });
});
