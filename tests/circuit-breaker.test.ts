import { describe, it, expect, beforeEach, vi } from "vitest";
import { CircuitBreaker } from "../src/orchestrator/circuit-breaker.js";
import type { ModelProvider } from "../src/types/index.js";

describe("CircuitBreaker", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
  });

  describe("initial state", () => {
    it("starts all providers as closed (available)", () => {
      expect(breaker.canRequest("claude")).toBe(true);
      expect(breaker.canRequest("grok")).toBe(true);
      expect(breaker.canRequest("perplexity")).toBe(true);
    });

    it("reports closed state for unknown providers", () => {
      expect(breaker.getState("claude")).toBe("closed");
    });
  });

  describe("recording successes", () => {
    it("keeps circuit closed on success", () => {
      breaker.recordSuccess("claude");
      expect(breaker.getState("claude")).toBe("closed");
      expect(breaker.canRequest("claude")).toBe(true);
    });

    it("resets failure count on success", () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordSuccess("claude");
      // Two more failures after success shouldn't trip (need 3 consecutive)
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      expect(breaker.getState("claude")).toBe("closed");
    });

    it("tracks total successes in stats", () => {
      breaker.recordSuccess("claude");
      breaker.recordSuccess("claude");
      breaker.recordSuccess("claude");
      const stats = breaker.getStats();
      expect(stats["claude"].totalSuccesses).toBe(3);
    });
  });

  describe("recording failures", () => {
    it("stays closed below threshold", () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      expect(breaker.getState("claude")).toBe("closed");
      expect(breaker.canRequest("claude")).toBe(true);
    });

    it("trips open at failure threshold", () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      expect(breaker.getState("claude")).toBe("open");
      expect(breaker.canRequest("claude")).toBe(false);
    });

    it("tracks total failures in stats", () => {
      breaker.recordFailure("grok");
      breaker.recordFailure("grok");
      const stats = breaker.getStats();
      expect(stats["grok"].totalFailures).toBe(2);
      expect(stats["grok"].consecutiveFailures).toBe(2);
    });
  });

  describe("open → half_open transition", () => {
    it("transitions to half_open after cooldown expires", async () => {
      // Trip the breaker
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      expect(breaker.canRequest("claude")).toBe(false);

      // Fast-forward past cooldown
      vi.useFakeTimers();
      vi.advanceTimersByTime(1100);

      expect(breaker.canRequest("claude")).toBe(true);
      expect(breaker.getState("claude")).toBe("half_open");

      vi.useRealTimers();
    });

    it("stays open before cooldown expires", () => {
      vi.useFakeTimers();

      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");

      vi.advanceTimersByTime(500); // Only half the cooldown
      expect(breaker.canRequest("claude")).toBe(false);
      expect(breaker.getState("claude")).toBe("open");

      vi.useRealTimers();
    });
  });

  describe("half_open state", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Trip the breaker
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      // Advance past cooldown
      vi.advanceTimersByTime(1100);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("closes on success (probe passed)", () => {
      expect(breaker.getState("claude")).toBe("half_open");
      breaker.recordSuccess("claude");
      expect(breaker.getState("claude")).toBe("closed");
      expect(breaker.canRequest("claude")).toBe(true);
    });

    it("reopens on failure (probe failed)", () => {
      expect(breaker.getState("claude")).toBe("half_open");
      breaker.recordFailure("claude");
      expect(breaker.getState("claude")).toBe("open");
      expect(breaker.canRequest("claude")).toBe(false);
    });
  });

  describe("filterAvailable", () => {
    it("returns all providers when all circuits are closed", () => {
      const chain: ModelProvider[] = ["claude", "grok", "perplexity"];
      expect(breaker.filterAvailable(chain)).toEqual(chain);
    });

    it("filters out providers with open circuits", () => {
      // Trip claude
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");

      const chain: ModelProvider[] = ["claude", "grok", "perplexity"];
      const available = breaker.filterAvailable(chain);
      expect(available).toEqual(["grok", "perplexity"]);
    });

    it("returns first provider as fallback when all are open", () => {
      // Trip all providers
      for (const p of ["claude", "grok", "perplexity"] as ModelProvider[]) {
        breaker.recordFailure(p);
        breaker.recordFailure(p);
        breaker.recordFailure(p);
      }

      const chain: ModelProvider[] = ["claude", "grok", "perplexity"];
      const available = breaker.filterAvailable(chain);
      // Returns first provider to avoid total deadlock
      expect(available).toEqual(["claude"]);
    });
  });

  describe("isolation between providers", () => {
    it("failures on one provider do not affect another", () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      expect(breaker.getState("claude")).toBe("open");
      expect(breaker.getState("grok")).toBe("closed");
      expect(breaker.getState("perplexity")).toBe("closed");
    });
  });

  describe("reset", () => {
    it("resets a single provider to closed", () => {
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      breaker.recordFailure("claude");
      expect(breaker.getState("claude")).toBe("open");

      breaker.reset("claude");
      expect(breaker.getState("claude")).toBe("closed");
      expect(breaker.canRequest("claude")).toBe(true);
    });

    it("resetAll clears all circuits", () => {
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

  describe("getStats", () => {
    it("returns stats for all tracked providers", () => {
      breaker.recordSuccess("claude");
      breaker.recordFailure("grok");

      const stats = breaker.getStats();
      expect(stats).toHaveProperty("claude");
      expect(stats).toHaveProperty("grok");
      expect(stats["claude"].totalSuccesses).toBe(1);
      expect(stats["grok"].totalFailures).toBe(1);
    });
  });

  describe("default configuration", () => {
    it("uses threshold of 5 and 60s cooldown by default", () => {
      const defaultBreaker = new CircuitBreaker();

      // 4 failures should not trip (threshold is 5)
      for (let i = 0; i < 4; i++) {
        defaultBreaker.recordFailure("claude");
      }
      expect(defaultBreaker.getState("claude")).toBe("closed");

      // 5th failure trips it
      defaultBreaker.recordFailure("claude");
      expect(defaultBreaker.getState("claude")).toBe("open");
    });
  });
});
