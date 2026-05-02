import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Tracer, generateTraceId } from "../src/utils/trace.js";

describe("Tracer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("generates a unique trace ID", () => {
      vi.useRealTimers();
      const t1 = new Tracer();
      const t2 = new Tracer();
      expect(t1.traceId).not.toBe(t2.traceId);
      expect(t1.traceId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it("accepts a custom trace ID", () => {
      const tracer = new Tracer("custom-trace-123");
      expect(tracer.traceId).toBe("custom-trace-123");
    });
  });

  describe("spans", () => {
    it("creates spans with unique IDs", () => {
      vi.useRealTimers();
      const tracer = new Tracer();
      const span1 = tracer.startSpan("op1");
      const span2 = tracer.startSpan("op2");
      expect(span1.spanId).not.toBe(span2.spanId);
    });

    it("tracks parent-child relationships", () => {
      const tracer = new Tracer();
      const parent = tracer.startSpan("parent");
      const child = tracer.startSpan("child", parent.spanId);
      expect(child.parentSpanId).toBe(parent.spanId);
    });

    it("records start time on span creation", () => {
      const tracer = new Tracer();
      const span = tracer.startSpan("test");
      expect(span.startTime).toBeDefined();
      expect(span.status).toBe("ok");
    });

    it("ends spans with duration and status", () => {
      vi.useRealTimers();
      const tracer = new Tracer();
      const span = tracer.startSpan("test");
      tracer.endSpan(span, "ok", { result: "success" });
      expect(span.endTime).toBeDefined();
      expect(span.durationMs).toBeDefined();
      expect(span.durationMs).toBeGreaterThanOrEqual(0);
      expect(span.status).toBe("ok");
      expect(span.metadata?.result).toBe("success");
    });

    it("marks error spans", () => {
      const tracer = new Tracer();
      const span = tracer.startSpan("failing-op");
      tracer.endSpan(span, "error");
      expect(span.status).toBe("error");
    });

    it("merges metadata on endSpan", () => {
      const tracer = new Tracer();
      const span = tracer.startSpan("test", undefined, { initial: true });
      tracer.endSpan(span, "ok", { final: true });
      expect(span.metadata?.initial).toBe(true);
      expect(span.metadata?.final).toBe(true);
    });
  });

  describe("getSpans", () => {
    it("returns all spans", () => {
      const tracer = new Tracer();
      tracer.startSpan("op1");
      tracer.startSpan("op2");
      tracer.startSpan("op3");
      expect(tracer.getSpans()).toHaveLength(3);
    });

    it("returns a copy of spans array", () => {
      const tracer = new Tracer();
      tracer.startSpan("op1");
      const spans = tracer.getSpans();
      spans.push(tracer.startSpan("op2"));
      expect(tracer.getSpans()).toHaveLength(2);
    });
  });

  describe("getSummary", () => {
    it("summarizes trace with span count and errors", () => {
      vi.useRealTimers();
      const tracer = new Tracer("test-trace");
      const s1 = tracer.startSpan("ok-op");
      tracer.endSpan(s1, "ok");
      const s2 = tracer.startSpan("fail-op");
      tracer.endSpan(s2, "error");
      const s3 = tracer.startSpan("ok-op-2");
      tracer.endSpan(s3, "ok");

      const summary = tracer.getSummary();
      expect(summary.traceId).toBe("test-trace");
      expect(summary.spanCount).toBe(3);
      expect(summary.errors).toBe(1);
      expect(summary.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it("tracks provider latencies", () => {
      vi.useRealTimers();
      const tracer = new Tracer();
      const span = tracer.startSpan("model-call");
      span.provider = "claude";
      tracer.endSpan(span, "ok");

      const summary = tracer.getSummary();
      expect(summary.providerLatencies).toHaveProperty("claude");
    });
  });

  describe("generateTraceId", () => {
    it("generates valid UUID format", () => {
      vi.useRealTimers();
      const id = generateTraceId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it("generates unique IDs", () => {
      vi.useRealTimers();
      const ids = new Set(Array.from({ length: 100 }, () => generateTraceId()));
      expect(ids.size).toBe(100);
    });
  });
});
