import { describe, it, expect } from "vitest";
import {
  CorrelationPairSchema,
  CorrelationMatrixSchema,
  CorrelationStrength,
} from "../src/types/index.js";
import {
  buildCorrelationPrompt,
  buildCorrelationBreakdownPrompt,
  buildStressCorrelationPrompt,
} from "../src/capabilities/correlation/prompts.js";

describe("CorrelationStrength enum", () => {
  const validStrengths = [
    "strong_positive",
    "moderate_positive",
    "weak_positive",
    "uncorrelated",
    "weak_negative",
    "moderate_negative",
    "strong_negative",
  ];

  it.each(validStrengths)("accepts %s", (strength) => {
    expect(CorrelationStrength.parse(strength)).toBe(strength);
  });

  it("rejects invalid strength", () => {
    expect(() => CorrelationStrength.parse("very_strong")).toThrow();
  });
});

describe("CorrelationPairSchema", () => {
  const validPair = {
    tickerA: "AAPL",
    tickerB: "MSFT",
    correlation: 0.82,
    strength: "strong_positive" as const,
    timeframe: "90 days",
    stability: 0.9,
  };

  it("accepts a valid pair", () => {
    const result = CorrelationPairSchema.safeParse(validPair);
    expect(result.success).toBe(true);
  });

  it("accepts pair with optional lead-lag", () => {
    const result = CorrelationPairSchema.safeParse({
      ...validPair,
      leadLag: {
        leader: "AAPL",
        lagDays: 2,
        confidence: 0.75,
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts pair with optional regime", () => {
    const result = CorrelationPairSchema.safeParse({
      ...validPair,
      regime: "trending_up",
    });
    expect(result.success).toBe(true);
  });

  it("rejects correlation out of range", () => {
    expect(
      CorrelationPairSchema.safeParse({ ...validPair, correlation: 1.5 }).success
    ).toBe(false);
    expect(
      CorrelationPairSchema.safeParse({ ...validPair, correlation: -1.5 }).success
    ).toBe(false);
  });

  it("rejects stability out of range", () => {
    expect(
      CorrelationPairSchema.safeParse({ ...validPair, stability: -0.1 }).success
    ).toBe(false);
    expect(
      CorrelationPairSchema.safeParse({ ...validPair, stability: 1.1 }).success
    ).toBe(false);
  });
});

describe("CorrelationMatrixSchema", () => {
  const now = new Date().toISOString();

  const validMatrix = {
    tickers: ["AAPL", "MSFT", "GOOGL"],
    analysisDate: now,
    timeframe: "90 days",
    pairs: [
      {
        tickerA: "AAPL",
        tickerB: "MSFT",
        correlation: 0.82,
        strength: "strong_positive" as const,
        timeframe: "90 days",
        stability: 0.9,
      },
      {
        tickerA: "AAPL",
        tickerB: "GOOGL",
        correlation: 0.65,
        strength: "moderate_positive" as const,
        timeframe: "90 days",
        stability: 0.75,
      },
      {
        tickerA: "MSFT",
        tickerB: "GOOGL",
        correlation: 0.71,
        strength: "strong_positive" as const,
        timeframe: "90 days",
        stability: 0.85,
      },
    ],
    clusters: [
      {
        name: "Big Tech",
        tickers: ["AAPL", "MSFT", "GOOGL"],
        avgCorrelation: 0.73,
        driver: "Technology sector exposure + mega-cap growth factor",
      },
    ],
    diversificationScore: 0.35,
    hiddenRisks: [
      {
        description: "All three assets share significant exposure to AI capex cycle",
        severity: "high" as const,
        affectedTickers: ["AAPL", "MSFT", "GOOGL"],
      },
    ],
    recommendations: [
      "Add non-tech sector exposure to improve diversification",
      "Consider inverse ETFs as a hedge for the tech cluster",
    ],
    summary: "Portfolio is heavily concentrated in correlated Big Tech assets with poor diversification.",
    timestamp: now,
  };

  it("accepts a valid correlation matrix", () => {
    const result = CorrelationMatrixSchema.safeParse(validMatrix);
    expect(result.success).toBe(true);
  });

  it("rejects diversificationScore out of range", () => {
    expect(
      CorrelationMatrixSchema.safeParse({
        ...validMatrix,
        diversificationScore: 1.5,
      }).success
    ).toBe(false);
  });

  it("rejects invalid hiddenRisk severity", () => {
    expect(
      CorrelationMatrixSchema.safeParse({
        ...validMatrix,
        hiddenRisks: [
          {
            description: "test",
            severity: "extreme",
            affectedTickers: ["AAPL"],
          },
        ],
      }).success
    ).toBe(false);
  });

  it("accepts all valid severity levels", () => {
    for (const severity of ["low", "medium", "high", "critical"]) {
      const result = CorrelationMatrixSchema.safeParse({
        ...validMatrix,
        hiddenRisks: [
          {
            description: "test",
            severity,
            affectedTickers: ["AAPL"],
          },
        ],
      });
      expect(result.success).toBe(true);
    }
  });

  it("requires timestamp as datetime", () => {
    expect(
      CorrelationMatrixSchema.safeParse({
        ...validMatrix,
        timestamp: "not-a-date",
      }).success
    ).toBe(false);
  });
});

describe("Correlation Prompt Builders", () => {
  describe("buildCorrelationPrompt", () => {
    it("includes all tickers", () => {
      const prompt = buildCorrelationPrompt({
        tickers: ["AAPL", "MSFT", "GOOGL"],
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("MSFT");
      expect(prompt).toContain("GOOGL");
    });

    it("uses default 90-day timeframe", () => {
      const prompt = buildCorrelationPrompt({ tickers: ["AAPL", "MSFT"] });
      expect(prompt).toContain("90 days");
    });

    it("respects custom timeframe", () => {
      const prompt = buildCorrelationPrompt({
        tickers: ["AAPL", "MSFT"],
        timeframe: "30 days",
      });
      expect(prompt).toContain("30 days");
    });

    it("includes price data when provided", () => {
      const prompt = buildCorrelationPrompt({
        tickers: ["AAPL"],
        priceData: "AAPL: 185.50, 186.20, 184.90",
      });
      expect(prompt).toContain("Price Data");
      expect(prompt).toContain("185.50");
    });

    it("includes sector data when provided", () => {
      const prompt = buildCorrelationPrompt({
        tickers: ["AAPL"],
        sectorData: "Technology - Consumer Electronics",
      });
      expect(prompt).toContain("Sector/Industry Data");
      expect(prompt).toContain("Consumer Electronics");
    });
  });

  describe("buildCorrelationBreakdownPrompt", () => {
    it("includes both tickers", () => {
      const prompt = buildCorrelationBreakdownPrompt({
        tickerA: "AAPL",
        tickerB: "MSFT",
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("MSFT");
    });

    it("includes historical correlation when provided", () => {
      const prompt = buildCorrelationBreakdownPrompt({
        tickerA: "AAPL",
        tickerB: "MSFT",
        historicalCorrelation: 0.823,
      });
      expect(prompt).toContain("0.823");
    });

    it("includes recent events when provided", () => {
      const prompt = buildCorrelationBreakdownPrompt({
        tickerA: "AAPL",
        tickerB: "MSFT",
        recentEvents: "AAPL reported earnings beat",
      });
      expect(prompt).toContain("AAPL reported earnings beat");
    });
  });

  describe("buildStressCorrelationPrompt", () => {
    it("includes tickers and scenario", () => {
      const prompt = buildStressCorrelationPrompt({
        tickers: ["AAPL", "MSFT", "XOM"],
        stressScenario: "Fed emergency rate hike of 100bps",
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("XOM");
      expect(prompt).toContain("Fed emergency rate hike");
    });

    it("references correlation tightening", () => {
      const prompt = buildStressCorrelationPrompt({
        tickers: ["AAPL"],
        stressScenario: "Black swan event",
      });
      expect(prompt).toContain("correlation tightening");
    });
  });
});
