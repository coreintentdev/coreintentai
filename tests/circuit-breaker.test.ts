import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CircuitBreaker } from "../src/utils/circuit-breaker.js";

describe("CircuitBreaker", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      cooldownMs: 10_000,
      successThreshold: 2,
      failureWindowMs: 30_000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("closed state (normal)", () => {
    it("starts in closed state", () => {
      expect(breaker.getState("claude")).toBe("closed");
      expect(breaker.isAvailable("claude")).toBe(true);
    });

    it("stays closed under failure threshold", () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      // 2 failures < threshold of 3
      expect(breaker.getState("claude")).toBe("closed");
      expect(breaker.isAvailable("claude")).toBe(true);
    });

    it("records successes while closed", () => {
      breaker.recordSuccess("claude");
      breaker.recordSuccess("claude");
      const status = breaker.getStatus();
      expect(status.claude.totalRequests).toBe(2);
      expect(status.claude.successRate).toBe(1);
    });
  });

  describe("closed → open transition", () => {
    it("opens after reaching failure threshold", () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("claude"); // 3rd failure → open
      expect(breaker.getState("claude")).toBe("open");
      expect(breaker.isAvailable("claude")).toBe(false);
    });

    it("ignores old failures outside the window", () => {
      breaker.recordFailure("claude"); // t=0
      vi.advanceTimersByTime(25_000);
      breaker.recordFailure("claude"); // t=25s
      vi.advanceTimersByTime(10_000);
      breaker.recordFailure("claude"); // t=35s — first failure is now outside 30s window

      // Only 2 recent failures → should still be closed
      expect(breaker.getState("claude")).toBe("closed");
    });
  });

  describe("open state (blocking)", () => {
    it("blocks requests while open", () => {
      // Trip the breaker
      breaker.recordFailure("grok");
      breaker.recordFailure("grok");
      breaker.recordFailure("grok");

      expect(breaker.isAvailable("grok")).toBe(false);
    });

    it("does not affect other providers", () => {
      breaker.recordFailure("grok");
      breaker.recordFailure("grok");
      breaker.recordFailure("grok");

      expect(breaker.isAvailable("grok")).toBe(false);
      expect(breaker.isAvailable("claude")).toBe(true);
      expect(breaker.isAvailable("perplexity")).toBe(true);
    });
  });

  describe("open → half_open transition", () => {
    it("transitions to half_open after cooldown", () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      expect(breaker.getState("claude")).toBe("open");

      vi.advanceTimersByTime(10_000); // cooldown elapsed
      expect(breaker.isAvailable("claude")).toBe(true); // triggers half_open check
      expect(breaker.getState("claude")).toBe("half_open");
    });
  });

  describe("half_open state (testing)", () => {
    function tripAndCooldown() {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      vi.advanceTimersByTime(10_000);
      breaker.isAvailable("claude"); // triggers half_open
    }

    it("closes after enough successes in half_open", () => {
      tripAndCooldown();
      expect(breaker.getState("claude")).toBe("half_open");

      breaker.recordSuccess("claude");
      breaker.recordSuccess("claude"); // 2 successes = threshold
      expect(breaker.getState("claude")).toBe("closed");
    });

    it("reopens on any failure in half_open", () => {
      tripAndCooldown();
      expect(breaker.getState("claude")).toBe("half_open");

      breaker.recordFailure("claude"); // one failure → back to open
      expect(breaker.getState("claude")).toBe("open");
    });
  });

  describe("filterAvailable", () => {
    it("filters out providers with open circuits", () => {
      breaker.recordFailure("grok");
      breaker.recordFailure("grok");
      breaker.recordFailure("grok"); // grok is open

      const available = breaker.filterAvailable(["grok", "claude", "perplexity"]);
      expect(available).toEqual(["claude", "perplexity"]);
    });

    it("keeps at least one provider even if all are open", () => {
      // Trip all breakers
      for (const p of ["claude", "grok", "perplexity"] as const) {
        breaker.recordFailure(p);
        breaker.recordFailure(p);
        breaker.recordFailure(p);
      }

      const available = breaker.filterAvailable(["claude", "grok", "perplexity"]);
      expect(available).toHaveLength(1);
      expect(available[0]).toBe("perplexity"); // last provider
    });
  });

  describe("reset", () => {
    it("resets a single provider", () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      expect(breaker.getState("claude")).toBe("open");

      breaker.reset("claude");
      expect(breaker.getState("claude")).toBe("closed");
      expect(breaker.isAvailable("claude")).toBe(true);
    });

    it("resets all providers", () => {
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

  describe("getStatus", () => {
    it("returns status for all tracked providers", () => {
      breaker.recordSuccess("claude");
      breaker.recordFailure("grok");

      const status = breaker.getStatus();
      expect(status.claude.state).toBe("closed");
      expect(status.claude.successRate).toBe(1);
      expect(status.grok.state).toBe("closed");
      expect(status.grok.recentFailures).toBe(1);
    });
  });
});
