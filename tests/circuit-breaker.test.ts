import { describe, it, expect, beforeEach } from "vitest";
import { CircuitBreaker } from "../src/orchestrator/circuit-breaker.js";

describe("CircuitBreaker", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      halfOpenMaxAttempts: 2,
    });
  });

  describe("initial state", () => {
    it("starts all providers as available", () => {
      expect(breaker.isAvailable("claude")).toBe(true);
      expect(breaker.isAvailable("grok")).toBe(true);
      expect(breaker.isAvailable("perplexity")).toBe(true);
    });

    it("starts in closed state", () => {
      expect(breaker.getState("claude")).toBe("closed");
    });
  });

  describe("failure tracking", () => {
    it("stays closed below failure threshold", () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      expect(breaker.getState("claude")).toBe("closed");
      expect(breaker.isAvailable("claude")).toBe(true);
    });

    it("opens after reaching failure threshold", () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      expect(breaker.getState("claude")).toBe("open");
      expect(breaker.isAvailable("claude")).toBe(false);
    });

    it("tracks providers independently", () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      expect(breaker.isAvailable("claude")).toBe(false);
      expect(breaker.isAvailable("grok")).toBe(true);
    });
  });

  describe("success recovery", () => {
    it("decrements failure count on success", () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordSuccess("claude");
      breaker.recordFailure("claude");
      // 2 failures - 1 success + 1 failure = 2 failures, still below threshold
      expect(breaker.getState("claude")).toBe("closed");
    });
  });

  describe("half-open state", () => {
    it("transitions to half-open after reset timeout", async () => {
      const fastBreaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 50,
        halfOpenMaxAttempts: 1,
      });

      fastBreaker.recordFailure("grok");
      fastBreaker.recordFailure("grok");
      expect(fastBreaker.getState("grok")).toBe("open");
      expect(fastBreaker.isAvailable("grok")).toBe(false);

      await new Promise((r) => setTimeout(r, 60));

      expect(fastBreaker.isAvailable("grok")).toBe(true);
      expect(fastBreaker.getState("grok")).toBe("half_open");
    });

    it("closes after enough successes in half-open", async () => {
      const fastBreaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 50,
        halfOpenMaxAttempts: 2,
      });

      fastBreaker.recordFailure("grok");
      fastBreaker.recordFailure("grok");
      await new Promise((r) => setTimeout(r, 60));

      fastBreaker.isAvailable("grok"); // triggers half_open transition
      fastBreaker.recordSuccess("grok");
      fastBreaker.recordSuccess("grok");
      expect(fastBreaker.getState("grok")).toBe("closed");
    });

    it("re-opens on failure in half-open", async () => {
      const fastBreaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 50,
        halfOpenMaxAttempts: 2,
      });

      fastBreaker.recordFailure("grok");
      fastBreaker.recordFailure("grok");
      await new Promise((r) => setTimeout(r, 60));

      fastBreaker.isAvailable("grok"); // triggers half_open
      fastBreaker.recordFailure("grok");
      expect(fastBreaker.getState("grok")).toBe("open");
    });
  });

  describe("filterAvailable", () => {
    it("filters out open-circuit providers", () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");

      const available = breaker.filterAvailable(["claude", "grok", "perplexity"]);
      expect(available).toEqual(["grok", "perplexity"]);
    });

    it("returns all providers when none are tripped", () => {
      const available = breaker.filterAvailable(["claude", "grok", "perplexity"]);
      expect(available).toEqual(["claude", "grok", "perplexity"]);
    });
  });

  describe("health report", () => {
    it("returns state for all tracked providers", () => {
      breaker.recordSuccess("claude");
      breaker.recordFailure("grok");
      breaker.recordFailure("grok");
      breaker.recordFailure("grok");

      const report = breaker.getHealthReport();
      expect(report.claude.state).toBe("closed");
      expect(report.grok.state).toBe("open");
      expect(report.grok.failures).toBe(3);
    });
  });

  describe("reset", () => {
    it("resets a single provider", () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      expect(breaker.isAvailable("claude")).toBe(false);

      breaker.reset("claude");
      expect(breaker.isAvailable("claude")).toBe(true);
      expect(breaker.getState("claude")).toBe("closed");
    });

    it("resets all providers", () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("grok");
      breaker.recordFailure("grok");
      breaker.recordFailure("grok");

      breaker.reset();
      expect(breaker.isAvailable("claude")).toBe(true);
      expect(breaker.isAvailable("grok")).toBe(true);
    });
  });
});
