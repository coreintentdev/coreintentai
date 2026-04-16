import { describe, it, expect } from "vitest";
import { validateSignalConstraints } from "../src/utils/validate-signal.js";
import type { TradingSignal } from "../src/types/index.js";

function makeSignal(overrides: Partial<TradingSignal> = {}): TradingSignal {
  return {
    ticker: "AAPL",
    action: "buy",
    confidence: 0.8,
    entryPrice: 150,
    stopLoss: 140,
    takeProfit: [160, 170, 180],
    timeframe: "swing",
    reasoning: "Strong technical setup with bullish RSI divergence",
    technicalFactors: [
      { indicator: "RSI", value: "65", signal: "bullish" },
      { indicator: "MACD", value: "bullish cross", signal: "bullish" },
      { indicator: "SMA200", value: "above", signal: "bullish" },
    ],
    riskRewardRatio: 2.0,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("validateSignalConstraints", () => {
  describe("valid signals", () => {
    it("validates a clean buy signal", () => {
      const result = validateSignalConstraints(makeSignal());
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it("validates a clean sell signal", () => {
      const result = validateSignalConstraints(
        makeSignal({
          action: "sell",
          entryPrice: 150,
          stopLoss: 160,
          takeProfit: [140, 130, 120],
        })
      );
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it("validates a hold signal without price constraints", () => {
      const result = validateSignalConstraints(
        makeSignal({
          action: "hold",
          entryPrice: undefined,
          stopLoss: undefined,
          takeProfit: undefined,
        })
      );
      expect(result.valid).toBe(true);
    });
  });

  describe("stop-loss violations", () => {
    it("flags buy signal with stop above entry", () => {
      const result = validateSignalConstraints(
        makeSignal({ action: "buy", entryPrice: 150, stopLoss: 160 })
      );
      expect(result.valid).toBe(false);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: "STOP_ABOVE_ENTRY", severity: "error" })
      );
    });

    it("flags buy signal with stop equal to entry", () => {
      const result = validateSignalConstraints(
        makeSignal({ action: "buy", entryPrice: 150, stopLoss: 150 })
      );
      expect(result.valid).toBe(false);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: "STOP_ABOVE_ENTRY" })
      );
    });

    it("flags strong_buy with stop above entry", () => {
      const result = validateSignalConstraints(
        makeSignal({ action: "strong_buy", entryPrice: 100, stopLoss: 110 })
      );
      expect(result.valid).toBe(false);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: "STOP_ABOVE_ENTRY" })
      );
    });

    it("flags sell signal with stop below entry", () => {
      const result = validateSignalConstraints(
        makeSignal({ action: "sell", entryPrice: 150, stopLoss: 140 })
      );
      expect(result.valid).toBe(false);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: "STOP_BELOW_ENTRY", severity: "error" })
      );
    });

    it("flags strong_sell with stop equal to entry", () => {
      const result = validateSignalConstraints(
        makeSignal({ action: "strong_sell", entryPrice: 100, stopLoss: 100 })
      );
      expect(result.valid).toBe(false);
    });
  });

  describe("take-profit violations", () => {
    it("flags buy signal with take-profit below entry", () => {
      const result = validateSignalConstraints(
        makeSignal({
          action: "buy",
          entryPrice: 150,
          takeProfit: [145, 160, 170],
        })
      );
      expect(result.valid).toBe(false);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: "TP_BELOW_ENTRY", severity: "error" })
      );
    });

    it("flags sell signal with take-profit above entry", () => {
      const result = validateSignalConstraints(
        makeSignal({
          action: "sell",
          entryPrice: 150,
          stopLoss: 160,
          takeProfit: [155, 140, 130],
        })
      );
      expect(result.valid).toBe(false);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: "TP_ABOVE_ENTRY", severity: "error" })
      );
    });
  });

  describe("take-profit ordering", () => {
    it("warns when buy TPs are not ascending", () => {
      const result = validateSignalConstraints(
        makeSignal({
          action: "buy",
          takeProfit: [170, 160, 180],
        })
      );
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: "TP_ORDER", severity: "warning" })
      );
      // Order warning is not an error — signal is still valid
      expect(result.valid).toBe(true);
    });

    it("warns when sell TPs are not descending", () => {
      const result = validateSignalConstraints(
        makeSignal({
          action: "sell",
          entryPrice: 150,
          stopLoss: 160,
          takeProfit: [130, 140, 120],
        })
      );
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: "TP_ORDER", severity: "warning" })
      );
    });
  });

  describe("risk/reward ratio", () => {
    it("warns when R:R is below 1:1", () => {
      const result = validateSignalConstraints(
        makeSignal({ riskRewardRatio: 0.5 })
      );
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: "LOW_RR", severity: "warning" })
      );
    });

    it("does not warn when R:R is 1:1 or above", () => {
      const result = validateSignalConstraints(
        makeSignal({ riskRewardRatio: 1.0 })
      );
      const rrWarnings = result.warnings.filter((w) => w.code === "LOW_RR");
      expect(rrWarnings).toHaveLength(0);
    });
  });

  describe("confidence vs action coherence", () => {
    it("warns on low-confidence directional signal", () => {
      const result = validateSignalConstraints(
        makeSignal({ action: "buy", confidence: 0.2 })
      );
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: "LOW_CONFIDENCE_ACTION",
          severity: "warning",
        })
      );
    });

    it("does not warn on low-confidence hold", () => {
      const result = validateSignalConstraints(
        makeSignal({ action: "hold", confidence: 0.2 })
      );
      const confWarnings = result.warnings.filter(
        (w) => w.code === "LOW_CONFIDENCE_ACTION"
      );
      expect(confWarnings).toHaveLength(0);
    });
  });

  describe("wide stop-loss detection", () => {
    it("warns when stop is >20% from entry on non-position trade", () => {
      const result = validateSignalConstraints(
        makeSignal({
          timeframe: "day",
          entryPrice: 100,
          stopLoss: 70,
        })
      );
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: "WIDE_STOP", severity: "warning" })
      );
    });

    it("does not warn for wide stop on position timeframe", () => {
      const result = validateSignalConstraints(
        makeSignal({
          timeframe: "position",
          entryPrice: 100,
          stopLoss: 70,
          takeProfit: [150, 200, 250],
        })
      );
      const wideStops = result.warnings.filter((w) => w.code === "WIDE_STOP");
      expect(wideStops).toHaveLength(0);
    });

    it("does not warn when stop is within 20%", () => {
      const result = validateSignalConstraints(
        makeSignal({
          timeframe: "day",
          entryPrice: 100,
          stopLoss: 85,
        })
      );
      const wideStops = result.warnings.filter((w) => w.code === "WIDE_STOP");
      expect(wideStops).toHaveLength(0);
    });
  });

  describe("multiple warnings", () => {
    it("accumulates multiple warnings", () => {
      const result = validateSignalConstraints(
        makeSignal({
          action: "buy",
          confidence: 0.1,
          entryPrice: 100,
          stopLoss: 110,
          takeProfit: [90],
          riskRewardRatio: 0.3,
        })
      );

      expect(result.valid).toBe(false);
      // Should have: STOP_ABOVE_ENTRY, TP_BELOW_ENTRY, LOW_RR, LOW_CONFIDENCE_ACTION
      expect(result.warnings.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("returns original signal unchanged", () => {
    it("does not mutate the signal", () => {
      const signal = makeSignal();
      const original = JSON.stringify(signal);
      validateSignalConstraints(signal);
      expect(JSON.stringify(signal)).toBe(original);
    });

    it("includes the signal in the result", () => {
      const signal = makeSignal();
      const result = validateSignalConstraints(signal);
      expect(result.signal).toBe(signal); // Same reference
    });
  });
});
