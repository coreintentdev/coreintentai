import { describe, it, expect } from "vitest";
import { VolatilityAnalysisSchema } from "../src/types/index.js";
import {
  buildVolatilitySurfacePrompt,
  buildTermStructurePrompt,
  buildSkewAnalysisPrompt,
  buildRealizedVsImpliedPrompt,
} from "../src/capabilities/volatility/prompts.js";

describe("Volatility Analysis", () => {
  describe("VolatilityAnalysisSchema", () => {
    const validAnalysis = {
      ticker: "AAPL",
      currentIV: 28.5,
      currentRV: 22.1,
      ivRank: 65,
      ivPercentile: 72,
      ivRvSpread: 6.4,
      volatilityRegime: "normal",
      termStructure: {
        shape: "contango",
        steepness: 0.35,
        frontMonthIV: 26.2,
        backMonthIV: 31.8,
        eventPremium: "Earnings in 12 days adding ~3% premium to front month",
        interpretation:
          "Normal upward-sloping term structure with earnings kink. Market expects calm near-term with uncertainty rising into next quarter.",
      },
      skew: {
        pattern: "normal",
        putCallSkew: 4.2,
        skewPercentile: 55,
        interpretation:
          "Moderate put skew consistent with institutional hedging. Not extreme — no panic positioning detected.",
      },
      volForecast: {
        direction: "expanding",
        catalyst: "Upcoming earnings report and FOMC meeting within 2 weeks",
        confidence: 0.72,
      },
      strategies: [
        {
          name: "Pre-earnings straddle",
          type: "long_vol",
          rationale:
            "IV rank 65 but historical earnings moves average 5.2%. Current straddle pricing implies only 3.8% move.",
          edge: "Straddle underpricing historical earnings volatility by ~1.4%",
          risk: "Earnings move lands within implied range — time decay destroys the position",
          conviction: 0.65,
        },
        {
          name: "Put spread collar",
          type: "hedging",
          rationale:
            "Elevated IV rank makes put buying expensive. Fund the put spread by selling OTM calls.",
          edge: "Positive skew means puts are relatively cheaper via spread",
          risk: "Capped upside if stock rallies through short call strike",
          conviction: 0.55,
        },
      ],
      summary:
        "AAPL vol surface shows normal structure with earnings premium building. IV overpricing realized vol by 6.4% (typical VRP). Pre-earnings straddle may offer edge if historical move patterns repeat.",
      timestamp: "2026-04-26T10:00:00.000Z",
    };

    it("accepts valid volatility analysis", () => {
      const result = VolatilityAnalysisSchema.parse(validAnalysis);
      expect(result.ticker).toBe("AAPL");
      expect(result.currentIV).toBe(28.5);
      expect(result.currentRV).toBe(22.1);
      expect(result.ivRank).toBe(65);
      expect(result.volatilityRegime).toBe("normal");
    });

    it("accepts all volatility regimes", () => {
      const regimes = ["low", "normal", "elevated", "extreme"] as const;
      for (const regime of regimes) {
        const result = VolatilityAnalysisSchema.parse({
          ...validAnalysis,
          volatilityRegime: regime,
        });
        expect(result.volatilityRegime).toBe(regime);
      }
    });

    it("accepts all term structure shapes", () => {
      const shapes = [
        "contango",
        "backwardation",
        "flat",
        "kinked",
        "steep_contango",
      ] as const;
      for (const shape of shapes) {
        const result = VolatilityAnalysisSchema.parse({
          ...validAnalysis,
          termStructure: { ...validAnalysis.termStructure, shape },
        });
        expect(result.termStructure.shape).toBe(shape);
      }
    });

    it("accepts all skew patterns", () => {
      const patterns = ["normal", "reverse", "smile", "smirk"] as const;
      for (const pattern of patterns) {
        const result = VolatilityAnalysisSchema.parse({
          ...validAnalysis,
          skew: { ...validAnalysis.skew, pattern },
        });
        expect(result.skew.pattern).toBe(pattern);
      }
    });

    it("accepts all vol forecast directions", () => {
      const directions = ["expanding", "contracting", "stable"] as const;
      for (const direction of directions) {
        const result = VolatilityAnalysisSchema.parse({
          ...validAnalysis,
          volForecast: { ...validAnalysis.volForecast, direction },
        });
        expect(result.volForecast.direction).toBe(direction);
      }
    });

    it("accepts all strategy types", () => {
      const types = [
        "long_vol",
        "short_vol",
        "skew_trade",
        "term_structure",
        "gamma_scalp",
        "hedging",
      ] as const;
      for (const type of types) {
        const result = VolatilityAnalysisSchema.parse({
          ...validAnalysis,
          strategies: [{ ...validAnalysis.strategies[0], type }],
        });
        expect(result.strategies[0].type).toBe(type);
      }
    });

    it("accepts null event premium", () => {
      const result = VolatilityAnalysisSchema.parse({
        ...validAnalysis,
        termStructure: { ...validAnalysis.termStructure, eventPremium: null },
      });
      expect(result.termStructure.eventPremium).toBeNull();
    });

    it("accepts empty strategies array", () => {
      const result = VolatilityAnalysisSchema.parse({
        ...validAnalysis,
        strategies: [],
      });
      expect(result.strategies).toHaveLength(0);
    });

    it("rejects IV out of range", () => {
      expect(() =>
        VolatilityAnalysisSchema.parse({
          ...validAnalysis,
          currentIV: 350,
        })
      ).toThrow();
    });

    it("rejects negative IV", () => {
      expect(() =>
        VolatilityAnalysisSchema.parse({
          ...validAnalysis,
          currentIV: -5,
        })
      ).toThrow();
    });

    it("rejects IV rank out of range", () => {
      expect(() =>
        VolatilityAnalysisSchema.parse({
          ...validAnalysis,
          ivRank: 110,
        })
      ).toThrow();
    });

    it("rejects steepness out of range", () => {
      expect(() =>
        VolatilityAnalysisSchema.parse({
          ...validAnalysis,
          termStructure: { ...validAnalysis.termStructure, steepness: 1.5 },
        })
      ).toThrow();
    });

    it("rejects skew percentile out of range", () => {
      expect(() =>
        VolatilityAnalysisSchema.parse({
          ...validAnalysis,
          skew: { ...validAnalysis.skew, skewPercentile: -10 },
        })
      ).toThrow();
    });

    it("rejects vol forecast confidence out of range", () => {
      expect(() =>
        VolatilityAnalysisSchema.parse({
          ...validAnalysis,
          volForecast: { ...validAnalysis.volForecast, confidence: 1.5 },
        })
      ).toThrow();
    });

    it("rejects strategy conviction out of range", () => {
      expect(() =>
        VolatilityAnalysisSchema.parse({
          ...validAnalysis,
          strategies: [{ ...validAnalysis.strategies[0], conviction: -0.1 }],
        })
      ).toThrow();
    });

    it("rejects invalid term structure shape", () => {
      expect(() =>
        VolatilityAnalysisSchema.parse({
          ...validAnalysis,
          termStructure: { ...validAnalysis.termStructure, shape: "inverted" },
        })
      ).toThrow();
    });

    it("rejects missing required fields", () => {
      expect(() =>
        VolatilityAnalysisSchema.parse({
          ticker: "AAPL",
          currentIV: 28.5,
        })
      ).toThrow();
    });
  });

  describe("Volatility Prompts", () => {
    it("builds basic surface analysis prompt", () => {
      const prompt = buildVolatilitySurfacePrompt({
        ticker: "AAPL",
        currentPrice: 195.5,
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("$195.5");
      expect(prompt).toContain("volatility surface");
    });

    it("includes IV data when provided", () => {
      const prompt = buildVolatilitySurfacePrompt({
        ticker: "TSLA",
        currentPrice: 250,
        ivData: "30-day IV: 52%, 60-day IV: 48%",
      });
      expect(prompt).toContain("Implied Volatility Data");
      expect(prompt).toContain("30-day IV: 52%");
    });

    it("includes options data when provided", () => {
      const prompt = buildVolatilitySurfacePrompt({
        ticker: "NVDA",
        currentPrice: 900,
        optionsData: "High put OI at 850 strike",
      });
      expect(prompt).toContain("Options Chain Data");
      expect(prompt).toContain("850 strike");
    });

    it("includes historical vol data when provided", () => {
      const prompt = buildVolatilitySurfacePrompt({
        ticker: "SPY",
        currentPrice: 520,
        historicalVolData: "20-day HV: 12%, 60-day HV: 15%",
      });
      expect(prompt).toContain("Historical Volatility Data");
      expect(prompt).toContain("20-day HV: 12%");
    });

    it("includes market context when provided", () => {
      const prompt = buildVolatilitySurfacePrompt({
        ticker: "QQQ",
        currentPrice: 440,
        marketContext: "VIX at 13, FOMC in 3 days",
      });
      expect(prompt).toContain("Market Context");
      expect(prompt).toContain("FOMC in 3 days");
    });

    it("builds term structure prompt", () => {
      const prompt = buildTermStructurePrompt({
        ticker: "AAPL",
        expirations: [
          { date: "2026-05-16", iv: 28 },
          { date: "2026-06-20", iv: 31 },
          { date: "2026-09-18", iv: 34 },
        ],
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("2026-05-16");
      expect(prompt).toContain("IV 28%");
      expect(prompt).toContain("term structure");
    });

    it("term structure includes historical context", () => {
      const prompt = buildTermStructurePrompt({
        ticker: "TSLA",
        expirations: [{ date: "2026-05-16", iv: 55 }],
        historicalContext: "Term structure inverted 3 times in past year",
      });
      expect(prompt).toContain("Historical Context");
      expect(prompt).toContain("inverted 3 times");
    });

    it("builds skew analysis prompt", () => {
      const prompt = buildSkewAnalysisPrompt({
        ticker: "NVDA",
        currentPrice: 900,
      });
      expect(prompt).toContain("NVDA");
      expect(prompt).toContain("$900");
      expect(prompt).toContain("skew");
    });

    it("skew includes put and call IV data", () => {
      const prompt = buildSkewAnalysisPrompt({
        ticker: "AAPL",
        currentPrice: 195,
        putIVs: "190P: 32%, 185P: 35%, 180P: 38%",
        callIVs: "200C: 26%, 205C: 24%, 210C: 23%",
      });
      expect(prompt).toContain("Put Implied Volatilities");
      expect(prompt).toContain("190P: 32%");
      expect(prompt).toContain("Call Implied Volatilities");
      expect(prompt).toContain("200C: 26%");
    });

    it("builds realized vs implied prompt", () => {
      const prompt = buildRealizedVsImpliedPrompt({
        ticker: "AAPL",
        currentIV: 28,
        windows: [
          { period: "10-day", realizedVol: 18 },
          { period: "30-day", realizedVol: 22 },
          { period: "60-day", realizedVol: 25 },
        ],
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("Current IV: 28%");
      expect(prompt).toContain("10-day: RV 18%");
      expect(prompt).toContain("30-day: RV 22%");
      expect(prompt).toContain("volatility risk premium");
    });

    it("realized vs implied includes IV history", () => {
      const prompt = buildRealizedVsImpliedPrompt({
        ticker: "TSLA",
        currentIV: 55,
        windows: [{ period: "30-day", realizedVol: 45 }],
        ivHistory: "IV 52-week range: 35% - 85%",
      });
      expect(prompt).toContain("IV History");
      expect(prompt).toContain("52-week range");
    });
  });
});
