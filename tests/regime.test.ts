import { describe, it, expect } from "vitest";
import {
  RegimeDetectionSchema,
  RegimeTransitionSchema,
  StrategySynthesisSchema,
  RegimeCharacteristicsSchema,
  StrategyAdjustmentsSchema,
} from "../src/types/index.js";
import {
  buildRegimeDetectionPrompt,
  buildRegimeTransitionPrompt,
  buildSectorRegimePrompt,
} from "../src/capabilities/regime/prompts.js";

describe("Regime Detection Schemas", () => {
  describe("RegimeDetectionSchema", () => {
    const validRegime = {
      regime: "trending_bull",
      confidence: 0.85,
      characteristics: {
        trendStrength: 0.7,
        volatilityLevel: "normal",
        momentumBias: "bullish",
        breadth: "strong",
        riskAppetite: "risk_on",
      },
      indicators: [
        { name: "RSI", value: "62", signal: "bullish" },
        { name: "MACD", value: "Bullish crossover", signal: "bullish" },
        { name: "200-DMA", value: "Price above", signal: "bullish" },
      ],
      strategyAdjustments: {
        positionSizing: "increase",
        stopLossWidth: "normal",
        takeProfitStrategy: "aggressive",
        preferredTimeframes: ["swing", "position"],
        avoidPatterns: ["counter-trend shorts"],
        favorPatterns: ["breakout", "trend continuation"],
      },
      summary: "Strong bullish trend with broad participation and healthy momentum.",
      transitionRisk: "low",
      timestamp: "2026-04-17T00:00:00.000Z",
    };

    it("accepts valid regime detection", () => {
      const result = RegimeDetectionSchema.parse(validRegime);
      expect(result.regime).toBe("trending_bull");
      expect(result.confidence).toBe(0.85);
      expect(result.characteristics.trendStrength).toBe(0.7);
    });

    it("rejects invalid regime values", () => {
      expect(() =>
        RegimeDetectionSchema.parse({ ...validRegime, regime: "sideways" })
      ).toThrow();
    });

    it("rejects confidence out of range", () => {
      expect(() =>
        RegimeDetectionSchema.parse({ ...validRegime, confidence: 1.5 })
      ).toThrow();
    });

    it("rejects trendStrength out of range", () => {
      expect(() =>
        RegimeDetectionSchema.parse({
          ...validRegime,
          characteristics: { ...validRegime.characteristics, trendStrength: 2.0 },
        })
      ).toThrow();
    });

    it("validates all six regime types", () => {
      const regimes = [
        "trending_bull", "trending_bear", "ranging",
        "high_volatility", "crisis", "recovery",
      ];
      for (const regime of regimes) {
        const result = RegimeDetectionSchema.parse({ ...validRegime, regime });
        expect(result.regime).toBe(regime);
      }
    });

    it("validates all volatility levels", () => {
      const levels = ["low", "normal", "elevated", "extreme"];
      for (const level of levels) {
        const result = RegimeCharacteristicsSchema.parse({
          ...validRegime.characteristics,
          volatilityLevel: level,
        });
        expect(result.volatilityLevel).toBe(level);
      }
    });

    it("validates strategy adjustments", () => {
      const result = StrategyAdjustmentsSchema.parse(validRegime.strategyAdjustments);
      expect(result.positionSizing).toBe("increase");
      expect(result.preferredTimeframes).toContain("swing");
    });
  });

  describe("RegimeTransitionSchema", () => {
    const validTransition = {
      currentRegime: "trending_bull",
      persistProbability: 0.7,
      transitions: [
        {
          toRegime: "high_volatility",
          probability: 0.2,
          triggers: ["Fed rate decision", "earnings season"],
          timeHorizon: "weeks",
        },
        {
          toRegime: "ranging",
          probability: 0.1,
          triggers: ["volume decline", "breadth narrowing"],
          timeHorizon: "months",
        },
      ],
      earlyWarningSignals: ["VIX rising above 20", "declining advance/decline ratio"],
      timestamp: "2026-04-17T00:00:00.000Z",
    };

    it("accepts valid transition data", () => {
      const result = RegimeTransitionSchema.parse(validTransition);
      expect(result.persistProbability).toBe(0.7);
      expect(result.transitions).toHaveLength(2);
    });

    it("rejects invalid time horizon", () => {
      expect(() =>
        RegimeTransitionSchema.parse({
          ...validTransition,
          transitions: [
            { toRegime: "crisis", probability: 0.1, triggers: ["x"], timeHorizon: "hours" },
          ],
        })
      ).toThrow();
    });
  });

  describe("StrategySynthesisSchema", () => {
    const validSynthesis = {
      decision: "go",
      confidence: 0.78,
      thesis: "Strong momentum setup with favorable risk/reward in a bullish regime.",
      regime: "trending_bull",
      regimeAlignment: 0.85,
      adjustedSignal: {
        action: "buy",
        positionSizePct: 3.5,
        entryStrategy: "Limit order at $150 with scale-in at $148",
        exitStrategy: "Trail stop with targets at $160 and $170",
        stopLoss: "Hard stop at $145 (3.3% risk)",
        timeframe: "Swing trade, 2-4 weeks expected holding",
      },
      riskBudget: {
        maxLossPct: 1.0,
        maxPositionPct: 5.0,
        hedgeRecommendation: "Consider put spread if VIX drops below 14",
      },
      conditions: [
        "Price holds above $148 support",
        "Volume confirms on breakout above $152",
      ],
      invalidationCriteria: [
        "Close below $145 on heavy volume",
        "Regime shifts to crisis or high_volatility",
      ],
      summary: "Buy AAPL with 3.5% position. Entry at $150 with $145 stop. Regime-aligned bullish swing trade.",
      timestamp: "2026-04-17T00:00:00.000Z",
    };

    it("accepts valid strategy synthesis", () => {
      const result = StrategySynthesisSchema.parse(validSynthesis);
      expect(result.decision).toBe("go");
      expect(result.adjustedSignal.action).toBe("buy");
    });

    it("validates all decision types", () => {
      const decisions = ["strong_go", "go", "conditional_go", "wait", "no_go"];
      for (const decision of decisions) {
        const result = StrategySynthesisSchema.parse({ ...validSynthesis, decision });
        expect(result.decision).toBe(decision);
      }
    });

    it("rejects invalid decision", () => {
      expect(() =>
        StrategySynthesisSchema.parse({ ...validSynthesis, decision: "yolo" })
      ).toThrow();
    });

    it("accepts without optional hedge recommendation", () => {
      const noHedge = {
        ...validSynthesis,
        riskBudget: { maxLossPct: 1.0, maxPositionPct: 5.0 },
      };
      const result = StrategySynthesisSchema.parse(noHedge);
      expect(result.riskBudget.hedgeRecommendation).toBeUndefined();
    });
  });
});

