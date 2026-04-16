import { describe, it, expect, vi, beforeEach } from "vitest";
import { Telemetry } from "../src/telemetry/index.js";
import type { TokenUsage } from "../src/types/index.js";

const tokens: TokenUsage = {
  inputTokens: 100,
  outputTokens: 50,
  totalTokens: 150,
};

describe("Telemetry", () => {
  let telemetry: Telemetry;

  beforeEach(() => {
    telemetry = new Telemetry();
  });

  // -----------------------------------------------------------------------
  // Event Emitter
  // -----------------------------------------------------------------------

  describe("Event Emitter", () => {
    it("emits and receives events", () => {
      const handler = vi.fn();
      telemetry.on("success", handler);

      telemetry.recordSuccess("claude", 250, tokens);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "claude",
          latencyMs: 250,
        })
      );
    });

    it("supports multiple listeners for the same event", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      telemetry.on("success", handler1);
      telemetry.on("success", handler2);

      telemetry.recordSuccess("grok", 100, tokens);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it("returns an unsubscribe function", () => {
      const handler = vi.fn();
      const unsub = telemetry.on("success", handler);

      telemetry.recordSuccess("claude", 100, tokens);
      expect(handler).toHaveBeenCalledTimes(1);

      unsub();
      telemetry.recordSuccess("claude", 100, tokens);
      expect(handler).toHaveBeenCalledTimes(1); // Not called again
    });

    it("does not crash if a listener throws", () => {
      telemetry.on("success", () => {
        throw new Error("boom");
      });
      const handler2 = vi.fn();
      telemetry.on("success", handler2);

      // Should not throw
      telemetry.recordSuccess("claude", 100, tokens);

      // Second handler still called despite first throwing
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Provider Health
  // -----------------------------------------------------------------------

  describe("Provider Health", () => {
    it("starts all providers as healthy", () => {
      const health = telemetry.getProviderHealth("claude");
      expect(health.status).toBe("healthy");
      expect(health.circuitState).toBe("closed");
      expect(health.successRate).toBe(1);
      expect(health.totalRequests).toBe(0);
    });

    it("tracks successes and failures", () => {
      telemetry.recordSuccess("claude", 200, tokens);
      telemetry.recordSuccess("claude", 300, tokens);
      telemetry.recordFailure("claude", "timeout");

      const health = telemetry.getProviderHealth("claude");
      expect(health.totalRequests).toBe(3);
      expect(health.totalFailures).toBe(1);
      expect(health.successRate).toBeCloseTo(0.667, 2);
    });

    it("computes average latency", () => {
      telemetry.recordSuccess("grok", 100, tokens);
      telemetry.recordSuccess("grok", 200, tokens);
      telemetry.recordSuccess("grok", 300, tokens);

      const health = telemetry.getProviderHealth("grok");
      expect(health.avgLatencyMs).toBe(200);
    });

    it("computes p95 latency using nearest-rank indexing", () => {
      const tel = new Telemetry({
        windowSize: 20,
      });

      for (let i = 1; i <= 20; i++) {
        tel.recordSuccess("claude", i, tokens);
      }

      const health = tel.getProviderHealth("claude");
      expect(health.p95LatencyMs).toBe(19);
    });

    it("tracks total tokens", () => {
      telemetry.recordSuccess("claude", 100, tokens);
      telemetry.recordSuccess("claude", 100, tokens);

      const health = telemetry.getProviderHealth("claude");
      expect(health.totalTokens).toBe(300); // 150 * 2
    });

    it("marks providers as degraded below 95% success rate", () => {
      // 9 successes, 1 failure = 90% success rate → degraded
      for (let i = 0; i < 9; i++) {
        telemetry.recordSuccess("claude", 100, tokens);
      }
      telemetry.recordFailure("claude", "error");

      const health = telemetry.getProviderHealth("claude");
      expect(health.status).toBe("degraded");
    });

    it("marks providers as unhealthy below 80% success rate", () => {
      // 3 successes, 2 failures = 60% success rate → unhealthy
      for (let i = 0; i < 3; i++) {
        telemetry.recordSuccess("claude", 100, tokens);
      }
      for (let i = 0; i < 2; i++) {
        telemetry.recordFailure("claude", "error");
      }

      const health = telemetry.getProviderHealth("claude");
      expect(health.status).toBe("unhealthy");
    });

    it("tracks lastSuccess and lastFailure timestamps", () => {
      telemetry.recordSuccess("claude", 100, tokens);
      telemetry.recordFailure("claude", "error");

      const health = telemetry.getProviderHealth("claude");
      expect(health.lastSuccess).toBeDefined();
      expect(health.lastFailure).toBeDefined();
    });

    it("caps stored latencies to window size", () => {
      const tel = new Telemetry({ windowSize: 3 });
      tel.recordSuccess("grok", 100, tokens);
      tel.recordSuccess("grok", 200, tokens);
      tel.recordSuccess("grok", 300, tokens);
      tel.recordSuccess("grok", 400, tokens);
      tel.recordSuccess("grok", 500, tokens);

      const health = tel.getProviderHealth("grok");
      expect(health.totalRequests).toBe(5);
      expect(health.avgLatencyMs).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // Circuit Breaker
  // -----------------------------------------------------------------------

  describe("Circuit Breaker", () => {
    it("keeps circuit closed when failure rate is low", () => {
      for (let i = 0; i < 8; i++) {
        telemetry.recordSuccess("claude", 100, tokens);
      }
      telemetry.recordFailure("claude", "error");
      telemetry.recordFailure("claude", "error");

      expect(telemetry.isProviderAvailable("claude")).toBe(true);
      expect(telemetry.getProviderHealth("claude").circuitState).toBe("closed");
    });

    it("opens circuit when failure rate exceeds threshold", () => {
      const tel = new Telemetry({
        failureThreshold: 3,
        failureRateThreshold: 0.5,
        windowSize: 6,
      });

      // 3 failures in a row (100% failure rate, >= threshold of 3)
      tel.recordFailure("grok", "error 1");
      tel.recordFailure("grok", "error 2");
      tel.recordFailure("grok", "error 3");

      expect(tel.isProviderAvailable("grok")).toBe(false);
      expect(tel.getProviderHealth("grok").circuitState).toBe("open");
    });

    it("emits circuit_open event", () => {
      const tel = new Telemetry({
        failureThreshold: 3,
        failureRateThreshold: 0.5,
        windowSize: 6,
      });
      const handler = vi.fn();
      tel.on("circuit_open", handler);

      tel.recordFailure("grok", "error 1");
      tel.recordFailure("grok", "error 2");
      tel.recordFailure("grok", "error 3");

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "grok" })
      );
    });

    it("transitions from open to half_open after reset timeout", () => {
      const tel = new Telemetry({
        failureThreshold: 2,
        failureRateThreshold: 0.5,
        windowSize: 4,
        resetTimeoutMs: 100,
      });

      tel.recordFailure("claude", "error 1");
      tel.recordFailure("claude", "error 2");
      expect(tel.isProviderAvailable("claude")).toBe(false);

      // Fast-forward time
      vi.useFakeTimers();
      vi.advanceTimersByTime(150);

      expect(tel.isProviderAvailable("claude")).toBe(true);
      expect(tel.getProviderHealth("claude").circuitState).toBe("half_open");

      vi.useRealTimers();
    });

    it("closes circuit after success in half_open state", () => {
      const tel = new Telemetry({
        failureThreshold: 2,
        failureRateThreshold: 0.5,
        windowSize: 4,
        resetTimeoutMs: 100,
      });

      const handler = vi.fn();
      tel.on("circuit_close", handler);

      tel.recordFailure("claude", "error 1");
      tel.recordFailure("claude", "error 2");

      vi.useFakeTimers();
      vi.advanceTimersByTime(150);
      tel.isProviderAvailable("claude"); // triggers half_open

      tel.recordSuccess("claude", 100, tokens);

      expect(tel.getProviderHealth("claude").circuitState).toBe("closed");
      expect(handler).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it("re-opens circuit when a half_open probe fails", () => {
      const tel = new Telemetry({
        failureThreshold: 2,
        failureRateThreshold: 0.5,
        windowSize: 4,
        resetTimeoutMs: 100,
      });

      vi.useFakeTimers();
      tel.recordFailure("claude", "error 1");
      tel.recordFailure("claude", "error 2");
      expect(tel.getProviderHealth("claude").circuitState).toBe("open");

      vi.advanceTimersByTime(150);
      expect(tel.isProviderAvailable("claude")).toBe(true);
      expect(tel.getProviderHealth("claude").circuitState).toBe("half_open");

      tel.recordFailure("claude", "probe failed");

      expect(tel.getProviderHealth("claude").circuitState).toBe("open");
      expect(tel.isProviderAvailable("claude")).toBe(false);
      vi.useRealTimers();
    });

    it("filters unavailable providers from chain", () => {
      const tel = new Telemetry({
        failureThreshold: 2,
        failureRateThreshold: 0.5,
        windowSize: 4,
      });

      tel.recordFailure("grok", "error 1");
      tel.recordFailure("grok", "error 2");

      const chain = tel.filterAvailableProviders([
        "claude",
        "grok",
        "perplexity",
      ]);
      expect(chain).toEqual(["claude", "perplexity"]);
    });
  });

  // -----------------------------------------------------------------------
  // Reporting
  // -----------------------------------------------------------------------

  describe("Health Report", () => {
    it("generates a full health report for all providers", () => {
      telemetry.recordSuccess("claude", 200, tokens);
      telemetry.recordSuccess("grok", 100, tokens);
      telemetry.recordFailure("perplexity", "timeout");

      const report = telemetry.getHealthReport();
      expect(report.providers.claude.status).toBe("healthy");
      expect(report.providers.grok.status).toBe("healthy");
      expect(report.providers.perplexity.status).toBe("unhealthy");
      expect(report.timestamp).toBeDefined();
    });

    it("emits health_report event", () => {
      const handler = vi.fn();
      telemetry.on("health_report", handler);

      telemetry.getHealthReport();

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("Aggregate Stats", () => {
    it("aggregates across all providers", () => {
      telemetry.recordSuccess("claude", 200, tokens);
      telemetry.recordSuccess("grok", 100, tokens);
      telemetry.recordSuccess("grok", 150, tokens);

      const stats = telemetry.getAggregateStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.totalTokens).toBe(450);
      expect(stats.avgLatencyMs).toBe(150);
      expect(stats.providerDistribution).toEqual({
        claude: 1,
        grok: 2,
        perplexity: 0,
      });
    });

    it("uses bounded latency window for aggregate averages", () => {
      const tel = new Telemetry({ windowSize: 5 });
      for (let i = 1; i <= 10; i++) {
        tel.recordSuccess("claude", i * 100, tokens);
      }

      const health = tel.getProviderHealth("claude");
      const stats = tel.getAggregateStats();

      expect(health.totalRequests).toBe(10);
      expect(health.avgLatencyMs).toBe(800); // Last 5: 600,700,800,900,1000
      expect(stats.avgLatencyMs).toBe(800);
    });
  });

  describe("Reset", () => {
    it("resets all metrics to initial state", () => {
      telemetry.recordSuccess("claude", 100, tokens);
      telemetry.recordFailure("grok", "error");
      telemetry.reset();

      const stats = telemetry.getAggregateStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalTokens).toBe(0);

      for (const p of ["claude", "grok", "perplexity"] as const) {
        const health = telemetry.getProviderHealth(p);
        expect(health.circuitState).toBe("closed");
        expect(health.totalRequests).toBe(0);
      }
    });
  });
});
