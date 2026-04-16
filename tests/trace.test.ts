import { describe, it, expect, beforeEach } from "vitest";
import {
  TraceContext,
  generateTraceId,
  globalTraceRegistry,
} from "../src/orchestrator/trace.js";
import type { TraceEvent } from "../src/orchestrator/trace.js";

describe("Request Tracing", () => {
  beforeEach(() => {
    globalTraceRegistry.clear();
  });

  describe("generateTraceId", () => {
    it("generates unique IDs", () => {
      const a = generateTraceId();
      const b = generateTraceId();
      expect(a).not.toBe(b);
    });

    it("generates IDs with ci- prefix", () => {
      const id = generateTraceId();
      expect(id).toMatch(/^ci-/);
    });
  });

  describe("TraceContext", () => {
    it("creates a trace with a unique ID", () => {
      const trace = new TraceContext();
      expect(trace.traceId).toMatch(/^ci-/);
    });

    it("accepts a custom trace ID", () => {
      const trace = new TraceContext("custom-id");
      expect(trace.traceId).toBe("custom-id");
    });

    it("records events in order", () => {
      const trace = new TraceContext();
      trace.emit("request_start", { intent: "sentiment" });
      trace.emit("route_resolved");
      trace.emit("provider_attempt", { provider: "claude" });
      trace.emit("provider_success", { provider: "claude", latencyMs: 500 });
      trace.emit("request_complete", { latencyMs: 520 });

      const events = trace.getEvents();
      expect(events).toHaveLength(5);
      expect(events[0].event).toBe("request_start");
      expect(events[4].event).toBe("request_complete");
    });

    it("includes trace ID on all events", () => {
      const trace = new TraceContext("test-trace");
      trace.emit("request_start");
      trace.emit("cache_miss");

      const events = trace.getEvents();
      expect(events[0].traceId).toBe("test-trace");
      expect(events[1].traceId).toBe("test-trace");
    });

    it("tracks elapsed time", async () => {
      const trace = new TraceContext();
      await new Promise((r) => setTimeout(r, 50));
      expect(trace.elapsed()).toBeGreaterThanOrEqual(40);
    });

    it("notifies listeners on emit", () => {
      const received: TraceEvent[] = [];
      const trace = new TraceContext("test", [(e) => received.push(e)]);

      trace.emit("request_start");
      trace.emit("cache_hit", { cached: true });

      expect(received).toHaveLength(2);
      expect(received[0].event).toBe("request_start");
      expect(received[1].cached).toBe(true);
    });

    it("does not break on listener errors", () => {
      const trace = new TraceContext("test", [
        () => {
          throw new Error("listener broke");
        },
      ]);

      // Should not throw
      expect(() => trace.emit("request_start")).not.toThrow();
      expect(trace.getEvents()).toHaveLength(1);
    });
  });

  describe("summarize", () => {
    it("builds a summary from events", () => {
      const trace = new TraceContext("sum-test");
      trace.emit("request_start", { intent: "sentiment" });
      trace.emit("provider_attempt", { provider: "grok" });
      trace.emit("provider_failure", { provider: "grok", error: "timeout" });
      trace.emit("fallback_triggered", { provider: "claude" });
      trace.emit("provider_success", { provider: "claude", latencyMs: 800 });
      trace.emit("request_complete");

      const summary = trace.summarize();
      expect(summary.traceId).toBe("sum-test");
      expect(summary.providers).toContain("grok");
      expect(summary.providers).toContain("claude");
      expect(summary.fallbackUsed).toBe(true);
      expect(summary.errors).toContain("timeout");
      expect(summary.cached).toBe(false);
    });

    it("detects cache hits", () => {
      const trace = new TraceContext();
      trace.emit("request_start");
      trace.emit("cache_hit", { cached: true });
      trace.emit("request_complete");

      expect(trace.summarize().cached).toBe(true);
    });
  });

  describe("globalTraceRegistry", () => {
    it("registers and unregisters listeners", () => {
      const events: TraceEvent[] = [];
      const unsubscribe = globalTraceRegistry.addListener((e) =>
        events.push(e)
      );

      expect(globalTraceRegistry.getListeners()).toHaveLength(1);

      unsubscribe();
      expect(globalTraceRegistry.getListeners()).toHaveLength(0);
    });
  });
});
