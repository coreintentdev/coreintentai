import { describe, it, expect, vi, beforeEach } from "vitest";
import { CircuitBreaker } from "../src/orchestrator/circuit-breaker.js";
import type { ModelProvider } from "../src/types/index.js";

describe("CircuitBreaker", () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      halfOpenMaxAttempts: 1,
      latencyWindowSize: 5,
    });
  });

  describe("closed state", () => {
    it("allows attempts in closed state", () => {
      expect(cb.canAttempt("claude")).toBe(true);
      expect(cb.getState("claude")).toBe("closed");
    });

    it("stays closed below failure threshold", () => {
      cb.recordFailure("claude");
      cb.recordFailure("claude");
      expect(cb.canAttempt("claude")).toBe(true);
      expect(cb.getState("claude")).toBe("closed");
    });

    it("transitions to open at failure threshold", () => {
      cb.recordFailure("claude");
      cb.recordFailure("claude");
      cb.recordFailure("claude");
      expect(cb.getState("claude")).toBe("open");
      expect(cb.canAttempt("claude")).toBe(false);
    });
  });

  describe("open state", () => {
    beforeEach(() => {
      cb.recordFailure("grok");
      cb.recordFailure("grok");
      cb.recordFailure("grok");
    });

    it("blocks attempts when open", () => {
      expect(cb.canAttempt("grok")).toBe(false);
    });

    it("transitions to half_open after reset timeout", () => {
      vi.useFakeTimers();
      vi.advanceTimersByTime(1001);
      expect(cb.getState("grok")).toBe("half_open");
      expect(cb.canAttempt("grok")).toBe(true);
      vi.useRealTimers();
    });
  });

  describe("half_open state", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      cb.recordFailure("perplexity");
      cb.recordFailure("perplexity");
      cb.recordFailure("perplexity");
      vi.advanceTimersByTime(1001);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("closes on success", () => {
      expect(cb.getState("perplexity")).toBe("half_open");
      cb.recordSuccess("perplexity", 100);
      expect(cb.getState("perplexity")).toBe("closed");
    });

    it("reopens on failure in half_open", () => {
      expect(cb.getState("perplexity")).toBe("half_open");
      cb.recordFailure("perplexity");
      expect(cb.getState("perplexity")).toBe("open");
    });
  });

  describe("latency tracking", () => {
    it("returns null for unknown provider", () => {
      expect(cb.getAverageLatency("claude")).toBeNull();
    });

    it("tracks average latency", () => {
      cb.recordSuccess("claude", 100);
      cb.recordSuccess("claude", 200);
      cb.recordSuccess("claude", 300);
      expect(cb.getAverageLatency("claude")).toBe(200);
    });

    it("respects window size", () => {
      for (let i = 1; i <= 10; i++) {
        cb.recordSuccess("claude", i * 100);
      }
      // Window size is 5, so only last 5 values: 600,700,800,900,1000
      expect(cb.getAverageLatency("claude")).toBe(800);
    });
  });

  describe("rankProviders", () => {
    it("sorts closed providers before open ones", () => {
      cb.recordFailure("claude");
      cb.recordFailure("claude");
      cb.recordFailure("claude");
      // claude is open, grok is closed
      const ranked = cb.rankProviders(["claude", "grok", "perplexity"]);
      expect(ranked[0]).not.toBe("claude");
      expect(ranked[ranked.length - 1]).toBe("claude");
    });

    it("sorts by latency among same-state providers", () => {
      cb.recordSuccess("grok", 50);
      cb.recordSuccess("claude", 200);
      cb.recordSuccess("perplexity", 100);
      const ranked = cb.rankProviders(["claude", "grok", "perplexity"]);
      expect(ranked).toEqual(["grok", "perplexity", "claude"]);
    });
  });

  describe("getSnapshot", () => {
    it("returns snapshot of all tracked providers", () => {
      cb.recordSuccess("claude", 100);
      cb.recordFailure("grok");
      const snap = cb.getSnapshot();
      expect(snap.get("claude")?.state).toBe("closed");
      expect(snap.get("grok")?.state).toBe("closed");
      expect(snap.get("grok")?.failures).toBe(1);
    });
  });

  describe("reset", () => {
    it("resets a specific provider", () => {
      cb.recordFailure("claude");
      cb.recordFailure("claude");
      cb.recordFailure("claude");
      expect(cb.getState("claude")).toBe("open");
      cb.reset("claude");
      expect(cb.getState("claude")).toBe("closed");
      expect(cb.canAttempt("claude")).toBe(true);
    });

    it("resets all providers", () => {
      cb.recordFailure("claude");
      cb.recordFailure("grok");
      cb.reset();
      expect(cb.getSnapshot().size).toBe(0);
    });
  });

  describe("provider isolation", () => {
    it("tracks each provider independently", () => {
      cb.recordFailure("claude");
      cb.recordFailure("claude");
      cb.recordFailure("claude");
      expect(cb.canAttempt("claude")).toBe(false);
      expect(cb.canAttempt("grok")).toBe(true);
      expect(cb.canAttempt("perplexity")).toBe(true);
    });
  });
});
