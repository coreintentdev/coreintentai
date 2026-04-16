/**
 * CoreIntent AI — Anomaly Detection Tests
 *
 * Tests for the anomaly detection type schemas, prompt builders,
 * and the anomaly result merge logic.
 */

import { describe, it, expect } from "vitest";
import {
  AnomalyResultSchema,
  MarketAnomalySchema,
  AnomalyType,
  AnomalySeverity,
} from "../src/types/index.js";
import {
  buildAnomalyDetectionPrompt,
  buildMultiTickerAnomalyPrompt,
  buildSentimentDivergencePrompt,
  buildVolatilityRegimePrompt,
} from "../src/capabilities/anomaly/prompts.js";

describe("Anomaly Type Schemas", () => {
  const validAnomaly = {
    type: "volume_spike" as const,
    severity: "high" as const,
    description: "Trading volume 4.2x the 20-day average",
    detectedValue: "42M shares",
    expectedRange: "8-12M shares",
    deviationPct: 320,
    potentialCause: "Institutional accumulation ahead of earnings",
    tradingImplication: "bullish" as const,
  };

  const validResult = {
    ticker: "NVDA",
    anomalies: [validAnomaly],
    overallAlert: "high" as const,
    anomalyCount: 1,
    marketContext: "Broad market up 0.5%, semiconductor sector leading.",
    recommendations: [
      "Monitor for continuation of volume pattern",
      "Tighten stops if long",
    ],
    timestamp: "2026-04-16T12:00:00.000Z",
  };

  describe("MarketAnomalySchema", () => {
    it("accepts valid anomaly data", () => {
      const result = MarketAnomalySchema.parse(validAnomaly);
      expect(result.type).toBe("volume_spike");
      expect(result.severity).toBe("high");
      expect(result.deviationPct).toBe(320);
    });

    it("accepts all anomaly types", () => {
      const types = [
        "volume_spike",
        "volume_drought",
        "price_gap",
        "momentum_divergence",
        "sentiment_divergence",
        "correlation_break",
        "volatility_regime_change",
        "unusual_options_activity",
        "sector_rotation",
      ] as const;

      for (const type of types) {
        const result = MarketAnomalySchema.parse({ ...validAnomaly, type });
        expect(result.type).toBe(type);
      }
    });

    it("accepts all severity levels", () => {
      const levels = ["low", "medium", "high", "critical"] as const;
      for (const severity of levels) {
        const result = MarketAnomalySchema.parse({
          ...validAnomaly,
          severity,
        });
        expect(result.severity).toBe(severity);
      }
    });

    it("accepts all trading implications", () => {
      const implications = [
        "bullish",
        "bearish",
        "neutral",
        "uncertain",
      ] as const;
      for (const tradingImplication of implications) {
        const result = MarketAnomalySchema.parse({
          ...validAnomaly,
          tradingImplication,
        });
        expect(result.tradingImplication).toBe(tradingImplication);
      }
    });

    it("rejects invalid anomaly type", () => {
      expect(() =>
        MarketAnomalySchema.parse({ ...validAnomaly, type: "magic_pattern" })
      ).toThrow();
    });

    it("rejects invalid severity", () => {
      expect(() =>
        MarketAnomalySchema.parse({ ...validAnomaly, severity: "extreme" })
      ).toThrow();
    });

    it("rejects invalid trading implication", () => {
      expect(() =>
        MarketAnomalySchema.parse({
          ...validAnomaly,
          tradingImplication: "moon",
        })
      ).toThrow();
    });
  });

  describe("AnomalyResultSchema", () => {
    it("accepts valid anomaly result", () => {
      const result = AnomalyResultSchema.parse(validResult);
      expect(result.ticker).toBe("NVDA");
      expect(result.anomalies).toHaveLength(1);
      expect(result.overallAlert).toBe("high");
      expect(result.anomalyCount).toBe(1);
    });

    it("accepts result with no anomalies (clean scan)", () => {
      const clean = {
        ...validResult,
        anomalies: [],
        overallAlert: "low",
        anomalyCount: 0,
      };
      const result = AnomalyResultSchema.parse(clean);
      expect(result.anomalies).toHaveLength(0);
      expect(result.anomalyCount).toBe(0);
    });

    it("accepts result with multiple anomalies", () => {
      const multi = {
        ...validResult,
        anomalies: [
          validAnomaly,
          {
            ...validAnomaly,
            type: "momentum_divergence",
            severity: "medium",
            description: "RSI divergence with price",
          },
          {
            ...validAnomaly,
            type: "unusual_options_activity",
            severity: "critical",
            description: "10x normal put volume",
          },
        ],
        anomalyCount: 3,
        overallAlert: "critical",
      };
      const result = AnomalyResultSchema.parse(multi);
      expect(result.anomalies).toHaveLength(3);
    });

    it("rejects negative anomaly count", () => {
      expect(() =>
        AnomalyResultSchema.parse({ ...validResult, anomalyCount: -1 })
      ).toThrow();
    });

    it("rejects invalid overall alert level", () => {
      expect(() =>
        AnomalyResultSchema.parse({ ...validResult, overallAlert: "extreme" })
      ).toThrow();
    });

    it("rejects missing required fields", () => {
      const { ticker, ...noTicker } = validResult;
      expect(() => AnomalyResultSchema.parse(noTicker)).toThrow();
    });
  });

  describe("AnomalyType enum", () => {
    it("has 9 anomaly types", () => {
      expect(AnomalyType.options).toHaveLength(9);
    });
  });

  describe("AnomalySeverity enum", () => {
    it("has 4 severity levels", () => {
      expect(AnomalySeverity.options).toHaveLength(4);
    });
  });
});

