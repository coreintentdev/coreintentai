import { describe, it, expect } from "vitest";
import { VolatilityAssessmentSchema, VolRegime, VolSurfaceRegime, SkewProfile } from "../src/types/index.js";
import {
  buildVolatilityPrompt,
  buildVolSurfacePrompt,
  buildVolRegimePrompt,
  buildIvRvSpreadPrompt,
} from "../src/capabilities/volatility/prompts.js";
import { VolatilityAnalyzer } from "../src/capabilities/volatility/index.js";

describe("Volatility Intelligence", () => {
  describe("VolatilityAssessmentSchema", () => {
    const validAssessment = {
      ticker: "AAPL",
      impliedVol: 35.5,
      realizedVol: 28.2,
      ivRank: 72,
      ivPercentile: 68,
      volSpread: 7.3,
      volSpreadZScore: 1.4,
      regime: "elevated",
      surfaceRegime: "contango",
      skewProfile: "normal",
      termStructure: [
        { expiry: "1W", iv: 32.1, daysToExpiry: 7, rollDown: 0.15 },
        { expiry: "1M", iv: 35.5, daysToExpiry: 30, rollDown: 0.08 },
        { expiry: "3M", iv: 38.2, daysToExpiry: 90, rollDown: 0.04 },
      ],
      skewMetrics: {
        put25Delta: 40.2,
        call25Delta: 31.5,
        skewIndex: 8.7,
        riskReversal: -8.7,
        butterflySpread: 0.35,
      },
      volOfVol: 12.5,
      realizedVolCone: {
        current: 28.2,
        percentile20d: 55,
        percentile60d: 48,
        percentile120d: 42,
        min1y: 15.3,
        max1y: 62.8,
      },
      catalysts: [
        {
          event: "Q3 Earnings Report",
          date: "2026-07-25",
          expectedVolImpact: "high",
          impliedMove: "±5.2%",
        },
      ],
      strategies: [
        {
          name: "Put Credit Spread",
          rationale: "Elevated IV rank with bullish skew — sell rich puts",
          structure: "Sell 185P, Buy 180P, 30DTE",
          maxLoss: "$500 per spread",
          targetReturn: "$180 per spread (36% RoR)",
          edge: "IV rank 72nd percentile, selling above fair value",
        },
        {
          name: "Calendar Spread",
          rationale: "Term structure in contango — front-month vol is cheap relative to back",
          structure: "Sell 1W 190C, Buy 1M 190C",
          maxLoss: "$200 per spread",
          targetReturn: "$150 per spread",
          edge: "Term structure steepness at 90th percentile",
        },
      ],
      warnings: [
        "Earnings in 14 days — expect IV crush post-event",
        "VIX term structure flattening — macro vol regime may shift",
      ],
      summary:
        "AAPL vol surface is in contango with elevated IV rank (72nd percentile). The 7.3-point IV-RV spread (z-score 1.4) suggests implied is overpricing realized moves. Best edge is selling premium via put credit spreads or calendar spreads ahead of earnings.",
      timestamp: "2026-05-11T10:00:00.000Z",
    };

    it("accepts valid volatility assessment", () => {
      const result = VolatilityAssessmentSchema.parse(validAssessment);
      expect(result.ticker).toBe("AAPL");
      expect(result.impliedVol).toBe(35.5);
      expect(result.realizedVol).toBe(28.2);
      expect(result.regime).toBe("elevated");
    });

    it("accepts all vol regimes", () => {
      const regimes = [
        "suppressed",
        "low",
        "normal",
        "elevated",
        "explosive",
        "mean_reverting",
      ] as const;

      for (const regime of regimes) {
        const result = VolatilityAssessmentSchema.parse({
          ...validAssessment,
          regime,
        });
        expect(result.regime).toBe(regime);
      }
    });

    it("accepts all surface regimes", () => {
      const regimes = [
        "contango",
        "backwardation",
        "flat",
        "inverted",
        "kinked",
      ] as const;

      for (const surfaceRegime of regimes) {
        const result = VolatilityAssessmentSchema.parse({
          ...validAssessment,
          surfaceRegime,
        });
        expect(result.surfaceRegime).toBe(surfaceRegime);
      }
    });

    it("accepts all skew profiles", () => {
      const profiles = [
        "normal",
        "steep",
        "flat",
        "reverse",
        "smile",
      ] as const;

      for (const skewProfile of profiles) {
        const result = VolatilityAssessmentSchema.parse({
          ...validAssessment,
          skewProfile,
        });
        expect(result.skewProfile).toBe(skewProfile);
      }
    });

    it("rejects negative implied vol", () => {
      expect(() =>
        VolatilityAssessmentSchema.parse({
          ...validAssessment,
          impliedVol: -5,
        })
      ).toThrow();
    });

    it("rejects negative realized vol", () => {
      expect(() =>
        VolatilityAssessmentSchema.parse({
          ...validAssessment,
          realizedVol: -3,
        })
      ).toThrow();
    });

    it("rejects IV rank out of range", () => {
      expect(() =>
        VolatilityAssessmentSchema.parse({
          ...validAssessment,
          ivRank: 120,
        })
      ).toThrow();
    });

    it("rejects negative IV rank", () => {
      expect(() =>
        VolatilityAssessmentSchema.parse({
          ...validAssessment,
          ivRank: -5,
        })
      ).toThrow();
    });

    it("rejects IV percentile out of range", () => {
      expect(() =>
        VolatilityAssessmentSchema.parse({
          ...validAssessment,
          ivPercentile: 105,
        })
      ).toThrow();
    });

    it("rejects invalid vol regime", () => {
      expect(() =>
        VolatilityAssessmentSchema.parse({
          ...validAssessment,
          regime: "crazy_vol",
        })
      ).toThrow();
    });

    it("rejects invalid surface regime", () => {
      expect(() =>
        VolatilityAssessmentSchema.parse({
          ...validAssessment,
          surfaceRegime: "twisted",
        })
      ).toThrow();
    });

    it("rejects invalid skew profile", () => {
      expect(() =>
        VolatilityAssessmentSchema.parse({
          ...validAssessment,
          skewProfile: "crazy_skew",
        })
      ).toThrow();
    });

    it("accepts empty term structure array", () => {
      const result = VolatilityAssessmentSchema.parse({
        ...validAssessment,
        termStructure: [],
      });
      expect(result.termStructure).toHaveLength(0);
    });

    it("accepts empty strategies array", () => {
      const result = VolatilityAssessmentSchema.parse({
        ...validAssessment,
        strategies: [],
      });
      expect(result.strategies).toHaveLength(0);
    });

    it("accepts empty catalysts array", () => {
      const result = VolatilityAssessmentSchema.parse({
        ...validAssessment,
        catalysts: [],
      });
      expect(result.catalysts).toHaveLength(0);
    });

    it("rejects missing required fields", () => {
      expect(() =>
        VolatilityAssessmentSchema.parse({
          ticker: "AAPL",
          impliedVol: 35,
        })
      ).toThrow();
    });

    it("rejects negative vol of vol", () => {
      expect(() =>
        VolatilityAssessmentSchema.parse({
          ...validAssessment,
          volOfVol: -2,
        })
      ).toThrow();
    });

    it("rejects realized vol cone percentile out of range", () => {
      expect(() =>
        VolatilityAssessmentSchema.parse({
          ...validAssessment,
          realizedVolCone: {
            ...validAssessment.realizedVolCone,
            percentile20d: 110,
          },
        })
      ).toThrow();
    });

    it("accepts all catalyst impact levels", () => {
      const levels = ["high", "medium", "low"] as const;
      for (const level of levels) {
        const result = VolatilityAssessmentSchema.parse({
          ...validAssessment,
          catalysts: [{ ...validAssessment.catalysts[0], expectedVolImpact: level }],
        });
        expect(result.catalysts[0].expectedVolImpact).toBe(level);
      }
    });
  });

  describe("Zod Enums", () => {
    it("VolRegime has correct values", () => {
      expect(VolRegime.options).toEqual([
        "suppressed",
        "low",
        "normal",
        "elevated",
        "explosive",
        "mean_reverting",
      ]);
    });

    it("VolSurfaceRegime has correct values", () => {
      expect(VolSurfaceRegime.options).toEqual([
        "contango",
        "backwardation",
        "flat",
        "inverted",
        "kinked",
      ]);
    });

    it("SkewProfile has correct values", () => {
      expect(SkewProfile.options).toEqual([
        "normal",
        "steep",
        "flat",
        "reverse",
        "smile",
      ]);
    });
  });

  describe("Volatility Prompts", () => {
    it("builds basic volatility prompt", () => {
      const prompt = buildVolatilityPrompt({ ticker: "AAPL" });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("volatility");
    });

    it("includes current price when provided", () => {
      const prompt = buildVolatilityPrompt({
        ticker: "TSLA",
        currentPrice: 250,
      });
      expect(prompt).toContain("$250");
    });

    it("includes IV data when provided", () => {
      const prompt = buildVolatilityPrompt({
        ticker: "AAPL",
        ivData: "30d IV: 35%, 60d IV: 38%",
      });
      expect(prompt).toContain("Implied Volatility Data");
      expect(prompt).toContain("35%");
    });

    it("includes RV data when provided", () => {
      const prompt = buildVolatilityPrompt({
        ticker: "AAPL",
        rvData: "20d RV: 28%, 60d RV: 25%",
      });
      expect(prompt).toContain("Realized Volatility Data");
      expect(prompt).toContain("28%");
    });

    it("includes options chain when provided", () => {
      const prompt = buildVolatilityPrompt({
        ticker: "NVDA",
        optionsChain: "Heavy call buying at 1000 strike",
      });
      expect(prompt).toContain("Options Chain Data");
      expect(prompt).toContain("1000 strike");
    });

    it("includes timeframe when provided", () => {
      const prompt = buildVolatilityPrompt({
        ticker: "SPY",
        timeframe: "30-day",
      });
      expect(prompt).toContain("30-day");
    });

    it("builds vol surface prompt", () => {
      const prompt = buildVolSurfacePrompt({
        ticker: "AAPL",
        strikeRange: "170-220",
        expirations: ["1W", "1M", "3M"],
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("170-220");
      expect(prompt).toContain("1W");
      expect(prompt).toContain("3M");
    });

    it("vol surface prompt includes surface data", () => {
      const prompt = buildVolSurfacePrompt({
        ticker: "TSLA",
        strikeRange: "200-300",
        expirations: ["1M"],
        surfaceData: "ATM IV: 55%, 25D put IV: 62%",
      });
      expect(prompt).toContain("Surface Data");
      expect(prompt).toContain("55%");
    });

    it("builds vol regime prompt", () => {
      const prompt = buildVolRegimePrompt({
        ticker: "SPY",
        historicalVol: "20d RV: 12%, 60d RV: 15%, 1y RV: 18%",
      });
      expect(prompt).toContain("SPY");
      expect(prompt).toContain("regime");
      expect(prompt).toContain("12%");
    });

    it("vol regime prompt includes current conditions", () => {
      const prompt = buildVolRegimePrompt({
        ticker: "QQQ",
        historicalVol: "20d RV: 22%",
        currentConditions: "VIX at 18, VVIX elevated",
      });
      expect(prompt).toContain("Current Conditions");
      expect(prompt).toContain("VVIX");
    });

    it("builds IV-RV spread prompt", () => {
      const prompt = buildIvRvSpreadPrompt({
        ticker: "AAPL",
        ivHistory: "30d IV: 35%, 60d IV: 38%, 90d IV: 36%",
        rvHistory: "20d RV: 28%, 60d RV: 25%, 120d RV: 22%",
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("implied vs realized");
      expect(prompt).toContain("35%");
      expect(prompt).toContain("28%");
    });
  });

  describe("VolatilityAnalyzer class", () => {
    it("can be instantiated without orchestrator", () => {
      const analyzer = new VolatilityAnalyzer();
      expect(analyzer).toBeInstanceOf(VolatilityAnalyzer);
    });

    it("exposes analyze method", () => {
      const analyzer = new VolatilityAnalyzer();
      expect(typeof analyzer.analyze).toBe("function");
    });

    it("exposes analyzeSurface method", () => {
      const analyzer = new VolatilityAnalyzer();
      expect(typeof analyzer.analyzeSurface).toBe("function");
    });

    it("exposes classifyRegime method", () => {
      const analyzer = new VolatilityAnalyzer();
      expect(typeof analyzer.classifyRegime).toBe("function");
    });

    it("exposes analyzeSpread method", () => {
      const analyzer = new VolatilityAnalyzer();
      expect(typeof analyzer.analyzeSpread).toBe("function");
    });

    it("exposes consensus method", () => {
      const analyzer = new VolatilityAnalyzer();
      expect(typeof analyzer.consensus).toBe("function");
    });
  });
});
