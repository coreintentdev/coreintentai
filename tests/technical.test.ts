import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  TechnicalAnalysisSchema,
  TrendPhase,
  PatternType,
  SRStrength,
  SRType,
  DivergenceType,
} from "../src/types/index.js";
import {
  TECHNICAL_SYSTEM_PROMPT,
  buildTechnicalAnalysisPrompt,
  buildMultiTimeframePrompt,
  buildSupportResistancePrompt,
  buildPatternScanPrompt,
  buildTechnicalReviewPrompt,
} from "../src/capabilities/technical/prompts.js";

// ---------------------------------------------------------------------------
// Schema Validation
// ---------------------------------------------------------------------------

describe("Technical Analysis Schema", () => {
  const validAnalysis = {
    ticker: "AAPL",
    timeframe: "daily",
    trend: {
      direction: "bullish",
      strength: 0.75,
      phase: "impulse",
      higherTimeframeBias: "bullish",
      description: "Strong uptrend with EMA alignment",
    },
    patterns: [
      {
        name: "Bull Flag",
        type: "continuation",
        timeframe: "daily",
        completionPct: 85,
        projectedTarget: 195.0,
        reliability: 0.7,
        description: "Bull flag forming after breakout",
      },
    ],
    indicators: [
      {
        name: "RSI (14)",
        value: "62.3",
        signal: "bullish",
        strength: 0.65,
        divergence: "none",
      },
      {
        name: "MACD",
        value: "Histogram positive and rising",
        signal: "bullish",
        strength: 0.8,
        divergence: "none",
      },
      {
        name: "Bollinger Bands",
        value: "%B = 0.78",
        signal: "neutral",
        strength: 0.5,
        divergence: "none",
      },
    ],
    supportResistance: {
      supports: [
        {
          price: 180.0,
          strength: "strong",
          type: "horizontal",
          touchCount: 3,
          description: "Prior breakout level, triple-tested",
        },
      ],
      resistances: [
        {
          price: 195.0,
          strength: "moderate",
          type: "fibonacci",
          touchCount: 1,
          description: "1.618 Fibonacci extension",
        },
      ],
      keyLevel: 180.0,
      keyLevelDescription: "Critical support — breakdown below invalidates bullish thesis",
    },
    volumeAnalysis: {
      trend: "increasing",
      priceVolumeRelationship: "confirming",
      notableActivity: "Above-average volume on breakout candle",
      vwapPosition: "above",
    },
    scenarios: {
      bullCase: {
        trigger: "Break above 192 with volume",
        target: 205.0,
        probability: 0.45,
        invalidation: "Close below 180",
      },
      bearCase: {
        trigger: "Rejection at 192 and break of flag support",
        target: 170.0,
        probability: 0.2,
        invalidation: "Hold above 185 for 3 sessions",
      },
      baseCase: {
        description: "Consolidation between 182-192",
        range: { low: 182, high: 192 },
        probability: 0.35,
      },
    },
    overallBias: "bullish",
    confidence: 0.72,
    timeframeConflicts: [],
    summary: "AAPL in a strong daily uptrend with bull flag formation. Volume confirms momentum.",
    timestamp: new Date().toISOString(),
  };

  it("validates a complete technical analysis", () => {
    const result = TechnicalAnalysisSchema.safeParse(validAnalysis);
    expect(result.success).toBe(true);
  });

  it("validates all trend phases", () => {
    for (const phase of ["impulse", "correction", "consolidation", "reversal", "breakout"]) {
      const analysis = {
        ...validAnalysis,
        trend: { ...validAnalysis.trend, phase },
      };
      expect(TechnicalAnalysisSchema.safeParse(analysis).success).toBe(true);
    }
  });

  it("validates all pattern types", () => {
    for (const type of ["continuation", "reversal", "bilateral"]) {
      const analysis = {
        ...validAnalysis,
        patterns: [{ ...validAnalysis.patterns[0], type }],
      };
      expect(TechnicalAnalysisSchema.safeParse(analysis).success).toBe(true);
    }
  });

  it("validates all S/R strength levels", () => {
    for (const strength of ["weak", "moderate", "strong", "major"]) {
      const analysis = {
        ...validAnalysis,
        supportResistance: {
          ...validAnalysis.supportResistance,
          supports: [{ ...validAnalysis.supportResistance.supports[0], strength }],
        },
      };
      expect(TechnicalAnalysisSchema.safeParse(analysis).success).toBe(true);
    }
  });

  it("validates all S/R types", () => {
    for (const type of ["horizontal", "dynamic", "volume", "fibonacci"]) {
      const analysis = {
        ...validAnalysis,
        supportResistance: {
          ...validAnalysis.supportResistance,
          supports: [{ ...validAnalysis.supportResistance.supports[0], type }],
        },
      };
      expect(TechnicalAnalysisSchema.safeParse(analysis).success).toBe(true);
    }
  });

  it("validates all divergence types", () => {
    for (const div of ["none", "bullish_regular", "bearish_regular", "bullish_hidden", "bearish_hidden"]) {
      const analysis = {
        ...validAnalysis,
        indicators: [{ ...validAnalysis.indicators[0], divergence: div }],
      };
      expect(TechnicalAnalysisSchema.safeParse(analysis).success).toBe(true);
    }
  });

  it("validates all bias levels", () => {
    for (const bias of [
      "strongly_bullish", "bullish", "slightly_bullish", "neutral",
      "slightly_bearish", "bearish", "strongly_bearish",
    ]) {
      const analysis = { ...validAnalysis, overallBias: bias };
      expect(TechnicalAnalysisSchema.safeParse(analysis).success).toBe(true);
    }
  });

  it("validates all volume trends", () => {
    for (const trend of ["increasing", "decreasing", "stable"]) {
      const analysis = {
        ...validAnalysis,
        volumeAnalysis: { ...validAnalysis.volumeAnalysis, trend },
      };
      expect(TechnicalAnalysisSchema.safeParse(analysis).success).toBe(true);
    }
  });

  it("validates VWAP positions", () => {
    for (const pos of ["above", "below", "at"]) {
      const analysis = {
        ...validAnalysis,
        volumeAnalysis: { ...validAnalysis.volumeAnalysis, vwapPosition: pos },
      };
      expect(TechnicalAnalysisSchema.safeParse(analysis).success).toBe(true);
    }
  });

  it("rejects invalid confidence values", () => {
    expect(
      TechnicalAnalysisSchema.safeParse({ ...validAnalysis, confidence: 1.5 }).success
    ).toBe(false);
    expect(
      TechnicalAnalysisSchema.safeParse({ ...validAnalysis, confidence: -0.1 }).success
    ).toBe(false);
  });

  it("rejects invalid trend strength", () => {
    const analysis = {
      ...validAnalysis,
      trend: { ...validAnalysis.trend, strength: 2.0 },
    };
    expect(TechnicalAnalysisSchema.safeParse(analysis).success).toBe(false);
  });

  it("rejects invalid pattern completion percentage", () => {
    const analysis = {
      ...validAnalysis,
      patterns: [{ ...validAnalysis.patterns[0], completionPct: 150 }],
    };
    expect(TechnicalAnalysisSchema.safeParse(analysis).success).toBe(false);
  });

  it("rejects invalid scenario probability", () => {
    const analysis = {
      ...validAnalysis,
      scenarios: {
        ...validAnalysis.scenarios,
        bullCase: { ...validAnalysis.scenarios.bullCase, probability: 1.5 },
      },
    };
    expect(TechnicalAnalysisSchema.safeParse(analysis).success).toBe(false);
  });

  it("allows patterns with no projectedTarget", () => {
    const analysis = {
      ...validAnalysis,
      patterns: [
        {
          name: "Doji Star",
          type: "reversal" as const,
          timeframe: "daily",
          completionPct: 100,
          reliability: 0.5,
          description: "Indecision at resistance",
        },
      ],
    };
    expect(TechnicalAnalysisSchema.safeParse(analysis).success).toBe(true);
  });

  it("validates empty patterns and indicators arrays", () => {
    const analysis = {
      ...validAnalysis,
      patterns: [],
      indicators: [],
      timeframeConflicts: [],
    };
    expect(TechnicalAnalysisSchema.safeParse(analysis).success).toBe(true);
  });

  it("validates timeframe conflicts", () => {
    const analysis = {
      ...validAnalysis,
      timeframeConflicts: [
        "Daily bullish but weekly showing bearish divergence",
        "4H overbought while daily still mid-range",
      ],
    };
    expect(TechnicalAnalysisSchema.safeParse(analysis).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Enum Schemas
// ---------------------------------------------------------------------------

describe("Technical Analysis Enum Schemas", () => {
  it("TrendPhase has all 5 phases", () => {
    const phases = TrendPhase.options;
    expect(phases).toHaveLength(5);
    expect(phases).toContain("impulse");
    expect(phases).toContain("breakout");
  });

  it("PatternType has 3 types", () => {
    expect(PatternType.options).toHaveLength(3);
  });

  it("SRStrength has 4 levels", () => {
    expect(SRStrength.options).toHaveLength(4);
  });

  it("SRType has 4 types", () => {
    expect(SRType.options).toHaveLength(4);
  });

  it("DivergenceType has 5 types", () => {
    expect(DivergenceType.options).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// Prompt Builders
// ---------------------------------------------------------------------------

describe("Technical Analysis Prompts", () => {
  it("system prompt covers all key technical concepts", () => {
    expect(TECHNICAL_SYSTEM_PROMPT).toContain("EMA");
    expect(TECHNICAL_SYSTEM_PROMPT).toContain("RSI");
    expect(TECHNICAL_SYSTEM_PROMPT).toContain("MACD");
    expect(TECHNICAL_SYSTEM_PROMPT).toContain("Bollinger");
    expect(TECHNICAL_SYSTEM_PROMPT).toContain("Fibonacci");
    expect(TECHNICAL_SYSTEM_PROMPT).toContain("VWAP");
    expect(TECHNICAL_SYSTEM_PROMPT).toContain("Head & shoulders");
    expect(TECHNICAL_SYSTEM_PROMPT).toContain("Confluence");
    expect(TECHNICAL_SYSTEM_PROMPT).toContain("MULTI-TIMEFRAME");
  });

  it("builds a basic analysis prompt", () => {
    const prompt = buildTechnicalAnalysisPrompt({
      ticker: "AAPL",
      currentPrice: 185.5,
      timeframe: "daily",
    });
    expect(prompt).toContain("AAPL");
    expect(prompt).toContain("$185.5");
    expect(prompt).toContain("daily");
  });

  it("includes optional data in analysis prompt", () => {
    const prompt = buildTechnicalAnalysisPrompt({
      ticker: "TSLA",
      currentPrice: 250,
      timeframe: "4h",
      priceData: "OHLCV data here",
      volumeData: "Volume profile data",
      indicators: "RSI: 65, MACD: positive",
      chartPatterns: "Bull flag detected",
      marketContext: "Fed meeting tomorrow",
    });
    expect(prompt).toContain("OHLCV data here");
    expect(prompt).toContain("Volume profile data");
    expect(prompt).toContain("RSI: 65");
    expect(prompt).toContain("Bull flag detected");
    expect(prompt).toContain("Fed meeting tomorrow");
  });

  it("builds a multi-timeframe prompt", () => {
    const prompt = buildMultiTimeframePrompt({
      ticker: "MSFT",
      currentPrice: 420,
      timeframes: [
        { timeframe: "weekly", priceData: "weekly OHLCV" },
        { timeframe: "daily", priceData: "daily OHLCV", indicators: "RSI: 55" },
        { timeframe: "4h", indicators: "MACD crossover" },
      ],
    });
    expect(prompt).toContain("MSFT");
    expect(prompt).toContain("WEEKLY");
    expect(prompt).toContain("DAILY");
    expect(prompt).toContain("4H");
    expect(prompt).toContain("timeframe conflicts");
  });

  it("builds a support/resistance prompt", () => {
    const prompt = buildSupportResistancePrompt({
      ticker: "NVDA",
      currentPrice: 800,
      priceData: "swing point data",
      volumeProfile: "POC at 780",
    });
    expect(prompt).toContain("NVDA");
    expect(prompt).toContain("swing point data");
    expect(prompt).toContain("POC at 780");
    expect(prompt).toContain("confluence");
  });

  it("builds support/resistance prompt without volume profile", () => {
    const prompt = buildSupportResistancePrompt({
      ticker: "NVDA",
      currentPrice: 800,
      priceData: "price data",
    });
    expect(prompt).not.toContain("Volume Profile");
  });

  it("builds a pattern scan prompt with defaults", () => {
    const prompt = buildPatternScanPrompt({
      ticker: "SPY",
      currentPrice: 500,
      priceData: "candle data",
    });
    expect(prompt).toContain("classical");
    expect(prompt).toContain("candlestick");
    expect(prompt).toContain("harmonic");
  });

  it("builds a pattern scan prompt with specific types", () => {
    const prompt = buildPatternScanPrompt({
      ticker: "SPY",
      currentPrice: 500,
      priceData: "candle data",
      patternTypes: ["classical"],
    });
    expect(prompt).toContain("classical");
    expect(prompt).not.toContain("harmonic");
  });

  it("builds a review prompt", () => {
    const prompt = buildTechnicalReviewPrompt({
      analysis: '{"ticker": "AAPL", "bias": "bullish"}',
    });
    expect(prompt).toContain("Review this technical analysis");
    expect(prompt).toContain("AAPL");
  });

  it("includes additional data in review prompt", () => {
    const prompt = buildTechnicalReviewPrompt({
      analysis: "{}",
      additionalData: "New earnings data",
    });
    expect(prompt).toContain("New earnings data");
  });
});
