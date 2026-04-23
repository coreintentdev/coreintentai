import { describe, it, expect } from "vitest";
import {
  AnomalyDetectionSchema,
  AnomalyType,
  AnomalySeverity,
} from "../src/types/index.js";
import {
  buildAnomalyDetectionPrompt,
  buildStressTestPrompt,
  buildBlackSwanScanPrompt,
} from "../src/capabilities/anomaly/prompts.js";

const VALID_ANOMALY: Record<string, unknown> = {
  ticker: "NVDA",
  anomalies: [
    {
      type: "volume_surge",
      severity: "high",
      description: "Volume 4.2x the 20-day average in the first hour of trading.",
      metric: "1H volume vs 20d avg",
      expectedValue: "12M shares",
      actualValue: "50.4M shares",
      deviationSigma: 3.8,
      possibleCauses: [
        "Earnings leak",
        "Large institutional block trade",
        "Options gamma squeeze setup",
      ],
      actionableInsight: "Wait for confirmation. If price follows volume, this is institutional accumulation.",
    },
    {
      type: "volatility_break",
      severity: "medium",
      description: "Implied volatility spiked 35% in 30 minutes without a corresponding move in realized vol.",
      metric: "IV 30d ATM",
      expectedValue: "42%",
      actualValue: "57%",
      deviationSigma: 2.4,
      possibleCauses: [
        "Options market maker repositioning",
        "Event risk pricing (upcoming earnings)",
      ],
      actionableInsight: "IV/RV spread is elevated — potential vol selling opportunity if no event catalyst materializes.",
    },
  ],
  overallAnomalyScore: 68,
  marketStress: 42,
  blackSwanProbability: 0.08,
  recommendations: [
    "Reduce position size in NVDA by 30% until volume anomaly resolves.",
    "Set a trailing stop at 2 ATR below current price.",
    "Monitor options open interest for gamma squeeze risk.",
  ],
  historicalParallels: [
    {
      event: "TSLA pre-earnings volume surge (Jan 2024)",
      date: "2024-01-23",
      similarity: 0.72,
      outcome: "Stock gapped up 8% on earnings beat. Volume anomaly was institutional front-running.",
    },
  ],
  summary: "NVDA showing a significant volume anomaly with elevated IV. Pattern suggests institutional activity ahead of a catalyst. Risk-adjust positions but don't panic.",
  timestamp: "2026-04-22T12:00:00.000Z",
};

