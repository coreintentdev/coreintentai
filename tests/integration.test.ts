import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Orchestrator } from "../src/orchestrator/index.js";
import { SentimentResultSchema } from "../src/types/index.js";
import { parseJsonResponse, ParseError } from "../src/utils/json-parser.js";
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
    tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
    latencyMs: 50,
    finishReason: "end_turn",
  };
}

const VALID_SENTIMENT_JSON = JSON.stringify({
  ticker: "AAPL",
  sentiment: "bullish",
  confidence: 0.82,
  score: 0.65,
  drivers: [
    { factor: "Strong earnings", impact: "positive", weight: 0.5 },
    { factor: "Guidance raised", impact: "positive", weight: 0.3 },
    { factor: "Sector risk", impact: "negative", weight: 0.2 },
  ],
  summary: "AAPL sentiment is bullish driven by earnings beat.",
  timeHorizon: "short_term",
  timestamp: "2026-04-19T12:00:00.000Z",
});

describe("Integration Tests", () => {
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

  describe("Orchestrator Execute", () => {
    it("routes request and returns response", async () => {
      mockAdapter.complete.mockResolvedValue(
        makeMockResponse("Hello from Claude")
      );

      const orchestrator = new Orchestrator();
      const result = await orchestrator.execute({
        intent: "reasoning",
        prompt: "Test prompt",
      });

      expect(result.content).toBe("Hello from Claude");
      expect(result.provider).toBe("claude");
      expect(result.fallbackUsed).toBe(false);
    });

    it("tracks latency", async () => {
      mockAdapter.complete.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(makeMockResponse("ok")), 10)
          )
      );

      const orchestrator = new Orchestrator();
      const result = await orchestrator.execute({
        intent: "reasoning",
        prompt: "Test",
      });

      expect(result.latencyMs).toBeGreaterThanOrEqual(10);
    });

    it("calls onRoute and onComplete callbacks", async () => {
      mockAdapter.complete.mockResolvedValue(makeMockResponse("ok"));

      const onRoute = vi.fn();
      const onComplete = vi.fn();

      const orchestrator = new Orchestrator({ onRoute, onComplete });
      await orchestrator.execute({
        intent: "reasoning",
        prompt: "Test",
      });

      expect(onRoute).toHaveBeenCalledOnce();
      expect(onComplete).toHaveBeenCalledOnce();
    });

    it("calls onError callback on failure", async () => {
      mockAdapter.complete.mockRejectedValue(new Error("Auth failed"));

      const onError = vi.fn();
      const orchestrator = new Orchestrator({ onError, maxRetries: 1 });

      await expect(
        orchestrator.execute({ intent: "reasoning", prompt: "Test" })
      ).rejects.toThrow();

      expect(onError).toHaveBeenCalledOnce();
    });
  });

  describe("Fallback Behavior", () => {
    it("falls back to second provider on failure", async () => {
      const callCount = { n: 0 };
      mockAdapter.complete.mockImplementation(() => {
        callCount.n++;
        if (callCount.n === 1) {
          return Promise.reject(new Error("Auth error"));
        }
        return Promise.resolve(makeMockResponse("Fallback response", "grok"));
      });

      const orchestrator = new Orchestrator({ maxRetries: 1 });
      const result = await orchestrator.execute({
        intent: "reasoning",
        prompt: "Test",
      });

      expect(result.content).toBe("Fallback response");
      expect(result.fallbackUsed).toBe(true);
    });

    it("retries on transient errors before falling back", async () => {
      const callCount = { n: 0 };
      mockAdapter.complete.mockImplementation(() => {
        callCount.n++;
        if (callCount.n <= 2) {
          return Promise.reject(new Error("429 rate limit exceeded"));
        }
        return Promise.resolve(makeMockResponse("Recovered"));
      });

      const orchestrator = new Orchestrator({ maxRetries: 3 });
      const result = await orchestrator.execute({
        intent: "reasoning",
        prompt: "Test",
      });

      expect(result.content).toBe("Recovered");
      expect(callCount.n).toBe(3);
    });

    it("does not retry on non-transient errors", async () => {
      const callCount = { n: 0 };
      mockAdapter.complete.mockImplementation(() => {
        callCount.n++;
        if (callCount.n === 1) {
          return Promise.reject(new Error("Invalid API key"));
        }
        return Promise.resolve(makeMockResponse("From fallback"));
      });

      const orchestrator = new Orchestrator({ maxRetries: 3 });
      const result = await orchestrator.execute({
        intent: "reasoning",
        prompt: "Test",
      });

      expect(result.content).toBe("From fallback");
      expect(callCount.n).toBe(2);
    });

    it("throws CoreIntentAIError when all providers fail", async () => {
      mockAdapter.complete.mockRejectedValue(new Error("All broken"));

      const orchestrator = new Orchestrator({
        maxRetries: 1,
        fallbackEnabled: true,
      });

      await expect(
        orchestrator.execute({ intent: "reasoning", prompt: "Test" })
      ).rejects.toThrow("All providers failed");
    });

    it("only uses primary when fallback is disabled", async () => {
      mockAdapter.complete.mockRejectedValue(new Error("Primary failed"));

      const orchestrator = new Orchestrator({
        maxRetries: 1,
        fallbackEnabled: false,
      });

      await expect(
        orchestrator.execute({ intent: "reasoning", prompt: "Test" })
      ).rejects.toThrow();

      expect(mockAdapter.complete).toHaveBeenCalledTimes(1);
    });
  });

  describe("Consensus", () => {
    it("queries multiple providers", async () => {
      mockAdapter.complete.mockResolvedValue(makeMockResponse("Response"));

      const orchestrator = new Orchestrator();
      const results = await orchestrator.consensus(
        { intent: "reasoning", prompt: "Test" },
        ["claude", "grok"]
      );

      expect(results).toHaveLength(2);
    });

    it("fan executes requests in parallel", async () => {
      mockAdapter.complete.mockResolvedValue(makeMockResponse("Response"));

      const orchestrator = new Orchestrator();
      const results = await orchestrator.fan([
        { intent: "reasoning", prompt: "A" },
        { intent: "fast_analysis", prompt: "B" },
        { intent: "research", prompt: "C" },
      ]);

      expect(results).toHaveLength(3);
    });
  });

  describe("JSON Parsing Integration", () => {
    it("parses model response into validated schema", () => {
      const result = parseJsonResponse(VALID_SENTIMENT_JSON, SentimentResultSchema);
      expect(result.ticker).toBe("AAPL");
      expect(result.sentiment).toBe("bullish");
      expect(result.drivers).toHaveLength(3);
    });

    it("handles model response wrapped in markdown", () => {
      const wrapped = `Here's my analysis:\n\n\`\`\`json\n${VALID_SENTIMENT_JSON}\n\`\`\`\n\nLet me know if you need more detail.`;
      const result = parseJsonResponse(wrapped, SentimentResultSchema);
      expect(result.ticker).toBe("AAPL");
    });

    it("handles model response with prose around JSON", () => {
      const withProse = `Based on my analysis of the market data, here is the sentiment assessment:\n\n${VALID_SENTIMENT_JSON}\n\nThis reflects the current bullish momentum.`;
      const result = parseJsonResponse(withProse, SentimentResultSchema);
      expect(result.ticker).toBe("AAPL");
    });

    it("rejects invalid model output with clear error", () => {
      const badJson = '{"ticker": "AAPL", "sentiment": "yolo"}';
      expect(() => parseJsonResponse(badJson, SentimentResultSchema)).toThrow(
        ParseError
      );
    });

    it("rejects completely non-JSON model output", () => {
      const narrative =
        "I think AAPL is looking bullish based on recent earnings.";
      expect(() =>
        parseJsonResponse(narrative, SentimentResultSchema)
      ).toThrow(ParseError);
    });
  });
});
