import { describe, it, expect } from "vitest";
import {
  CorrelationAnalysisSchema,
  PairCorrelationSchema,
  PortfolioOptimizationSchema,
} from "../src/capabilities/correlation/index.js";
import {
  buildCorrelationAnalysisPrompt,
  buildPairCorrelationPrompt,
  buildPortfolioOptimizationPrompt,
} from "../src/capabilities/correlation/prompts.js";

describe("Portfolio Correlation & Optimization", () => {
  describe("CorrelationAnalysisSchema", () => {
    const validAnalysis = {
      portfolioId: "analysis",
      correlationPairs: [
        {
          tickerA: "AAPL",
          tickerB: "MSFT",
          correlation: 0.82,
          correlationType: "direct" as const,
          stressCorrelation: 0.93,
          explanation: "Both mega-cap tech, shared factor exposure to growth/quality",
        },
        {
          tickerA: "AAPL",
          tickerB: "GLD",
          correlation: -0.15,
          correlationType: "inverse" as const,
          stressCorrelation: -0.35,
          explanation: "Gold as risk-off asset inversely correlated with growth equities",
        },
      ],
      clusterAnalysis: [
        {
          clusterId: 1,
          name: "Mega-Cap Tech",
          tickers: ["AAPL", "MSFT", "GOOGL"],
          dominantFactor: "Growth/Quality factor",
          clusterWeight: 0.65,
          riskContribution: 0.78,
        },
      ],
      diversificationScore: 0.35,
      effectivePositions: 2.1,
      concentrationRisks: [
        {
          type: "sector" as const,
          description: "65% concentrated in technology sector",
          severity: "high" as const,
          affectedTickers: ["AAPL", "MSFT", "GOOGL"],
          recommendation: "Add defensive sectors: healthcare, utilities, consumer staples",
        },
      ],
      hedgeRecommendations: [
        {
          hedgeType: "tail_hedge" as const,
          instrument: "SPY put spread (5% OTM)",
          rationale: "Protects against broad market selloff affecting correlated tech positions",
          expectedCost: "0.8% annually",
          riskReduction: "Caps portfolio drawdown at approximately 15%",
        },
      ],
      stressScenarios: [
        {
          scenario: "Tech earnings miss + rate hike",
          expectedCorrelationShift: "Tech cluster correlation spikes to 0.95+",
          estimatedDrawdown: "-18% to -25%",
          mostVulnerable: ["GOOGL", "MSFT"],
        },
      ],
      summary:
        "Portfolio is heavily concentrated in mega-cap tech with a diversification score of 0.35. Effective positions are only 2.1 despite holding 5 tickers. Recommend adding non-correlated assets.",
      timestamp: "2026-04-19T12:00:00.000Z",
    };

    it("accepts valid correlation analysis", () => {
      const result = CorrelationAnalysisSchema.parse(validAnalysis);
      expect(result.diversificationScore).toBe(0.35);
      expect(result.effectivePositions).toBe(2.1);
      expect(result.correlationPairs).toHaveLength(2);
      expect(result.clusterAnalysis).toHaveLength(1);
    });

    it("validates correlation range", () => {
      expect(() =>
        CorrelationAnalysisSchema.parse({
          ...validAnalysis,
          correlationPairs: [
            {
              ...validAnalysis.correlationPairs[0],
              correlation: 1.5,
            },
          ],
        })
      ).toThrow();
    });

    it("validates diversification score range", () => {
      expect(() =>
        CorrelationAnalysisSchema.parse({
          ...validAnalysis,
          diversificationScore: 1.5,
        })
      ).toThrow();
    });

    it("accepts all correlation types", () => {
      const types = ["direct", "indirect", "inverse", "regime_dependent"] as const;
      for (const type of types) {
        const pair = {
          ...validAnalysis.correlationPairs[0],
          correlationType: type,
        };
        const result = CorrelationAnalysisSchema.parse({
          ...validAnalysis,
          correlationPairs: [pair],
        });
        expect(result.correlationPairs[0].correlationType).toBe(type);
      }
    });

    it("accepts all concentration risk types", () => {
      const types = ["sector", "factor", "geographic", "macro"] as const;
      for (const type of types) {
        const risk = { ...validAnalysis.concentrationRisks[0], type };
        const result = CorrelationAnalysisSchema.parse({
          ...validAnalysis,
          concentrationRisks: [risk],
        });
        expect(result.concentrationRisks[0].type).toBe(type);
      }
    });

    it("accepts all severity levels", () => {
      const levels = ["low", "moderate", "high", "critical"] as const;
      for (const severity of levels) {
        const risk = { ...validAnalysis.concentrationRisks[0], severity };
        const result = CorrelationAnalysisSchema.parse({
          ...validAnalysis,
          concentrationRisks: [risk],
        });
        expect(result.concentrationRisks[0].severity).toBe(severity);
      }
    });

    it("accepts all hedge types", () => {
      const types = [
        "direct_hedge",
        "tail_hedge",
        "factor_hedge",
        "correlation_trade",
      ] as const;
      for (const hedgeType of types) {
        const hedge = { ...validAnalysis.hedgeRecommendations[0], hedgeType };
        const result = CorrelationAnalysisSchema.parse({
          ...validAnalysis,
          hedgeRecommendations: [hedge],
        });
        expect(result.hedgeRecommendations[0].hedgeType).toBe(hedgeType);
      }
    });

    it("accepts empty arrays", () => {
      const result = CorrelationAnalysisSchema.parse({
        ...validAnalysis,
        correlationPairs: [],
        clusterAnalysis: [],
        concentrationRisks: [],
        hedgeRecommendations: [],
        stressScenarios: [],
      });
      expect(result.correlationPairs).toHaveLength(0);
    });
  });

  describe("PairCorrelationSchema", () => {
    const validPair = {
      tickerA: "AAPL",
      tickerB: "MSFT",
      correlation: 0.82,
      correlationType: "direct" as const,
      stressCorrelation: 0.93,
      rollingCorrelation: {
        "30d": 0.78,
        "90d": 0.81,
        "1y": 0.85,
      },
      sharedFactors: ["Technology sector", "Growth factor", "Quality factor"],
      divergenceRisk: 0.15,
      tradingImplications: "Pair trade opportunities when correlation deviates from norm",
      explanation: "Both mega-cap tech with shared macro sensitivity",
      timestamp: "2026-04-19T12:00:00.000Z",
    };

    it("accepts valid pair correlation", () => {
      const result = PairCorrelationSchema.parse(validPair);
      expect(result.correlation).toBe(0.82);
      expect(result.rollingCorrelation["30d"]).toBe(0.78);
      expect(result.sharedFactors).toHaveLength(3);
    });

    it("validates rolling correlation range", () => {
      expect(() =>
        PairCorrelationSchema.parse({
          ...validPair,
          rollingCorrelation: { "30d": 2.0, "90d": 0.5, "1y": 0.5 },
        })
      ).toThrow();
    });

    it("validates divergence risk range", () => {
      expect(() =>
        PairCorrelationSchema.parse({
          ...validPair,
          divergenceRisk: 1.5,
        })
      ).toThrow();
    });
  });

  describe("PortfolioOptimizationSchema", () => {
    const validOptimization = {
      objective: "max_sharpe",
      currentPortfolio: {
        expectedReturn: 0.12,
        expectedVolatility: 0.22,
        sharpeRatio: 0.55,
        maxDrawdown: "-35%",
      },
      optimizedPortfolio: {
        positions: [
          {
            ticker: "AAPL",
            currentWeight: 0.40,
            optimizedWeight: 0.25,
            change: -0.15,
            rationale: "Reduce concentration to lower portfolio variance",
          },
          {
            ticker: "GLD",
            currentWeight: 0.05,
            optimizedWeight: 0.15,
            change: 0.10,
            rationale: "Increase hedge allocation for diversification",
          },
        ],
        expectedReturn: 0.10,
        expectedVolatility: 0.15,
        sharpeRatio: 0.67,
        maxDrawdown: "-22%",
        diversificationRatio: 1.45,
      },
      rebalancingActions: [
        {
          action: "decrease" as const,
          ticker: "AAPL",
          fromWeight: 0.40,
          toWeight: 0.25,
          priority: "high" as const,
        },
        {
          action: "increase" as const,
          ticker: "GLD",
          fromWeight: 0.05,
          toWeight: 0.15,
          priority: "medium" as const,
        },
      ],
      summary: "Rebalancing from tech-heavy to more diversified improves Sharpe from 0.55 to 0.67.",
      timestamp: "2026-04-19T12:00:00.000Z",
    };

    it("accepts valid optimization result", () => {
      const result = PortfolioOptimizationSchema.parse(validOptimization);
      expect(result.objective).toBe("max_sharpe");
      expect(result.optimizedPortfolio.sharpeRatio).toBe(0.67);
      expect(result.rebalancingActions).toHaveLength(2);
    });

    it("accepts all rebalancing action types", () => {
      const actions = ["increase", "decrease", "add", "remove"] as const;
      for (const action of actions) {
        const act = { ...validOptimization.rebalancingActions[0], action };
        const result = PortfolioOptimizationSchema.parse({
          ...validOptimization,
          rebalancingActions: [act],
        });
        expect(result.rebalancingActions[0].action).toBe(action);
      }
    });

    it("accepts all priority levels", () => {
      const priorities = ["high", "medium", "low"] as const;
      for (const priority of priorities) {
        const act = { ...validOptimization.rebalancingActions[0], priority };
        const result = PortfolioOptimizationSchema.parse({
          ...validOptimization,
          rebalancingActions: [act],
        });
        expect(result.rebalancingActions[0].priority).toBe(priority);
      }
    });

    it("validates weight ranges in rebalancing actions", () => {
      expect(() =>
        PortfolioOptimizationSchema.parse({
          ...validOptimization,
          rebalancingActions: [
            { ...validOptimization.rebalancingActions[0], fromWeight: 1.5 },
          ],
        })
      ).toThrow();
    });
  });

  describe("Correlation Prompts", () => {
    it("builds portfolio correlation prompt", () => {
      const prompt = buildCorrelationAnalysisPrompt({
        positions: [
          { ticker: "AAPL", weight: 0.3, sector: "Technology" },
          { ticker: "MSFT", weight: 0.25, sector: "Technology" },
          { ticker: "GLD", weight: 0.1 },
        ],
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("30.0%");
      expect(prompt).toContain("Technology");
      expect(prompt).toContain("GLD");
      expect(prompt).toContain("JSON");
    });

    it("includes market conditions when provided", () => {
      const prompt = buildCorrelationAnalysisPrompt({
        positions: [{ ticker: "AAPL", weight: 0.5 }],
        marketConditions: "VIX at 25, Fed hiking cycle",
      });
      expect(prompt).toContain("VIX at 25");
    });

    it("includes lookback period when provided", () => {
      const prompt = buildCorrelationAnalysisPrompt({
        positions: [{ ticker: "AAPL", weight: 0.5 }],
        lookbackPeriod: "6 months",
      });
      expect(prompt).toContain("6 months");
    });

    it("builds pair correlation prompt", () => {
      const prompt = buildPairCorrelationPrompt({
        tickerA: "AAPL",
        tickerB: "MSFT",
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("MSFT");
      expect(prompt).toContain("correlation");
    });

    it("includes price data in pair prompt", () => {
      const prompt = buildPairCorrelationPrompt({
        tickerA: "AAPL",
        tickerB: "MSFT",
        priceDataA: "200, 205, 210",
        priceDataB: "400, 410, 415",
      });
      expect(prompt).toContain("200, 205, 210");
      expect(prompt).toContain("400, 410, 415");
    });

    it("builds portfolio optimization prompt", () => {
      const prompt = buildPortfolioOptimizationPrompt({
        positions: [
          { ticker: "AAPL", weight: 0.4, expectedReturn: 0.12 },
          { ticker: "GLD", weight: 0.1 },
        ],
        objective: "max_sharpe",
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("40.0%");
      expect(prompt).toContain("12.0%");
      expect(prompt).toContain("Maximum Sharpe Ratio");
    });

    it("includes constraints in optimization prompt", () => {
      const prompt = buildPortfolioOptimizationPrompt({
        positions: [{ ticker: "AAPL", weight: 0.5 }],
        constraints: {
          maxPositionWeight: 0.25,
          minPositionWeight: 0.05,
          maxSectorWeight: 0.40,
          targetVolatility: 0.15,
        },
      });
      expect(prompt).toContain("25%");
      expect(prompt).toContain("5%");
      expect(prompt).toContain("40%");
      expect(prompt).toContain("15%");
    });

    it("defaults to max_sharpe objective", () => {
      const prompt = buildPortfolioOptimizationPrompt({
        positions: [{ ticker: "AAPL", weight: 0.5 }],
      });
      expect(prompt).toContain("Maximum Sharpe Ratio");
    });

    it("supports all optimization objectives", () => {
      const objectives = [
        "max_sharpe",
        "min_variance",
        "risk_parity",
        "max_diversification",
      ] as const;
      for (const obj of objectives) {
        const prompt = buildPortfolioOptimizationPrompt({
          positions: [{ ticker: "AAPL", weight: 0.5 }],
          objective: obj,
        });
        expect(prompt).toContain("Optimize");
      }
    });
  });
});
