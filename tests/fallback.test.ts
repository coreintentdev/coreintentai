import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeWithFallback,
  CoreIntentAIError,
  isTransient,
} from "../src/orchestrator/fallback.js";
import { CircuitBreaker } from "../src/orchestrator/circuit-breaker.js";
import type { ModelProvider } from "../src/types/index.js";
import type { CompletionResponse } from "../src/models/base.js";

// ---------------------------------------------------------------------------
// Mock the model adapter factory
// ---------------------------------------------------------------------------

const mockComplete = vi.fn<() => Promise<CompletionResponse>>();

vi.mock("../src/models/index.js", () => ({
  getAdapter: (_provider: ModelProvider) => ({
    complete: mockComplete,
  }),
}));

function makeResponse(provider: ModelProvider): CompletionResponse {
  return {
    content: `Response from ${provider}`,
    provider,
    model: `${provider}-mock`,
    tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    latencyMs: 100,
    finishReason: "stop",
  };
}

describe("executeWithFallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the first provider's response on success", async () => {
    mockComplete.mockResolvedValueOnce(makeResponse("claude"));

    const result = await executeWithFallback({
      providers: ["claude", "grok"],
      request: { prompt: "test" },
      maxRetries: 1,
    });

    expect(result.response.provider).toBe("claude");
    expect(result.fallbackUsed).toBe(false);
    expect(result.attemptedProviders).toEqual(["claude"]);
    expect(result.errors).toHaveLength(0);
  });

  it("falls back to second provider on non-transient failure", async () => {
    mockComplete
      .mockRejectedValueOnce(new Error("Authentication failed"))
      .mockResolvedValueOnce(makeResponse("grok"));

    const result = await executeWithFallback({
      providers: ["claude", "grok"],
      request: { prompt: "test" },
      maxRetries: 2,
    });

    expect(result.response.provider).toBe("grok");
    expect(result.fallbackUsed).toBe(true);
    expect(result.attemptedProviders).toEqual(["claude", "grok"]);
    expect(result.errors).toHaveLength(1);
  });

  it("retries on transient errors before falling back", async () => {
    mockComplete
      .mockRejectedValueOnce(new Error("rate limit exceeded"))
      .mockResolvedValueOnce(makeResponse("claude"));

    const result = await executeWithFallback({
      providers: ["claude", "grok"],
      request: { prompt: "test" },
      maxRetries: 2,
    });

    // Should have succeeded on retry with same provider
    expect(result.response.provider).toBe("claude");
    expect(result.fallbackUsed).toBe(false);
    expect(mockComplete).toHaveBeenCalledTimes(2);
  });

  it("falls back after exhausting retries on transient errors", async () => {
    mockComplete
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(makeResponse("grok"));

    const result = await executeWithFallback({
      providers: ["claude", "grok"],
      request: { prompt: "test" },
      maxRetries: 2,
    });

    expect(result.response.provider).toBe("grok");
    expect(result.fallbackUsed).toBe(true);
    expect(result.errors).toHaveLength(2); // Two failures on claude
  });

  it("throws CoreIntentAIError when all providers fail", async () => {
    mockComplete
      .mockRejectedValueOnce(new Error("claude down"))
      .mockRejectedValueOnce(new Error("grok down"));

    await expect(
      executeWithFallback({
        providers: ["claude", "grok"],
        request: { prompt: "test" },
        maxRetries: 1,
      })
    ).rejects.toThrow(CoreIntentAIError);
  });

  it("includes all provider errors in CoreIntentAIError", async () => {
    mockComplete
      .mockRejectedValueOnce(new Error("claude exploded"))
      .mockRejectedValueOnce(new Error("grok exploded"));

    try {
      await executeWithFallback({
        providers: ["claude", "grok"],
        request: { prompt: "test" },
        maxRetries: 1,
      });
      expect.fail("Should have thrown");
    } catch (e) {
      const err = e as CoreIntentAIError;
      expect(err.providerErrors).toHaveLength(2);
      expect(err.providerErrors[0].provider).toBe("claude");
      expect(err.providerErrors[1].provider).toBe("grok");
    }
  });

  it("calls onAttempt and onFailure callbacks", async () => {
    const onAttempt = vi.fn();
    const onFailure = vi.fn();

    mockComplete
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce(makeResponse("grok"));

    await executeWithFallback({
      providers: ["claude", "grok"],
      request: { prompt: "test" },
      maxRetries: 1,
      onAttempt,
      onFailure,
    });

    expect(onAttempt).toHaveBeenCalledWith("claude", 1);
    expect(onAttempt).toHaveBeenCalledWith("grok", 1);
    expect(onFailure).toHaveBeenCalledWith("claude", expect.any(Error));
  });

  describe("circuit breaker integration", () => {
    it("skips providers with open circuits", async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1 });
      breaker.recordFailure("claude"); // Trips circuit

      mockComplete.mockResolvedValueOnce(makeResponse("grok"));

      const result = await executeWithFallback({
        providers: ["claude", "grok"],
        request: { prompt: "test" },
        maxRetries: 1,
        circuitBreaker: breaker,
      });

      // Should have gone straight to grok
      expect(result.response.provider).toBe("grok");
      expect(result.attemptedProviders).toEqual(["grok"]);
    });

    it("records success with circuit breaker", async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });
      mockComplete.mockResolvedValueOnce(makeResponse("claude"));

      await executeWithFallback({
        providers: ["claude"],
        request: { prompt: "test" },
        maxRetries: 1,
        circuitBreaker: breaker,
      });

      const stats = breaker.getStats();
      expect(stats["claude"].totalSuccesses).toBe(1);
    });

    it("records failure with circuit breaker", async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });
      mockComplete
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValueOnce(makeResponse("grok"));

      await executeWithFallback({
        providers: ["claude", "grok"],
        request: { prompt: "test" },
        maxRetries: 1,
        circuitBreaker: breaker,
      });

      const stats = breaker.getStats();
      expect(stats["claude"].totalFailures).toBe(1);
    });
  });
});

describe("isTransient", () => {
  it.each([
    ["timeout", true],
    ["Request timed out after 30000ms", true],
    ["rate limit exceeded", true],
    ["HTTP 429 Too Many Requests", true],
    ["503 Service Unavailable", true],
    ["502 Bad Gateway", true],
    ["500 Internal Server Error", true],
    ["ECONNRESET", true],
    ["ECONNREFUSED", true],
    ["ENOTFOUND", true],
    ["EPIPE", true],
    ["EHOSTUNREACH", true],
    ["ENETUNREACH", true],
    ["socket hang up", true],
    ["network error", true],
    ["fetch failed", true],
    ["aborted", true],
    ["ECONNABORTED", true],
    ["service unavailable", true],
    ["server overloaded", true],
    ["at capacity", true],
    ["Authentication failed", false],
    ["Invalid API key", false],
    ["Model not found", false],
    ["Permission denied", false],
    ["Invalid request body", false],
  ])("classifies '%s' as transient=%s", (message, expected) => {
    expect(isTransient(new Error(message))).toBe(expected);
  });

  it.each([
    "Token limit exceeded: 4500 tokens",
    "Model context-500 not found",
    "Validation failed for field 502a",
  ])("does not classify non-http numeric message '%s' as transient", (message) => {
    expect(isTransient(new Error(message))).toBe(false);
  });
});
