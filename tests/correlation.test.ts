import { describe, it, expect } from "vitest";
import { CorrelationPairSchema, CorrelationMatrixSchema } from "../src/types/index.js";
import {
  buildCorrelationPrompt,
  buildPortfolioCorrelationPrompt,
  buildCorrelationShiftPrompt,
} from "../src/capabilities/correlation/prompts.js";

describe("Correlation Types", () => {
  describe("CorrelationPairSchema", () => {
    it("validates a valid correlation pair", () => {
      const pair = {
        tickerA: "AAPL",
        tickerB: "MSFT",
        correlation: 0.85,
        rollingWindow: "60d",
        stability: 0.9,
        regime: "stable",
      };
      expect(CorrelationPairSchema.parse(pair)).toEqual(pair);
    });

    it("rejects correlation out of range", () => {
      expect(() =>
        CorrelationPairSchema.parse({
          tickerA: "AAPL",
          tickerB: "MSFT",
          correlation: 1.5,
          rollingWindow: "30d",
          stability: 0.5,
          regime: "stable",
        })
      ).toThrow();
    });

    it("accepts negative correlations", () => {
      const result = CorrelationPairSchema.parse({
        tickerA: "SPY",
        tickerB: "TLT",
        correlation: -0.45,
        rollingWindow: "30d",
        stability: 0.6,
        regime: "regime_dependent",
      });
      expect(result.correlation).toBe(-0.45);
    });

    it("validates regime enum values", () => {
      for (const regime of ["stable", "breaking_down", "strengthening", "regime_dependent"]) {
        expect(() =>
          CorrelationPairSchema.parse({
            tickerA: "A",
            tickerB: "B",
            correlation: 0.5,
            rollingWindow: "30d",
            stability: 0.5,
            regime,
          })
        ).not.toThrow();
      }
    });
  });

  describe("CorrelationMatrixSchema", () => {
    const validMatrix = {
      tickers: ["AAPL", "MSFT", "GOOGL"],
      pairs: [
        {
          tickerA: "AAPL",
          tickerB: "MSFT",
          correlation: 0.82,
          rollingWindow: "60d",
          stability: 0.88,
          regime: "stable" as const,
        },
        {
          tickerA: "AAPL",
          tickerB: "GOOGL",
          correlation: 0.71,
          rollingWindow: "60d",
          stability: 0.75,
          regime: "strengthening" as const,
        },
      ],
      clusterCount: 1,
      clusters: [
        {
          id: 1,
          tickers: ["AAPL", "MSFT", "GOOGL"],
          theme: "Large-cap tech, correlated via Nasdaq/growth factor",
          intraClusterCorrelation: 0.76,
        },
      ],
      diversificationScore: 0.25,
      concentrationRisk: "high" as const,
      regimeNote: "Bull market regime increases tech correlation",
      recommendations: ["Add non-correlated assets like commodities or bonds"],
      timestamp: new Date().toISOString(),
    };

    it("validates a complete correlation matrix", () => {
      expect(CorrelationMatrixSchema.parse(validMatrix)).toEqual(validMatrix);
    });

    it("rejects invalid concentration risk levels", () => {
      expect(() =>
        CorrelationMatrixSchema.parse({
          ...validMatrix,
          concentrationRisk: "extreme",
        })
      ).toThrow();
    });
  });
});

describe("Correlation Prompts", () => {
  it("builds basic correlation prompt", () => {
    const prompt = buildCorrelationPrompt({
      tickers: ["AAPL", "MSFT", "GOOGL"],
    });
    expect(prompt).toContain("AAPL, MSFT, GOOGL");
    expect(prompt).toContain("cross-asset correlations");
  });

  it("includes optional data in prompt", () => {
    const prompt = buildCorrelationPrompt({
      tickers: ["SPY", "TLT"],
      priceData: "SPY: +1.2%, TLT: -0.8%",
      timeframe: "30d",
      marketContext: "Fed rate decision tomorrow",
    });
    expect(prompt).toContain("SPY: +1.2%");
    expect(prompt).toContain("30d");
    expect(prompt).toContain("Fed rate decision");
  });

  it("builds portfolio correlation prompt with weights", () => {
    const prompt = buildPortfolioCorrelationPrompt({
      positions: [
        { ticker: "AAPL", weight: 0.3 },
        { ticker: "MSFT", weight: 0.25 },
      ],
      regime: "trending_up",
    });
    expect(prompt).toContain("AAPL: 30.0%");
    expect(prompt).toContain("MSFT: 25.0%");
    expect(prompt).toContain("trending_up");
  });

  it("builds correlation shift prompt", () => {
    const prompt = buildCorrelationShiftPrompt({
      tickers: ["SPY", "GLD"],
      historicalCorrelation: "SPY-GLD: 0.1 (30d), -0.3 (90d)",
      recentEvents: "Banking stress",
    });
    expect(prompt).toContain("regime shifts");
    expect(prompt).toContain("Banking stress");
  });
});
