import { describe, it, expect, vi, beforeEach } from "vitest";
import * as modelsModule from "../src/models/index.js";
import { executeWithFallback } from "../src/orchestrator/fallback.js";
import { CircuitBreaker } from "../src/orchestrator/circuit-breaker.js";
import { Orchestrator } from "../src/orchestrator/index.js";
import type { CompletionResponse } from "../src/models/base.js";
import type { ModelProvider } from "../src/types/index.js";

function mockAdapter(
  provider: ModelProvider,
  behavior: "success" | "fail" | (() => Promise<CompletionResponse>)
) {
  const successResponse: CompletionResponse = {
    content: `Response from ${provider}`,
    provider,
    model: `${provider}-model`,
    tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    latencyMs: 100,
    finishReason: "end_turn",
  };

  return {
    provider,
    model: `${provider}-model`,
    config: { provider, model: `${provider}-model`, apiKey: "test", maxTokens: 4096, temperature: 0.3, timeoutMs: 30000 },
    complete: typeof behavior === "function"
      ? behavior
      : behavior === "success"
        ? vi.fn().mockResolvedValue(successResponse)
        : vi.fn().mockRejectedValue(new Error(`${provider} failed`)),
    ping: vi.fn().mockResolvedValue(true),
  } as any;
}

describe("Fallback Engine with Circuit Breaker", () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 1000,
      halfOpenMaxAttempts: 1,
      latencyWindowSize: 10,
    });
  });

  it("records success and tracks latency", async () => {
    const adapter = mockAdapter("claude", "success");
    vi.spyOn(modelsModule, "getAdapter").mockReturnValue(adapter);

    await executeWithFallback({
      providers: ["claude"],
      request: { prompt: "test" },
      maxRetries: 1,
      circuitBreaker: cb,
    });

    expect(cb.getState("claude")).toBe("closed");
    expect(cb.getAverageLatency("claude")).toBeGreaterThanOrEqual(0);
  });

  it("records failure and opens circuit at threshold", async () => {
    const adapter = mockAdapter("claude", "fail");
    vi.spyOn(modelsModule, "getAdapter").mockReturnValue(adapter);

    // First call: 1 failure, still closed
    try {
      await executeWithFallback({
        providers: ["claude"],
        request: { prompt: "test" },
        maxRetries: 1,
        circuitBreaker: cb,
      });
    } catch {}

    expect(cb.getState("claude")).toBe("closed");

    // Second call: hits threshold (2), opens
    try {
      await executeWithFallback({
        providers: ["claude"],
        request: { prompt: "test" },
        maxRetries: 1,
        circuitBreaker: cb,
      });
    } catch {}

    expect(cb.getState("claude")).toBe("open");
  });

  it("skips open-circuit providers and falls back", async () => {
    // Open claude's circuit
    cb.recordFailure("claude");
    cb.recordFailure("claude");
    expect(cb.getState("claude")).toBe("open");

    const grokAdapter = mockAdapter("grok", "success");
    vi.spyOn(modelsModule, "getAdapter").mockReturnValue(grokAdapter);

    const result = await executeWithFallback({
      providers: ["claude", "grok"],
      request: { prompt: "test" },
      maxRetries: 1,
      circuitBreaker: cb,
    });

    // Circuit breaker ranks grok (closed) before claude (open).
    // Grok succeeds immediately, so claude is never attempted.
    expect(result.response.provider).toBe("grok");
    expect(result.attemptedProviders).toEqual(["grok"]);
  });

  it("reorders providers by health (rankProviders)", async () => {
    cb.recordSuccess("grok", 50);
    cb.recordSuccess("claude", 200);

    const ranked = cb.rankProviders(["claude", "grok"]);
    expect(ranked[0]).toBe("grok");
  });

  it("fails when all circuits are open", async () => {
    cb.recordFailure("claude");
    cb.recordFailure("claude");
    cb.recordFailure("grok");
    cb.recordFailure("grok");

    await expect(
      executeWithFallback({
        providers: ["claude", "grok"],
        request: { prompt: "test" },
        maxRetries: 1,
        circuitBreaker: cb,
      })
    ).rejects.toThrow("All providers failed");
  });
});

describe("Orchestrator with Circuit Breaker", () => {
  it("creates circuit breaker by default", () => {
    const orch = new Orchestrator();
    expect(orch.getCircuitBreaker()).toBeInstanceOf(CircuitBreaker);
  });

  it("disables circuit breaker when false", () => {
    const orch = new Orchestrator({ circuitBreaker: false });
    expect(orch.getCircuitBreaker()).toBeNull();
  });

  it("accepts custom circuit breaker options", () => {
    const orch = new Orchestrator({
      circuitBreaker: { failureThreshold: 5, resetTimeoutMs: 60_000 },
    });
    const cb = orch.getCircuitBreaker();
    expect(cb).toBeInstanceOf(CircuitBreaker);
  });
});