describe("Regime Prompts", () => {
  describe("buildRegimeDetectionPrompt", () => {
    it("includes market in prompt", () => {
      const prompt = buildRegimeDetectionPrompt({ market: "NASDAQ" });
      expect(prompt).toContain("NASDAQ");
    });

    it("defaults to broad market", () => {
      const prompt = buildRegimeDetectionPrompt({});
      expect(prompt).toContain("broad market");
    });

    it("includes price data when provided", () => {
      const prompt = buildRegimeDetectionPrompt({
        priceData: "SPY: 520 → 530 → 525",
      });
      expect(prompt).toContain("SPY: 520");
    });

    it("includes indicators", () => {
      const prompt = buildRegimeDetectionPrompt({
        indicators: ["VIX: 18.5", "RSI: 62"],
      });
      expect(prompt).toContain("VIX: 18.5");
      expect(prompt).toContain("RSI: 62");
    });

    it("includes context", () => {
      const prompt = buildRegimeDetectionPrompt({
        context: "Fed meeting next week",
      });
      expect(prompt).toContain("Fed meeting next week");
    });
  });

  describe("buildRegimeTransitionPrompt", () => {
    it("includes current regime", () => {
      const prompt = buildRegimeTransitionPrompt({ currentRegime: "trending_bull" });
      expect(prompt).toContain("trending_bull");
    });

    it("includes context when provided", () => {
      const prompt = buildRegimeTransitionPrompt({
        currentRegime: "ranging",
        context: "Earnings season approaching",
      });
      expect(prompt).toContain("Earnings season");
    });
  });

  describe("buildSectorRegimePrompt", () => {
    it("lists all sectors", () => {
      const prompt = buildSectorRegimePrompt({
        sectors: ["Technology", "Healthcare", "Energy"],
      });
      expect(prompt).toContain("Technology");
      expect(prompt).toContain("Healthcare");
      expect(prompt).toContain("Energy");
    });
  });
});
