import { describe, it, expect } from "vitest";
import { CostTracker } from "../src/utils/cost-tracker.js";

describe("CostTracker", () => {
  describe("estimate", () => {
    it("calculates Claude costs correctly", () => {
      const tracker = new CostTracker();
      const estimate = tracker.estimate("claude", "claude-sonnet-4-20250514", {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      });

      expect(estimate.provider).toBe("claude");
      expect(estimate.inputCostUsd).toBe(0.003);
      expect(estimate.outputCostUsd).toBe(0.0075);
      expect(estimate.totalCostUsd).toBe(0.0105);
    });

    it("calculates Grok costs correctly", () => {
      const tracker = new CostTracker();
      const estimate = tracker.estimate("grok", "grok-2", {
        inputTokens: 2000,
        outputTokens: 1000,
        totalTokens: 3000,
      });

      expect(estimate.inputCostUsd).toBe(0.004);
      expect(estimate.outputCostUsd).toBe(0.01);
      expect(estimate.totalCostUsd).toBe(0.014);
    });

    it("calculates Perplexity costs correctly", () => {
      const tracker = new CostTracker();
      const estimate = tracker.estimate("perplexity", "sonar-pro", {
        inputTokens: 500,
        outputTokens: 2000,
        totalTokens: 2500,
      });

      expect(estimate.inputCostUsd).toBe(0.0015);
      expect(estimate.outputCostUsd).toBe(0.03);
      expect(estimate.totalCostUsd).toBe(0.0315);
    });

    it("handles zero tokens", () => {
      const tracker = new CostTracker();
      const estimate = tracker.estimate("claude", "test", {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      });

      expect(estimate.totalCostUsd).toBe(0);
    });

    it("handles large token counts", () => {
      const tracker = new CostTracker();
      const estimate = tracker.estimate("claude", "test", {
        inputTokens: 1_000_000,
        outputTokens: 100_000,
        totalTokens: 1_100_000,
      });

      expect(estimate.inputCostUsd).toBe(3.0);
      expect(estimate.outputCostUsd).toBe(1.5);
      expect(estimate.totalCostUsd).toBe(4.5);
    });
  });

  describe("record and summarize", () => {
    it("tracks cumulative costs", () => {
      const tracker = new CostTracker();

      tracker.record("claude", "claude-sonnet-4-20250514", "reasoning", {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      });

      tracker.record("grok", "grok-2", "fast_analysis", {
        inputTokens: 800,
        outputTokens: 400,
        totalTokens: 1200,
      });

      const summary = tracker.summarize();
      expect(summary.requestCount).toBe(2);
      expect(summary.totalInputTokens).toBe(1800);
      expect(summary.totalOutputTokens).toBe(900);
      expect(summary.totalCostUsd).toBeGreaterThan(0);
    });

    it("tracks costs by provider", () => {
      const tracker = new CostTracker();

      tracker.record("claude", "test", "reasoning", {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      });

      tracker.record("claude", "test", "risk", {
        inputTokens: 2000,
        outputTokens: 1000,
        totalTokens: 3000,
      });

      tracker.record("grok", "test", "sentiment", {
        inputTokens: 500,
        outputTokens: 200,
        totalTokens: 700,
      });

      const summary = tracker.summarize();
      expect(summary.costByProvider["claude"]).toBeGreaterThan(
        summary.costByProvider["grok"]
      );
    });

    it("tracks costs by intent", () => {
      const tracker = new CostTracker();

      tracker.record("claude", "test", "reasoning", {
        inputTokens: 5000,
        outputTokens: 2000,
        totalTokens: 7000,
      });

      tracker.record("grok", "test", "fast_analysis", {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      });

      const summary = tracker.summarize();
      expect(summary.costByIntent["reasoning"]).toBeGreaterThan(
        summary.costByIntent["fast_analysis"]
      );
    });

    it("returns zero summary when empty", () => {
      const tracker = new CostTracker();
      const summary = tracker.summarize();

      expect(summary.totalCostUsd).toBe(0);
      expect(summary.requestCount).toBe(0);
      expect(summary.totalInputTokens).toBe(0);
    });
  });

  describe("reset", () => {
    it("clears all tracked data", () => {
      const tracker = new CostTracker();

      tracker.record("claude", "test", "reasoning", {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      });

      expect(tracker.requestCount).toBe(1);

      tracker.reset();

      expect(tracker.requestCount).toBe(0);
      const summary = tracker.summarize();
      expect(summary.totalCostUsd).toBe(0);
    });
  });

  describe("custom pricing", () => {
    it("accepts custom pricing overrides", () => {
      const tracker = new CostTracker({
        claude: { inputPer1MTokens: 10.0, outputPer1MTokens: 30.0 },
      });

      const estimate = tracker.estimate("claude", "opus", {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        totalTokens: 2_000_000,
      });

      expect(estimate.inputCostUsd).toBe(10.0);
      expect(estimate.outputCostUsd).toBe(30.0);
    });

    it("preserves default pricing for non-overridden providers", () => {
      const tracker = new CostTracker({
        claude: { inputPer1MTokens: 100.0, outputPer1MTokens: 100.0 },
      });

      const grokEstimate = tracker.estimate("grok", "grok-2", {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        totalTokens: 2_000_000,
      });

      expect(grokEstimate.inputCostUsd).toBe(2.0);
      expect(grokEstimate.outputCostUsd).toBe(10.0);
    });
  });
});
