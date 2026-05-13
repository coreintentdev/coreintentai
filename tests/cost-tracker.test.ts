import { describe, it, expect } from "vitest";
import { CostTracker } from "../src/orchestrator/cost-tracker.js";

describe("CostTracker", () => {
  it("estimates cost correctly for Claude", () => {
    const tracker = new CostTracker();
    const cost = tracker.estimateCost("claude", {
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
    });
    // Claude: $3/1M input + $15/1M output
    const expected = (1000 / 1_000_000) * 3 + (500 / 1_000_000) * 15;
    expect(cost).toBeCloseTo(expected, 6);
  });

  it("estimates cost correctly for Perplexity", () => {
    const tracker = new CostTracker();
    const cost = tracker.estimateCost("perplexity", {
      inputTokens: 2000,
      outputTokens: 1000,
      totalTokens: 3000,
    });
    // Perplexity: $1/1M input + $5/1M output
    const expected = (2000 / 1_000_000) * 1 + (1000 / 1_000_000) * 5;
    expect(cost).toBeCloseTo(expected, 6);
  });

  it("records entries and provides snapshot", () => {
    const tracker = new CostTracker();
    tracker.record("claude", "reasoning", { inputTokens: 5000, outputTokens: 2000, totalTokens: 7000 });
    tracker.record("grok", "fast_analysis", { inputTokens: 3000, outputTokens: 1000, totalTokens: 4000 });

    const snap = tracker.getSnapshot();
    expect(snap.requestCount).toBe(2);
    expect(snap.totalCostUsd).toBeGreaterThan(0);
    expect(snap.costByProvider["claude"]).toBeDefined();
    expect(snap.costByProvider["claude"].requests).toBe(1);
    expect(snap.costByProvider["grok"]).toBeDefined();
    expect(snap.costByProvider["grok"].requests).toBe(1);
  });

  it("tracks cost by intent", () => {
    const tracker = new CostTracker();
    tracker.record("claude", "reasoning", { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });
    tracker.record("claude", "reasoning", { inputTokens: 2000, outputTokens: 1000, totalTokens: 3000 });
    tracker.record("grok", "sentiment", { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });

    const snap = tracker.getSnapshot();
    expect(snap.costByIntent["reasoning"].requests).toBe(2);
    expect(snap.costByIntent["sentiment"].requests).toBe(1);
  });

  it("accepts custom pricing", () => {
    const tracker = new CostTracker({
      claude: { inputPer1M: 10, outputPer1M: 30 },
    });
    const cost = tracker.estimateCost("claude", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      totalTokens: 2_000_000,
    });
    expect(cost).toBeCloseTo(40, 2);
  });

  it("calculates average cost per request", () => {
    const tracker = new CostTracker();
    tracker.record("claude", "reasoning", { inputTokens: 10000, outputTokens: 5000, totalTokens: 15000 });
    tracker.record("claude", "reasoning", { inputTokens: 10000, outputTokens: 5000, totalTokens: 15000 });

    const snap = tracker.getSnapshot();
    expect(snap.avgCostPerRequest).toBeCloseTo(snap.totalCostUsd / 2, 6);
  });

  it("projects daily cost", () => {
    const tracker = new CostTracker();
    // Backdate startedAt so elapsed time is non-zero
    (tracker as unknown as { startedAt: number }).startedAt = Date.now() - 3_600_000;
    tracker.record("claude", "reasoning", { inputTokens: 10000, outputTokens: 5000, totalTokens: 15000 });

    const snap = tracker.getSnapshot();
    expect(snap.projectedDailyCostUsd).toBeGreaterThan(0);
  });

  it("resets state", () => {
    const tracker = new CostTracker();
    tracker.record("claude", "reasoning", { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });

    tracker.reset();
    const snap = tracker.getSnapshot();
    expect(snap.requestCount).toBe(0);
    expect(snap.totalCostUsd).toBe(0);
  });

  it("getRecentCost filters by time window", () => {
    const tracker = new CostTracker();
    tracker.record("claude", "reasoning", { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });

    const cost = tracker.getRecentCost(3_600_000);
    expect(cost).toBeGreaterThan(0);
  });
});
