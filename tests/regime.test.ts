import { describe, it, expect } from "vitest";
import {
  buildRegimeDetectionPrompt,
  buildRegimeTransitionPrompt,
  buildMultiTimeframeRegimePrompt,
} from "../src/capabilities/regime/prompts.js";
import {
  RegimeDetectionResultSchema,
  MarketRegime,
  RegimeIndicatorSchema,
  RegimeTransitionSchema,
  StrategyImplicationsSchema,
} from "../src/types/index.js";

describe("Market Regime Detection", () => {
  describe("Prompts", () => {
    it("builds basic regime detection prompt", () => {
      const prompt = buildRegimeDetectionPrompt({});
      expect(prompt).toContain("regime");
      expect(prompt).toContain("indicators");
    });

    it("includes VIX level", () => {
      const prompt = buildRegimeDetectionPrompt({ vix: 28.5 });
      expect(prompt).toContain("28.5");
    });

    it("includes indices data", () => {
      const prompt = buildRegimeDetectionPrompt({
        indices: ["SPX: 5200 (+0.5%)", "NDX: 18500 (+1.2%)"],
      });
      expect(prompt).toContain("SPX");
      expect(prompt).toContain("NDX");
    });

    it("includes timeframe", () => {
      const prompt = buildRegimeDetectionPrompt({
        timeframe: "weekly",
      });
      expect(prompt).toContain("weekly");
    });

    it("includes market data and breadth data", () => {
      const prompt = buildRegimeDetectionPrompt({
        marketData: "50 DMA rising, 200 DMA flat",
        breadthData: "Advance/Decline ratio 2.1",
      });
      expect(prompt).toContain("50 DMA");
      expect(prompt).toContain("Advance/Decline");
    });

    it("includes sector rotation data", () => {
      const prompt = buildRegimeDetectionPrompt({
        sectorRotation: "Tech leading, Utilities lagging — risk-on rotation",
      });
      expect(prompt).toContain("Tech leading");
      expect(prompt).toContain("risk-on");
    });

    it("builds regime transition prompt", () => {
      const prompt = buildRegimeTransitionPrompt({
        currentRegime: "trending_bull",
        marketData: "SPX at resistance, volume declining",
        recentChanges: "VIX rising from 12 to 18 over 3 sessions",
      });
      expect(prompt).toContain("trending_bull");
      expect(prompt).toContain("VIX rising");
      expect(prompt).toContain("transition");
    });

    it("builds multi-timeframe prompt", () => {
      const prompt = buildMultiTimeframeRegimePrompt({
        dailyData: "Choppy price action, RSI 48",
        weeklyData: "Clear uptrend, higher highs",
        monthlyData: "At all-time highs",
      });
      expect(prompt).toContain("Daily");
      expect(prompt).toContain("Weekly");
      expect(prompt).toContain("Monthly");
      expect(prompt).toContain("multi-timeframe");
    });

    it("builds multi-timeframe prompt without monthly", () => {
      const prompt = buildMultiTimeframeRegimePrompt({
        dailyData: "Ranging",
        weeklyData: "Trending",
      });
      expect(prompt).toContain("Daily");
      expect(prompt).toContain("Weekly");
      expect(prompt).not.toContain("Monthly");
    });
  });

  describe("Schema Validation", () => {
    it("validates all regime types", () => {
      const regimes = [
        "trending_bull",
        "trending_bear",
        "ranging",
        "volatile",
        "crisis",
      ] as const;
      for (const regime of regimes) {
        expect(MarketRegime.parse(regime)).toBe(regime);
      }
    });

    it("rejects invalid regime type", () => {
      expect(() => MarketRegime.parse("sideways")).toThrow();
    });

    it("validates a complete regime detection result", () => {
      const result = RegimeDetectionResultSchema.parse({
        regime: "trending_bull",
        confidence: 0.82,
        subRegime: "Late-stage bull with narrowing breadth",
        indicators: [
          {
            name: "SPX 50/200 DMA",
            value: "Golden cross active",
            signal: "confirms",
            weight: 0.3,
          },
          {
            name: "VIX",
            value: "14.2",
            signal: "confirms",
            weight: 0.2,
          },
          {
            name: "Market Breadth",
            value: "52% above 200 DMA",
            signal: "contradicts",
            weight: 0.25,
          },
          {
            name: "Sector Rotation",
            value: "Defensive sectors outperforming",
            signal: "contradicts",
            weight: 0.25,
          },
        ],
        transitionRisk: {
          probability: 0.35,
          likelyNextRegime: "volatile",
          earlyWarnings: [
            "Breadth deteriorating",
            "Defensive rotation accelerating",
          ],
        },
        strategyImplications: {
          favoredStrategies: [
            "Trend following on large caps",
            "Momentum in tech leaders",
          ],
          avoidStrategies: [
            "Short selling",
            "Fading breakouts",
          ],
          positionSizing: "normal",
          hedgingAdvice: "Consider put spreads on indices as breadth narrows",
        },
        timeframe: "daily",
        invalidation:
          "SPX closes below 200 DMA on high volume for 3 consecutive sessions",
        timestamp: new Date().toISOString(),
      });
      expect(result.regime).toBe("trending_bull");
      expect(result.confidence).toBe(0.82);
      expect(result.indicators).toHaveLength(4);
      expect(result.transitionRisk.probability).toBe(0.35);
    });

    it("validates crisis regime with defensive positioning", () => {
      const result = RegimeDetectionResultSchema.parse({
        regime: "crisis",
        confidence: 0.91,
        subRegime: "Liquidity crisis with contagion risk",
        indicators: [
          {
            name: "VIX",
            value: "42.5",
            signal: "confirms",
            weight: 0.35,
          },
          {
            name: "Credit Spreads",
            value: "Widening rapidly",
            signal: "confirms",
            weight: 0.3,
          },
          {
            name: "Correlation",
            value: "0.85 — everything selling together",
            signal: "confirms",
            weight: 0.2,
          },
          {
            name: "Volume",
            value: "3x average — panic selling",
            signal: "confirms",
            weight: 0.15,
          },
        ],
        transitionRisk: {
          probability: 0.2,
          likelyNextRegime: "volatile",
          earlyWarnings: [
            "Central bank intervention",
            "VIX term structure normalizing",
          ],
        },
        strategyImplications: {
          favoredStrategies: ["Cash", "Short-duration treasuries"],
          avoidStrategies: [
            "Buying dips",
            "Leverage",
            "Illiquid positions",
          ],
          positionSizing: "defensive",
          hedgingAdvice: "Max hedging — long VIX, long puts, reduce gross exposure",
        },
        timeframe: "daily",
        invalidation: "VIX drops below 25 with sustained buying",
        timestamp: new Date().toISOString(),
      });
      expect(result.regime).toBe("crisis");
      expect(result.strategyImplications.positionSizing).toBe("defensive");
    });

    it("validates regime indicator schema", () => {
      const indicator = RegimeIndicatorSchema.parse({
        name: "RSI",
        value: "72 — overbought",
        signal: "contradicts",
        weight: 0.2,
      });
      expect(indicator.signal).toBe("contradicts");
    });

    it("rejects indicator with invalid signal", () => {
      expect(() =>
        RegimeIndicatorSchema.parse({
          name: "RSI",
          value: "72",
          signal: "bullish",
          weight: 0.2,
        })
      ).toThrow();
    });

    it("validates transition risk schema", () => {
      const risk = RegimeTransitionSchema.parse({
        probability: 0.45,
        likelyNextRegime: "trending_bear",
        earlyWarnings: ["Yield curve inverting", "PMI declining"],
      });
      expect(risk.probability).toBe(0.45);
      expect(risk.earlyWarnings).toHaveLength(2);
    });

    it("validates strategy implications schema", () => {
      const strategy = StrategyImplicationsSchema.parse({
        favoredStrategies: ["Mean reversion", "Iron condors"],
        avoidStrategies: ["Trend following"],
        positionSizing: "reduced",
        hedgingAdvice: "Collar strategy on core holdings",
      });
      expect(strategy.positionSizing).toBe("reduced");
    });

    it("rejects invalid position sizing", () => {
      expect(() =>
        StrategyImplicationsSchema.parse({
          favoredStrategies: [],
          avoidStrategies: [],
          positionSizing: "yolo",
          hedgingAdvice: "None",
        })
      ).toThrow();
    });

    it("rejects invalid confidence range", () => {
      expect(() =>
        RegimeDetectionResultSchema.parse({
          regime: "ranging",
          confidence: 1.2,
          subRegime: "Test",
          indicators: [],
          transitionRisk: {
            probability: 0.5,
            likelyNextRegime: "volatile",
            earlyWarnings: [],
          },
          strategyImplications: {
            favoredStrategies: [],
            avoidStrategies: [],
            positionSizing: "normal",
            hedgingAdvice: "None",
          },
          timeframe: "daily",
          invalidation: "Test",
          timestamp: new Date().toISOString(),
        })
      ).toThrow();
    });
  });
});
