import { describe, it, expect, beforeEach, vi } from "vitest";
import { Telemetry, getTelemetry, setGlobalTelemetry } from "../src/telemetry/index.js";
import type { TelemetryEvent } from "../src/types/index.js";

describe("Telemetry", () => {
  let telemetry: Telemetry;

  beforeEach(() => {
    telemetry = new Telemetry({ enabled: true });
  });

  describe("emit and listen", () => {
    it("delivers events to matching listeners", () => {
      const events: TelemetryEvent[] = [];
      telemetry.on("request_start", (e) => events.push(e));

      telemetry.emit({ type: "request_start", intent: "sentiment" });

      expect(events).toHaveLength(1);
      expect(events[0].intent).toBe("sentiment");
      expect(events[0].timestamp).toBeDefined();
    });

    it("does not deliver events to non-matching listeners", () => {
      const events: TelemetryEvent[] = [];
      telemetry.on("request_error", (e) => events.push(e));

      telemetry.emit({ type: "request_start", intent: "sentiment" });

      expect(events).toHaveLength(0);
    });

    it("wildcard listener receives all events", () => {
      const events: TelemetryEvent[] = [];
      telemetry.on("*", (e) => events.push(e));

      telemetry.emit({ type: "request_start" });
      telemetry.emit({ type: "request_complete", latencyMs: 100 });
      telemetry.emit({ type: "request_error" });

      expect(events).toHaveLength(3);
    });

    it("unsubscribe function works", () => {
      const events: TelemetryEvent[] = [];
      const unsub = telemetry.on("request_start", (e) => events.push(e));

      telemetry.emit({ type: "request_start" });
      unsub();
      telemetry.emit({ type: "request_start" });

      expect(events).toHaveLength(1);
    });
  });

  describe("buffer", () => {
    it("stores events in buffer", () => {
      telemetry.emit({ type: "request_start" });
      telemetry.emit({ type: "request_complete", latencyMs: 200 });

      expect(telemetry.getBuffer()).toHaveLength(2);
    });

    it("respects buffer limit", () => {
      const small = new Telemetry({ bufferLimit: 3, enabled: true });

      small.emit({ type: "request_start" });
      small.emit({ type: "request_start" });
      small.emit({ type: "request_start" });
      small.emit({ type: "request_complete", latencyMs: 100 });

      expect(small.getBuffer()).toHaveLength(3);
      expect(small.getBuffer()[2].type).toBe("request_complete");
    });

    it("filters by type", () => {
      telemetry.emit({ type: "request_start" });
      telemetry.emit({ type: "request_complete", latencyMs: 200 });
      telemetry.emit({ type: "request_error" });

      expect(telemetry.getBufferByType("request_complete")).toHaveLength(1);
    });

    it("clears buffer", () => {
      telemetry.emit({ type: "request_start" });
      telemetry.clear();
      expect(telemetry.getBuffer()).toHaveLength(0);
    });
  });

  describe("latency stats", () => {
    it("computes latency percentiles", () => {
      for (const ms of [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]) {
        telemetry.emit({
          type: "request_complete",
          latencyMs: ms,
          provider: "claude",
        });
      }

      const stats = telemetry.getLatencyStats();
      expect(stats.count).toBe(10);
      expect(stats.avgMs).toBe(55);
      expect(stats.p50Ms).toBe(60);
      expect(stats.p95Ms).toBe(100);
    });

    it("filters by provider", () => {
      telemetry.emit({ type: "request_complete", latencyMs: 100, provider: "claude" });
      telemetry.emit({ type: "request_complete", latencyMs: 50, provider: "grok" });

      const claudeStats = telemetry.getLatencyStats("claude");
      expect(claudeStats.count).toBe(1);
      expect(claudeStats.avgMs).toBe(100);
    });

    it("returns zeros for empty data", () => {
      const stats = telemetry.getLatencyStats();
      expect(stats.count).toBe(0);
      expect(stats.avgMs).toBe(0);
    });
  });

  describe("error rate", () => {
    it("computes error rate correctly", () => {
      telemetry.emit({ type: "request_complete", provider: "claude" });
      telemetry.emit({ type: "request_complete", provider: "claude" });
      telemetry.emit({ type: "request_error", provider: "claude" });

      const rate = telemetry.getErrorRate("claude");
      expect(rate.total).toBe(3);
      expect(rate.errors).toBe(1);
      expect(rate.rate).toBeCloseTo(1 / 3);
    });
  });

  describe("enabled/disabled", () => {
    it("does not emit when disabled", () => {
      const disabled = new Telemetry({ enabled: false });
      const events: TelemetryEvent[] = [];
      disabled.on("request_start", (e) => events.push(e));

      disabled.emit({ type: "request_start" });

      expect(events).toHaveLength(0);
      expect(disabled.getBuffer()).toHaveLength(0);
    });

    it("can toggle enabled state", () => {
      telemetry.setEnabled(false);
      telemetry.emit({ type: "request_start" });
      expect(telemetry.getBuffer()).toHaveLength(0);

      telemetry.setEnabled(true);
      telemetry.emit({ type: "request_start" });
      expect(telemetry.getBuffer()).toHaveLength(1);
    });
  });

  describe("global telemetry", () => {
    it("provides a singleton via getTelemetry", () => {
      const t1 = getTelemetry();
      const t2 = getTelemetry();
      expect(t1).toBe(t2);
    });

    it("allows overriding global instance", () => {
      const custom = new Telemetry({ enabled: true });
      setGlobalTelemetry(custom);
      expect(getTelemetry()).toBe(custom);
    });
  });
});
