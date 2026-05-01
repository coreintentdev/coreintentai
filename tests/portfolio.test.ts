import { describe, it, expect } from "vitest";
import {
  PortfolioPositionSchema,
  ExposureBreakdownSchema,
  RebalanceActionSchema,
  HedgingRecommendationSchema,
  ScenarioAnalysisSchema,
  PortfolioAnalysisSchema,
} from "../src/types/index.js";
import {
  buildPortfolioAnalysisPrompt,
  buildRebalancePrompt,
  buildStressTestPrompt,
} from "../src/capabilities/portfolio/prompts.js";

describe("Portfolio Intelligence", () => {
  describe("PortfolioPositionSchema", () => {
    it("accepts valid position", () => {
      const result = PortfolioPositionSchema.parse({
        ticker: "AAPL",
        shares: 100,
        avgCost: 150.0,
        currentPrice: 195.0,
        marketValue: 19500,
        weight: 0.25,
        pnl: 4500,
        pnlPct: 30.0,
      });
      expect(result.ticker).toBe("AAPL");
      expect(result.weight).toBe(0.25);
    });

    it("rejects negative price", () => {
      expect(() =>
        PortfolioPositionSchema.parse({
          ticker: "AAPL",
          shares: 100,
          avgCost: -10,
          currentPrice: 195,
          marketValue: 19500,
          weight: 0.25,
          pnl: 0,
          pnlPct: 0,
        })
      ).toThrow();
    });

    it("rejects weight above 1", () => {
      expect(() =>
        PortfolioPositionSchema.parse({
          ticker: "AAPL",
          shares: 100,
          avgCost: 150,
          currentPrice: 195,
          marketValue: 19500,
          weight: 1.5,
          pnl: 0,
          pnlPct: 0,
        })
      ).toThrow();
    });
  });

  describe("ExposureBreakdownSchema", () => {
    it("accepts valid breakdown", () => {
      const result = ExposureBreakdownSchema.parse({
        sector: { technology: 0.45, healthcare: 0.25, financials: 0.3 },
        geography: { us: 0.8, international: 0.2 },
        assetClass: { equity: 0.9, bonds: 0.1 },
        factorExposure: { growth: 0.6, value: 0.3, momentum: 0.1 },
      });
      expect(result.sector.technology).toBe(0.45);
    });
  });

  describe("RebalanceActionSchema", () => {
    it("accepts valid rebalance action", () => {
      const result = RebalanceActionSchema.parse({
        ticker: "NVDA",
        action: "trim",
        currentWeight: 0.35,
        targetWeight: 0.2,
        sharesToTrade: 50,
        estimatedCost: 0,
        rationale: "Reduce concentration risk in single position",
        priority: "immediate",
      });
      expect(result.action).toBe("trim");
      expect(result.priority).toBe("immediate");
    });

    it("accepts all action types", () => {
      const actions = ["buy", "sell", "hold", "trim", "add"] as const;
      for (const action of actions) {
        const result = RebalanceActionSchema.parse({
          ticker: "TEST",
          action,
          currentWeight: 0.1,
          targetWeight: 0.15,
          sharesToTrade: 10,
          estimatedCost: 1000,
          rationale: "test",
          priority: "soon",
        });
        expect(result.action).toBe(action);
      }
    });

    it("rejects invalid priority", () => {
      expect(() =>
        RebalanceActionSchema.parse({
          ticker: "TEST",
          action: "buy",
          currentWeight: 0.1,
          targetWeight: 0.15,
          sharesToTrade: 10,
          estimatedCost: 1000,
          rationale: "test",
          priority: "urgent",
        })
      ).toThrow();
    });
  });

  describe("HedgingRecommendationSchema", () => {
    it("accepts valid hedging recommendation", () => {
      const result = HedgingRecommendationSchema.parse({
        strategy: "Protective put on SPY",
        instrument: "SPY 520P 2026-06-20",
        rationale: "Protect against 5%+ drawdown in broad market",
        estimatedCost: "$2,500 premium",
        priority: "soon",
      });
      expect(result.strategy).toContain("put");
    });
  });

  describe("ScenarioAnalysisSchema", () => {
    it("accepts valid scenario", () => {
      const result = ScenarioAnalysisSchema.parse({
        scenario: "Rate hike 100bps",
        probability: 0.15,
        portfolioImpact: -8.5,
        worstCaseDrawdown: -15,
        recommendations: ["Reduce duration", "Add inflation hedges"],
      });
      expect(result.probability).toBe(0.15);
      expect(result.recommendations).toHaveLength(2);
    });

    it("rejects probability > 1", () => {
      expect(() =>
        ScenarioAnalysisSchema.parse({
          scenario: "test",
          probability: 1.5,
          portfolioImpact: -5,
          worstCaseDrawdown: -10,
          recommendations: [],
        })
      ).toThrow();
    });
  });

  describe("PortfolioAnalysisSchema", () => {
    const validAnalysis = {
      totalValue: 250000,
      totalPositions: 8,
      overallHealth: "good",
      riskScore: 42,
      diversificationScore: 68,
      concentrationRisk: {
        topHolding: { ticker: "NVDA", weight: 0.22 },
        top3Weight: 0.55,
        herfindahlIndex: 0.15,
        assessment: "Moderate concentration in top holdings",
      },
      exposureBreakdown: {
        sector: { technology: 0.45, healthcare: 0.2, financials: 0.15, energy: 0.1, consumer: 0.1 },
        geography: { us: 0.85, international: 0.15 },
        assetClass: { equity: 0.9, cash: 0.1 },
        factorExposure: { growth: 0.55, quality: 0.25, momentum: 0.2 },
      },
      rebalanceActions: [
        {
          ticker: "NVDA",
          action: "trim",
          currentWeight: 0.22,
          targetWeight: 0.15,
          sharesToTrade: 25,
          estimatedCost: 0,
          rationale: "Reduce single-name concentration",
          priority: "soon",
        },
      ],
      hedgingRecommendations: [
        {
          strategy: "Collar on NVDA",
          instrument: "NVDA 130C/100P",
          rationale: "Lock in gains while limiting downside",
          estimatedCost: "Net zero (funded collar)",
          priority: "opportunistic",
        },
      ],
      scenarioAnalysis: [
        {
          scenario: "Tech selloff -20%",
          probability: 0.2,
          portfolioImpact: -9,
          worstCaseDrawdown: -14,
          recommendations: ["Rotate from tech to defensive sectors"],
        },
        {
          scenario: "Broad market rally +15%",
          probability: 0.35,
          portfolioImpact: 13.5,
          worstCaseDrawdown: -3,
          recommendations: ["Maintain current exposure, trail stops higher"],
        },
      ],
      summary:
        "Portfolio is in good health with moderate tech concentration. Consider trimming NVDA and diversifying into underrepresented sectors.",
      timestamp: "2026-05-01T12:00:00.000Z",
    };

    it("accepts valid portfolio analysis", () => {
      const result = PortfolioAnalysisSchema.parse(validAnalysis);
      expect(result.overallHealth).toBe("good");
      expect(result.totalPositions).toBe(8);
      expect(result.rebalanceActions).toHaveLength(1);
      expect(result.scenarioAnalysis).toHaveLength(2);
    });

    it("accepts all health levels", () => {
      const levels = ["excellent", "good", "fair", "poor", "critical"] as const;
      for (const level of levels) {
        const result = PortfolioAnalysisSchema.parse({
          ...validAnalysis,
          overallHealth: level,
        });
        expect(result.overallHealth).toBe(level);
      }
    });

    it("rejects risk score out of range", () => {
      expect(() =>
        PortfolioAnalysisSchema.parse({
          ...validAnalysis,
          riskScore: 150,
        })
      ).toThrow();
    });

    it("rejects negative diversification score", () => {
      expect(() =>
        PortfolioAnalysisSchema.parse({
          ...validAnalysis,
          diversificationScore: -5,
        })
      ).toThrow();
    });

    it("accepts empty arrays", () => {
      const result = PortfolioAnalysisSchema.parse({
        ...validAnalysis,
        rebalanceActions: [],
        hedgingRecommendations: [],
        scenarioAnalysis: [],
      });
      expect(result.rebalanceActions).toHaveLength(0);
    });

    it("rejects missing required fields", () => {
      expect(() =>
        PortfolioAnalysisSchema.parse({
          totalValue: 100000,
          totalPositions: 5,
        })
      ).toThrow();
    });

    it("rejects herfindahl index > 1", () => {
      expect(() =>
        PortfolioAnalysisSchema.parse({
          ...validAnalysis,
          concentrationRisk: {
            ...validAnalysis.concentrationRisk,
            herfindahlIndex: 1.5,
          },
        })
      ).toThrow();
    });
  });

  describe("Portfolio Prompts", () => {
    const samplePositions = [
      { ticker: "AAPL", shares: 100, avgCost: 150, currentPrice: 195 },
      { ticker: "NVDA", shares: 50, avgCost: 400, currentPrice: 900 },
      { ticker: "MSFT", shares: 75, avgCost: 300, currentPrice: 420 },
    ];

    describe("buildPortfolioAnalysisPrompt", () => {
      it("includes all positions with calculations", () => {
        const prompt = buildPortfolioAnalysisPrompt({
          positions: samplePositions,
          totalValue: 100000,
        });
        expect(prompt).toContain("AAPL");
        expect(prompt).toContain("NVDA");
        expect(prompt).toContain("MSFT");
        expect(prompt).toContain("Weight:");
        expect(prompt).toContain("PnL:");
      });

      it("includes cash balance", () => {
        const prompt = buildPortfolioAnalysisPrompt({
          positions: samplePositions,
          totalValue: 110000,
          cashBalance: 10000,
        });
        expect(prompt).toContain("CASH");
        expect(prompt).toContain("$10,000");
      });

      it("includes risk tolerance", () => {
        const prompt = buildPortfolioAnalysisPrompt({
          positions: samplePositions,
          totalValue: 100000,
          riskTolerance: "moderate",
        });
        expect(prompt).toContain("moderate");
      });

      it("includes benchmarks", () => {
        const prompt = buildPortfolioAnalysisPrompt({
          positions: samplePositions,
          totalValue: 100000,
          benchmarks: ["SPY", "QQQ"],
        });
        expect(prompt).toContain("SPY");
        expect(prompt).toContain("QQQ");
      });

      it("includes market context", () => {
        const prompt = buildPortfolioAnalysisPrompt({
          positions: samplePositions,
          totalValue: 100000,
          marketContext: "VIX at 12, market near all-time highs",
        });
        expect(prompt).toContain("VIX at 12");
      });
    });

    describe("buildRebalancePrompt", () => {
      it("shows current vs target weights", () => {
        const prompt = buildRebalancePrompt({
          positions: [
            { ticker: "AAPL", currentWeight: 0.3, targetWeight: 0.2, currentPrice: 195 },
            { ticker: "NVDA", currentWeight: 0.15, targetWeight: 0.25, currentPrice: 900 },
          ],
          totalValue: 100000,
        });
        expect(prompt).toContain("AAPL");
        expect(prompt).toContain("trim");
        expect(prompt).toContain("add");
      });

      it("includes constraints", () => {
        const prompt = buildRebalancePrompt({
          positions: [
            { ticker: "AAPL", currentWeight: 0.3, targetWeight: 0.2, currentPrice: 195 },
          ],
          totalValue: 100000,
          constraints: ["No more than 20% in any single position", "Min $500 trade size"],
        });
        expect(prompt).toContain("No more than 20%");
        expect(prompt).toContain("Min $500");
      });

      it("includes tax considerations", () => {
        const prompt = buildRebalancePrompt({
          positions: [
            { ticker: "AAPL", currentWeight: 0.3, targetWeight: 0.2, currentPrice: 195 },
          ],
          totalValue: 100000,
          taxConsiderations: "Prefer long-term capital gains. Tax loss harvest where possible.",
        });
        expect(prompt).toContain("long-term capital gains");
      });
    });

    describe("buildStressTestPrompt", () => {
      it("includes portfolio and scenarios", () => {
        const prompt = buildStressTestPrompt({
          positions: [
            { ticker: "AAPL", weight: 0.3 },
            { ticker: "NVDA", weight: 0.4 },
            { ticker: "MSFT", weight: 0.3 },
          ],
          scenarios: ["Black swan crash -30%", "Fed pivot to dovish"],
          totalValue: 200000,
        });
        expect(prompt).toContain("AAPL");
        expect(prompt).toContain("30.0%");
        expect(prompt).toContain("Black swan");
        expect(prompt).toContain("Fed pivot");
        expect(prompt).toContain("$200,000");
      });
    });
  });
});
