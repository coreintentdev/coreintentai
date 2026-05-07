import { describe, it, expect, beforeEach, vi } from "vitest";
import { Telemetry } from "../src/orchestrator/telemetry.js";

describe("Telemetry", () => {
  let telemetry: Telemetry;

  beforeEach(() => {
    telemetry = new Telemetry(100);
  });

  describe("emit and listen", () => {
    it("calls listeners on emit", () => {
      const listener = vi.fn();
      telemetry.on(listener);

      telemetry.emit({
        type: "request_start",
        intent: "sentiment",
        provider: "grok",
      });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "request_start",
          intent: "sentiment",
          provider: "grok",
          timestamp: expect.any(String),
        })
      );
    });

    it("supports multiple listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      telemetry.on(listener1);
      telemetry.on(listener2);

      telemetry.emit({ type: "cache_hit" });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it("allows unsubscribing", () => {
      const listener = vi.fn();
      const unsubscribe = telemetry.on(listener);

      telemetry.emit({ type: "request_start" });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      telemetry.emit({ type: "request_start" });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("does not crash if listener throws", () => {
      telemetry.on(() => { throw new Error("boom"); });

      expect(() => {
        telemetry.emit({ type: "request_start" });
      }).not.toThrow();
    });
  });

  describe("counters", () => {
    it("counts requests", () => {
      telemetry.emit({ type: "request_start", intent: "sentiment", provider: "grok" });
      telemetry.emit({ type: "request_start", intent: "signal", provider: "claude" });

      const snapshot = telemetry.getSnapshot();
      expect(snapshot.totalRequests).toBe(2);
    });

    it("counts errors", () => {
      telemetry.emit({ type: "request_error", provider: "grok", error: "timeout" });

      const snapshot = telemetry.getSnapshot();
      expect(snapshot.totalErrors).toBe(1);
    });

    it("counts fallbacks", () => {
      telemetry.emit({ type: "fallback_triggered", provider: "claude" });

      const snapshot = telemetry.getSnapshot();
      expect(snapshot.totalFallbacks).toBe(1);
    });

    it("counts cache hits", () => {
      telemetry.emit({ type: "cache_hit" });
      telemetry.emit({ type: "cache_hit" });

      const snapshot = telemetry.getSnapshot();
      expect(snapshot.totalCacheHits).toBe(2);
    });

    it("counts escalations", () => {
      telemetry.emit({ type: "escalation", provider: "claude" });

      const snapshot = telemetry.getSnapshot();
      expect(snapshot.totalEscalations).toBe(1);
    });
  });

  describe("provider breakdown", () => {
    it("tracks per-provider statistics", () => {
      telemetry.emit({ type: "request_start", provider: "grok" });
      telemetry.emit({ type: "request_complete", provider: "grok", latencyMs: 200, tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } });
      telemetry.emit({ type: "request_start", provider: "grok" });
      telemetry.emit({ type: "request_complete", provider: "grok", latencyMs: 300, tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } });

      const snapshot = telemetry.getSnapshot();
      const grokStats = snapshot.providerBreakdown.get("grok");

      expect(grokStats).toBeDefined();
      expect(grokStats!.requests).toBe(2);
      expect(grokStats!.avgLatencyMs).toBe(250);
      expect(grokStats!.totalTokens).toBe(300);
    });

    it("tracks errors per provider", () => {
      telemetry.emit({ type: "request_error", provider: "perplexity" });
      telemetry.emit({ type: "request_error", provider: "perplexity" });

      const snapshot = telemetry.getSnapshot();
      expect(snapshot.providerBreakdown.get("perplexity")!.errors).toBe(2);
    });
  });

  describe("intent breakdown", () => {
    it("tracks per-intent statistics", () => {
      telemetry.emit({ type: "request_start", intent: "sentiment" });
      telemetry.emit({ type: "request_complete", intent: "sentiment", latencyMs: 200 });

      const snapshot = telemetry.getSnapshot();
      const sentimentStats = snapshot.intentBreakdown.get("sentiment");
      expect(sentimentStats).toBeDefined();
      expect(sentimentStats!.requests).toBe(1);
      expect(sentimentStats!.avgLatencyMs).toBe(200);
    });
  });

  describe("event history", () => {
    it("stores recent events", () => {
      telemetry.emit({ type: "request_start" });
      telemetry.emit({ type: "request_complete", latencyMs: 100 });

      const events = telemetry.getRecentEvents();
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe("request_start");
      expect(events[1].type).toBe("request_complete");
    });

    it("respects max event limit", () => {
      const smallTelemetry = new Telemetry(5);
      for (let i = 0; i < 10; i++) {
        smallTelemetry.emit({ type: "request_start" });
      }

      const events = smallTelemetry.getRecentEvents();
      expect(events).toHaveLength(5);
    });

    it("returns only the requested number of events", () => {
      for (let i = 0; i < 10; i++) {
        telemetry.emit({ type: "request_start" });
      }

      const events = telemetry.getRecentEvents(3);
      expect(events).toHaveLength(3);
    });
  });

  describe("snapshot", () => {
    it("computes average latency across all providers", () => {
      telemetry.emit({ type: "request_start", provider: "grok" });
      telemetry.emit({ type: "request_complete", provider: "grok", latencyMs: 200 });
      telemetry.emit({ type: "request_start", provider: "claude" });
      telemetry.emit({ type: "request_complete", provider: "claude", latencyMs: 800 });

      const snapshot = telemetry.getSnapshot();
      expect(snapshot.avgLatencyMs).toBe(500);
    });

    it("tracks uptime", () => {
      const snapshot = telemetry.getSnapshot();
      expect(snapshot.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("reset", () => {
    it("clears all data", () => {
      telemetry.emit({ type: "request_start", intent: "sentiment", provider: "grok" });
      telemetry.emit({ type: "request_error", provider: "grok" });

      telemetry.reset();

      const snapshot = telemetry.getSnapshot();
      expect(snapshot.totalRequests).toBe(0);
      expect(snapshot.totalErrors).toBe(0);
      expect(snapshot.providerBreakdown.size).toBe(0);
      expect(snapshot.intentBreakdown.size).toBe(0);
      expect(telemetry.getRecentEvents()).toHaveLength(0);
    });
  });

  describe("combined scenarios", () => {
    it("tracks a full request lifecycle", () => {
      telemetry.emit({ type: "cache_miss", intent: "signal" });
      telemetry.emit({ type: "request_start", intent: "signal", provider: "claude" });
      telemetry.emit({
        type: "request_complete",
        intent: "signal",
        provider: "claude",
        latencyMs: 1200,
        tokenUsage: { inputTokens: 500, outputTokens: 300, totalTokens: 800 },
      });

      const snapshot = telemetry.getSnapshot();
      expect(snapshot.totalRequests).toBe(1);
      expect(snapshot.totalCacheHits).toBe(0);
      expect(snapshot.providerBreakdown.get("claude")!.totalTokens).toBe(800);
    });

    it("tracks fallback + error scenario", () => {
      telemetry.emit({ type: "request_start", intent: "reasoning", provider: "claude" });
      telemetry.emit({ type: "request_error", intent: "reasoning", provider: "claude", error: "timeout" });
      telemetry.emit({ type: "fallback_triggered", intent: "reasoning", provider: "grok" });
      telemetry.emit({ type: "request_start", intent: "reasoning", provider: "grok" });
      telemetry.emit({ type: "request_complete", intent: "reasoning", provider: "grok", latencyMs: 300 });

      const snapshot = telemetry.getSnapshot();
      expect(snapshot.totalRequests).toBe(2);
      expect(snapshot.totalErrors).toBe(1);
      expect(snapshot.totalFallbacks).toBe(1);
    });
  });
});
