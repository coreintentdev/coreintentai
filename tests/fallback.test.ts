import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeWithFallback,
  CoreIntentAIError,
} from "../src/orchestrator/fallback.js";
import type { CompletionResponse } from "../src/models/base.js";
import type { ModelProvider } from "../src/types/index.js";

// ---------------------------------------------------------------------------
// Mock the model adapter factory
// ---------------------------------------------------------------------------

const mockComplete = vi.fn();
const mockAdapter = { complete: mockComplete, ping: vi.fn() };

vi.mock("../src/models/index.js", () => ({
  getAdapter: () => mockAdapter,
}));

function makeResponse(
  provider: ModelProvider,
  content = "test response"
): CompletionResponse {
  return {
    content,
    provider,
    model: `${provider}-model`,
    tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    latencyMs: 100,
    finishReason: "stop",
  };
}

describe("Fallback Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns result from primary provider on success", async () => {
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

  it("falls back to next provider on non-transient failure", async () => {
    mockComplete
      .mockRejectedValueOnce(new Error("Invalid API key"))
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
    expect(result.errors[0].provider).toBe("claude");
  });

  it("retries on transient errors before falling back", async () => {
    mockComplete
      .mockRejectedValueOnce(new Error("429 rate limit exceeded"))
      .mockResolvedValueOnce(makeResponse("claude", "retry success"));

    const result = await executeWithFallback({
      providers: ["claude", "grok"],
      request: { prompt: "test" },
      maxRetries: 2,
    });

    expect(result.response.content).toBe("retry success");
    expect(result.fallbackUsed).toBe(false);
    expect(mockComplete).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-transient errors on same provider", async () => {
    mockComplete
      .mockRejectedValueOnce(new Error("Invalid request"))
      .mockResolvedValueOnce(makeResponse("grok"));

    const result = await executeWithFallback({
      providers: ["claude", "grok"],
      request: { prompt: "test" },
      maxRetries: 3,
    });

    // Should have called only twice: once for claude (no retry), once for grok
    expect(mockComplete).toHaveBeenCalledTimes(2);
    expect(result.response.provider).toBe("grok");
  });

  it("throws CoreIntentAIError when all providers fail", async () => {
    mockComplete
      .mockRejectedValueOnce(new Error("claude down"))
      .mockRejectedValueOnce(new Error("grok down"))
      .mockRejectedValueOnce(new Error("perplexity down"));

    await expect(
      executeWithFallback({
        providers: ["claude", "grok", "perplexity"],
        request: { prompt: "test" },
        maxRetries: 1,
      })
    ).rejects.toThrow(CoreIntentAIError);
  });

  it("CoreIntentAIError contains all provider errors", async () => {
    mockComplete
      .mockRejectedValueOnce(new Error("auth failed"))
      .mockRejectedValueOnce(new Error("quota exceeded"));

    try {
      await executeWithFallback({
        providers: ["claude", "grok"],
        request: { prompt: "test" },
        maxRetries: 1,
      });
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CoreIntentAIError);
      const error = err as CoreIntentAIError;
      expect(error.providerErrors).toHaveLength(2);
      expect(error.providerErrors[0].provider).toBe("claude");
      expect(error.providerErrors[1].provider).toBe("grok");
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

  it("handles non-Error thrown values", async () => {
    mockComplete
      .mockRejectedValueOnce("string error")
      .mockResolvedValueOnce(makeResponse("grok"));

    const result = await executeWithFallback({
      providers: ["claude", "grok"],
      request: { prompt: "test" },
      maxRetries: 1,
    });

    expect(result.errors[0].error).toBe("string error");
    expect(result.response.provider).toBe("grok");
  });

  it("applies timeout when specified in request", async () => {
    // Simulate a request that takes longer than the timeout
    mockComplete.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(makeResponse("claude")), 5000)
        )
    );

    await expect(
      executeWithFallback({
        providers: ["claude"],
        request: { prompt: "test", timeoutMs: 50 },
        maxRetries: 1,
      })
    ).rejects.toThrow("timed out");
  });
});
