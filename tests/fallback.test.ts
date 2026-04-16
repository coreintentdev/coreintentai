import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { executeWithFallback, CoreIntentAIError } from "../src/orchestrator/fallback.js";
import { CircuitBreaker } from "../src/utils/circuit-breaker.js";
import * as modelsModule from "../src/models/index.js";

// Mock the adapter module
vi.mock("../src/models/index.js", () => ({
  getAdapter: vi.fn(),
}));

function createMockAdapter(response?: Partial<ReturnType<typeof makeResponse>>, shouldFail?: string) {
  return {
    complete: shouldFail
      ? vi.fn().mockRejectedValue(new Error(shouldFail))
      : vi.fn().mockResolvedValue(makeResponse(response)),
    ping: vi.fn().mockResolvedValue(true),
  };
}

function makeResponse(overrides?: Record<string, unknown>) {
  return {
    content: "test response",
    provider: "claude",
    model: "test-model",
    tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    latencyMs: 200,
    finishReason: "stop",
    ...overrides,
  };
}

describe("executeWithFallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("succeeds on first provider", async () => {
    const adapter = createMockAdapter({ content: "Claude says hi" });
    vi.mocked(modelsModule.getAdapter).mockReturnValue(adapter as never);

    const result = await executeWithFallback({
      providers: ["claude"],
      request: { prompt: "test" },
      maxRetries: 2,
    });

    expect(result.response.content).toBe("Claude says hi");
    expect(result.fallbackUsed).toBe(false);
    expect(result.errors).toHaveLength(0);
  });

  it("falls through to second provider on failure", async () => {
    const failingAdapter = createMockAdapter(undefined, "Auth error 401");
    const successAdapter = createMockAdapter({ content: "Grok to the rescue", provider: "grok" });

    vi.mocked(modelsModule.getAdapter)
      .mockReturnValueOnce(failingAdapter as never)
      .mockReturnValueOnce(successAdapter as never);

    const result = await executeWithFallback({
      providers: ["claude", "grok"],
      request: { prompt: "test" },
      maxRetries: 1,
    });

    expect(result.response.content).toBe("Grok to the rescue");
    expect(result.fallbackUsed).toBe(true);
    expect(result.attemptedProviders).toEqual(["claude", "grok"]);
    expect(result.errors).toHaveLength(1);
  });

  it("retries on transient errors before falling through", async () => {
    const adapter = createMockAdapter(undefined, "429 rate limit exceeded");
    const successAdapter = createMockAdapter({ content: "success" });

    vi.mocked(modelsModule.getAdapter)
      .mockReturnValueOnce(adapter as never)     // claude attempt 1 — fail
      .mockReturnValueOnce(adapter as never)     // claude attempt 2 — fail
      .mockReturnValueOnce(successAdapter as never); // grok — success

    vi.useFakeTimers();

    const promise = executeWithFallback({
      providers: ["claude", "grok"],
      request: { prompt: "test" },
      maxRetries: 2,
    });

    // Advance past the backoff timers
    await vi.advanceTimersByTimeAsync(10_000);

    const result = await promise;
    expect(result.response.content).toBe("success");
    expect(result.errors).toHaveLength(2); // 2 claude failures

    vi.useRealTimers();
  });

  it("throws CoreIntentAIError when all providers fail", async () => {
    const failingAdapter = createMockAdapter(undefined, "Service down");
    vi.mocked(modelsModule.getAdapter).mockReturnValue(failingAdapter as never);

    await expect(
      executeWithFallback({
        providers: ["claude", "grok"],
        request: { prompt: "test" },
        maxRetries: 1,
      })
    ).rejects.toThrow(CoreIntentAIError);
  });

  it("calls onAttempt and onFailure callbacks", async () => {
    const failingAdapter = createMockAdapter(undefined, "timeout");
    const successAdapter = createMockAdapter({ content: "ok" });

    vi.mocked(modelsModule.getAdapter)
      .mockReturnValueOnce(failingAdapter as never)
      .mockReturnValueOnce(successAdapter as never);

    const onAttempt = vi.fn();
    const onFailure = vi.fn();

    vi.useFakeTimers();

    const promise = executeWithFallback({
      providers: ["claude", "grok"],
      request: { prompt: "test" },
      maxRetries: 1,
      onAttempt,
      onFailure,
    });

    await vi.advanceTimersByTimeAsync(1000);

    await promise;

    expect(onAttempt).toHaveBeenCalledTimes(2);
    expect(onFailure).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  describe("circuit breaker integration", () => {
    it("skips providers with open circuits", async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 60_000, failureWindowMs: 60_000, successThreshold: 1 });
      breaker.recordFailure("claude"); // trips claude's circuit

      const grokAdapter = createMockAdapter({ content: "Grok here", provider: "grok" });
      vi.mocked(modelsModule.getAdapter).mockReturnValue(grokAdapter as never);

      const result = await executeWithFallback({
        providers: ["claude", "grok"],
        request: { prompt: "test" },
        maxRetries: 1,
        circuitBreaker: breaker,
      });

      expect(result.response.content).toBe("Grok here");
      expect(result.skippedProviders).toEqual(["claude"]);
      expect(result.attemptedProviders).toEqual(["grok"]);
    });

    it("records success with circuit breaker", async () => {
      const breaker = new CircuitBreaker();
      const adapter = createMockAdapter({ content: "ok" });
      vi.mocked(modelsModule.getAdapter).mockReturnValue(adapter as never);

      await executeWithFallback({
        providers: ["claude"],
        request: { prompt: "test" },
        maxRetries: 1,
        circuitBreaker: breaker,
      });

      const status = breaker.getStatus();
      expect(status.claude.successRate).toBe(1);
    });

    it("records failure with circuit breaker", async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 5, cooldownMs: 60_000, failureWindowMs: 60_000, successThreshold: 1 });
      const failingAdapter = createMockAdapter(undefined, "Auth 401");
      const successAdapter = createMockAdapter({ content: "ok" });

      vi.mocked(modelsModule.getAdapter)
        .mockReturnValueOnce(failingAdapter as never)
        .mockReturnValueOnce(successAdapter as never);

      await executeWithFallback({
        providers: ["claude", "grok"],
        request: { prompt: "test" },
        maxRetries: 1,
        circuitBreaker: breaker,
      });

      const status = breaker.getStatus();
      expect(status.claude.recentFailures).toBe(1);
    });
  });

  describe("error classification", () => {
    it("classifies timeout errors", async () => {
      const adapter = createMockAdapter(undefined, "Request timed out after 30000ms");
      const successAdapter = createMockAdapter({ content: "ok" });

      vi.mocked(modelsModule.getAdapter)
        .mockReturnValueOnce(adapter as never)
        .mockReturnValueOnce(successAdapter as never);

      vi.useFakeTimers();

      const promise = executeWithFallback({
        providers: ["claude", "grok"],
        request: { prompt: "test" },
        maxRetries: 1,
      });

      await vi.advanceTimersByTimeAsync(10_000);
      const result = await promise;

      expect(result.errors[0].category).toBe("timeout");

      vi.useRealTimers();
    });

    it("classifies auth errors", async () => {
      const adapter = createMockAdapter(undefined, "401 Unauthorized");
      const successAdapter = createMockAdapter({ content: "ok" });

      vi.mocked(modelsModule.getAdapter)
        .mockReturnValueOnce(adapter as never)
        .mockReturnValueOnce(successAdapter as never);

      const result = await executeWithFallback({
        providers: ["claude", "grok"],
        request: { prompt: "test" },
        maxRetries: 1,
      });

      expect(result.errors[0].category).toBe("auth");
    });
  });
});
