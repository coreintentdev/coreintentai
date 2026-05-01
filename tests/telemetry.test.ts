import { describe, it, expect, beforeEach, vi } from "vitest";
import { Telemetry } from "../src/utils/telemetry.js";

describe("Telemetry", () => {
  let telemetry: Telemetry;

  beforeEach(() => {
    telemetry = new Telemetry({ maxEvents: 100 });
  });

  describe("record", () => {
    it("records events and assigns IDs", () => {
      const id = telemetry.record({
        traceId: "trace_1",
        type: "route_decision",
        metadata: { intent: "reasoning" },
      });

      expect(id).toBeTruthy();
      expect(id.startsWith("evt_")).toBe(true);
      expect(telemetry.size).toBe(1);
    });

    it("auto-sets timestamp if not provided", () => {
      telemetry.record({
        traceId: "trace_1",
        type: "model_call",
        metadata: {},
      });

      const events = telemetry.query({ traceId: "trace_1" });
      expect(events[0].timestamp).toBeGreaterThan(0);
    });

    it("trims events when exceeding max", () => {
      for (let i = 0; i < 120; i++) {
        telemetry.record({
          traceId: "trace_1",
          type: "model_call",
          metadata: { i },
        });
      }
      expect(telemetry.size).toBeLessThanOrEqual(100);
    });
  });

  describe("startTrace", () => {
    it("generates unique trace IDs", () => {
      const id1 = telemetry.startTrace();
      const id2 = telemetry.startTrace();
      expect(id1).not.toBe(id2);
      expect(id1.startsWith("trace_")).toBe(true);
    });
  });

  describe("subscribe", () => {
    it("notifies listeners on record", () => {
      const events: unknown[] = [];
      telemetry.subscribe((e) => events.push(e));

      telemetry.record({
        traceId: "trace_1",
        type: "model_call",
        metadata: {},
      });

      expect(events).toHaveLength(1);
    });

    it("supports unsubscribe", () => {
      const events: unknown[] = [];
      const unsub = telemetry.subscribe((e) => events.push(e));

      telemetry.record({ traceId: "t1", type: "model_call", metadata: {} });
      unsub();
      telemetry.record({ traceId: "t2", type: "model_call", metadata: {} });

      expect(events).toHaveLength(1);
    });

    it("handles listener errors gracefully", () => {
      telemetry.subscribe(() => {
        throw new Error("boom");
      });

      expect(() =>
        telemetry.record({ traceId: "t1", type: "model_call", metadata: {} })
      ).not.toThrow();
    });
  });

  describe("query", () => {
    beforeEach(() => {
      telemetry.record({
        traceId: "trace_a",
        type: "route_decision",
        intent: "reasoning",
        provider: "claude",
        metadata: {},
      });
      telemetry.record({
        traceId: "trace_a",
        type: "model_response",
        intent: "reasoning",
        provider: "claude",
        durationMs: 250,
        metadata: { success: true },
      });
      telemetry.record({
        traceId: "trace_b",
        type: "fallback_triggered",
        intent: "sentiment",
        provider: "grok",
        metadata: { error: "timeout" },
      });
      telemetry.record({
        traceId: "trace_b",
        type: "model_response",
        intent: "sentiment",
        provider: "claude",
        durationMs: 500,
        metadata: { success: true },
      });
    });

    it("filters by type", () => {
      const results = telemetry.query({ type: "route_decision" });
      expect(results).toHaveLength(1);
    });

    it("filters by traceId", () => {
      const results = telemetry.query({ traceId: "trace_a" });
      expect(results).toHaveLength(2);
    });

    it("filters by provider", () => {
      const results = telemetry.query({ provider: "grok" });
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("fallback_triggered");
    });

    it("filters by intent", () => {
      const results = telemetry.query({ intent: "sentiment" });
      expect(results).toHaveLength(2);
    });

    it("combines filters", () => {
      const results = telemetry.query({
        type: "model_response",
        provider: "claude",
      });
      expect(results).toHaveLength(2);
    });

    it("returns empty for no matches", () => {
      const results = telemetry.query({ provider: "perplexity" });
      expect(results).toHaveLength(0);
    });
  });

  describe("getTrace", () => {
    it("returns events for a trace in order", () => {
      const traceId = telemetry.startTrace();
      telemetry.record({ traceId, type: "route_decision", metadata: {} });
      telemetry.record({ traceId, type: "model_call", metadata: {} });
      telemetry.record({ traceId, type: "model_response", metadata: { success: true } });

      const trace = telemetry.getTrace(traceId);
      expect(trace).toHaveLength(3);
      expect(trace[0].type).toBe("route_decision");
      expect(trace[2].type).toBe("model_response");
    });

    it("returns empty for unknown trace", () => {
      expect(telemetry.getTrace("nonexistent")).toHaveLength(0);
    });
  });

  describe("summary", () => {
    it("computes summary statistics", () => {
      const traceId = "t1";
      telemetry.record({
        traceId,
        type: "model_response",
        provider: "claude",
        durationMs: 200,
        metadata: { success: true },
      });
      telemetry.record({
        traceId,
        type: "model_response",
        provider: "claude",
        durationMs: 300,
        metadata: { success: true },
      });
      telemetry.record({
        traceId,
        type: "model_response",
        provider: "grok",
        durationMs: 50,
        metadata: { success: false },
      });
      telemetry.record({
        traceId,
        type: "fallback_triggered",
        metadata: {},
      });

      const summary = telemetry.summary();
      expect(summary.totalEvents).toBe(4);
      expect(summary.eventsByType["model_response"]).toBe(3);
      expect(summary.eventsByType["fallback_triggered"]).toBe(1);

      expect(summary.providerStats["claude"].calls).toBe(2);
      expect(summary.providerStats["claude"].successes).toBe(2);
      expect(summary.providerStats["claude"].failures).toBe(0);
      expect(summary.providerStats["claude"].avgLatencyMs).toBe(250);

      expect(summary.providerStats["grok"].calls).toBe(1);
      expect(summary.providerStats["grok"].failures).toBe(1);

      expect(summary.errorRate).toBeCloseTo(1 / 3);
      expect(summary.fallbackRate).toBeCloseTo(1 / 3);
      expect(summary.uptimeMs).toBeGreaterThanOrEqual(0);
    });

    it("returns zero rates with no data", () => {
      const summary = telemetry.summary();
      expect(summary.totalEvents).toBe(0);
      expect(summary.errorRate).toBe(0);
      expect(summary.fallbackRate).toBe(0);
    });
  });

  describe("clear", () => {
    it("removes all events", () => {
      telemetry.record({ traceId: "t1", type: "model_call", metadata: {} });
      telemetry.record({ traceId: "t2", type: "model_call", metadata: {} });
      expect(telemetry.size).toBe(2);

      telemetry.clear();
      expect(telemetry.size).toBe(0);
    });
  });
});
