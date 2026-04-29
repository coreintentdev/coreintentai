import { describe, it, expect } from "vitest";
import {
  VolatilityAnalysisSchema,
  VolSnapshotSchema,
  VolSurfaceSchema,
  VolEventSchema,
  VolStrategySchema,
  VolAlertSchema,
} from "../src/capabilities/volatility/index.js";
import {
  buildVolatilityAnalysisPrompt,
  buildVolTermStructurePrompt,
  buildVolRegimePrompt,
  buildEventVolPrompt,
} from "../src/capabilities/volatility/prompts.js";

describe("Volatility Analyzer", () => {
  describe("VolatilityAnalysisSchema", () => {
    const validAnalysis = {
      ticker: "AAPL",
      snapshot: {
        atmIv: 0.28,
        ivRank: 72,
        ivPercentile: 68,
        realizedVol20d: 0.22,
        realizedVol60d: 0.19,
        ivRvSpread: 0.06,
        regime: "elevated",
      },
      surface: {
        skew25Delta: -0.045,
        skewInterpretation:
          "Moderate put skew indicating hedging demand. Not extreme — consistent with pre-earnings positioning.",
        termStructure: "backwardation",
        termStructureSlope: 0.03,
        termInterpretation:
          "Near-term vol elevated above far-term due to upcoming earnings event. Vol crush expected post-event.",
        wingDemand: "elevated",
        wingInterpretation:
          "Elevated demand for OTM puts and calls. Tail risk hedging and speculative straddle buyers.",
      },
      events: [
        {
          event: "Q2 Earnings Report",
          date: "2026-05-01",
          expectedMove: 0.045,
          impliedMove: 0.058,
          mispriced: "overpriced",
          opportunity:
            "Sell iron condor at 1.5x expected move. Historical average move is 4.5%, market pricing 5.8%.",
        },
      ],
      strategies: [
        {
          name: "Post-Earnings Iron Condor",
          type: "short_vol",
          rationale:
            "IV rank 72, event vol appears overpriced vs historical moves. Sell premium and capture vol crush.",
          riskLevel: "moderate",
          expectedEdge:
            "13% edge based on implied vs historical move differential",
        },
        {
          name: "Calendar Spread (May/June)",
          type: "calendar_spread",
          rationale:
            "Backwardation creates opportunity. Sell near-term elevated vol, buy cheaper far-term.",
          riskLevel: "low",
          expectedEdge: "Term structure normalization provides 0.03 vol edge",
        },
      ],
      alerts: [
        {
          condition: "IV Rank above 70",
          severity: "warning",
          implication:
            "Vol is historically rich. Short vol strategies favored. Size positions conservatively.",
        },
        {
          condition: "Put skew steepening",
          severity: "info",
          implication:
            "Institutional hedging increasing. May signal caution among large holders.",
        },
      ],
      summary:
        "AAPL showing elevated vol ahead of earnings with rich IV relative to historical moves. Backwardated term structure and elevated skew suggest opportunity in short vol strategies post-event.",
      timestamp: "2026-04-29T10:00:00.000Z",
    };

    it("validates a correct volatility analysis", () => {
      const result = VolatilityAnalysisSchema.safeParse(validAnalysis);
      expect(result.success).toBe(true);
    });

    it("rejects invalid vol regime", () => {
      const invalid = {
        ...validAnalysis,
        snapshot: { ...validAnalysis.snapshot, regime: "wild" },
      };
      const result = VolatilityAnalysisSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects invalid term structure", () => {
      const invalid = {
        ...validAnalysis,
        surface: { ...validAnalysis.surface, termStructure: "inverted" },
      };
      const result = VolatilityAnalysisSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("validates all vol regimes", () => {
      for (const regime of ["low", "normal", "elevated", "extreme"]) {
        const result = VolSnapshotSchema.safeParse({
          ...validAnalysis.snapshot,
          regime,
        });
        expect(result.success).toBe(true);
      }
    });

    it("validates all term structure types", () => {
      for (const ts of ["contango", "flat", "backwardation"]) {
        const result = VolSurfaceSchema.safeParse({
          ...validAnalysis.surface,
          termStructure: ts,
        });
        expect(result.success).toBe(true);
      }
    });

    it("validates all strategy types", () => {
      for (const type of [
        "long_vol",
        "short_vol",
        "skew_trade",
        "calendar_spread",
        "event_trade",
      ]) {
        const result = VolStrategySchema.safeParse({
          ...validAnalysis.strategies[0],
          type,
        });
        expect(result.success).toBe(true);
      }
    });

    it("validates all event mispricing types", () => {
      for (const mispriced of ["overpriced", "fairly_priced", "underpriced"]) {
        const result = VolEventSchema.safeParse({
          ...validAnalysis.events[0],
          mispriced,
        });
        expect(result.success).toBe(true);
      }
    });

    it("validates all alert severity levels", () => {
      for (const severity of ["info", "warning", "critical"]) {
        const result = VolAlertSchema.safeParse({
          ...validAnalysis.alerts[0],
          severity,
        });
        expect(result.success).toBe(true);
      }
    });

    it("validates all wing demand levels", () => {
      for (const demand of ["low", "normal", "elevated", "extreme"]) {
        const result = VolSurfaceSchema.safeParse({
          ...validAnalysis.surface,
          wingDemand: demand,
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects negative IV rank", () => {
      const result = VolSnapshotSchema.safeParse({
        ...validAnalysis.snapshot,
        ivRank: -5,
      });
      expect(result.success).toBe(false);
    });

    it("rejects IV rank above 100", () => {
      const result = VolSnapshotSchema.safeParse({
        ...validAnalysis.snapshot,
        ivRank: 105,
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative ATM IV", () => {
      const result = VolSnapshotSchema.safeParse({
        ...validAnalysis.snapshot,
        atmIv: -0.1,
      });
      expect(result.success).toBe(false);
    });

    it("accepts empty events and strategies arrays", () => {
      const result = VolatilityAnalysisSchema.safeParse({
        ...validAnalysis,
        events: [],
        strategies: [],
        alerts: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("Prompt Builders", () => {
    it("buildVolatilityAnalysisPrompt includes ticker and price", () => {
      const prompt = buildVolatilityAnalysisPrompt({
        ticker: "TSLA",
        currentPrice: 250,
      });

      expect(prompt).toContain("TSLA");
      expect(prompt).toContain("$250");
      expect(prompt).toContain("volatility surface analysis");
    });

    it("buildVolatilityAnalysisPrompt includes optional data", () => {
      const prompt = buildVolatilityAnalysisPrompt({
        ticker: "AAPL",
        currentPrice: 175,
        ivData: "ATM IV: 28%",
        historicalVolData: "20d RV: 22%, 60d RV: 19%",
        optionChainData: "May 175 Call: $5.20, May 175 Put: $4.80",
        vixData: "VIX: 18.5, VVIX: 95",
        upcomingEvents: ["Earnings May 1", "FOMC May 7"],
      });

      expect(prompt).toContain("ATM IV: 28%");
      expect(prompt).toContain("20d RV: 22%");
      expect(prompt).toContain("May 175 Call");
      expect(prompt).toContain("VIX: 18.5");
      expect(prompt).toContain("Earnings May 1");
      expect(prompt).toContain("FOMC May 7");
    });

    it("buildVolTermStructurePrompt includes expiration data", () => {
      const prompt = buildVolTermStructurePrompt({
        ticker: "SPY",
        expirations: [
          { expiration: "2026-05-02", daysToExpiry: 3, atmIv: 0.22 },
          { expiration: "2026-05-16", daysToExpiry: 17, atmIv: 0.19 },
          { expiration: "2026-06-20", daysToExpiry: 52, atmIv: 0.17 },
        ],
        eventCalendar: ["FOMC May 7", "CPI May 13"],
      });

      expect(prompt).toContain("SPY");
      expect(prompt).toContain("2026-05-02 (3d): ATM IV 22.0%");
      expect(prompt).toContain("2026-05-16 (17d): ATM IV 19.0%");
      expect(prompt).toContain("2026-06-20 (52d): ATM IV 17.0%");
      expect(prompt).toContain("FOMC May 7");
      expect(prompt).toContain("calendar spread");
    });

    it("buildVolRegimePrompt includes IV and RV history", () => {
      const prompt = buildVolRegimePrompt({
        ticker: "AAPL",
        currentIv: 0.28,
        ivHistory: "Week 1: 25%, Week 2: 26%, Week 3: 28%",
        rvHistory: "Week 1: 20%, Week 2: 21%, Week 3: 22%",
      });

      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("28.0%");
      expect(prompt).toContain("Week 1: 25%");
      expect(prompt).toContain("Vol regime transition probability");
    });

    it("buildEventVolPrompt includes event details", () => {
      const prompt = buildEventVolPrompt({
        ticker: "AAPL",
        event: "Q2 Earnings Report",
        eventDate: "2026-05-01",
        currentIv: 0.32,
        historicalMoves: "Last 4 earnings: +3.2%, -1.8%, +5.1%, +2.4%",
        optionPricing: "May 175 Straddle: $9.20 (implied move ~5.3%)",
      });

      expect(prompt).toContain("Q2 Earnings Report");
      expect(prompt).toContain("2026-05-01");
      expect(prompt).toContain("32.0%");
      expect(prompt).toContain("Last 4 earnings");
      expect(prompt).toContain("May 175 Straddle");
      expect(prompt).toContain("overpriced or underpriced");
    });

    it("buildEventVolPrompt works without optional pricing", () => {
      const prompt = buildEventVolPrompt({
        ticker: "MSFT",
        event: "FOMC Decision",
        eventDate: "2026-05-07",
        currentIv: 0.2,
        historicalMoves: "Avg FOMC day move: 0.8%",
      });

      expect(prompt).toContain("MSFT");
      expect(prompt).toContain("FOMC Decision");
      expect(prompt).not.toContain("Option Pricing");
    });
  });
});
