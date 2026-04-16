import { describe, it, expect, beforeEach } from "vitest";
import { CircuitBreaker } from "../src/orchestrator/circuit-breaker.js";

describe("CircuitBreaker", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 100, // Short timeout for tests
      halfOpenSuccessThreshold: 1,
    });
  });

  describe("initial state", () => {
    it("starts in closed state", () => {
      expect(breaker.getState("claude")).toBe("closed");
    });

    it("allows requests in closed state", () => {
      expect(breaker.canRequest("claude")).toBe(true);
    });
  });

  describe("failure tracking", () => {
    it("stays closed below failure threshold", () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      expect(breaker.getState("claude")).toBe("closed");
      expect(breaker.canRequest("claude")).toBe(true);
    });

    it("opens after reaching failure threshold", () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      expect(breaker.getState("claude")).toBe("open");
      expect(breaker.canRequest("claude")).toBe(false);
    });

    it("resets failure count on success", () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordSuccess("claude");
      breaker.recordFailure("claude");
      // Should still be closed — success reset the counter
      expect(breaker.getState("claude")).toBe("closed");
    });
  });

  describe("half-open recovery", () => {
    it("transitions to half-open after reset timeout", async () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      expect(breaker.canRequest("claude")).toBe(false);

      // Wait for reset timeout
      await new Promise((r) => setTimeout(r, 150));

      expect(breaker.canRequest("claude")).toBe(true);
      expect(breaker.getState("claude")).toBe("half_open");
    });

    it("closes on success in half-open state", async () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");

      await new Promise((r) => setTimeout(r, 150));
      breaker.canRequest("claude"); // Trigger transition

      breaker.recordSuccess("claude");
      expect(breaker.getState("claude")).toBe("closed");
    });

    it("reopens on failure in half-open state", async () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");

      await new Promise((r) => setTimeout(r, 150));
      breaker.canRequest("claude"); // Trigger transition

      breaker.recordFailure("claude");
      expect(breaker.getState("claude")).toBe("open");
    });
  });

  describe("provider isolation", () => {
    it("tracks each provider independently", () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");

      expect(breaker.canRequest("claude")).toBe(false);
      expect(breaker.canRequest("grok")).toBe(true);
      expect(breaker.canRequest("perplexity")).toBe(true);
    });
  });

  describe("filterAvailable", () => {
    it("filters out open circuits", () => {
      breaker.recordFailure("grok");
      breaker.recordFailure("grok");
      breaker.recordFailure("grok");

      const available = breaker.filterAvailable([
        "claude",
        "grok",
        "perplexity",
      ]);
      expect(available).toEqual(["claude", "perplexity"]);
    });

    it("returns all when all circuits closed", () => {
      const available = breaker.filterAvailable([
        "claude",
        "grok",
        "perplexity",
      ]);
      expect(available).toEqual(["claude", "grok", "perplexity"]);
    });
  });

  describe("stats", () => {
    it("tracks cumulative stats", () => {
      breaker.recordSuccess("claude");
      breaker.recordSuccess("claude");
      breaker.recordFailure("claude");

      const stats = breaker.getStats("claude");
      expect(stats.totalRequests).toBe(3);
      expect(stats.totalSuccesses).toBe(2);
      expect(stats.totalFailures).toBe(1);
      expect(stats.failureRate).toBeCloseTo(1 / 3, 2);
    });
  });

  describe("reset", () => {
    it("resets a specific provider", () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      expect(breaker.getState("claude")).toBe("open");

      breaker.reset("claude");
      expect(breaker.getState("claude")).toBe("closed");
    });

    it("resetAll clears all providers", () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("grok");
      breaker.recordFailure("grok");
      breaker.recordFailure("grok");

      breaker.resetAll();
      expect(breaker.getState("claude")).toBe("closed");
      expect(breaker.getState("grok")).toBe("closed");
    });
  });
});
