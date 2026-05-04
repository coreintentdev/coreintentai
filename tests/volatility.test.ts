import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  VolSurfaceRegime,
  SkewType,
  VolatilitySignal,
  VolatilityAnalysisSchema,
  VolSurfaceSnapshotSchema,
} from "../src/types/index.js";
import {
  buildVolatilityAnalysisPrompt,
  buildVolSurfacePrompt,
  buildSkewAnalysisPrompt,
  VOLATILITY_SYSTEM_PROMPT,
} from "../src/capabilities/volatility/prompts.js";
import { VolatilityIntelligence } from "../src/capabilities/volatility/index.js";
import { Orchestrator } from "../src/orchestrator/index.js";

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

describe("Volatility Intelligence — Schemas", () => {
  describe("VolSurfaceRegime enum", () => {
    it.each(["contango", "backwardation", "flat", "inverted", "kinked"])(
      "accepts %s",
      (value) => {
        expect(VolSurfaceRegime.parse(value)).toBe(value);
      }
    );

    it("rejects invalid regime", () => {
      expect(VolSurfaceRegime.safeParse("normal").success).toBe(false);
    });
  });

  describe("SkewType enum", () => {
    it.each(["put_skew", "call_skew", "symmetric", "smile"])(
      "accepts %s",
      (value) => {
        expect(SkewType.parse(value)).toBe(value);
      }
    );

    it("rejects invalid skew type", () => {
      expect(SkewType.safeParse("flat").success).toBe(false);
    });
  });

  describe("VolatilitySignal enum", () => {
    it.each([
      "vol_expansion",
      "vol_crush",
      "mean_reverting",
      "trending_higher",
      "trending_lower",
      "regime_shift",
    ])("accepts %s", (value) => {
      expect(VolatilitySignal.parse(value)).toBe(value);
    });

    it("rejects invalid signal", () => {
      expect(VolatilitySignal.safeParse("stable").success).toBe(false);
    });
  });

  describe("VolatilityAnalysisSchema", () => {
    const validAnalysis = {
      ticker: "AAPL",
      impliedVolatility: 28.5,
      historicalVolatility: 22.3,
      ivRank: 72,
      ivPercentile: 80,
      ivHvSpread: 6.2,
      termStructure: {
        regime: "contango",
        frontMonth: 27.0,
        secondMonth: 29.5,
        thirdMonth: 31.0,
        slope: 0.15,
        signal: "Normal term structure, no near-term fear",
      },
      skew: {
        type: "put_skew",
        put25Delta: 32.5,
        atm: 28.5,
        call25Delta: 25.0,
        skewIndex: 7.5,
        signal: "Moderate put skew — normal crash protection demand",
      },
      signal: "mean_reverting",
      unusualActivity: [
        {
          description: "Large block of 200 strike puts purchased",
          significance: "high" as const,
          interpretation: "Institutional hedging before earnings",
        },
      ],
      strategies: [
        {
          name: "Iron Condor",
          rationale: "IV rank >70, sell premium",
          legs: [
            "Sell 185P",
            "Buy 180P",
            "Sell 210C",
            "Buy 215C",
          ],
          maxProfit: "$2.50 per spread",
          maxLoss: "$2.50 per spread",
          breakeven: "$182.50 / $212.50",
          edge: "IV rank 72 — premium overpriced relative to historical",
        },
      ],
      riskMetrics: {
        vegaExposure: "Short vega, benefits from vol crush",
        gammaProfile: "Negative gamma near strikes",
        thetaDecay: "$45/day positive theta",
        volOfVol: 0.85,
      },
      summary:
        "AAPL IV rank at 72 with moderate put skew. Premium is elevated relative to realized vol. High-probability mean reversion trade.",
      timestamp: "2026-05-04T12:00:00.000Z",
    };

    it("accepts a valid volatility analysis", () => {
      const result = VolatilityAnalysisSchema.safeParse(validAnalysis);
      expect(result.success).toBe(true);
    });

    it("enforces non-negative IV", () => {
      const result = VolatilityAnalysisSchema.safeParse({
        ...validAnalysis,
        impliedVolatility: -5,
      });
      expect(result.success).toBe(false);
    });

    it("enforces IV rank 0-100", () => {
      expect(
        VolatilityAnalysisSchema.safeParse({ ...validAnalysis, ivRank: -1 })
          .success
      ).toBe(false);
      expect(
        VolatilityAnalysisSchema.safeParse({ ...validAnalysis, ivRank: 101 })
          .success
      ).toBe(false);
    });

    it("enforces IV percentile 0-100", () => {
      expect(
        VolatilityAnalysisSchema.safeParse({
          ...validAnalysis,
          ivPercentile: 150,
        }).success
      ).toBe(false);
    });

    it("accepts volOfVol as optional", () => {
      const withoutVoV = {
        ...validAnalysis,
        riskMetrics: {
          vegaExposure: "Short vega",
          gammaProfile: "Negative gamma",
          thetaDecay: "$45/day",
        },
      };
      expect(VolatilityAnalysisSchema.safeParse(withoutVoV).success).toBe(
        true
      );
    });

    it("rejects missing required fields", () => {
      const { ticker: _, ...noTicker } = validAnalysis;
      expect(VolatilityAnalysisSchema.safeParse(noTicker).success).toBe(false);
    });
  });

  describe("VolSurfaceSnapshotSchema", () => {
    const validSnapshot = {
      ticker: "SPY",
      surfaceRegime: "kinked",
      atmIv: 18.5,
      skewSteepness: 4.2,
      termSlope: 0.08,
      wingBehavior:
        "Far OTM puts pricing 2x normal tail risk. Call wing flat.",
      eventPricing: [
        {
          event: "FOMC Decision",
          impliedMove: 1.2,
          historicalAvgMove: 0.8,
          premium: 0.4,
        },
      ],
      tradingOpportunities: [
        {
          opportunity: "Sell FOMC straddle — implied move overpriced",
          conviction: 0.7,
          structure: "Short 545 straddle, buy 540P/550C wings",
          risk: "Hawkish surprise could blow through wings",
        },
      ],
      summary: "Vol surface kinked at FOMC expiry. Implied move 50% above historical average.",
      timestamp: "2026-05-04T12:00:00.000Z",
    };

    it("accepts a valid surface snapshot", () => {
      expect(VolSurfaceSnapshotSchema.safeParse(validSnapshot).success).toBe(
        true
      );
    });

    it("enforces non-negative ATM IV", () => {
      expect(
        VolSurfaceSnapshotSchema.safeParse({ ...validSnapshot, atmIv: -1 })
          .success
      ).toBe(false);
    });

    it("enforces conviction 0-1", () => {
      const bad = {
        ...validSnapshot,
        tradingOpportunities: [
          {
            ...validSnapshot.tradingOpportunities[0],
            conviction: 1.5,
          },
        ],
      };
      expect(VolSurfaceSnapshotSchema.safeParse(bad).success).toBe(false);
    });

    it("enforces non-negative implied move on events", () => {
      const bad = {
        ...validSnapshot,
        eventPricing: [
          {
            ...validSnapshot.eventPricing[0],
            impliedMove: -0.5,
          },
        ],
      };
      expect(VolSurfaceSnapshotSchema.safeParse(bad).success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

describe("Volatility Intelligence — Prompts", () => {
  describe("VOLATILITY_SYSTEM_PROMPT", () => {
    it("defines vol surface regimes", () => {
      expect(VOLATILITY_SYSTEM_PROMPT).toContain("contango");
      expect(VOLATILITY_SYSTEM_PROMPT).toContain("backwardation");
      expect(VOLATILITY_SYSTEM_PROMPT).toContain("kinked");
    });

    it("defines skew types", () => {
      expect(VOLATILITY_SYSTEM_PROMPT).toContain("put_skew");
      expect(VOLATILITY_SYSTEM_PROMPT).toContain("call_skew");
      expect(VOLATILITY_SYSTEM_PROMPT).toContain("smile");
    });

    it("covers strategy selection logic", () => {
      expect(VOLATILITY_SYSTEM_PROMPT).toContain("IV rank > 70");
      expect(VOLATILITY_SYSTEM_PROMPT).toContain("IV rank < 30");
    });
  });

  describe("buildVolatilityAnalysisPrompt", () => {
    it("includes ticker and price", () => {
      const prompt = buildVolatilityAnalysisPrompt({
        ticker: "TSLA",
        currentPrice: 250,
      });
      expect(prompt).toContain("TSLA");
      expect(prompt).toContain("$250");
    });

    it("includes VIX level when provided", () => {
      const prompt = buildVolatilityAnalysisPrompt({
        ticker: "AAPL",
        currentPrice: 190,
        vixLevel: 22.5,
      });
      expect(prompt).toContain("VIX: 22.5");
    });

    it("includes earnings date when provided", () => {
      const prompt = buildVolatilityAnalysisPrompt({
        ticker: "NVDA",
        currentPrice: 900,
        earningsDate: "2026-05-28",
      });
      expect(prompt).toContain("2026-05-28");
    });

    it("includes all optional data sections", () => {
      const prompt = buildVolatilityAnalysisPrompt({
        ticker: "SPY",
        currentPrice: 545,
        ivData: "IV: 18%",
        historicalVolData: "HV30: 14%",
        optionsData: "Call volume: 2M",
      });
      expect(prompt).toContain("Implied Volatility Data");
      expect(prompt).toContain("Historical Volatility Data");
      expect(prompt).toContain("Options Chain Data");
    });
  });

  describe("buildVolSurfacePrompt", () => {
    it("includes ticker and price", () => {
      const prompt = buildVolSurfacePrompt({
        ticker: "AMZN",
        currentPrice: 185,
      });
      expect(prompt).toContain("AMZN");
      expect(prompt).toContain("$185");
    });

    it("includes optional data sections", () => {
      const prompt = buildVolSurfacePrompt({
        ticker: "MSFT",
        currentPrice: 420,
        surfaceData: "25D put: 22%",
        upcomingEvents: "Earnings May 10",
      });
      expect(prompt).toContain("Vol Surface Data");
      expect(prompt).toContain("Upcoming Events");
    });
  });

  describe("buildSkewAnalysisPrompt", () => {
    it("includes ticker and requests skew analysis", () => {
      const prompt = buildSkewAnalysisPrompt({
        ticker: "META",
        currentPrice: 510,
      });
      expect(prompt).toContain("META");
      expect(prompt).toContain("skew");
    });

    it("includes historical skew when provided", () => {
      const prompt = buildSkewAnalysisPrompt({
        ticker: "GOOG",
        currentPrice: 175,
        historicalSkew: "90-day avg skew: 5.2",
      });
      expect(prompt).toContain("Historical Skew Data");
    });
  });
});

// ---------------------------------------------------------------------------
// VolatilityIntelligence class
// ---------------------------------------------------------------------------

describe("VolatilityIntelligence — Class", () => {
  let mockOrchestrator: Orchestrator;

  beforeEach(() => {
    mockOrchestrator = new Orchestrator();
  });

  it("constructs with default orchestrator", () => {
    const vol = new VolatilityIntelligence();
    expect(vol).toBeInstanceOf(VolatilityIntelligence);
  });

  it("constructs with provided orchestrator", () => {
    const vol = new VolatilityIntelligence(mockOrchestrator);
    expect(vol).toBeInstanceOf(VolatilityIntelligence);
  });

  it("exposes all expected methods", () => {
    const vol = new VolatilityIntelligence(mockOrchestrator);
    expect(typeof vol.analyze).toBe("function");
    expect(typeof vol.surface).toBe("function");
    expect(typeof vol.analyzeSkew).toBe("function");
    expect(typeof vol.consensus).toBe("function");
    expect(typeof vol.tieredAnalysis).toBe("function");
  });
});
