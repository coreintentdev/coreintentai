import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RateLimiter } from "../src/orchestrator/rate-limiter.js";

describe("RateLimiter", () => {
  describe("basic operation", () => {
    it("allows requests when bucket has tokens", () => {
      const limiter = new RateLimiter();
      expect(limiter.canRequest("claude")).toBe(true);
    });

    it("returns true from acquire when tokens available", () => {
      const limiter = new RateLimiter();
      expect(limiter.acquire("claude")).toBe(true);
    });

    it("returns false from acquire when bucket exhausted", () => {
      const limiter = new RateLimiter({}, {
        claude: { requestsPerMinute: 2, tokensPerMinute: 100_000 },
      });
      const rl = new RateLimiter({ burstMultiplier: 1.0 }, {
        claude: { requestsPerMinute: 2, tokensPerMinute: 100_000 },
      });
      rl.acquire("claude");
      rl.acquire("claude");
      expect(rl.acquire("claude")).toBe(false);
    });

    it("tracks total requests", () => {
      const limiter = new RateLimiter();
      limiter.acquire("claude");
      limiter.acquire("claude");
      const snap = limiter.getSnapshot();
      expect(snap.get("claude")!.totalRequests).toBe(2);
    });

    it("tracks throttled requests", () => {
      const rl = new RateLimiter({ burstMultiplier: 1.0 }, {
        claude: { requestsPerMinute: 1, tokensPerMinute: 100_000 },
      });
      rl.acquire("claude");
      rl.acquire("claude");
      const snap = rl.getSnapshot();
      expect(snap.get("claude")!.throttledRequests).toBe(1);
    });
  });

  describe("token consumption", () => {
    it("consumes tokens from the token bucket", () => {
      const limiter = new RateLimiter();
      expect(limiter.consumeTokens("claude", 1000)).toBe(true);
    });

    it("returns false when insufficient tokens", () => {
      const rl = new RateLimiter({ burstMultiplier: 1.0 }, {
        claude: { requestsPerMinute: 60, tokensPerMinute: 500 },
      });
      expect(rl.consumeTokens("claude", 1000)).toBe(false);
    });

    it("tracks total tokens used", () => {
      const limiter = new RateLimiter();
      limiter.consumeTokens("claude", 5000);
      limiter.consumeTokens("claude", 3000);
      const snap = limiter.getSnapshot();
      expect(snap.get("claude")!.totalTokensUsed).toBe(8000);
    });
  });

  describe("token refill", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("refills tokens over time", () => {
      const rl = new RateLimiter({ burstMultiplier: 1.0 }, {
        claude: { requestsPerMinute: 60, tokensPerMinute: 100_000 },
      });

      // Exhaust the bucket (60 rpm with burst 1.0 = 60 tokens)
      for (let i = 0; i < 60; i++) {
        rl.acquire("claude");
      }
      expect(rl.canRequest("claude")).toBe(false);

      // Advance 1 second — should refill 1 token (60 per minute = 1 per second)
      vi.advanceTimersByTime(1000);
      expect(rl.canRequest("claude")).toBe(true);
    });

    it("caps tokens at burst capacity", () => {
      const rl = new RateLimiter({ burstMultiplier: 1.5 }, {
        claude: { requestsPerMinute: 10, tokensPerMinute: 100_000 },
      });

      // Advance time far beyond what's needed to fill
      vi.advanceTimersByTime(600_000);

      // Should still be capped at 15 (10 * 1.5)
      let count = 0;
      while (rl.acquire("claude")) {
        count++;
        if (count > 100) break;
      }
      expect(count).toBe(15);
    });

    it("refills independently per provider", () => {
      const rl = new RateLimiter({ burstMultiplier: 1.0 }, {
        claude: { requestsPerMinute: 2, tokensPerMinute: 100_000 },
        grok: { requestsPerMinute: 2, tokensPerMinute: 100_000 },
      });

      // Exhaust claude
      rl.acquire("claude");
      rl.acquire("claude");
      expect(rl.canRequest("claude")).toBe(false);

      // Grok should still be available
      expect(rl.canRequest("grok")).toBe(true);
    });
  });

  describe("getWaitTimeMs", () => {
    it("returns 0 when tokens available", () => {
      const limiter = new RateLimiter();
      expect(limiter.getWaitTimeMs("claude")).toBe(0);
    });

    it("returns positive value when bucket exhausted", () => {
      const rl = new RateLimiter({ burstMultiplier: 1.0 }, {
        claude: { requestsPerMinute: 1, tokensPerMinute: 100_000 },
      });
      rl.acquire("claude");
      expect(rl.getWaitTimeMs("claude")).toBeGreaterThan(0);
    });
  });

  describe("waitForSlot", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns immediately if tokens available", async () => {
      const limiter = new RateLimiter();
      const result = await limiter.waitForSlot("claude");
      expect(result).toBe(true);
    });

    it("returns false on timeout when no tokens", async () => {
      const rl = new RateLimiter({ burstMultiplier: 1.0 }, {
        claude: { requestsPerMinute: 1, tokensPerMinute: 100_000 },
      });
      rl.acquire("claude");

      const promise = rl.waitForSlot("claude", 50);
      vi.advanceTimersByTime(100);
      const result = await promise;
      expect(result).toBe(false);
    });
  });

  describe("provider isolation", () => {
    it("rate limits each provider independently", () => {
      const rl = new RateLimiter({ burstMultiplier: 1.0 }, {
        claude: { requestsPerMinute: 1, tokensPerMinute: 100_000 },
        grok: { requestsPerMinute: 1, tokensPerMinute: 100_000 },
        perplexity: { requestsPerMinute: 1, tokensPerMinute: 100_000 },
      });

      rl.acquire("claude");
      expect(rl.canRequest("claude")).toBe(false);
      expect(rl.canRequest("grok")).toBe(true);
      expect(rl.canRequest("perplexity")).toBe(true);
    });
  });

  describe("getSnapshot", () => {
    it("returns state for all providers", () => {
      const limiter = new RateLimiter();
      limiter.acquire("claude");
      limiter.acquire("grok");

      const snap = limiter.getSnapshot();
      expect(snap.has("claude")).toBe(true);
      expect(snap.has("grok")).toBe(true);
      expect(snap.has("perplexity")).toBe(true);
      expect(snap.get("claude")!.totalRequests).toBe(1);
      expect(snap.get("grok")!.totalRequests).toBe(1);
    });

    it("shows utilization percentage", () => {
      const limiter = new RateLimiter();
      limiter.acquire("claude");
      const snap = limiter.getSnapshot();
      expect(snap.get("claude")!.utilizationPct).toBe(100);
    });

    it("calculates correct utilization when throttled exceeds successful", () => {
      const rl = new RateLimiter({ burstMultiplier: 1.0 }, {
        claude: { requestsPerMinute: 1, tokensPerMinute: 100_000 },
      });

      // 1 success, then 5 throttled attempts
      rl.acquire("claude");
      rl.acquire("claude");
      rl.acquire("claude");
      rl.acquire("claude");
      rl.acquire("claude");
      rl.acquire("claude");

      const snap = rl.getSnapshot();
      // 1 success / 6 total attempts = ~17%
      expect(snap.get("claude")!.totalRequests).toBe(1);
      expect(snap.get("claude")!.throttledRequests).toBe(5);
      expect(snap.get("claude")!.utilizationPct).toBe(17);
    });
  });

  describe("reset", () => {
    it("resets a specific provider", () => {
      const limiter = new RateLimiter();
      limiter.acquire("claude");
      limiter.acquire("grok");
      limiter.reset("claude");

      const snap = limiter.getSnapshot();
      expect(snap.get("claude")!.totalRequests).toBe(0);
      expect(snap.get("grok")!.totalRequests).toBe(1);
    });

    it("resets all providers", () => {
      const limiter = new RateLimiter();
      limiter.acquire("claude");
      limiter.acquire("grok");
      limiter.acquire("perplexity");
      limiter.reset();

      const snap = limiter.getSnapshot();
      expect(snap.get("claude")!.totalRequests).toBe(0);
      expect(snap.get("grok")!.totalRequests).toBe(0);
      expect(snap.get("perplexity")!.totalRequests).toBe(0);
    });
  });

  describe("custom provider limits", () => {
    it("respects custom request limits", () => {
      const rl = new RateLimiter({ burstMultiplier: 1.0 }, {
        claude: { requestsPerMinute: 3, tokensPerMinute: 100_000 },
      });

      expect(rl.acquire("claude")).toBe(true);
      expect(rl.acquire("claude")).toBe(true);
      expect(rl.acquire("claude")).toBe(true);
      expect(rl.acquire("claude")).toBe(false);
    });

    it("uses defaults for providers without custom limits", () => {
      const rl = new RateLimiter({ burstMultiplier: 1.0 }, {
        claude: { requestsPerMinute: 1, tokensPerMinute: 100_000 },
      });

      // Claude should be limited to 1
      rl.acquire("claude");
      expect(rl.canRequest("claude")).toBe(false);

      // Grok uses default (60 rpm), should still be available
      expect(rl.canRequest("grok")).toBe(true);
    });
  });
});
