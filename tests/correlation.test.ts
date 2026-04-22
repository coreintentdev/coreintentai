import { describe, it, expect } from "vitest";
import { CorrelationAnalysisSchema, CorrelationRelationship } from "../src/types/index.js";
import {
  buildCorrelationPrompt,
  buildDivergencePrompt,
  buildPortfolioCorrelationPrompt,
} from "../src/capabilities/correlation/prompts.js";

const VALID_CORRELATION = {
  pairs: [
    {
      tickerA: "SPY",
      tickerB: "QQQ",
      correlation: 0.92,
      rollingPeriod: "30d",
      historicalAverage: 0.88,
      deviation: 0.04,
      relationship: "positive",
      significance: 0.95,
    },
    {
      tickerA: "SPY",
      tickerB: "TLT",
      correlation: -0.45,
      rollingPeriod: "30d",
      historicalAverage: -0.3,
      deviation: -0.15,
      relationship: "negative",
      significance: 0.82,
    },
    {
      tickerA: "GLD",
      tickerB: "DXY",
      correlation: -0.68,
      rollingPeriod: "30d",
      historicalAverage: -0.55,
      deviation: -0.13,
      relationship: "divergent",
      significance: 0.78,
    },
  ],
  clusters: [
    {
      name: "Tech/Growth Basket",
      tickers: ["SPY", "QQQ", "AAPL"],
      avgIntraCorrelation: 0.88,
      riskImplication: "High concentration risk — these move as a unit in sell-offs.",
    },
  ],
  divergences: [
    {
      tickerA: "GLD",
      tickerB: "DXY",
      expectedRelationship: "Moderate negative correlation (-0.55)",
      currentRelationship: "Strong negative correlation (-0.68)",
      divergenceMagnitude: 0.4,
      tradingImplication: "Gold is overshooting the dollar weakness — potential mean reversion trade.",
      confidence: 0.72,
    },
  ],
  regimeContext: "Risk-on environment with declining correlations across safe havens.",
  summary: "SPY/QQQ correlation remains tight. GLD/DXY divergence flagged as potential mean reversion opportunity.",
  timestamp: "2026-04-22T12:00:00.000Z",
};

describe("CorrelationAnalysis Schema", () => {
  it("validates a complete correlation analysis", () => {
    const result = CorrelationAnalysisSchema.safeParse(VALID_CORRELATION);
    expect(result.success).toBe(true);
  });

  it("accepts all relationship types", () => {
    const relationships = [
      "positive", "negative", "leading", "lagging", "coincident", "divergent",
    ];
    for (const rel of relationships) {
      const result = CorrelationRelationship.safeParse(rel);
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid relationship type", () => {
    const result = CorrelationRelationship.safeParse("correlated");
    expect(result.success).toBe(false);
  });

  it("rejects correlation out of range", () => {
    const data = {
      ...VALID_CORRELATION,
      pairs: [
        { ...VALID_CORRELATION.pairs[0], correlation: 1.5 },
      ],
    };
    const result = CorrelationAnalysisSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects negative correlation below -1", () => {
    const data = {
      ...VALID_CORRELATION,
      pairs: [
        { ...VALID_CORRELATION.pairs[0], correlation: -1.1 },
      ],
    };
    const result = CorrelationAnalysisSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects significance out of range", () => {
    const data = {
      ...VALID_CORRELATION,
      pairs: [
        { ...VALID_CORRELATION.pairs[0], significance: 1.5 },
      ],
    };
    const result = CorrelationAnalysisSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects divergence confidence out of range", () => {
    const data = {
      ...VALID_CORRELATION,
      divergences: [
        { ...VALID_CORRELATION.divergences[0], confidence: -0.1 },
      ],
    };
    const result = CorrelationAnalysisSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("allows empty pairs and divergences", () => {
    const data = {
      ...VALID_CORRELATION,
      pairs: [],
      clusters: [],
      divergences: [],
    };
    const result = CorrelationAnalysisSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("validates cluster avgIntraCorrelation range", () => {
    const data = {
      ...VALID_CORRELATION,
      clusters: [
        { ...VALID_CORRELATION.clusters[0], avgIntraCorrelation: 1.5 },
      ],
    };
    const result = CorrelationAnalysisSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe("Correlation Prompts", () => {
  it("builds basic correlation prompt", () => {
    const prompt = buildCorrelationPrompt({ tickers: ["SPY", "QQQ", "TLT"] });
    expect(prompt).toContain("SPY");
    expect(prompt).toContain("QQQ");
    expect(prompt).toContain("TLT");
    expect(prompt).toContain("timestamp");
  });

  it("includes period when specified", () => {
    const prompt = buildCorrelationPrompt({
      tickers: ["SPY", "QQQ"],
      period: "90d",
    });
    expect(prompt).toContain("90d");
  });

  it("includes focus on divergences", () => {
    const prompt = buildCorrelationPrompt({
      tickers: ["SPY", "TLT"],
      focusOn: "divergences",
    });
    expect(prompt).toContain("divergence");
  });

  it("includes focus on clusters", () => {
    const prompt = buildCorrelationPrompt({
      tickers: ["SPY", "QQQ"],
      focusOn: "clusters",
    });
    expect(prompt).toContain("cluster");
  });

  it("includes price data", () => {
    const prompt = buildCorrelationPrompt({
      tickers: ["SPY"],
      priceData: "SPY: 520, 518, 522",
    });
    expect(prompt).toContain("520, 518, 522");
  });

  it("builds divergence prompt with all fields", () => {
    const prompt = buildDivergencePrompt({
      tickerA: "GLD",
      tickerB: "DXY",
      historicalCorrelation: -0.55,
      currentCorrelation: -0.85,
      priceDataA: "GLD: 2050, 2080, 2100",
      priceDataB: "DXY: 104, 103, 101",
      context: "Fed dovish pivot",
    });
    expect(prompt).toContain("GLD");
    expect(prompt).toContain("DXY");
    expect(prompt).toContain("-0.550");
    expect(prompt).toContain("-0.850");
    expect(prompt).toContain("0.300");
    expect(prompt).toContain("Fed dovish pivot");
  });

  it("builds portfolio correlation prompt", () => {
    const prompt = buildPortfolioCorrelationPrompt({
      positions: [
        { ticker: "AAPL", weight: 0.25, sector: "Technology" },
        { ticker: "JPM", weight: 0.15, sector: "Financials" },
      ],
      riskBudget: 10,
    });
    expect(prompt).toContain("AAPL");
    expect(prompt).toContain("25.0%");
    expect(prompt).toContain("Technology");
    expect(prompt).toContain("10%");
  });

  it("builds portfolio prompt with correlation matrix", () => {
    const prompt = buildPortfolioCorrelationPrompt({
      positions: [{ ticker: "SPY", weight: 0.5 }],
      correlationMatrix: "SPY/QQQ: 0.92",
    });
    expect(prompt).toContain("SPY/QQQ: 0.92");
  });
});
