import { describe, it, expect, beforeEach, vi } from "vitest";
import { Telemetry } from "../src/telemetry/index.js";
import type {
  RequestCompleteEvent,
  RequestErrorEvent,
  CacheHitEvent,
} from "../src/telemetry/index.js";

describe("Telemetry", () => {
  let tel: Telemetry;

  beforeEach(() => {
    tel = new Telemetry();
  });

  describe("event emission", () => {
    it("emits request_start and increments request count", () => {
      const listener = vi.fn();
      tel.on("request_start", listener);

      tel.emit("request_start", {
        requestId: "req_1",
        provider: "claude",
        intent: "reasoning",
        timestamp: Date.now(),
      });

      expect(listener).toHaveBeenCalledOnce();
      expect(tel.getSnapshot().totalRequests).toBe(1);
    });

    it("emits request_complete and tracks metrics", () => {
      const listener = vi.fn();
      tel.on("request_complete", listener);

      tel.emit("request_start", {
        requestId: "req_1",
        provider: "claude",
        intent: "reasoning",
        timestamp: Date.now(),
      });

      tel.emit("request_complete", {
        requestId: "req_1",
        provider: "claude",
        intent: "reasoning",
        latencyMs: 250,
        tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        costUsd: 0.0033,
        cached: false,
        timestamp: Date.now(),
      });

      expect(listener).toHaveBeenCalledOnce();
      const snap = tel.getSnapshot();
      expect(snap.successfulRequests).toBe(1);
      expect(snap.totalCostUsd).toBeCloseTo(0.0033);
      expect(snap.totalTokens.input).toBe(100);
      expect(snap.totalTokens.output).toBe(200);
    });

    it("emits request_error and tracks failures", () => {
      tel.emit("request_start", {
        requestId: "req_1",
        provider: "grok",
        intent: "fast_analysis",
        timestamp: Date.now(),
      });

      tel.emit("request_error", {
        requestId: "req_1",
        provider: "grok",
        intent: "fast_analysis",
        error: "rate limit exceeded",
        transient: true,
        timestamp: Date.now(),
      });

      const snap = tel.getSnapshot();
      expect(snap.failedRequests).toBe(1);
      expect(snap.byProvider.grok?.failures).toBe(1);
    });

    it("supports removing listeners", () => {
      const listener = vi.fn();
      tel.on("request_start", listener);
      tel.off("request_start", listener);

      tel.emit("request_start", {
        requestId: "req_1",
        provider: "claude",
        intent: "reasoning",
        timestamp: Date.now(),
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("cost calculation", () => {
    it("calculates claude cost correctly", () => {
      const cost = tel.calculateCost("claude", {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        totalTokens: 2_000_000,
      });

      // Claude: $3/M input + $15/M output = $18
      expect(cost).toBeCloseTo(18.0);
    });

    it("calculates grok cost correctly", () => {
      const cost = tel.calculateCost("grok", {
        inputTokens: 500_000,
        outputTokens: 500_000,
        totalTokens: 1_000_000,
      });

      // Grok: $1.50 input + $7.50 output = $9
      expect(cost).toBeCloseTo(9.0);
    });

    it("calculates perplexity cost correctly", () => {
      const cost = tel.calculateCost("perplexity", {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        totalTokens: 2_000_000,
      });

      // Perplexity: $1/M input + $5/M output = $6
      expect(cost).toBeCloseTo(6.0);
    });

    it("calculates cost with cache metrics", () => {
      const costWithCache = tel.calculateCost(
        "claude",
        {
          inputTokens: 1_000_000,
          outputTokens: 100_000,
          totalTokens: 1_100_000,
        },
        {
          cacheReadInputTokens: 800_000,
          cacheCreationInputTokens: 0,
        }
      );

      // 200k regular input: 200k/1M * $3 = $0.60
      // 800k cache read: 800k/1M * $0.30 = $0.24
      // 100k output: 100k/1M * $15 = $1.50
      // Total = $2.34
      expect(costWithCache).toBeCloseTo(2.34);
    });

    it("calculates cost with cache creation", () => {
      const cost = tel.calculateCost(
        "claude",
        {
          inputTokens: 1_000_000,
          outputTokens: 100_000,
          totalTokens: 1_100_000,
        },
        {
          cacheReadInputTokens: 0,
          cacheCreationInputTokens: 500_000,
        }
      );

      // 500k regular: 500k/1M * $3 = $1.50
      // 500k cache write: 500k/1M * $3.75 = $1.875
      // 100k output: 100k/1M * $15 = $1.50
      // Total = $4.875
      expect(cost).toBeCloseTo(4.875);
    });
  });

  describe("provider metrics", () => {
    it("tracks per-provider statistics", () => {
      emitComplete(tel, "claude", "reasoning", 200, 0.003);
      emitComplete(tel, "claude", "reasoning", 300, 0.004);
      emitComplete(tel, "grok", "fast_analysis", 50, 0.001);

      const snap = tel.getSnapshot();
      expect(snap.byProvider.claude?.requests).toBe(2);
      expect(snap.byProvider.claude?.successes).toBe(2);
      expect(snap.byProvider.grok?.requests).toBe(1);
    });

    it("tracks per-intent statistics", () => {
      emitComplete(tel, "claude", "reasoning", 200, 0.003);
      emitComplete(tel, "claude", "reasoning", 300, 0.004);
      emitComplete(tel, "grok", "sentiment", 50, 0.001);

      const snap = tel.getSnapshot();
      expect(snap.byIntent.reasoning?.requests).toBe(2);
      expect(snap.byIntent.sentiment?.requests).toBe(1);
    });

    it("computes exponential moving average for latency", () => {
      for (let i = 0; i < 20; i++) {
        emitComplete(tel, "claude", "reasoning", 100, 0.003);
      }

      const snap = tel.getSnapshot();
      expect(snap.byProvider.claude?.avgLatencyMs).toBeCloseTo(100, 0);
    });
  });

  describe("latency percentiles", () => {
    it("calculates P50, P95, P99", () => {
      for (let i = 1; i <= 100; i++) {
        emitComplete(tel, "claude", "reasoning", i * 10, 0.001);
      }

      const snap = tel.getSnapshot();
      expect(snap.latencyP50Ms).toBe(500);
      expect(snap.latencyP95Ms).toBe(950);
      expect(snap.latencyP99Ms).toBe(990);
    });

    it("returns 0 for empty latencies", () => {
      const snap = tel.getSnapshot();
      expect(snap.latencyP50Ms).toBe(0);
      expect(snap.latencyP95Ms).toBe(0);
    });
  });

  describe("cache savings tracking", () => {
    it("accumulates cache savings from cache_hit events", () => {
      tel.emit("cache_hit", {
        provider: "claude",
        cacheReadTokens: 500_000,
        cacheCreationTokens: 0,
        estimatedSavingsUsd: 1.35,
        timestamp: Date.now(),
      });

      tel.emit("cache_hit", {
        provider: "claude",
        cacheReadTokens: 300_000,
        cacheCreationTokens: 0,
        estimatedSavingsUsd: 0.81,
        timestamp: Date.now(),
      });

      const snap = tel.getSnapshot();
      expect(snap.cacheSavingsUsd).toBeCloseTo(2.16);
    });
  });

  describe("request ID generation", () => {
    it("generates unique request IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(tel.generateRequestId());
      }
      expect(ids.size).toBe(100);
    });

    it("generates IDs with req_ prefix", () => {
      const id = tel.generateRequestId();
      expect(id).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });

  describe("reset", () => {
    it("clears all metrics", () => {
      emitComplete(tel, "claude", "reasoning", 200, 0.003);
      emitComplete(tel, "grok", "fast_analysis", 50, 0.001);

      tel.reset();

      const snap = tel.getSnapshot();
      expect(snap.totalRequests).toBe(0);
      expect(snap.successfulRequests).toBe(0);
      expect(snap.failedRequests).toBe(0);
      expect(snap.totalCostUsd).toBe(0);
      expect(snap.totalTokens.input).toBe(0);
      expect(snap.totalTokens.output).toBe(0);
      expect(Object.keys(snap.byProvider)).toHaveLength(0);
      expect(Object.keys(snap.byIntent)).toHaveLength(0);
    });
  });

  describe("uptime tracking", () => {
    it("tracks uptime since creation", () => {
      const snap = tel.getSnapshot();
      expect(snap.uptimeMs).toBeGreaterThanOrEqual(0);
      expect(snap.uptimeMs).toBeLessThan(1000);
    });
  });

  describe("latency window overflow", () => {
    it("trims latencies beyond 10k entries", () => {
      for (let i = 0; i < 10_050; i++) {
        emitComplete(tel, "claude", "reasoning", 100, 0.001);
      }

      const snap = tel.getSnapshot();
      expect(snap.successfulRequests).toBe(10_050);
      expect(snap.latencyP50Ms).toBe(100);
    });
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emitComplete(
  tel: Telemetry,
  provider: "claude" | "grok" | "perplexity",
  intent: string,
  latencyMs: number,
  costUsd: number
): void {
  tel.emit("request_complete", {
    requestId: tel.generateRequestId(),
    provider,
    intent: intent as any,
    latencyMs,
    tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
    costUsd,
    cached: false,
    timestamp: Date.now(),
  });
}
