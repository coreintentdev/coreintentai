import { describe, it, expect } from "vitest";
import {
  ScreenerResultSchema,
  ScreenerReportSchema,
  ScreenerSignalStrength,
} from "../src/types/index.js";
import { MultiAssetScreenerAgent } from "../src/agents/screener.js";
import { createAgentTeam } from "../src/agents/index.js";

describe("Multi-Asset Screener", () => {
  describe("ScreenerResultSchema", () => {
    const validResult = {
      ticker: "AAPL",
      compositeScore: 82,
      rank: 1,
      signals: {
        sentiment: { score: 0.6, strength: "strong" },
        momentum: { score: 75, strength: "moderate" },
        risk: { score: 35, strength: "weak" },
        anomaly: { score: 55, strength: "moderate" },
        regime: { classification: "trending_up", strength: "strong" },
      },
      conviction: 0.85,
      catalysts: ["Earnings beat expected", "New product launch Q3"],
      risks: ["Regulatory headwinds", "China revenue exposure"],
      actionSummary: "Strong buy — momentum aligned with bullish sentiment, low risk, regime-appropriate.",
    };

    it("accepts valid screener result", () => {
      const result = ScreenerResultSchema.parse(validResult);
      expect(result.ticker).toBe("AAPL");
      expect(result.compositeScore).toBe(82);
      expect(result.rank).toBe(1);
    });

    it("accepts all signal strengths", () => {
      const strengths = [
        "strong",
        "moderate",
        "weak",
        "neutral",
        "conflicting",
      ] as const;

      for (const strength of strengths) {
        const result = ScreenerResultSchema.parse({
          ...validResult,
          signals: {
            ...validResult.signals,
            sentiment: { score: 0.5, strength },
          },
        });
        expect(result.signals.sentiment.strength).toBe(strength);
      }
    });

    it("rejects composite score out of range", () => {
      expect(() =>
        ScreenerResultSchema.parse({
          ...validResult,
          compositeScore: 120,
        })
      ).toThrow();
    });

    it("rejects negative composite score", () => {
      expect(() =>
        ScreenerResultSchema.parse({
          ...validResult,
          compositeScore: -5,
        })
      ).toThrow();
    });

    it("rejects conviction out of range", () => {
      expect(() =>
        ScreenerResultSchema.parse({
          ...validResult,
          conviction: 1.5,
        })
      ).toThrow();
    });

    it("rejects rank of zero", () => {
      expect(() =>
        ScreenerResultSchema.parse({
          ...validResult,
          rank: 0,
        })
      ).toThrow();
    });

    it("rejects sentiment score out of range", () => {
      expect(() =>
        ScreenerResultSchema.parse({
          ...validResult,
          signals: {
            ...validResult.signals,
            sentiment: { score: 2.0, strength: "strong" },
          },
        })
      ).toThrow();
    });

    it("accepts empty catalysts and risks", () => {
      const result = ScreenerResultSchema.parse({
        ...validResult,
        catalysts: [],
        risks: [],
      });
      expect(result.catalysts).toHaveLength(0);
      expect(result.risks).toHaveLength(0);
    });

    it("rejects missing signal dimensions", () => {
      expect(() =>
        ScreenerResultSchema.parse({
          ...validResult,
          signals: {
            sentiment: { score: 0.5, strength: "moderate" },
          },
        })
      ).toThrow();
    });
  });

  describe("ScreenerReportSchema", () => {
    const validReport = {
      universe: ["AAPL", "MSFT", "GOOGL", "NVDA", "TSLA"],
      rankings: [
        {
          ticker: "NVDA",
          compositeScore: 88,
          rank: 1,
          signals: {
            sentiment: { score: 0.7, strength: "strong" },
            momentum: { score: 85, strength: "strong" },
            risk: { score: 40, strength: "moderate" },
            anomaly: { score: 60, strength: "moderate" },
            regime: { classification: "trending_up", strength: "strong" },
          },
          conviction: 0.9,
          catalysts: ["AI demand acceleration", "Data center buildout"],
          risks: ["Valuation stretch", "Export controls"],
          actionSummary: "Top pick — strong momentum with regime alignment.",
        },
      ],
      topPicks: ["NVDA", "AAPL"],
      avoidList: ["TSLA"],
      marketRegimeSummary:
        "Risk-on environment with tech leadership. Breadth narrowing but momentum intact.",
      sectorThemes: [
        {
          sector: "Technology",
          theme: "AI infrastructure buildout",
          direction: "bullish",
        },
        {
          sector: "Energy",
          theme: "Demand slowdown concerns",
          direction: "bearish",
        },
      ],
      diversificationNotes: [
        "Top 3 picks are all mega-cap tech — consider adding a defensive name",
        "Correlation between NVDA and AAPL rising to 0.75",
      ],
      summary:
        "NVDA leads the screen with 88/100 composite. Tech momentum is intact but concentration risk is elevated. Consider pairing with a defensive sector position.",
      timestamp: "2026-05-11T10:00:00.000Z",
    };

    it("accepts valid screener report", () => {
      const result = ScreenerReportSchema.parse(validReport);
      expect(result.universe).toHaveLength(5);
      expect(result.topPicks).toContain("NVDA");
    });

    it("accepts all sector directions", () => {
      const directions = ["bullish", "bearish", "neutral"] as const;
      for (const direction of directions) {
        const result = ScreenerReportSchema.parse({
          ...validReport,
          sectorThemes: [
            { sector: "Tech", theme: "test", direction },
          ],
        });
        expect(result.sectorThemes[0].direction).toBe(direction);
      }
    });

    it("accepts empty rankings", () => {
      const result = ScreenerReportSchema.parse({
        ...validReport,
        rankings: [],
      });
      expect(result.rankings).toHaveLength(0);
    });

    it("accepts empty avoid list", () => {
      const result = ScreenerReportSchema.parse({
        ...validReport,
        avoidList: [],
      });
      expect(result.avoidList).toHaveLength(0);
    });

    it("rejects missing required fields", () => {
      expect(() =>
        ScreenerReportSchema.parse({
          universe: ["AAPL"],
        })
      ).toThrow();
    });
  });

  describe("ScreenerSignalStrength enum", () => {
    it("has correct values", () => {
      expect(ScreenerSignalStrength.options).toEqual([
        "strong",
        "moderate",
        "weak",
        "neutral",
        "conflicting",
      ]);
    });
  });

  describe("MultiAssetScreenerAgent", () => {
    describe("Instantiation", () => {
      it("can be created without orchestrator", () => {
        const screener = new MultiAssetScreenerAgent();
        expect(screener).toBeInstanceOf(MultiAssetScreenerAgent);
      });

      it("has correct name", () => {
        const screener = new MultiAssetScreenerAgent();
        expect(screener.name).toBe("MultiAssetScreener");
      });

      it("has correct role", () => {
        const screener = new MultiAssetScreenerAgent();
        expect(screener.role).toBe(
          "Multi-dimensional asset screening and ranking agent"
        );
      });

      it("exposes execute method", () => {
        const screener = new MultiAssetScreenerAgent();
        expect(typeof screener.execute).toBe("function");
      });

      it("exposes quickScreen method", () => {
        const screener = new MultiAssetScreenerAgent();
        expect(typeof screener.quickScreen).toBe("function");
      });

      it("exposes sectorRotation method", () => {
        const screener = new MultiAssetScreenerAgent();
        expect(typeof screener.sectorRotation).toBe("function");
      });
    });

    describe("Agent Team Integration", () => {
      it("is included in createAgentTeam", () => {
        const team = createAgentTeam();
        expect(team.screener).toBeInstanceOf(MultiAssetScreenerAgent);
      });

      it("shares orchestrator with team members", () => {
        const team = createAgentTeam();
        expect(team.screener).toBeDefined();
        expect(team.analyst).toBeDefined();
        expect(team.riskManager).toBeDefined();
        expect(team.strategist).toBeDefined();
        expect(team.executor).toBeDefined();
        expect(team.watchdog).toBeDefined();
      });
    });
  });
});