describe("Anomaly Prompt Builders", () => {
  describe("buildAnomalyDetectionPrompt", () => {
    it("includes ticker in the prompt", () => {
      const prompt = buildAnomalyDetectionPrompt({ ticker: "AAPL" });
      expect(prompt).toContain("AAPL");
    });

    it("includes lookback period when provided", () => {
      const prompt = buildAnomalyDetectionPrompt({
        ticker: "AAPL",
        lookbackPeriod: "30 days",
      });
      expect(prompt).toContain("30 days");
    });

    it("includes all data sections when provided", () => {
      const prompt = buildAnomalyDetectionPrompt({
        ticker: "TSLA",
        priceData: "Open: 250, Close: 260",
        volumeData: "Volume: 42M (avg 10M)",
        technicalIndicators: "RSI: 72, MACD: bullish",
        optionsData: "Put/Call ratio: 1.8",
        sectorData: "XLK +0.5%, TSLA +4%",
      });
      expect(prompt).toContain("Price Data:");
      expect(prompt).toContain("Volume Data:");
      expect(prompt).toContain("Technical Indicators:");
      expect(prompt).toContain("Options Activity:");
      expect(prompt).toContain("Sector/Correlation Data:");
    });

    it("includes JSON instruction and timestamp", () => {
      const prompt = buildAnomalyDetectionPrompt({ ticker: "MSFT" });
      expect(prompt).toContain("statistically significant anomalies");
      expect(prompt).toContain("timestamp");
    });
  });

  describe("buildMultiTickerAnomalyPrompt", () => {
    it("includes all tickers", () => {
      const prompt = buildMultiTickerAnomalyPrompt({
        tickers: ["AAPL", "MSFT", "GOOG"],
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("MSFT");
      expect(prompt).toContain("GOOG");
    });

    it("includes focus types when specified", () => {
      const prompt = buildMultiTickerAnomalyPrompt({
        tickers: ["NVDA"],
        focusTypes: ["volume_spike", "unusual_options_activity"],
      });
      expect(prompt).toContain("volume_spike");
      expect(prompt).toContain("unusual_options_activity");
    });

    it("includes market data when provided", () => {
      const prompt = buildMultiTickerAnomalyPrompt({
        tickers: ["AAPL"],
        marketData: "SPY +1.2%, VIX 15.3",
      });
      expect(prompt).toContain("SPY +1.2%");
    });
  });

  describe("buildSentimentDivergencePrompt", () => {
    it("includes both price action and sentiment data", () => {
      const prompt = buildSentimentDivergencePrompt({
        ticker: "AAPL",
        priceAction: "Up 3% in 5 sessions",
        sentimentData: "Bearish sentiment score -0.4",
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("Up 3% in 5 sessions");
      expect(prompt).toContain("Bearish sentiment score -0.4");
      expect(prompt).toContain("sentiment divergence");
    });
  });

  describe("buildVolatilityRegimePrompt", () => {
    it("includes IV and RV data", () => {
      const prompt = buildVolatilityRegimePrompt({
        ticker: "SPY",
        impliedVolatility: "VIX: 22.5, 30-day IV: 25%",
        realizedVolatility: "20-day HV: 18%, 10-day HV: 14%",
      });
      expect(prompt).toContain("SPY");
      expect(prompt).toContain("VIX: 22.5");
      expect(prompt).toContain("20-day HV: 18%");
    });

    it("includes historical context when provided", () => {
      const prompt = buildVolatilityRegimePrompt({
        ticker: "SPY",
        impliedVolatility: "VIX: 22.5",
        realizedVolatility: "HV: 18%",
        historicalContext: "VIX has been below 15 for 3 months",
      });
      expect(prompt).toContain("VIX has been below 15 for 3 months");
    });

    it("requests regime analysis", () => {
      const prompt = buildVolatilityRegimePrompt({
        ticker: "QQQ",
        impliedVolatility: "IV: 20%",
        realizedVolatility: "HV: 15%",
      });
      expect(prompt).toContain("volatility regime");
      expect(prompt).toContain("IV/RV ratio");
    });
  });
});
