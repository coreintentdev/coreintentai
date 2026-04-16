/**
 * CoreIntent AI — Fallback Engine Tests
 *
 * Integration tests for the fallback engine using mocked model adapters.
 * Tests provider chaining, transient error retry, exponential backoff,
 * and the CoreIntentAIError aggregate error.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CompletionResponse } from "../src/models/base.js";
import type { ModelProvider } from "../src/types/index.js";

// Store mock adapters keyed by provider
const mockAdapters = new Map<string, { complete: ReturnType<typeof vi.fn> }>();

vi.mock("../src/models/index.js", () => ({
  getAdapter: (provider: string) => {
    if (!mockAdapters.has(provider)) {
      mockAdapters.set(provider, { complete: vi.fn() });
    }
    return mockAdapters.get(provider)!;
  },
}));

// Import after mock is set up
const { executeWithFallback, CoreIntentAIError } = await import(
  "../src/orchestrator/fallback.js"
);

function getMockAdapter(provider: ModelProvider) {
  if (!mockAdapters.has(provider)) {
    mockAdapters.set(provider, { complete: vi.fn() });
  }
  return mockAdapters.get(provider)!;
}

function makeResponse(
  provider: ModelProvider,
  content: string
): CompletionResponse {
  return {
    content,
    provider,
    model: `${provider}-mock`,
    tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    latencyMs: 100,
    finishReason: "stop",
  };
}

beforeEach(() => {
  mockAdapters.clear();
});

describe("Fallback Engine", () => {
  describe("successful execution", () => {
    it("returns result from primary provider on success", async () => {
      getMockAdapter("claude").complete.mockResolvedValue(
        makeResponse("claude", "Claude says hello")
      );

      const result = await executeWithFallback({
        providers: ["claude", "grok"],
        request: { prompt: "Hello" },
        maxRetries: 2,
      });

      expect(result.response.content).toBe("Claude says hello");
      expect(result.response.provider).toBe("claude");
      expect(result.fallbackUsed).toBe(false);
      expect(result.attemptedProviders).toEqual(["claude"]);
      expect(result.errors).toHaveLength(0);
    });

    it("does not call fallback providers when primary succeeds", async () => {
      getMockAdapter("claude").complete.mockResolvedValue(
        makeResponse("claude", "Success")
      );
      const grokAdapter = getMockAdapter("grok");

      await executeWithFallback({
        providers: ["claude", "grok"],
        request: { prompt: "Test" },
        maxRetries: 2,
      });

      expect(grokAdapter.complete).not.toHaveBeenCalled();
    });
  });

  describe("fallback on failure", () => {
    it("falls through to next provider when primary fails", async () => {
      getMockAdapter("claude").complete.mockRejectedValue(
        new Error("API key invalid")
      );
      getMockAdapter("grok").complete.mockResolvedValue(
        makeResponse("grok", "Grok got you")
      );

      const result = await executeWithFallback({
        providers: ["claude", "grok"],
        request: { prompt: "Hello" },
        maxRetries: 1,
      });

      expect(result.response.content).toBe("Grok got you");
      expect(result.response.provider).toBe("grok");
      expect(result.fallbackUsed).toBe(true);
      expect(result.attemptedProviders).toEqual(["claude", "grok"]);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].provider).toBe("claude");
    });

    it("tries all providers in the chain before failing", async () => {
      getMockAdapter("claude").complete.mockRejectedValue(
        new Error("Claude down")
      );
      getMockAdapter("grok").complete.mockRejectedValue(
        new Error("Grok down")
      );
      getMockAdapter("perplexity").complete.mockRejectedValue(
        new Error("Perplexity down")
      );

      await expect(
        executeWithFallback({
          providers: ["claude", "grok", "perplexity"],
          request: { prompt: "Hello" },
          maxRetries: 1,
        })
      ).rejects.toThrow(CoreIntentAIError);
    });

    it("includes all provider errors in CoreIntentAIError", async () => {
      getMockAdapter("claude").complete.mockRejectedValue(
        new Error("Claude error")
      );
      getMockAdapter("grok").complete.mockRejectedValue(
        new Error("Grok error")
      );

      try {
        await executeWithFallback({
          providers: ["claude", "grok"],
          request: { prompt: "Hello" },
          maxRetries: 1,
        });
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CoreIntentAIError);
        const aiErr = err as InstanceType<typeof CoreIntentAIError>;
        expect(aiErr.providerErrors).toHaveLength(2);
        expect(aiErr.providerErrors[0].provider).toBe("claude");
        expect(aiErr.providerErrors[1].provider).toBe("grok");
      }
    });
  });

  describe("transient error retry", () => {
    it("retries on timeout errors", async () => {
      const claudeAdapter = getMockAdapter("claude");
      claudeAdapter.complete
        .mockRejectedValueOnce(new Error("Request timed out after 30000ms"))
        .mockResolvedValueOnce(makeResponse("claude", "Retried OK"));

      const result = await executeWithFallback({
        providers: ["claude"],
        request: { prompt: "Hello" },
        maxRetries: 2,
      });

      expect(result.response.content).toBe("Retried OK");
      expect(claudeAdapter.complete).toHaveBeenCalledTimes(2);
    });

    it("retries on rate limit errors", async () => {
      const claudeAdapter = getMockAdapter("claude");
      claudeAdapter.complete
        .mockRejectedValueOnce(new Error("429 rate limit exceeded"))
        .mockResolvedValueOnce(makeResponse("claude", "After rate limit"));

      const result = await executeWithFallback({
        providers: ["claude"],
        request: { prompt: "Hello" },
        maxRetries: 2,
      });

      expect(result.response.content).toBe("After rate limit");
    });

    it("retries on 503 errors", async () => {
      const claudeAdapter = getMockAdapter("claude");
      claudeAdapter.complete
        .mockRejectedValueOnce(new Error("503 service unavailable"))
        .mockResolvedValueOnce(makeResponse("claude", "Recovered"));

      const result = await executeWithFallback({
        providers: ["claude"],
        request: { prompt: "Hello" },
        maxRetries: 2,
      });

      expect(result.response.content).toBe("Recovered");
    });

    it("does not retry non-transient errors", async () => {
      const claudeAdapter = getMockAdapter("claude");
      claudeAdapter.complete.mockRejectedValue(
        new Error("Invalid API key")
      );
      getMockAdapter("grok").complete.mockResolvedValue(
        makeResponse("grok", "Fallback")
      );

      const result = await executeWithFallback({
        providers: ["claude", "grok"],
        request: { prompt: "Hello" },
        maxRetries: 3,
      });

      // Should only try claude once (non-transient), then fall through to grok
      expect(claudeAdapter.complete).toHaveBeenCalledTimes(1);
      expect(result.response.provider).toBe("grok");
    });

    it("moves to fallback after exhausting retries on transient errors", async () => {
      const claudeAdapter = getMockAdapter("claude");
      claudeAdapter.complete.mockRejectedValue(
        new Error("Request timed out after 30000ms")
      );
      getMockAdapter("grok").complete.mockResolvedValue(
        makeResponse("grok", "Grok backup")
      );

      const result = await executeWithFallback({
        providers: ["claude", "grok"],
        request: { prompt: "Hello" },
        maxRetries: 2,
      });

      expect(claudeAdapter.complete).toHaveBeenCalledTimes(2);
      expect(result.response.provider).toBe("grok");
      expect(result.fallbackUsed).toBe(true);
    });
  });

  describe("lifecycle callbacks", () => {
    it("calls onAttempt for each provider attempt", async () => {
      getMockAdapter("claude").complete.mockRejectedValue(
        new Error("Down")
      );
      getMockAdapter("grok").complete.mockResolvedValue(
        makeResponse("grok", "OK")
      );

      const onAttempt = vi.fn();

      await executeWithFallback({
        providers: ["claude", "grok"],
        request: { prompt: "Hello" },
        maxRetries: 1,
        onAttempt,
      });

      expect(onAttempt).toHaveBeenCalledWith("claude", 1);
      expect(onAttempt).toHaveBeenCalledWith("grok", 1);
    });

    it("calls onFailure when a provider fails", async () => {
      const error = new Error("Claude exploded");
      getMockAdapter("claude").complete.mockRejectedValue(error);
      getMockAdapter("grok").complete.mockResolvedValue(
        makeResponse("grok", "OK")
      );

      const onFailure = vi.fn();

      await executeWithFallback({
        providers: ["claude", "grok"],
        request: { prompt: "Hello" },
        maxRetries: 1,
        onFailure,
      });

      expect(onFailure).toHaveBeenCalledWith("claude", error);
    });
  });
});
