import { describe, it, expect, beforeEach } from "vitest";
import { HealthTracker } from "../src/orchestrator/health.js";

describe("HealthTracker", () => {
  let tracker: HealthTracker;

  beforeEach(() => {
    tracker = new HealthTracker();
  });

  describe("initial state", () => {
    it("reports healthy for untracked providers", () => {
      const health = tracker.getHealth("claude");
      expect(health.status).toBe("healthy");
      expect(health.totalRequests).toBe(0);
      expect(health.avgLatencyMs).toBe(0);
    });
  });

  describe("recordSuccess", () => {
    it("tracks latency metrics", () => {
      tracker.recordSuccess("claude", 100);
      tracker.recordSuccess("claude", 200);
      tracker.recordSuccess("claude", 300);

      const health = tracker.getHealth("claude");
      expect(health.totalRequests).toBe(3);
      expect(health.avgLatencyMs).toBe(200);
      expect(health.errorRate).toBe(0);
      expect(health.status).toBe("healthy");
    });

    it("calculates p95 latency", () => {
      // Add 20 requests, most fast, a few slow
      for (let i = 0; i < 18; i++) {
        tracker.recordSuccess("claude", 100);
      }
      tracker.recordSuccess("claude", 500);
      tracker.recordSuccess("claude", 1000);

      const health = tracker.getHealth("claude");
      expect(health.p95LatencyMs).toBeGreaterThanOrEqual(500);
    });
  });

  describe("recordError", () => {
    it("tracks error rates", () => {
      tracker.recordSuccess("grok", 100);
      tracker.recordError("grok");

      const health = tracker.getHealth("grok");
      expect(health.totalRequests).toBe(2);
      expect(health.totalErrors).toBe(1);
      expect(health.errorRate).toBe(0.5);
    });

    it("marks provider as degraded at high error rate", () => {
      for (let i = 0; i < 10; i++) {
        tracker.recordSuccess("grok", 100);
      }
      for (let i = 0; i < 4; i++) {
        tracker.recordError("grok");
      }

      const health = tracker.getHealth("grok");
      // 4/14 = ~0.286 > 0.2 threshold
      expect(health.status).toBe("degraded");
    });

    it("marks provider as unhealthy at very high error rate", () => {
      for (let i = 0; i < 5; i++) {
        tracker.recordSuccess("perplexity", 100);
      }
      for (let i = 0; i < 6; i++) {
        tracker.recordError("perplexity");
      }

      const health = tracker.getHealth("perplexity");
      // 6/11 = ~0.545 > 0.5 threshold
      expect(health.status).toBe("unhealthy");
    });
  });

  describe("rankProviders", () => {
    it("ranks healthy providers above degraded ones", () => {
      tracker.recordSuccess("claude", 200);
      tracker.recordSuccess("claude", 200);

      tracker.recordSuccess("grok", 100);
      tracker.recordError("grok");
      tracker.recordError("grok");

      const ranked = tracker.rankProviders(["claude", "grok"]);
      expect(ranked[0]).toBe("claude");
    });

    it("ranks faster providers above slower ones when error rates equal", () => {
      tracker.recordSuccess("grok", 100);
      tracker.recordSuccess("grok", 100);

      tracker.recordSuccess("claude", 500);
      tracker.recordSuccess("claude", 500);

      const ranked = tracker.rankProviders(["claude", "grok"]);
      expect(ranked[0]).toBe("grok");
    });
  });

  describe("getAllHealth", () => {
    it("returns health for all three providers", () => {
      const all = tracker.getAllHealth();
      expect(all).toHaveLength(3);
      expect(all.map((h) => h.provider)).toEqual([
        "claude",
        "grok",
        "perplexity",
      ]);
    });
  });

  describe("reset", () => {
    it("resets a specific provider", () => {
      tracker.recordSuccess("claude", 100);
      tracker.recordError("claude");
      tracker.reset("claude");

      const health = tracker.getHealth("claude");
      expect(health.totalRequests).toBe(0);
    });

    it("resetAll clears all providers", () => {
      tracker.recordSuccess("claude", 100);
      tracker.recordSuccess("grok", 200);
      tracker.resetAll();

      expect(tracker.getHealth("claude").totalRequests).toBe(0);
      expect(tracker.getHealth("grok").totalRequests).toBe(0);
    });
  });
});
