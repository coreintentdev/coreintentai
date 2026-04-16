import { describe, it, expect, beforeEach } from "vitest";
import { CircuitBreakerRegistry } from "../src/orchestrator/circuit-breaker.js";

describe("CircuitBreakerRegistry", () => {
  let cb: CircuitBreakerRegistry;

  beforeEach(() => {
    cb = new CircuitBreakerRegistry({
      failureThreshold: 3,
      resetTimeoutMs: 100, // Short for testing
      failureWindowMs: 5000,
    });
  });

  describe("closed state", () => {
    it("starts in closed state", () => {
      expect(cb.getState("claude")).toBe("closed");
      expect(cb.canAttempt("claude")).toBe(true);
    });

    it("stays closed below failure threshold", () => {
      cb.recordFailure("claude");
      cb.recordFailure("claude");
      expect(cb.getState("claude")).toBe("closed");
      expect(cb.canAttempt("claude")).toBe(true);
    });

    it("resets failure count on success", () => {
      cb.recordFailure("claude");
      cb.recordFailure("claude");
      cb.recordSuccess("claude");
      cb.recordFailure("claude");
      cb.recordFailure("claude");
      // Still closed — success reset the window
      expect(cb.getState("claude")).toBe("closed");
    });
  });

  describe("open state", () => {
    it("opens after hitting failure threshold", () => {
      cb.recordFailure("grok");
      cb.recordFailure("grok");
      cb.recordFailure("grok");
      expect(cb.getState("grok")).toBe("open");
      expect(cb.canAttempt("grok")).toBe(false);
    });

    it("does not affect other providers", () => {
      cb.recordFailure("grok");
      cb.recordFailure("grok");
      cb.recordFailure("grok");
      expect(cb.canAttempt("grok")).toBe(false);
      expect(cb.canAttempt("claude")).toBe(true);
      expect(cb.canAttempt("perplexity")).toBe(true);
    });
  });

  describe("half-open state", () => {
    it("transitions to half-open after reset timeout", async () => {
      cb.recordFailure("claude");
      cb.recordFailure("claude");
      cb.recordFailure("claude");
      expect(cb.getState("claude")).toBe("open");

      // Wait for reset timeout
      await new Promise((r) => setTimeout(r, 120));

      expect(cb.getState("claude")).toBe("half_open");
      expect(cb.canAttempt("claude")).toBe(true);
    });

    it("closes on successful probe", async () => {
      cb.recordFailure("claude");
      cb.recordFailure("claude");
      cb.recordFailure("claude");

      await new Promise((r) => setTimeout(r, 120));
      expect(cb.canAttempt("claude")).toBe(true);

      cb.recordSuccess("claude");
      expect(cb.getState("claude")).toBe("closed");
    });

    it("reopens on failed probe", async () => {
      cb.recordFailure("claude");
      cb.recordFailure("claude");
      cb.recordFailure("claude");

      await new Promise((r) => setTimeout(r, 120));
      expect(cb.canAttempt("claude")).toBe(true);

      cb.recordFailure("claude");
      expect(cb.getState("claude")).toBe("open");
    });
  });

  describe("stats", () => {
    it("tracks request counts accurately", () => {
      cb.recordSuccess("claude");
      cb.recordSuccess("claude");
      cb.recordFailure("claude");

      const stats = cb.getStats("claude");
      expect(stats.totalRequests).toBe(3);
      expect(stats.successCount).toBe(2);
      expect(stats.totalFailures).toBe(1);
      expect(stats.failureRate).toBeCloseTo(1 / 3);
    });

    it("provides a snapshot of all providers", () => {
      cb.recordSuccess("claude");
      cb.recordFailure("grok");

      const snap = cb.snapshot();
      expect(snap.claude.state).toBe("closed");
      expect(snap.grok.state).toBe("closed");
      expect(snap.perplexity.state).toBe("closed");
    });
  });

  describe("reset", () => {
    it("resets a single provider", () => {
      cb.recordFailure("claude");
      cb.recordFailure("claude");
      cb.recordFailure("claude");
      expect(cb.getState("claude")).toBe("open");

      cb.reset("claude");
      expect(cb.getState("claude")).toBe("closed");
    });

    it("resets all providers", () => {
      cb.recordFailure("claude");
      cb.recordFailure("claude");
      cb.recordFailure("claude");
      cb.recordFailure("grok");
      cb.recordFailure("grok");
      cb.recordFailure("grok");

      cb.resetAll();
      expect(cb.getState("claude")).toBe("closed");
      expect(cb.getState("grok")).toBe("closed");
    });
  });
});