describe("AnomalyDetection Schema", () => {
  it("validates a complete anomaly detection result", () => {
    const result = AnomalyDetectionSchema.safeParse(VALID_ANOMALY);
    expect(result.success).toBe(true);
  });

  it("accepts all anomaly types", () => {
    const types = [
      "price_spike", "volume_surge", "volatility_break",
      "correlation_breakdown", "breadth_divergence", "flow_anomaly",
      "pattern_break",
    ];
    for (const t of types) {
      const result = AnomalyType.safeParse(t);
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid anomaly type", () => {
    const result = AnomalyType.safeParse("market_crash");
    expect(result.success).toBe(false);
  });

  it("accepts all severity levels", () => {
    const levels = ["low", "medium", "high", "critical"];
    for (const l of levels) {
      const result = AnomalySeverity.safeParse(l);
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid severity", () => {
    const result = AnomalySeverity.safeParse("extreme");
    expect(result.success).toBe(false);
  });

  it("rejects overallAnomalyScore out of range", () => {
    const data = { ...VALID_ANOMALY, overallAnomalyScore: 150 };
    const result = AnomalyDetectionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects negative overallAnomalyScore", () => {
    const data = { ...VALID_ANOMALY, overallAnomalyScore: -5 };
    const result = AnomalyDetectionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects marketStress out of range", () => {
    const data = { ...VALID_ANOMALY, marketStress: 101 };
    const result = AnomalyDetectionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects blackSwanProbability out of range", () => {
    const data = { ...VALID_ANOMALY, blackSwanProbability: 1.5 };
    const result = AnomalyDetectionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects negative deviationSigma", () => {
    const data = {
      ...VALID_ANOMALY,
      anomalies: [
        { ...(VALID_ANOMALY.anomalies as Array<Record<string, unknown>>)[0], deviationSigma: -1 },
      ],
    };
    const result = AnomalyDetectionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("allows empty anomalies array (no anomalies detected)", () => {
    const data = {
      ...VALID_ANOMALY,
      anomalies: [],
      overallAnomalyScore: 0,
      marketStress: 5,
      blackSwanProbability: 0.01,
    };
    const result = AnomalyDetectionSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("allows empty historical parallels", () => {
    const data = { ...VALID_ANOMALY, historicalParallels: [] };
    const result = AnomalyDetectionSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("validates historical parallel similarity range", () => {
    const data = {
      ...VALID_ANOMALY,
      historicalParallels: [
        {
          event: "Test",
          date: "2024-01-01",
          similarity: 1.5,
          outcome: "Bad",
        },
      ],
    };
    const result = AnomalyDetectionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("accepts MARKET as ticker for broad scans", () => {
    const data = { ...VALID_ANOMALY, ticker: "MARKET" };
    const result = AnomalyDetectionSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe("Anomaly Prompts", () => {
  it("builds basic anomaly prompt with ticker", () => {
    const prompt = buildAnomalyDetectionPrompt({ ticker: "NVDA" });
    expect(prompt).toContain("NVDA");
    expect(prompt).toContain("timestamp");
  });

  it("builds broad market anomaly prompt without ticker", () => {
    const prompt = buildAnomalyDetectionPrompt({});
    expect(prompt).toContain("broad market");
  });

  it("includes all optional data fields", () => {
    const prompt = buildAnomalyDetectionPrompt({
      ticker: "SPY",
      priceData: "520, 518, 525",
      volumeData: "50M, 80M, 120M",
      volatilityData: "VIX: 18, 22, 28",
      optionsFlow: "Large put buying",
      breadthData: "Advance/Decline: 1.2",
      recentNews: "Fed meeting tomorrow",
    });
    expect(prompt).toContain("520, 518, 525");
    expect(prompt).toContain("50M, 80M, 120M");
    expect(prompt).toContain("VIX: 18, 22, 28");
    expect(prompt).toContain("Large put buying");
    expect(prompt).toContain("Advance/Decline: 1.2");
    expect(prompt).toContain("Fed meeting tomorrow");
  });

  it("builds stress test prompt", () => {
    const prompt = buildStressTestPrompt({
      portfolio: [
        { ticker: "SPY", weight: 0.6 },
        { ticker: "TLT", weight: 0.4 },
      ],
      scenario: "2020 COVID Crash",
      currentConditions: "Elevated VIX",
    });
    expect(prompt).toContain("SPY");
    expect(prompt).toContain("60.0%");
    expect(prompt).toContain("2020 COVID Crash");
    expect(prompt).toContain("Elevated VIX");
  });

  it("builds stress test prompt without conditions", () => {
    const prompt = buildStressTestPrompt({
      portfolio: [{ ticker: "AAPL", weight: 1.0 }],
      scenario: "Rate Shock",
    });
    expect(prompt).toContain("AAPL");
    expect(prompt).toContain("Rate Shock");
    expect(prompt).not.toContain("Current Market Conditions");
  });

  it("builds black swan scan prompt", () => {
    const prompt = buildBlackSwanScanPrompt({
      marketData: "S&P at ATH",
      geopoliticalContext: "Taiwan tensions",
      macroIndicators: "Inverted yield curve",
    });
    expect(prompt).toContain("black swan");
    expect(prompt).toContain("S&P at ATH");
    expect(prompt).toContain("Taiwan tensions");
    expect(prompt).toContain("Inverted yield curve");
  });

  it("builds minimal black swan scan prompt", () => {
    const prompt = buildBlackSwanScanPrompt({});
    expect(prompt).toContain("black swan");
    expect(prompt).toContain("MARKET");
  });
});
