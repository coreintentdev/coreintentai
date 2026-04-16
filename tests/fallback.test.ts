import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeWithFallback } from "../src/orchestrator/fallback.js";
import { CircuitBreaker } from "../src/orchestrator/circuit-breaker.js";
import { HealthTracker } from "../src/orchestrator/health.js";
import type { CompletionRequest, CompletionResponse } from "../src/models/base.js";
import type { ModelProvider } from "../src/types/index.js";

const getAdapterMock = vi.hoisted(() => vi.fn());

vi.mock("../src/models/index.js", () => ({
  getAdapter: getAdapterMock,
}));

function makeResponse(provider: ModelProvider): CompletionResponse {
  return {
    content: `ok-${provider}`,
    provider,
    model: `${provider}-model`,
    tokenUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    latencyMs: 1,
    finishReason: "stop",
  };
}

describe("executeWithFallback", () => {
  const request: CompletionRequest = { prompt: "test request" };

  beforeEach(() => {
    getAdapterMock.mockReset();
  });

  it("records a single circuit-breaker failure after retries are exhausted", async () => {
    const circuitBreaker = new CircuitBreaker();
    const healthTracker = new HealthTracker();

    const complete = vi
      .fn()
      .mockRejectedValueOnce(new Error("Request timeout"))
      .mockRejectedValueOnce(new Error("Request timeout"))
      .mockResolvedValue(makeResponse("grok"));

    getAdapterMock.mockImplementation(() => ({ complete }));

    const result = await executeWithFallback({
      providers: ["claude", "grok"],
      request,
      maxRetries: 2,
      circuitBreaker,
      healthTracker,
    });

    expect(result.response.provider).toBe("grok");
    expect(circuitBreaker.getStats("claude").consecutiveFailures).toBe(1);
    expect(healthTracker.getHealth("claude").totalErrors).toBe(2);
  });
});
