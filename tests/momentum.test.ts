import { describe, it, expect } from "vitest";
import {
  MomentumReportSchema,
  MomentumRankingSchema,
} from "../src/types/index.js";
import {
  buildMomentumRankingPrompt,
  buildMomentumScreenerPrompt,
  buildMomentumShiftPrompt,
} from "../src/capabilities/momentum/prompts.js";

describe("Momentum Scoring", () => {
  describe("MomentumRankingSchema", () => {
    const validRanking = {
      ticker: "NVDA",
      compositeScore: 88,
      rank: 1,
      priceScore: 92,
      volumeScore: 85,
      relativeStrengthScore: 90,
      accelerationSignal: "accelerating",
      timeframeAlignment: "aligned",
      exhaustionRisk: 0.25,
      keyDriver: "AI infrastructure demand driving revenue acceleration",
      watchFor: "Semiconductor cycle peak signals or competitive margin pressure",
    };

    it("accepts valid ranking", () => {
      const result = MomentumRankingSchema.parse(validRanking);
      expect(result.ticker).toBe("NVDA");
      expect(result.compositeScore).toBe(88);
      expect(result.rank).toBe(1);
    });

    it("accepts all acceleration signals", () => {
      const signals = [
        "accelerating",
        "steady",
        "decelerating",
        "reversing",
      ] as const;
      for (const signal of signals) {
        const result = MomentumRankingSchema.parse({
          ...validRanking,
          accelerationSignal: signal,
        });
        expect(result.accelerationSignal).toBe(signal);
      }
    });

    it("accepts all timeframe alignments", () => {
      const alignments = ["aligned", "mixed", "conflicting"] as const;
      for (const alignment of alignments) {
        const result = MomentumRankingSchema.parse({
          ...validRanking,
          timeframeAlignment: alignment,
        });
        expect(result.timeframeAlignment).toBe(alignment);
      }
    });

    it("rejects composite score out of range", () => {
      expect(() =>
        MomentumRankingSchema.parse({
          ...validRanking,
          compositeScore: 150,
        })
      ).toThrow();
    });

    it("rejects negative rank", () => {
      expect(() =>
        MomentumRankingSchema.parse({
          ...validRanking,
          rank: -1,
        })
      ).toThrow();
    });

    it("rejects zero rank", () => {
      expect(() =>
        MomentumRankingSchema.parse({
          ...validRanking,
          rank: 0,
        })
      ).toThrow();
    });

    it("rejects exhaustion risk out of range", () => {
      expect(() =>
        MomentumRankingSchema.parse({
          ...validRanking,
          exhaustionRisk: 1.5,
        })
      ).toThrow();
    });

    it("rejects non-integer rank", () => {
      expect(() =>
        MomentumRankingSchema.parse({
          ...validRanking,
          rank: 1.5,
        })
      ).toThrow();
    });
  });

  describe("MomentumReportSchema", () => {
    const validReport = {
      rankings: [
        {
          ticker: "NVDA",
          compositeScore: 88,
          rank: 1,
          priceScore: 92,
          volumeScore: 85,
          relativeStrengthScore: 90,
          accelerationSignal: "accelerating",
          timeframeAlignment: "aligned",
          exhaustionRisk: 0.25,
          keyDriver: "AI demand",
          watchFor: "Cycle peak",
        },
        {
          ticker: "META",
          compositeScore: 75,
          rank: 2,
          priceScore: 78,
          volumeScore: 70,
          relativeStrengthScore: 80,
          accelerationSignal: "steady",
          timeframeAlignment: "aligned",
          exhaustionRisk: 0.35,
          keyDriver: "Ad revenue growth",
          watchFor: "Engagement metrics",
        },
        {
          ticker: "INTC",
          compositeScore: 22,
          rank: 3,
          priceScore: 18,
          volumeScore: 30,
          relativeStrengthScore: 15,
          accelerationSignal: "reversing",
          timeframeAlignment: "conflicting",
          exhaustionRisk: 0.1,
          keyDriver: "Turnaround speculation",
          watchFor: "Foundry revenue traction",
        },
      ],
      topPick: "NVDA",
      avoidList: ["INTC"],
      sectorRotation: {
        leading: ["Technology", "Industrials"],
        lagging: ["Utilities", "Real Estate"],
        emerging: ["Healthcare"],
      },
      marketBreadth: {
        score: 65,
        assessment: "healthy",
      },
      summary:
        "Strong momentum concentration in AI-related names. NVDA leads with aligned multi-timeframe momentum. INTC shows negative momentum with conflicting signals.",
      timestamp: "2026-04-26T10:00:00.000Z",
    };

    it("accepts valid momentum report", () => {
      const result = MomentumReportSchema.parse(validReport);
      expect(result.rankings).toHaveLength(3);
      expect(result.topPick).toBe("NVDA");
      expect(result.avoidList).toContain("INTC");
    });

    it("validates sector rotation structure", () => {
      const result = MomentumReportSchema.parse(validReport);
      expect(result.sectorRotation.leading).toContain("Technology");
      expect(result.sectorRotation.lagging).toContain("Utilities");
      expect(result.sectorRotation.emerging).toContain("Healthcare");
    });

    it("validates market breadth", () => {
      const result = MomentumReportSchema.parse(validReport);
      expect(result.marketBreadth.score).toBe(65);
      expect(result.marketBreadth.assessment).toBe("healthy");
    });

    it("accepts all breadth assessments", () => {
      const assessments = [
        "healthy",
        "narrowing",
        "deteriorating",
        "capitulation",
      ] as const;
      for (const assessment of assessments) {
        const result = MomentumReportSchema.parse({
          ...validReport,
          marketBreadth: { score: 50, assessment },
        });
        expect(result.marketBreadth.assessment).toBe(assessment);
      }
    });

    it("rejects breadth score out of range", () => {
      expect(() =>
        MomentumReportSchema.parse({
          ...validReport,
          marketBreadth: { score: 150, assessment: "healthy" },
        })
      ).toThrow();
    });

    it("accepts empty rankings", () => {
      const result = MomentumReportSchema.parse({
        ...validReport,
        rankings: [],
      });
      expect(result.rankings).toHaveLength(0);
    });

    it("accepts empty avoid list", () => {
      const result = MomentumReportSchema.parse({
        ...validReport,
        avoidList: [],
      });
      expect(result.avoidList).toHaveLength(0);
    });

    it("rejects missing required fields", () => {
      expect(() =>
        MomentumReportSchema.parse({
          rankings: [],
          topPick: "AAPL",
        })
      ).toThrow();
    });
  });

  describe("Momentum Prompts", () => {
    it("builds ranking prompt with tickers", () => {
      const prompt = buildMomentumRankingPrompt({
        tickers: [
          { ticker: "AAPL", currentPrice: 195 },
          { ticker: "MSFT", currentPrice: 420 },
          { ticker: "NVDA", currentPrice: 900 },
        ],
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("MSFT");
      expect(prompt).toContain("NVDA");
      expect(prompt).toContain("momentum");
    });

    it("includes price data when provided", () => {
      const prompt = buildMomentumRankingPrompt({
        tickers: [{ ticker: "AAPL", currentPrice: 195 }],
        priceData: "1M: +5.2%, 3M: +12.1%",
      });
      expect(prompt).toContain("Price Performance Data");
      expect(prompt).toContain("1M: +5.2%");
    });

    it("includes volume data when provided", () => {
      const prompt = buildMomentumRankingPrompt({
        tickers: [{ ticker: "AAPL", currentPrice: 195 }],
        volumeData: "AAPL volume trend: expanding on up days",
      });
      expect(prompt).toContain("Volume Data");
      expect(prompt).toContain("expanding");
    });

    it("includes sector and benchmark data", () => {
      const prompt = buildMomentumRankingPrompt({
        tickers: [{ ticker: "AAPL", currentPrice: 195 }],
        sectorData: "Tech sector +8% QTD",
        benchmarkData: "SPY +4% QTD",
      });
      expect(prompt).toContain("Sector Data");
      expect(prompt).toContain("Benchmark Comparison");
    });

    it("builds screener prompt with criteria", () => {
      const prompt = buildMomentumScreenerPrompt({
        universe: "S&P 500",
        criteria: {
          minCompositeScore: 70,
          timeframeAlignment: "aligned",
          maxExhaustionRisk: 0.4,
          accelerationOnly: true,
        },
      });
      expect(prompt).toContain("S&P 500");
      expect(prompt).toContain("70");
      expect(prompt).toContain("aligned");
      expect(prompt).toContain("0.4");
      expect(prompt).toContain("accelerating only");
    });

    it("builds screener with minimal criteria", () => {
      const prompt = buildMomentumScreenerPrompt({
        universe: "NASDAQ 100",
        criteria: {},
      });
      expect(prompt).toContain("NASDAQ 100");
      expect(prompt).not.toContain("Minimum composite");
    });

    it("builds momentum shift prompt", () => {
      const prompt = buildMomentumShiftPrompt({
        ticker: "TSLA",
        currentMomentum: "Strong upward momentum, composite 82",
        recentData: "Volume declining on last 3 up days",
      });
      expect(prompt).toContain("TSLA");
      expect(prompt).toContain("momentum shift");
      expect(prompt).toContain("composite 82");
      expect(prompt).toContain("Volume declining");
    });

    it("builds shift prompt without recent data", () => {
      const prompt = buildMomentumShiftPrompt({
        ticker: "AAPL",
        currentMomentum: "Neutral, composite 48",
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).not.toContain("Recent Data");
    });
  });
});
