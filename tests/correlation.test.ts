import { describe, it, expect } from "vitest";
import {
  CorrelationResultSchema,
  CorrelationPairSchema,
  CorrelationStrength,
} from "../src/types/index.js";
import {
  buildCorrelationPrompt,
  buildRegimeCorrelationPrompt,
  buildDiversificationPrompt,
  buildContagionPrompt,
} from "../src/capabilities/correlation/prompts.js";

describe("CorrelationResultSchema", () => {
  const validResult = {
    assets: ["AAPL", "MSFT", "GOOGL"],
    pairs: [
      {
        asset1: "AAPL",
        asset2: "MSFT",
        correlation: 0.85,
        relationship: "strong_positive",
        stability: "stable",
        regimeSensitivity: "Correlation increases during tech selloffs",
      },
      {
        asset1: "AAPL",
        asset2: "GOOGL",
        correlation: 0.72,
        relationship: "strong_positive",
        stability: "shifting",
        regimeSensitivity: "Moderate regime dependency",
      },
      {
        asset1: "MSFT",
        asset2: "GOOGL",
        correlation: 0.68,
        relationship: "moderate_positive",
        stability: "stable",
        regimeSensitivity: "Low sensitivity",
      },
    ],
    regimeContext: {
      currentRegime: "trending_up",
      regimeSensitivity: "moderate",
      historicalShifts: "Correlations spiked to 0.95+ during 2020 crash",
    },
    diversificationScore: 35,
    contagionRisk: "moderate",
    portfolioImplications: {
      effectiveDiversification: "Poor — all three are large-cap tech",
      concentrationWarnings: ["Sector concentration: 100% technology"],
      hedgingSuggestions: ["Add bonds (TLT) or commodities (GLD) for true diversification"],
    },
    summary: "High intra-sector correlation with limited diversification benefit.",
    timestamp: new Date().toISOString(),
  };

  it("accepts valid correlation result", () => {
    const result = CorrelationResultSchema.parse(validResult);
    expect(result.assets).toHaveLength(3);
    expect(result.pairs).toHaveLength(3);
    expect(result.diversificationScore).toBe(35);
  });

  it("requires at least 2 assets", () => {
    expect(() =>
      CorrelationResultSchema.parse({ ...validResult, assets: ["AAPL"] })
    ).toThrow();
  });

  it("validates correlation range -1 to 1", () => {
    const invalidPair = {
      ...validResult,
      pairs: [
        {
          asset1: "A",
          asset2: "B",
          correlation: 1.5,
          relationship: "strong_positive",
          stability: "stable",
          regimeSensitivity: "None",
        },
      ],
    };
    expect(() => CorrelationResultSchema.parse(invalidPair)).toThrow();
  });

  it("validates diversification score 0-100", () => {
    expect(() =>
      CorrelationResultSchema.parse({ ...validResult, diversificationScore: 150 })
    ).toThrow();
  });

  it("accepts result without optional fields", () => {
    const minimal = {
      assets: ["AAPL", "GLD"],
      pairs: [
        {
          asset1: "AAPL",
          asset2: "GLD",
          correlation: -0.2,
          relationship: "weak",
          stability: "unstable",
          regimeSensitivity: "High",
        },
      ],
      portfolioImplications: {
        effectiveDiversification: "Good",
        concentrationWarnings: [],
        hedgingSuggestions: [],
      },
      summary: "Low correlation provides diversification.",
      timestamp: new Date().toISOString(),
    };
    const result = CorrelationResultSchema.parse(minimal);
    expect(result.regimeContext).toBeUndefined();
    expect(result.diversificationScore).toBeUndefined();
    expect(result.contagionRisk).toBeUndefined();
  });

  it("validates all correlation strength values", () => {
    const values = [
      "strong_positive",
      "moderate_positive",
      "weak",
      "moderate_negative",
      "strong_negative",
    ];
    for (const v of values) {
      expect(CorrelationStrength.parse(v)).toBe(v);
    }
  });

  it("rejects invalid correlation strength", () => {
    expect(() => CorrelationStrength.parse("very_strong")).toThrow();
  });

  it("validates all contagion risk levels", () => {
    for (const level of ["low", "moderate", "elevated", "high"]) {
      const result = CorrelationResultSchema.parse({
        ...validResult,
        contagionRisk: level,
      });
      expect(result.contagionRisk).toBe(level);
    }
  });

  it("validates all stability values", () => {
    for (const stability of ["stable", "shifting", "unstable"]) {
      const pair = CorrelationPairSchema.parse({
        asset1: "A",
        asset2: "B",
        correlation: 0.5,
        relationship: "moderate_positive",
        stability,
        regimeSensitivity: "Test",
      });
      expect(pair.stability).toBe(stability);
    }
  });
});

describe("Correlation Prompts", () => {
  it("buildCorrelationPrompt includes all assets", () => {
    const prompt = buildCorrelationPrompt({
      assets: ["AAPL", "MSFT", "TSLA"],
    });
    expect(prompt).toContain("AAPL");
    expect(prompt).toContain("MSFT");
    expect(prompt).toContain("TSLA");
    expect(prompt).toContain("timestamp");
  });

  it("buildCorrelationPrompt includes price data when provided", () => {
    const prompt = buildCorrelationPrompt({
      assets: ["AAPL", "GLD"],
      priceData: "AAPL: 180.50, GLD: 2050.00",
    });
    expect(prompt).toContain("AAPL: 180.50");
  });

  it("buildCorrelationPrompt includes market context", () => {
    const prompt = buildCorrelationPrompt({
      assets: ["SPY", "TLT"],
      marketContext: "Fed rate decision upcoming",
    });
    expect(prompt).toContain("Fed rate decision");
  });

  it("buildRegimeCorrelationPrompt includes regime info", () => {
    const prompt = buildRegimeCorrelationPrompt({
      assets: ["SPY", "VIX"],
      currentRegime: "volatile_expansion",
      stressScenarios: ["Flash crash", "Liquidity crisis"],
    });
    expect(prompt).toContain("volatile_expansion");
    expect(prompt).toContain("Flash crash");
    expect(prompt).toContain("Liquidity crisis");
  });

  it("buildDiversificationPrompt formats portfolio correctly", () => {
    const prompt = buildDiversificationPrompt({
      portfolio: [
        { ticker: "AAPL", weight: 0.4 },
        { ticker: "MSFT", weight: 0.3 },
        { ticker: "GLD", weight: 0.3 },
      ],
    });
    expect(prompt).toContain("AAPL: 40.0%");
    expect(prompt).toContain("MSFT: 30.0%");
    expect(prompt).toContain("GLD: 30.0%");
    expect(prompt).toContain("diversificationScore");
  });

  it("buildContagionPrompt includes all parameters", () => {
    const prompt = buildContagionPrompt({
      sourceAsset: "SVB",
      targetAssets: ["JPM", "BAC", "WFC"],
      scenario: "Regional bank failure spreading to money center banks",
    });
    expect(prompt).toContain("SVB");
    expect(prompt).toContain("JPM");
    expect(prompt).toContain("Regional bank failure");
    expect(prompt).toContain("contagionRisk");
  });
});
