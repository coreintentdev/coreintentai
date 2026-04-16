import { describe, it, expect } from "vitest";
import {
  SentimentResultSchema,
  TradingSignalSchema,
  RiskAssessmentSchema,
  ResearchResultSchema,
} from "../src/types/index.js";

describe("Type Schemas", () => {
  describe("SentimentResultSchema", () => {
    const validSentiment = {
      ticker: "AAPL",
      sentiment: "bullish",
      confidence: 0.82,
      score: 0.65,
      drivers: [
        { factor: "Strong earnings beat", impact: "positive" as const, weight: 0.5 },
        { factor: "Raised guidance", impact: "positive" as const, weight: 0.3 },
        { factor: "Sector rotation risk", impact: "negative" as const, weight: 0.2 },
      ],
      summary: "AAPL shows strong bullish sentiment driven by earnings beat and raised guidance.",
      timeHorizon: "short_term" as const,
      sources: ["earnings report", "analyst notes"],
      timestamp: "2026-04-16T12:00:00.000Z",
    };

    it("accepts valid sentiment data", () => {
      const result = SentimentResultSchema.parse(validSentiment);
      expect(result.ticker).toBe("AAPL");
      expect(result.sentiment).toBe("bullish");
      expect(result.confidence).toBe(0.82);
    });

    it("rejects invalid sentiment values", () => {
      expect(() =>
        SentimentResultSchema.parse({
          ...validSentiment,
          sentiment: "super_bullish",
        })
      ).toThrow();
    });

    it("rejects confidence out of range", () => {
      expect(() =>
        SentimentResultSchema.parse({
          ...validSentiment,
          confidence: 1.5,
        })
      ).toThrow();
    });

    it("rejects score out of range", () => {
      expect(() =>
        SentimentResultSchema.parse({
          ...validSentiment,
          score: -2,
        })
      ).toThrow();
    });

    it("accepts without optional sources", () => {
      const { sources, ...noSources } = validSentiment;
      const result = SentimentResultSchema.parse(noSources);
      expect(result.sources).toBeUndefined();
    });
  });

  describe("TradingSignalSchema", () => {
    const validSignal = {
      ticker: "TSLA",
      action: "buy",
      confidence: 0.75,
      entryPrice: 250.0,
      stopLoss: 240.0,
      takeProfit: [265.0, 280.0, 300.0],
      timeframe: "swing" as const,
      reasoning: "Bullish flag breakout with volume confirmation.",
      technicalFactors: [
        { indicator: "RSI", value: "58", signal: "bullish" as const },
        { indicator: "MACD", value: "Bullish crossover", signal: "bullish" as const },
        { indicator: "Volume", value: "Above 20-day average", signal: "bullish" as const },
      ],
      fundamentalFactors: [
        { factor: "Revenue growth", assessment: "25% YoY", impact: "positive" as const },
      ],
      riskRewardRatio: 2.5,
      timestamp: "2026-04-16T12:00:00.000Z",
    };

    it("accepts valid signal data", () => {
      const result = TradingSignalSchema.parse(validSignal);
      expect(result.ticker).toBe("TSLA");
      expect(result.action).toBe("buy");
      expect(result.technicalFactors).toHaveLength(3);
    });

    it("rejects invalid action", () => {
      expect(() =>
        TradingSignalSchema.parse({
          ...validSignal,
          action: "yolo",
        })
      ).toThrow();
    });

    it("rejects negative stop-loss", () => {
      expect(() =>
        TradingSignalSchema.parse({
          ...validSignal,
          stopLoss: -10,
        })
      ).toThrow();
    });

    it("accepts signal without optional fields", () => {
      const { entryPrice, stopLoss, takeProfit, fundamentalFactors, riskRewardRatio, ...minimal } =
        validSignal;
      const result = TradingSignalSchema.parse(minimal);
      expect(result.ticker).toBe("TSLA");
    });
  });

  describe("RiskAssessmentSchema", () => {
    const validRisk = {
      ticker: "NVDA",
      portfolioScope: false,
      overallRisk: "moderate",
      riskScore: 45,
      components: [
        {
          category: "market_risk" as const,
          level: "moderate" as const,
          score: 50,
          description: "Broad market exposure through high beta",
        },
        {
          category: "volatility_risk" as const,
          level: "elevated" as const,
          score: 65,
          description: "Implied volatility above historical norms",
        },
      ],
      positionSizing: {
        maxPositionPct: 5,
        recommendedPositionPct: 3,
        kellyFraction: 0.15,
      },
      warnings: ["High IV environment — consider reduced size"],
      recommendations: ["Use limit orders for entry", "Set trailing stop at 8%"],
      timestamp: "2026-04-16T12:00:00.000Z",
    };

    it("accepts valid risk assessment", () => {
      const result = RiskAssessmentSchema.parse(validRisk);
      expect(result.overallRisk).toBe("moderate");
      expect(result.riskScore).toBe(45);
      expect(result.components).toHaveLength(2);
    });

    it("rejects risk score out of range", () => {
      expect(() =>
        RiskAssessmentSchema.parse({
          ...validRisk,
          riskScore: 150,
        })
      ).toThrow();
    });

    it("rejects invalid risk level", () => {
      expect(() =>
        RiskAssessmentSchema.parse({
          ...validRisk,
          overallRisk: "extreme",
        })
      ).toThrow();
    });

    it("accepts portfolio-level assessment without ticker", () => {
      const { ticker, ...noTicker } = validRisk;
      const result = RiskAssessmentSchema.parse({
        ...noTicker,
        portfolioScope: true,
      });
      expect(result.portfolioScope).toBe(true);
    });
  });

  describe("ResearchResultSchema", () => {
    const validResearch = {
      ticker: "NVDA",
      query: "NVDA growth catalysts 2026",
      summary: "NVIDIA continues to dominate AI infrastructure with strong datacenter growth.",
      findings: [
        {
          claim: "Datacenter revenue grew 150% YoY in Q1 2026",
          source: "NVIDIA Q1 earnings report",
          confidence: "confirmed" as const,
          recency: "recent" as const,
        },
        {
          claim: "New Blackwell Ultra chips expected Q3 2026",
          source: "Reuters",
          confidence: "likely" as const,
          recency: "recent" as const,
        },
      ],
      catalysts: [
        {
          event: "Blackwell Ultra launch",
          expectedDate: "Q3 2026",
          impact: "positive" as const,
          magnitude: "high" as const,
        },
      ],
      risks: ["Geopolitical restrictions on China exports", "Valuation compression"],
      consensus: "Analysts broadly bullish with $200 median price target",
      contrarianView: "Some argue AI capex cycle may peak in late 2026",
      dataFreshness: "same_day" as const,
      sources: ["NVIDIA earnings", "Reuters", "Bloomberg"],
      timestamp: "2026-04-16T12:00:00.000Z",
    };

    it("accepts valid research data", () => {
      const result = ResearchResultSchema.parse(validResearch);
      expect(result.ticker).toBe("NVDA");
      expect(result.findings).toHaveLength(2);
      expect(result.catalysts).toHaveLength(1);
    });

    it("accepts research without optional fields", () => {
      const { ticker, catalysts, contrarianView, ...minimal } = validResearch;
      const result = ResearchResultSchema.parse(minimal);
      expect(result.ticker).toBeUndefined();
      expect(result.catalysts).toBeUndefined();
    });

    it("rejects invalid confidence value", () => {
      const invalid = {
        ...validResearch,
        findings: [
          { claim: "test", source: "test", confidence: "certain", recency: "recent" },
        ],
      };
      expect(() => ResearchResultSchema.parse(invalid)).toThrow();
    });

    it("rejects invalid data freshness", () => {
      expect(() =>
        ResearchResultSchema.parse({
          ...validResearch,
          dataFreshness: "ancient",
        })
      ).toThrow();
    });

    it("rejects invalid catalyst impact", () => {
      const invalid = {
        ...validResearch,
        catalysts: [
          { event: "test", expectedDate: "Q1", impact: "maybe", magnitude: "high" },
        ],
      };
      expect(() => ResearchResultSchema.parse(invalid)).toThrow();
    });
  });
});
