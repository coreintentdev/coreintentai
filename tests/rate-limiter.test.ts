import { describe, it, expect } from "vitest";
import { RateLimiter } from "../src/orchestrator/rate-limiter.js";

describe("RateLimiter", () => {
  it("allows requests under the limit", () => {
    const limiter = new RateLimiter({ requestsPerMinute: { claude: 10 } });
    const status = limiter.canRequest("claude");
    expect(status.allowed).toBe(true);
    expect(status.minuteRequests).toBe(0);
  });

  it("blocks requests at the minute limit", () => {
    const limiter = new RateLimiter({ requestsPerMinute: { claude: 3 } });

    for (let i = 0; i < 3; i++) {
      limiter.recordRequest("claude", 1000, 0.01);
    }

    const status = limiter.canRequest("claude");
    expect(status.allowed).toBe(false);
    expect(status.reason).toContain("Rate limit");
    expect(status.minuteRequests).toBe(3);
  });

  it("blocks requests at the daily limit", () => {
    const limiter = new RateLimiter({
      requestsPerMinute: { claude: 1000 },
      requestsPerDay: { claude: 5 },
    });

    for (let i = 0; i < 5; i++) {
      limiter.recordRequest("claude", 1000, 0.01);
    }

    const status = limiter.canRequest("claude");
    expect(status.allowed).toBe(false);
    expect(status.reason).toContain("Daily limit");
  });

  it("blocks when daily budget is exhausted", () => {
    const limiter = new RateLimiter({
      dailyBudgetUsd: 1.0,
      tokensPerMinute: { claude: 1_000_000 },
    });
    limiter.recordRequest("claude", 5000, 0.60);
    limiter.recordRequest("claude", 5000, 0.50);

    const status = limiter.canRequest("claude");
    expect(status.allowed).toBe(false);
    expect(status.reason).toContain("budget exhausted");
  });

  it("tracks token limits per minute", () => {
    const limiter = new RateLimiter({ tokensPerMinute: { grok: 5000 } });
    limiter.recordRequest("grok", 3000, 0.01);
    limiter.recordRequest("grok", 3000, 0.01);

    const status = limiter.canRequest("grok");
    expect(status.allowed).toBe(false);
    expect(status.reason).toContain("Token limit");
  });

  it("provides a snapshot of all providers", () => {
    const limiter = new RateLimiter();
    limiter.recordRequest("claude", 1000, 0.01);
    limiter.recordRequest("grok", 2000, 0.005);

    const snap = limiter.getSnapshot();
    expect(snap.size).toBe(3);
    expect(snap.get("claude")?.minuteRequests).toBe(1);
    expect(snap.get("grok")?.minuteRequests).toBe(1);
  });

  it("returns daily spend", () => {
    const limiter = new RateLimiter();
    limiter.recordRequest("claude", 1000, 0.05);
    limiter.recordRequest("grok", 1000, 0.03);

    expect(limiter.getDailySpend()).toBeCloseTo(0.08, 6);
  });

  it("resets state", () => {
    const limiter = new RateLimiter();
    limiter.recordRequest("claude", 1000, 0.05);

    limiter.reset();
    expect(limiter.getDailySpend()).toBe(0);
    expect(limiter.canRequest("claude").minuteRequests).toBe(0);
  });

  it("different providers have independent limits", () => {
    const limiter = new RateLimiter({ requestsPerMinute: { claude: 2, grok: 2 } });
    limiter.recordRequest("claude", 1000, 0.01);
    limiter.recordRequest("claude", 1000, 0.01);

    expect(limiter.canRequest("claude").allowed).toBe(false);
    expect(limiter.canRequest("grok").allowed).toBe(true);
  });
});
