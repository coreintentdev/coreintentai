import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProviderHealthMonitor } from "../src/orchestrator/health.js";

describe("ProviderHealthMonitor", () => {
  let monitor: ProviderHealthMonitor;

  beforeEach(() => {
    monitor = new ProviderHealthMonitor({
      errorThreshold: 0.5,
      circuitOpenDurationMs: 1000,
      halfOpenMaxProbes: 2,
      minSamplesForStats: 3,
    });
  });

  describe("basic tracking", () => {
    it("starts with all providers available", () => {
      expect(monitor.isAvailable("claude")).toBe(true);
      expect(monitor.isAvailable("grok")).toBe(true);
      expect(monitor.isAvailable("perplexity")).toBe(true);
    });

    it("tracks successes", () => {
      monitor.recordSuccess("claude", 200);
      monitor.recordSuccess("claude", 300);

      const snapshot = monitor.getSnapshot("claude");
      expect(snapshot.successCount).toBe(2);
      expect(snapshot.failureCount).toBe(0);
      expect(snapshot.successRate).toBe(1);
      expect(snapshot.avgLatencyMs).toBe(250);
    });

    it("tracks failures", () => {
      monitor.recordFailure("grok");
      monitor.recordFailure("grok");

      const snapshot = monitor.getSnapshot("grok");
      expect(snapshot.failureCount).toBe(2);
      expect(snapshot.consecutiveFailures).toBe(2);
    });

    it("resets consecutive failures on success", () => {
      monitor.recordFailure("claude");
      monitor.recordFailure("claude");
      monitor.recordSuccess("claude", 100);

      const snapshot = monitor.getSnapshot("claude");
      expect(snapshot.consecutiveFailures).toBe(0);
    });
  });

  describe("circuit breaker", () => {
    it("opens circuit when error threshold exceeded", () => {
      monitor.recordSuccess("grok", 100);
      monitor.recordFailure("grok");
      monitor.recordFailure("grok");

      const snapshot = monitor.getSnapshot("grok");
      expect(snapshot.state).toBe("open");
      expect(monitor.isAvailable("grok")).toBe(false);
    });

    it("stays closed below threshold", () => {
      monitor.recordSuccess("claude", 100);
      monitor.recordSuccess("claude", 100);
      monitor.recordSuccess("claude", 100);
      monitor.recordFailure("claude");

      const snapshot = monitor.getSnapshot("claude");
      expect(snapshot.state).toBe("closed");
      expect(monitor.isAvailable("claude")).toBe(true);
    });

    it("transitions to half_open after cooling period", async () => {
      monitor.recordSuccess("grok", 100);
      monitor.recordFailure("grok");
      monitor.recordFailure("grok");

      expect(monitor.isAvailable("grok")).toBe(false);

      await new Promise((r) => setTimeout(r, 1100));
      expect(monitor.isAvailable("grok")).toBe(true);

      const snapshot = monitor.getSnapshot("grok");
      expect(snapshot.state).toBe("half_open");
    });

    it("closes circuit on success during half_open", async () => {
      monitor.recordSuccess("grok", 100);
      monitor.recordFailure("grok");
      monitor.recordFailure("grok");

      await new Promise((r) => setTimeout(r, 1100));
      monitor.isAvailable("grok");

      monitor.recordSuccess("grok", 150);
      const snapshot = monitor.getSnapshot("grok");
      expect(snapshot.state).toBe("closed");
    });

    it("re-opens circuit on repeated failures during half_open", async () => {
      monitor.recordSuccess("grok", 100);
      monitor.recordFailure("grok");
      monitor.recordFailure("grok");

      await new Promise((r) => setTimeout(r, 1100));
      monitor.isAvailable("grok");

      monitor.recordFailure("grok");
      monitor.recordFailure("grok");

      const snapshot = monitor.getSnapshot("grok");
      expect(snapshot.state).toBe("open");
    });

    it("does not reset the cool-down timer when failures occur while open", () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));

        monitor.recordSuccess("grok", 100);
        monitor.recordFailure("grok");
        monitor.recordFailure("grok");
        expect(monitor.getSnapshot("grok").state).toBe("open");

        vi.advanceTimersByTime(900);
        monitor.recordFailure("grok");

        vi.advanceTimersByTime(200);
        expect(monitor.isAvailable("grok")).toBe(true);
        expect(monitor.getSnapshot("grok").state).toBe("half_open");
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("filterAvailable", () => {
    it("filters out unavailable providers", () => {
      monitor.recordSuccess("grok", 100);
      monitor.recordFailure("grok");
      monitor.recordFailure("grok");

      const available = monitor.filterAvailable(["claude", "grok", "perplexity"]);
      expect(available).toEqual(["claude", "perplexity"]);
    });
  });

  describe("latency stats", () => {
    it("calculates p95 latency", () => {
      for (let i = 1; i <= 20; i++) {
        monitor.recordSuccess("claude", i * 100);
      }

      const snapshot = monitor.getSnapshot("claude");
      expect(snapshot.p95LatencyMs).toBe(2000);
    });
  });

  describe("getAllSnapshots", () => {
    it("returns snapshots for all three providers", () => {
      monitor.recordSuccess("claude", 100);
      const snapshots = monitor.getAllSnapshots();
      expect(snapshots).toHaveLength(3);
      expect(snapshots.map((s) => s.provider)).toEqual(["claude", "grok", "perplexity"]);
    });
  });

  describe("reset", () => {
    it("resets a specific provider", () => {
      monitor.recordSuccess("claude", 100);
      monitor.recordFailure("claude");
      monitor.reset("claude");

      const snapshot = monitor.getSnapshot("claude");
      expect(snapshot.totalRequests).toBe(0);
    });

    it("resets all providers", () => {
      monitor.recordSuccess("claude", 100);
      monitor.recordSuccess("grok", 200);
      monitor.reset();

      expect(monitor.getSnapshot("claude").totalRequests).toBe(0);
      expect(monitor.getSnapshot("grok").totalRequests).toBe(0);
    });
  });
});
