import { describe, it, expect } from "vitest";
import { MarketRegimeSchema } from "../src/types/index.js";
import {
  buildRegimeDetectionPrompt,
  buildMultiTimeframeRegimePrompt,
  buildRegimeTransitionPrompt,
} from "../src/capabilities/regime/prompts.js";

describe("Market Regime Detection", () => {
  describe("MarketRegimeSchema", () => {
    const validRegime = {
      ticker: "SPY",
      regime: "trending_up",
      confidence: 0.85,
      volatilityRegime: "normal",
      trendStrength: 0.72,
      regimeAge: "~3 weeks",
      transitionProbability: 0.15,
      transitionTargets: [
        {
          regime: "ranging",
          probability: 0.10,
          trigger: "Failure to break resistance at $520",
        },
        {
          regime: "volatile_expansion",
          probability: 0.05,
          trigger: "Unexpected FOMC rate decision",
        },
      ],
      indicators: [
        {
          name: "ADX",
          value: "32",
          signal: "Strong trend in progress",
        },
        {
          name: "20/50 SMA",
          value: "Bullish crossover",
          signal: "Confirming uptrend",
        },
        {
          name: "VIX",
          value: "14.2",
          signal: "Low fear, supportive of trend continuation",
        },
      ],
      strategyImplications: {
        recommended: ["Trend following", "Pullback buying", "Momentum breakouts"],
        avoid: ["Mean reversion shorts", "Selling naked calls"],
        positionSizing: "Standard to aggressive sizing — trend is your friend",
        stopLossApproach: "Trail stops below prior swing lows or 20-day SMA",
      },
      summary:
        "SPY is in a confirmed uptrend with healthy momentum and low volatility. Trend persistence favors continuation.",
      timestamp: "2026-04-19T12:00:00.000Z",
    };

    it("accepts valid regime data", () => {
      const result = MarketRegimeSchema.parse(validRegime);
      expect(result.regime).toBe("trending_up");
      expect(result.confidence).toBe(0.85);
      expect(result.indicators).toHaveLength(3);
      expect(result.strategyImplications.recommended).toHaveLength(3);
    });

    it("accepts all valid regime types", () => {
      const regimes = [
        "trending_up",
        "trending_down",
        "ranging",
        "volatile_expansion",
        "compression",
        "crisis",
        "rotation",
      ];
      for (const regime of regimes) {
        const result = MarketRegimeSchema.parse({ ...validRegime, regime });
        expect(result.regime).toBe(regime);
      }
    });

    it("accepts all volatility regimes", () => {
      const volRegimes = ["low", "normal", "elevated", "extreme"];
      for (const vol of volRegimes) {
        const result = MarketRegimeSchema.parse({
          ...validRegime,
          volatilityRegime: vol,
        });
        expect(result.volatilityRegime).toBe(vol);
      }
    });

    it("rejects invalid regime type", () => {
      expect(() =>
        MarketRegimeSchema.parse({
          ...validRegime,
          regime: "sideways",
        })
      ).toThrow();
    });

    it("rejects confidence out of range", () => {
      expect(() =>
        MarketRegimeSchema.parse({
          ...validRegime,
          confidence: 1.5,
        })
      ).toThrow();
    });

    it("rejects trend strength out of range", () => {
      expect(() =>
        MarketRegimeSchema.parse({
          ...validRegime,
          trendStrength: -0.1,
        })
      ).toThrow();
    });

    it("rejects transition probability out of range", () => {
      expect(() =>
        MarketRegimeSchema.parse({
          ...validRegime,
          transitionProbability: 2.0,
        })
      ).toThrow();
    });

    it("accepts empty transition targets", () => {
      const result = MarketRegimeSchema.parse({
        ...validRegime,
        transitionTargets: [],
      });
      expect(result.transitionTargets).toHaveLength(0);
    });
  });

  describe("Regime Prompts", () => {
    it("builds basic regime detection prompt", () => {
      const prompt = buildRegimeDetectionPrompt({
        ticker: "SPY",
        currentPrice: 515,
      });
      expect(prompt).toContain("SPY");
      expect(prompt).toContain("$515");
      expect(prompt).toContain("regime");
    });

    it("includes technical data when provided", () => {
      const prompt = buildRegimeDetectionPrompt({
        ticker: "QQQ",
        currentPrice: 440,
        technicalData: "ADX: 28, RSI: 62",
      });
      expect(prompt).toContain("ADX: 28");
    });

    it("includes volatility data when provided", () => {
      const prompt = buildRegimeDetectionPrompt({
        ticker: "SPY",
        currentPrice: 515,
        volatilityData: "VIX: 14.5, IV Rank: 22%",
      });
      expect(prompt).toContain("VIX: 14.5");
    });

    it("includes market breadth when provided", () => {
      const prompt = buildRegimeDetectionPrompt({
        ticker: "SPY",
        currentPrice: 515,
        marketBreadth: "Advance/Decline: 2.1, New Highs: 150",
      });
      expect(prompt).toContain("Advance/Decline");
    });

    it("builds multi-timeframe prompt", () => {
      const prompt = buildMultiTimeframeRegimePrompt({
        ticker: "AAPL",
        currentPrice: 200,
        dailyData: "Daily uptrend",
        weeklyData: "Weekly ranging",
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("multi-timeframe");
      expect(prompt).toContain("Daily uptrend");
      expect(prompt).toContain("Weekly ranging");
    });

    it("builds regime transition prompt", () => {
      const prompt = buildRegimeTransitionPrompt({
        ticker: "NVDA",
        currentRegime: "trending_up",
        recentEvents: "Earnings report tomorrow",
      });
      expect(prompt).toContain("NVDA");
      expect(prompt).toContain("trending_up");
      expect(prompt).toContain("Earnings report");
    });
  });
});
