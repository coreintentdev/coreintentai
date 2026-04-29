import { describe, it, expect, beforeEach } from "vitest";
import { Telemetry } from "../src/telemetry/index.js";

describe("Telemetry", () => {
  let telemetry: Telemetry;

  beforeEach(() => {
    telemetry = new Telemetry();
  });

  const makeRecord = (overrides: Partial<Parameters<Telemetry["record"]>[0]> = {}) => ({
    intent: "reasoning",
    provider: "claude" as const,
    model: "claude-sonnet-4-20250514",
    latencyMs: 1500,
    tokenUsage: { inputTokens: 500, outputTokens: 200, totalTokens: 700 },
    fallbackUsed: false,
    success: true,
    ...overrides,
  });

  describe("record()", () => {
    it("creates a record with correct fields", () => {
      const result = telemetry.record(makeRecord());
      expect(result.id).toMatch(/^req_/);
      expect(result.intent).toBe("reasoning");
      expect(result.provider).toBe("claude");
      expect(result.latencyMs).toBe(1500);
      expect(result.costUsd).toBeGreaterThan(0);
      expect(result.success).toBe(true);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it("calculates cost from token usage", () => {
      const result = telemetry.record(makeRecord({
        tokenUsage: { inputTokens: 1000, outputTokens: 1000, totalTokens: 2000 },
      }));
      // Claude: input = 1000/1000 * 0.003 = 0.003, output = 1000/1000 * 0.015 = 0.015
      expect(result.costUsd).toBeCloseTo(0.018, 5);
    });

    it("calculates different costs per provider", () => {
      const claudeRecord = telemetry.record(makeRecord({ provider: "claude" }));
      const grokRecord = telemetry.record(makeRecord({ provider: "grok" }));
      const perplexityRecord = telemetry.record(makeRecord({ provider: "perplexity" }));

      expect(claudeRecord.costUsd).not.toBe(grokRecord.costUsd);
      expect(perplexityRecord.costUsd).toBeLessThan(claudeRecord.costUsd);
    });

    it("respects maxRecords limit", () => {
      const small = new Telemetry({ maxRecords: 3 });
      small.record(makeRecord({ intent: "a" }));
      small.record(makeRecord({ intent: "b" }));
      small.record(makeRecord({ intent: "c" }));
      small.record(makeRecord({ intent: "d" }));

      const recent = small.getRecentRecords(10);
      expect(recent).toHaveLength(3);
      expect(recent[0].intent).toBe("b");
    });
  });

  describe("getTotalCost()", () => {
    it("returns 0 with no records", () => {
      expect(telemetry.getTotalCost()).toBe(0);
    });

    it("sums cost across all records", () => {
      telemetry.record(makeRecord());
      telemetry.record(makeRecord());
      expect(telemetry.getTotalCost()).toBeGreaterThan(0);
    });
  });

  describe("getCostByProvider()", () => {
    it("breaks down cost by provider", () => {
      telemetry.record(makeRecord({ provider: "claude" }));
      telemetry.record(makeRecord({ provider: "grok" }));

      const costs = telemetry.getCostByProvider();
      expect(costs["claude"]).toBeGreaterThan(0);
      expect(costs["grok"]).toBeGreaterThan(0);
    });
  });

  describe("getLatencyPercentiles()", () => {
    it("returns null for unknown provider", () => {
      expect(telemetry.getLatencyPercentiles("claude")).toBeNull();
    });

    it("calculates p50/p90/p99", () => {
      for (let i = 0; i < 100; i++) {
        telemetry.record(makeRecord({ latencyMs: (i + 1) * 100 }));
      }

      const percentiles = telemetry.getLatencyPercentiles("claude");
      expect(percentiles).not.toBeNull();
      expect(percentiles!.p50).toBeGreaterThan(4000);
      expect(percentiles!.p90).toBeGreaterThan(8000);
      expect(percentiles!.p99).toBeGreaterThan(9000);
    });
  });

  describe("getSuccessRate()", () => {
    it("returns null for unknown provider", () => {
      expect(telemetry.getSuccessRate("claude")).toBeNull();
    });

    it("calculates correct rate", () => {
      telemetry.record(makeRecord({ success: true }));
      telemetry.record(makeRecord({ success: true }));
      telemetry.record(makeRecord({ success: false }));

      expect(telemetry.getSuccessRate("claude")).toBeCloseTo(2 / 3, 5);
    });
  });

  describe("getSnapshot()", () => {
    it("returns complete snapshot", () => {
      telemetry.record(makeRecord({ provider: "claude" }));
      telemetry.record(makeRecord({ provider: "grok", fallbackUsed: true }));
      telemetry.record(makeRecord({ provider: "claude", success: false }));

      const snap = telemetry.getSnapshot();
      expect(snap.totalRequests).toBe(3);
      expect(snap.totalCostUsd).toBeGreaterThan(0);
      expect(snap.fallbackRate).toBeCloseTo(1 / 3, 5);
      expect(snap.providers["claude"]).toBeDefined();
      expect(snap.providers["grok"]).toBeDefined();
      expect(snap.recentErrors).toHaveLength(1);
    });
  });

  describe("getCostForWindow()", () => {
    it("includes recent records in window", () => {
      telemetry.record(makeRecord());
      const costNow = telemetry.getCostForWindow(60_000);
      expect(costNow).toBeGreaterThan(0);
    });

    it("returns 0 for empty telemetry", () => {
      expect(telemetry.getCostForWindow(60_000)).toBe(0);
    });
  });

  describe("getProviderScore()", () => {
    it("returns 0.5 for unknown provider", () => {
      expect(telemetry.getProviderScore("claude")).toBe(0.5);
    });

    it("returns higher score for successful low-latency provider", () => {
      for (let i = 0; i < 10; i++) {
        telemetry.record(makeRecord({ provider: "claude", latencyMs: 500, success: true }));
      }
      for (let i = 0; i < 10; i++) {
        telemetry.record(makeRecord({ provider: "grok", latencyMs: 5000, success: true }));
      }
      telemetry.record(makeRecord({ provider: "grok", latencyMs: 5000, success: false }));

      const claudeScore = telemetry.getProviderScore("claude");
      const grokScore = telemetry.getProviderScore("grok");
      expect(claudeScore).toBeGreaterThan(grokScore);
    });
  });

  describe("getRecentRecords()", () => {
    it("returns most recent records", () => {
      telemetry.record(makeRecord({ intent: "a" }));
      telemetry.record(makeRecord({ intent: "b" }));
      telemetry.record(makeRecord({ intent: "c" }));

      const recent = telemetry.getRecentRecords(2);
      expect(recent).toHaveLength(2);
      expect(recent[0].intent).toBe("b");
      expect(recent[1].intent).toBe("c");
    });
  });

  describe("reset()", () => {
    it("clears all data", () => {
      telemetry.record(makeRecord());
      telemetry.record(makeRecord());
      telemetry.reset();

      expect(telemetry.getTotalCost()).toBe(0);
      expect(telemetry.getRecentRecords()).toHaveLength(0);
      expect(telemetry.getSnapshot().totalRequests).toBe(0);
    });
  });

  describe("custom cost overrides", () => {
    it("uses custom cost table", () => {
      const custom = new Telemetry({
        costOverrides: {
          claude: { inputPer1k: 0.01, outputPer1k: 0.03 },
        },
      });

      const result = custom.record(makeRecord({
        tokenUsage: { inputTokens: 1000, outputTokens: 1000, totalTokens: 2000 },
      }));

      // 1000/1000 * 0.01 + 1000/1000 * 0.03 = 0.04
      expect(result.costUsd).toBeCloseTo(0.04, 5);
    });
  });
});
