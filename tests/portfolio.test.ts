import { describe, it, expect } from "vitest";
import { PortfolioAnalysisSchema } from "../src/types/index.js";
import {
  buildPortfolioOptimizationPrompt,
  buildRebalancingPrompt,
  buildStressTestPrompt,
  buildEfficientFrontierPrompt,
} from "../src/capabilities/portfolio/prompts.js";

describe("Portfolio Optimization", () => {
  describe("PortfolioAnalysisSchema", () => {
    const validAnalysis = {
      portfolioName: "CoreIntent Growth Portfolio",
      totalValue: 250000,
      currentAllocations: [
        { ticker: "AAPL", weight: 0.2, currentValue: 50000, sector: "Technology" },
        { ticker: "MSFT", weight: 0.18, currentValue: 45000, sector: "Technology" },
        { ticker: "GOOGL", weight: 0.15, currentValue: 37500, sector: "Technology" },
        { ticker: "JPM", weight: 0.12, currentValue: 30000, sector: "Financials" },
        { ticker: "JNJ", weight: 0.1, currentValue: 25000, sector: "Healthcare" },
        { ticker: "XOM", weight: 0.08, currentValue: 20000, sector: "Energy" },
        { ticker: "BND", weight: 0.1, currentValue: 25000, sector: "Fixed Income" },
        { ticker: "CASH", weight: 0.07, currentValue: 17500, sector: "Cash" },
      ],
      riskMetrics: {
        sharpeRatio: 1.42,
        sortinoRatio: 1.85,
        maxDrawdown: 0.18,
        beta: 1.12,
        valueAtRisk95: 12500,
        expectedShortfall: 18750,
        annualizedReturn: 0.156,
        annualizedVolatility: 0.142,
      },
      optimizedAllocations: [
        {
          ticker: "AAPL",
          currentWeight: 0.2,
          targetWeight: 0.15,
          action: "decrease",
          rationale: "Reduce single-name concentration. Still the largest tech holding.",
        },
        {
          ticker: "MSFT",
          currentWeight: 0.18,
          targetWeight: 0.15,
          action: "decrease",
          rationale: "Trim to reduce tech sector concentration below 40%.",
        },
        {
          ticker: "GOOGL",
          currentWeight: 0.15,
          targetWeight: 0.12,
          action: "decrease",
          rationale: "Reduce to bring tech sector within concentration limits.",
        },
        {
          ticker: "JPM",
          currentWeight: 0.12,
          targetWeight: 0.12,
          action: "hold",
          rationale: "At target weight. Good diversifier to tech.",
        },
        {
          ticker: "JNJ",
          currentWeight: 0.1,
          targetWeight: 0.12,
          action: "increase",
          rationale: "Defensive ballast. Low correlation to tech holdings.",
        },
        {
          ticker: "VWO",
          currentWeight: 0,
          targetWeight: 0.08,
          action: "add",
          rationale: "Add emerging market exposure for geographic diversification.",
        },
      ],
      rebalancingTrades: [
        {
          ticker: "AAPL",
          side: "sell",
          amount: 12500,
          priority: "next_rebalance",
          reason: "Trim from 20% to 15% target weight",
        },
        {
          ticker: "VWO",
          side: "buy",
          amount: 20000,
          priority: "immediate",
          reason: "New position — add EM exposure for diversification",
        },
        {
          ticker: "JNJ",
          side: "buy",
          amount: 5000,
          priority: "opportunistic",
          reason: "Increase defensive allocation on pullback",
        },
      ],
      concentrationRisks: [
        {
          type: "sector",
          description: "Technology sector accounts for 53% of portfolio, well above 40% threshold",
          severity: "high",
          affectedPositions: ["AAPL", "MSFT", "GOOGL"],
          mitigation: "Reduce tech to 42% by trimming all three and adding VWO/JNJ",
        },
        {
          type: "single_position",
          description: "AAPL at 20% is the largest single-name position",
          severity: "medium",
          affectedPositions: ["AAPL"],
          mitigation: "Trim to 15% over next rebalancing cycle",
        },
        {
          type: "correlation",
          description: "AAPL/MSFT/GOOGL highly correlated (0.78 avg). Acts like a single 53% position in drawdowns.",
          severity: "high",
          affectedPositions: ["AAPL", "MSFT", "GOOGL"],
          mitigation: "True diversification requires adding uncorrelated assets (commodities, international, bonds)",
        },
      ],
      scenarioAnalysis: [
        {
          scenario: "Tech selloff (-25%)",
          probability: 0.15,
          portfolioImpact: -0.133,
          worstHit: "GOOGL",
          bestPerformer: "BND",
          recommendation: "Reduce tech to 40% now. Add put protection on QQQ.",
        },
        {
          scenario: "Rate hike (+150bp)",
          probability: 0.1,
          portfolioImpact: -0.065,
          worstHit: "BND",
          bestPerformer: "XOM",
          recommendation: "Shorten bond duration. Increase energy allocation.",
        },
        {
          scenario: "Broad market rally (+15%)",
          probability: 0.35,
          portfolioImpact: 0.142,
          worstHit: "BND",
          bestPerformer: "GOOGL",
          recommendation: "Maintain equity exposure. Set trailing stops at +10%.",
        },
      ],
      summary:
        "Portfolio is growth-oriented with strong returns (Sharpe 1.42) but dangerous tech concentration at 53%. Top priority: reduce tech to <42% by trimming AAPL/MSFT/GOOGL and adding EM/healthcare exposure. Correlation risk means a tech drawdown hits harder than individual weights suggest.",
      timestamp: "2026-04-26T10:00:00.000Z",
    };

    it("accepts valid portfolio analysis", () => {
      const result = PortfolioAnalysisSchema.parse(validAnalysis);
      expect(result.portfolioName).toBe("CoreIntent Growth Portfolio");
      expect(result.totalValue).toBe(250000);
      expect(result.currentAllocations).toHaveLength(8);
      expect(result.riskMetrics.sharpeRatio).toBe(1.42);
    });

    it("accepts all allocation actions", () => {
      const actions = ["increase", "decrease", "hold", "add", "exit"] as const;
      for (const action of actions) {
        const result = PortfolioAnalysisSchema.parse({
          ...validAnalysis,
          optimizedAllocations: [
            { ...validAnalysis.optimizedAllocations[0], action },
          ],
        });
        expect(result.optimizedAllocations[0].action).toBe(action);
      }
    });

    it("accepts all trade priorities", () => {
      const priorities = ["immediate", "next_rebalance", "opportunistic"] as const;
      for (const priority of priorities) {
        const result = PortfolioAnalysisSchema.parse({
          ...validAnalysis,
          rebalancingTrades: [
            { ...validAnalysis.rebalancingTrades[0], priority },
          ],
        });
        expect(result.rebalancingTrades[0].priority).toBe(priority);
      }
    });

    it("accepts all concentration risk types", () => {
      const types = [
        "single_position",
        "sector",
        "factor",
        "geography",
        "correlation",
      ] as const;
      for (const type of types) {
        const result = PortfolioAnalysisSchema.parse({
          ...validAnalysis,
          concentrationRisks: [
            { ...validAnalysis.concentrationRisks[0], type },
          ],
        });
        expect(result.concentrationRisks[0].type).toBe(type);
      }
    });

    it("accepts all concentration risk severities", () => {
      const severities = ["low", "medium", "high", "critical"] as const;
      for (const severity of severities) {
        const result = PortfolioAnalysisSchema.parse({
          ...validAnalysis,
          concentrationRisks: [
            { ...validAnalysis.concentrationRisks[0], severity },
          ],
        });
        expect(result.concentrationRisks[0].severity).toBe(severity);
      }
    });

    it("validates risk metrics ranges", () => {
      const result = PortfolioAnalysisSchema.parse(validAnalysis);
      expect(result.riskMetrics.maxDrawdown).toBeLessThanOrEqual(1);
      expect(result.riskMetrics.maxDrawdown).toBeGreaterThanOrEqual(0);
      expect(result.riskMetrics.annualizedVolatility).toBeGreaterThanOrEqual(0);
    });

    it("rejects negative total value", () => {
      expect(() =>
        PortfolioAnalysisSchema.parse({
          ...validAnalysis,
          totalValue: -50000,
        })
      ).toThrow();
    });

    it("rejects weight out of range", () => {
      expect(() =>
        PortfolioAnalysisSchema.parse({
          ...validAnalysis,
          currentAllocations: [
            { ...validAnalysis.currentAllocations[0], weight: 1.5 },
          ],
        })
      ).toThrow();
    });

    it("rejects negative weight", () => {
      expect(() =>
        PortfolioAnalysisSchema.parse({
          ...validAnalysis,
          currentAllocations: [
            { ...validAnalysis.currentAllocations[0], weight: -0.1 },
          ],
        })
      ).toThrow();
    });

    it("rejects max drawdown out of range", () => {
      expect(() =>
        PortfolioAnalysisSchema.parse({
          ...validAnalysis,
          riskMetrics: { ...validAnalysis.riskMetrics, maxDrawdown: 1.5 },
        })
      ).toThrow();
    });

    it("rejects scenario probability out of range", () => {
      expect(() =>
        PortfolioAnalysisSchema.parse({
          ...validAnalysis,
          scenarioAnalysis: [
            { ...validAnalysis.scenarioAnalysis[0], probability: 2.0 },
          ],
        })
      ).toThrow();
    });

    it("rejects negative trade amount", () => {
      expect(() =>
        PortfolioAnalysisSchema.parse({
          ...validAnalysis,
          rebalancingTrades: [
            { ...validAnalysis.rebalancingTrades[0], amount: -1000 },
          ],
        })
      ).toThrow();
    });

    it("rejects invalid allocation action", () => {
      expect(() =>
        PortfolioAnalysisSchema.parse({
          ...validAnalysis,
          optimizedAllocations: [
            { ...validAnalysis.optimizedAllocations[0], action: "yolo" },
          ],
        })
      ).toThrow();
    });

    it("accepts empty arrays", () => {
      const result = PortfolioAnalysisSchema.parse({
        ...validAnalysis,
        currentAllocations: [],
        optimizedAllocations: [],
        rebalancingTrades: [],
        concentrationRisks: [],
        scenarioAnalysis: [],
      });
      expect(result.currentAllocations).toHaveLength(0);
      expect(result.concentrationRisks).toHaveLength(0);
    });

    it("rejects missing required fields", () => {
      expect(() =>
        PortfolioAnalysisSchema.parse({
          portfolioName: "Test",
          totalValue: 100000,
        })
      ).toThrow();
    });
  });

  describe("Portfolio Prompts", () => {
    it("builds portfolio optimization prompt", () => {
      const prompt = buildPortfolioOptimizationPrompt({
        positions: [
          { ticker: "AAPL", shares: 100, avgCost: 150, currentPrice: 195 },
          { ticker: "MSFT", shares: 50, avgCost: 350, currentPrice: 420 },
        ],
        totalValue: 40500,
        riskTolerance: "moderate",
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("MSFT");
      expect(prompt).toContain("moderate");
      expect(prompt).toContain("$40,500");
      expect(prompt).toContain("P&L");
    });

    it("includes constraints when provided", () => {
      const prompt = buildPortfolioOptimizationPrompt({
        positions: [
          { ticker: "AAPL", shares: 100, avgCost: 150, currentPrice: 195 },
        ],
        totalValue: 19500,
        riskTolerance: "conservative",
        constraints: "No crypto, no leveraged ETFs",
      });
      expect(prompt).toContain("Constraints");
      expect(prompt).toContain("No crypto");
    });

    it("includes market context when provided", () => {
      const prompt = buildPortfolioOptimizationPrompt({
        positions: [
          { ticker: "SPY", shares: 100, avgCost: 480, currentPrice: 520 },
        ],
        totalValue: 52000,
        riskTolerance: "aggressive",
        marketContext: "Fed signaling rate cuts, VIX at 12",
      });
      expect(prompt).toContain("Market Context");
      expect(prompt).toContain("rate cuts");
    });

    it("builds rebalancing prompt", () => {
      const prompt = buildRebalancingPrompt({
        currentPositions: [
          { ticker: "AAPL", weight: 0.25, targetWeight: 0.2 },
          { ticker: "MSFT", weight: 0.15, targetWeight: 0.2 },
        ],
        totalValue: 100000,
        rebalanceThreshold: 5,
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("current 25.0%");
      expect(prompt).toContain("target 20.0%");
      expect(prompt).toContain("drift");
      expect(prompt).toContain("5%");
    });

    it("rebalancing includes tax considerations", () => {
      const prompt = buildRebalancingPrompt({
        currentPositions: [
          { ticker: "AAPL", weight: 0.3, targetWeight: 0.2 },
        ],
        totalValue: 100000,
        rebalanceThreshold: 5,
        taxConsiderations: "Short-term gains on AAPL lots purchased < 1 year ago",
      });
      expect(prompt).toContain("Tax Considerations");
      expect(prompt).toContain("Short-term gains");
    });

    it("builds stress test prompt", () => {
      const prompt = buildStressTestPrompt({
        positions: [
          { ticker: "AAPL", weight: 0.3, sector: "Technology" },
          { ticker: "JPM", weight: 0.2, sector: "Financials" },
        ],
        totalValue: 100000,
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("Technology");
      expect(prompt).toContain("Market crash");
      expect(prompt).toContain("Stress test");
    });

    it("stress test uses custom scenarios", () => {
      const prompt = buildStressTestPrompt({
        positions: [{ ticker: "BTC", weight: 0.5, sector: "Crypto" }],
        totalValue: 50000,
        scenarios: ["Crypto winter (-80%)", "Regulatory ban"],
      });
      expect(prompt).toContain("Crypto winter");
      expect(prompt).toContain("Regulatory ban");
      expect(prompt).not.toContain("Market crash");
    });

    it("builds efficient frontier prompt", () => {
      const prompt = buildEfficientFrontierPrompt({
        universe: ["AAPL", "MSFT", "GOOGL", "JPM", "JNJ", "BND"],
      });
      expect(prompt).toContain("AAPL, MSFT, GOOGL, JPM, JNJ, BND");
      expect(prompt).toContain("efficient frontier");
      expect(prompt).toContain("minimum variance");
      expect(prompt).toContain("maximum Sharpe");
    });

    it("efficient frontier includes current allocation", () => {
      const prompt = buildEfficientFrontierPrompt({
        universe: ["AAPL", "MSFT"],
        currentAllocation: [
          { ticker: "AAPL", weight: 0.6 },
          { ticker: "MSFT", weight: 0.4 },
        ],
      });
      expect(prompt).toContain("Current Allocation");
      expect(prompt).toContain("60.0%");
      expect(prompt).toContain("40.0%");
    });

    it("efficient frontier includes constraints", () => {
      const prompt = buildEfficientFrontierPrompt({
        universe: ["AAPL", "MSFT", "BND"],
        constraints: "Min 20% fixed income, max 30% per position",
      });
      expect(prompt).toContain("Constraints");
      expect(prompt).toContain("20% fixed income");
    });
  });
});
