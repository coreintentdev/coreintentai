import { describe, it, expect } from "vitest";
import { VolatilityAnalysisSchema } from "../src/types/index.js";
import {
  buildVolatilityPrompt,
  buildVolSurfacePrompt,
  buildVolRegimePrompt,
  buildVolForecastPrompt,
  VOLATILITY_SYSTEM_PROMPT,
} from "../src/capabilities/volatility/prompts.js";
import { VolatilityAnalyzer } from "../src/capabilities/volatility/index.js";

describe("Volatility Intelligence", () => {
  describe("Schema Validation", () => {
    it("validates a complete volatility analysis", () => {
      const validData = {
        ticker: "AAPL",
        currentIV: 0.28,
        realizedVol: { vol5d: 0.22, vol20d: 0.25, vol60d: 0.23 },
        varianceRiskPremium: 0.03,
        regime: "elevated",
        regimePercentile: 72,
        skew: {
          put25Delta: 0.32,
          atm: 0.28,
          call25Delta: 0.25,
          skewIndex: 0.07,
          interpretation: "Moderate put skew indicates hedging demand",
        },
        termStructure: {
          shape: "contango",
          front: 0.28,
          mid: 0.30,
          back: 0.32,
          slope: 0.04,
          eventPremium: "Earnings in 2 weeks inflating front month",
        },
        forecast: {
          direction: "rising",
          targetRange: { low: 0.25, high: 0.35 },
          timeframe: "2 weeks",
          confidence: 0.72,
          catalysts: ["Earnings report", "Fed meeting", "CPI release"],
        },
        tradingImplications: {
          optimalStrategy: "Long straddle ahead of earnings",
          positionSizing: "Reduce to 75% normal size due to elevated vol",
          hedgingCost: "Put protection at 2.8% of notional",
          opportunities: [
            "Sell call spreads above resistance",
            "Calendar spread exploiting term structure",
          ],
        },
        summary: "AAPL implied volatility is elevated at the 72nd percentile. Earnings event premium visible in term structure. Put skew suggests institutional hedging.",
        timestamp: new Date().toISOString(),
      };

      const result = VolatilityAnalysisSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("rejects invalid regime values", () => {
      const data = {
        ticker: "AAPL",
        currentIV: 0.28,
        realizedVol: { vol5d: 0.22, vol20d: 0.25, vol60d: 0.23 },
        varianceRiskPremium: 0.03,
        regime: "invalid_regime",
        regimePercentile: 72,
        skew: { put25Delta: 0.32, atm: 0.28, call25Delta: 0.25, skewIndex: 0.07, interpretation: "test" },
        termStructure: { shape: "contango", front: 0.28, mid: 0.30, back: 0.32, slope: 0.04 },
        forecast: { direction: "rising", targetRange: { low: 0.25, high: 0.35 }, timeframe: "2w", confidence: 0.72, catalysts: [] },
        tradingImplications: { optimalStrategy: "test", positionSizing: "test", hedgingCost: "test", opportunities: [] },
        summary: "test",
        timestamp: new Date().toISOString(),
      };

      const result = VolatilityAnalysisSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("rejects negative implied volatility", () => {
      const data = {
        ticker: "AAPL",
        currentIV: -0.1,
        realizedVol: { vol5d: 0.22, vol20d: 0.25, vol60d: 0.23 },
        varianceRiskPremium: 0.03,
        regime: "normal",
        regimePercentile: 50,
        skew: { put25Delta: 0.32, atm: 0.28, call25Delta: 0.25, skewIndex: 0.07, interpretation: "test" },
        termStructure: { shape: "contango", front: 0.28, mid: 0.30, back: 0.32, slope: 0.04 },
        forecast: { direction: "stable", targetRange: { low: 0.2, high: 0.3 }, timeframe: "1w", confidence: 0.5, catalysts: [] },
        tradingImplications: { optimalStrategy: "test", positionSizing: "test", hedgingCost: "test", opportunities: [] },
        summary: "test",
        timestamp: new Date().toISOString(),
      };

      const result = VolatilityAnalysisSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("validates all six regime types", () => {
      const regimes = ["compressed", "low", "normal", "elevated", "high", "extreme"];
      for (const regime of regimes) {
        const data = {
          ticker: "SPY",
          currentIV: 0.20,
          realizedVol: { vol5d: 0.18, vol20d: 0.19, vol60d: 0.20 },
          varianceRiskPremium: 0.01,
          regime,
          regimePercentile: 50,
          skew: { put25Delta: 0.22, atm: 0.20, call25Delta: 0.18, skewIndex: 0.04, interpretation: "test" },
          termStructure: { shape: "flat", front: 0.20, mid: 0.20, back: 0.20, slope: 0 },
          forecast: { direction: "stable", targetRange: { low: 0.18, high: 0.22 }, timeframe: "1m", confidence: 0.6, catalysts: [] },
          tradingImplications: { optimalStrategy: "test", positionSizing: "test", hedgingCost: "test", opportunities: [] },
          summary: "test",
          timestamp: new Date().toISOString(),
        };
        expect(VolatilityAnalysisSchema.safeParse(data).success).toBe(true);
      }
    });

    it("validates all term structure shapes", () => {
      const shapes = ["contango", "flat", "backwardation", "humped"];
      for (const shape of shapes) {
        const data = {
          ticker: "SPY",
          currentIV: 0.20,
          realizedVol: { vol5d: 0.18, vol20d: 0.19, vol60d: 0.20 },
          varianceRiskPremium: 0.01,
          regime: "normal",
          regimePercentile: 50,
          skew: { put25Delta: 0.22, atm: 0.20, call25Delta: 0.18, skewIndex: 0.04, interpretation: "test" },
          termStructure: { shape, front: 0.20, mid: 0.22, back: 0.24, slope: 0.04 },
          forecast: { direction: "stable", targetRange: { low: 0.18, high: 0.22 }, timeframe: "1m", confidence: 0.6, catalysts: [] },
          tradingImplications: { optimalStrategy: "test", positionSizing: "test", hedgingCost: "test", opportunities: [] },
          summary: "test",
          timestamp: new Date().toISOString(),
        };
        expect(VolatilityAnalysisSchema.safeParse(data).success).toBe(true);
      }
    });
  });

  describe("Prompt Engineering", () => {
    it("builds basic volatility prompt", () => {
      const prompt = buildVolatilityPrompt({ ticker: "AAPL" });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("volatility");
      expect(prompt).toContain("timestamp");
    });

    it("includes price and VIX when provided", () => {
      const prompt = buildVolatilityPrompt({
        ticker: "AAPL",
        currentPrice: 195,
        vixLevel: 22.5,
      });
      expect(prompt).toContain("$195");
      expect(prompt).toContain("22.5");
    });

    it("includes options data", () => {
      const prompt = buildVolatilityPrompt({
        ticker: "AAPL",
        optionsData: "IV30: 28%, IV60: 25%",
      });
      expect(prompt).toContain("IV30: 28%");
    });

    it("builds surface analysis prompt with expirations", () => {
      const prompt = buildVolSurfacePrompt({
        ticker: "SPY",
        expirations: ["2024-01-19", "2024-02-16", "2024-03-15"],
        currentPrice: 475,
      });
      expect(prompt).toContain("SPY");
      expect(prompt).toContain("2024-01-19");
      expect(prompt).toContain("surface");
      expect(prompt).toContain("$475");
    });

    it("builds regime assessment for multiple tickers", () => {
      const prompt = buildVolRegimePrompt({
        tickers: ["SPY", "QQQ", "IWM"],
      });
      expect(prompt).toContain("SPY");
      expect(prompt).toContain("QQQ");
      expect(prompt).toContain("IWM");
      expect(prompt).toContain("regime");
    });

    it("builds forecast prompt with events", () => {
      const prompt = buildVolForecastPrompt({
        ticker: "NVDA",
        currentIV: 0.45,
        upcomingEvents: ["Earnings 2024-02-21", "GTC conference"],
      });
      expect(prompt).toContain("NVDA");
      expect(prompt).toContain("45.0%");
      expect(prompt).toContain("Earnings");
      expect(prompt).toContain("GTC");
    });

    it("system prompt covers key volatility concepts", () => {
      expect(VOLATILITY_SYSTEM_PROMPT).toContain("variance risk premium");
      expect(VOLATILITY_SYSTEM_PROMPT).toContain("skew");
      expect(VOLATILITY_SYSTEM_PROMPT).toContain("term structure");
      expect(VOLATILITY_SYSTEM_PROMPT).toContain("mean-reverting");
      expect(VOLATILITY_SYSTEM_PROMPT).toContain("GARCH");
      expect(VOLATILITY_SYSTEM_PROMPT).toContain("leverage effect");
    });
  });

  describe("VolatilityAnalyzer", () => {
    it("can be instantiated without orchestrator", () => {
      const analyzer = new VolatilityAnalyzer();
      expect(analyzer).toBeInstanceOf(VolatilityAnalyzer);
    });

    it("exposes all analysis methods", () => {
      const analyzer = new VolatilityAnalyzer();
      expect(typeof analyzer.analyze).toBe("function");
      expect(typeof analyzer.surface).toBe("function");
      expect(typeof analyzer.regimeAssessment).toBe("function");
      expect(typeof analyzer.forecast).toBe("function");
      expect(typeof analyzer.consensus).toBe("function");
    });
  });
});
