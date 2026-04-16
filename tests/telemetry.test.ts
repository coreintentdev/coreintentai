import { describe, it, expect } from "vitest";
import { TelemetryCollector, estimateCost } from "../src/utils/telemetry.js";
import type { OrchestrationResponse, ModelProvider } from "../src/types/index.js";

function makeResponse(overrides?: Partial<OrchestrationResponse>): OrchestrationResponse {
  return {
    content: "test response",
    provider: "claude" as ModelProvider,
    model: "claude-sonnet-4-20250514",
    latencyMs: 500,
    tokenUsage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
    fallbackUsed: false,
    ...overrides,
  };
}

describe("estimateCost", () => {
  it("calculates cost for known model", () => {
    const cost = estimateCost("claude-sonnet-4-20250514", {
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
    });
    // Input: 1000/1000 * $0.003 = $0.003
    // Output: 500/1000 * $0.015 = $0.0075
    expect(cost.inputCost).toBeCloseTo(0.003, 6);
    expect(cost.outputCost).toBeCloseTo(0.0075, 6);
    expect(cost.totalCost).toBeCloseTo(0.0105, 6);
    expect(cost.currency).toBe("USD");
  });

  it("uses default pricing for unknown model", () => {
    const cost = estimateCost("unknown-model", {
      inputTokens: 1000,
      outputTokens: 1000,
      totalTokens: 2000,
    });
    // Should still return a number (uses fallback pricing)
    expect(cost.totalCost).toBeGreaterThan(0);
  });

  it("accepts custom pricing", () => {
    const cost = estimateCost(
      "my-model",
      { inputTokens: 1000, outputTokens: 1000, totalTokens: 2000 },
      { "my-model": { input: 0.01, output: 0.02 } }
    );
    expect(cost.inputCost).toBeCloseTo(0.01, 6);
    expect(cost.outputCost).toBeCloseTo(0.02, 6);
  });
});

describe("TelemetryCollector", () => {
  describe("record", () => {
    it("records events and tracks them", () => {
      const collector = new TelemetryCollector();
      collector.record({ response: makeResponse(), intent: "sentiment" });
      collector.record({ response: makeResponse(), intent: "risk" });

      const events = collector.getEvents();
      expect(events).toHaveLength(2);
      expect(events[0].intent).toBe("sentiment");
      expect(events[1].intent).toBe("risk");
    });

    it("auto-calculates cost from response", () => {
      const collector = new TelemetryCollector();
      collector.record({ response: makeResponse(), intent: "sentiment" });

      const events = collector.getEvents();
      expect(events[0].cost.totalCost).toBeGreaterThan(0);
    });

    it("evicts oldest events when over capacity", () => {
      const collector = new TelemetryCollector(5);
      for (let i = 0; i < 10; i++) {
        collector.record({ response: makeResponse(), intent: `intent_${i}` });
      }
      const events = collector.getEvents();
      expect(events).toHaveLength(5);
      expect(events[0].intent).toBe("intent_5"); // oldest surviving
    });
  });

  describe("recordError", () => {
    it("records errors with zero tokens and cost", () => {
      const collector = new TelemetryCollector();
      collector.recordError({
        provider: "grok",
        model: "grok-3",
        intent: "fast_analysis",
        latencyMs: 30_000,
        errorCategory: "timeout",
      });

      const events = collector.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].success).toBe(false);
      expect(events[0].errorCategory).toBe("timeout");
      expect(events[0].cost.totalCost).toBe(0);
    });
  });

  describe("getSummary", () => {
    it("produces aggregate metrics", () => {
      const collector = new TelemetryCollector();

      // 2 claude successes
      collector.record({
        response: makeResponse({ provider: "claude", latencyMs: 400 }),
        intent: "reasoning",
      });
      collector.record({
        response: makeResponse({ provider: "claude", latencyMs: 600 }),
        intent: "risk",
      });

      // 1 grok success
      collector.record({
        response: makeResponse({ provider: "grok", model: "grok-3", latencyMs: 200 }),
        intent: "fast_analysis",
      });

      const summary = collector.getSummary();

      expect(summary.overall.totalRequests).toBe(3);
      expect(summary.overall.totalCost).toBeGreaterThan(0);
      expect(summary.overall.avgLatencyMs).toBe(400); // (400+600+200)/3

      expect(summary.byProvider.claude.totalRequests).toBe(2);
      expect(summary.byProvider.claude.avgLatencyMs).toBe(500);
      expect(summary.byProvider.grok.totalRequests).toBe(1);
    });

    it("calculates error rate correctly", () => {
      const collector = new TelemetryCollector();

      collector.record({ response: makeResponse(), intent: "test", success: true });
      collector.record({ response: makeResponse(), intent: "test", success: false });

      const summary = collector.getSummary();
      expect(summary.overall.errorRate).toBe(0.5);
      expect(summary.byProvider.claude.errorRate).toBe(0.5);
    });

    it("returns empty summary for no events", () => {
      const collector = new TelemetryCollector();
      const summary = collector.getSummary();
      expect(summary.overall.totalRequests).toBe(0);
      expect(summary.overall.totalCost).toBe(0);
    });
  });

  describe("onEvent listener", () => {
    it("notifies listeners on new events", () => {
      const collector = new TelemetryCollector();
      const events: string[] = [];

      collector.onEvent((event) => events.push(event.intent));

      collector.record({ response: makeResponse(), intent: "sentiment" });
      collector.record({ response: makeResponse(), intent: "risk" });

      expect(events).toEqual(["sentiment", "risk"]);
    });

    it("returns unsubscribe function", () => {
      const collector = new TelemetryCollector();
      const events: string[] = [];

      const unsub = collector.onEvent((event) => events.push(event.intent));

      collector.record({ response: makeResponse(), intent: "first" });
      unsub();
      collector.record({ response: makeResponse(), intent: "second" });

      expect(events).toEqual(["first"]);
    });
  });

  describe("clear", () => {
    it("removes all events", () => {
      const collector = new TelemetryCollector();
      collector.record({ response: makeResponse(), intent: "test" });
      collector.clear();
      expect(collector.getEvents()).toHaveLength(0);
    });
  });
});
