import { describe, it, expect } from "vitest";
import {
  AnomalySchema,
  AnomalyScanResultSchema,
  AnomalyType,
  AnomalySeverity,
} from "../src/types/index.js";
import {
  buildAnomalyScanPrompt,
  buildMultiAssetAnomalyScanPrompt,
  buildAnomalyContextPrompt,
} from "../src/capabilities/anomaly/prompts.js";

describe("Anomaly Types", () => {
  describe("AnomalySchema", () => {
    const validAnomaly = {
      ticker: "NVDA",
      anomalyType: "volume_spike",
      severity: "high",
      confidence: 0.92,
      description: "Volume 4.2x 20-day average with no news catalyst",
      evidence: [
        {
          metric: "Volume",
          observed: "84M shares",
          expected: "20M shares (20-day avg)",
          deviationSigma: 3.8,
        },
      ],
      historicalPrecedent: "Similar spike preceded 12% rally in Q3 2024",
      tradingImplication: "bullish" as const,
      urgency: "prepare" as const,
      suggestedActions: ["Tighten stops on short positions", "Watch for breakout confirmation"],
      timestamp: new Date().toISOString(),
    };

    it("validates a complete anomaly", () => {
      expect(AnomalySchema.parse(validAnomaly)).toEqual(validAnomaly);
    });

    it("validates all anomaly types", () => {
      const types = [
        "volume_spike",
        "price_gap",
        "volatility_regime_shift",
        "correlation_break",
        "momentum_divergence",
        "liquidity_vacuum",
        "unusual_options_activity",
        "breadth_divergence",
      ];

      for (const type of types) {
        expect(() => AnomalyType.parse(type)).not.toThrow();
      }
    });

    it("validates all severity levels", () => {
      for (const s of ["low", "medium", "high", "critical"]) {
        expect(() => AnomalySeverity.parse(s)).not.toThrow();
      }
    });

    it("rejects invalid trading implications", () => {
      expect(() =>
        AnomalySchema.parse({
          ...validAnomaly,
          tradingImplication: "moon",
        })
      ).toThrow();
    });

    it("allows optional historical precedent", () => {
      const { historicalPrecedent, ...noHistory } = validAnomaly;
      expect(AnomalySchema.parse(noHistory)).toBeDefined();
    });

    it("validates evidence structure", () => {
      expect(() =>
        AnomalySchema.parse({
          ...validAnomaly,
          evidence: [{ metric: "Vol", observed: "high" }],
        })
      ).toThrow();
    });
  });

  describe("AnomalyScanResultSchema", () => {
    it("validates a scan with anomalies", () => {
      const scan = {
        ticker: "NVDA",
        anomalies: [
          {
            ticker: "NVDA",
            anomalyType: "volume_spike",
            severity: "high",
            confidence: 0.9,
            description: "Unusual volume",
            evidence: [
              {
                metric: "Volume",
                observed: "80M",
                expected: "20M",
                deviationSigma: 3.5,
              },
            ],
            tradingImplication: "bullish",
            urgency: "prepare",
            suggestedActions: ["Watch closely"],
            timestamp: new Date().toISOString(),
          },
        ],
        overallAlertLevel: "high",
        marketCondition: "Elevated activity in semiconductors",
        summary: "NVDA showing significant volume anomaly",
        timestamp: new Date().toISOString(),
      };
      expect(AnomalyScanResultSchema.parse(scan)).toBeDefined();
    });

    it("validates a clean scan with no anomalies", () => {
      const scan = {
        ticker: "SPY",
        anomalies: [],
        overallAlertLevel: "low",
        marketCondition: "Normal trading conditions",
        summary: "No anomalies detected",
        timestamp: new Date().toISOString(),
      };
      expect(AnomalyScanResultSchema.parse(scan)).toBeDefined();
    });
  });
});

describe("Anomaly Prompts", () => {
  it("builds a basic anomaly scan prompt", () => {
    const prompt = buildAnomalyScanPrompt({
      ticker: "NVDA",
      currentPrice: 850,
    });
    expect(prompt).toContain("NVDA");
    expect(prompt).toContain("$850");
    expect(prompt).toContain("anomalies");
  });

  it("includes all optional data fields", () => {
    const prompt = buildAnomalyScanPrompt({
      ticker: "AAPL",
      currentPrice: 200,
      volumeData: "Vol: 50M",
      priceData: "Gap up 3%",
      volatilityData: "IV: 45%",
      optionsData: "Put/Call: 1.2",
      breadthData: "A/D: 0.8",
    });
    expect(prompt).toContain("Vol: 50M");
    expect(prompt).toContain("Gap up 3%");
    expect(prompt).toContain("IV: 45%");
    expect(prompt).toContain("Put/Call: 1.2");
    expect(prompt).toContain("A/D: 0.8");
  });

  it("builds multi-asset scan prompt", () => {
    const prompt = buildMultiAssetAnomalyScanPrompt({
      tickers: [
        { ticker: "AAPL", currentPrice: 200 },
        { ticker: "MSFT", currentPrice: 400 },
      ],
      marketData: "Sector rotation in progress",
    });
    expect(prompt).toContain("AAPL @ $200");
    expect(prompt).toContain("MSFT @ $400");
    expect(prompt).toContain("Sector rotation");
  });

  it("builds anomaly context prompt", () => {
    const prompt = buildAnomalyContextPrompt({
      anomaly: '{"type":"volume_spike","severity":"high"}',
      historicalData: "Q3 2024: similar spike led to 12% rally",
    });
    expect(prompt).toContain("volume_spike");
    expect(prompt).toContain("Q3 2024");
    expect(prompt).toContain("base rate");
  });
});
