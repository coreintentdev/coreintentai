import { describe, it, expect } from "vitest";
import { PortfolioOptimizationSchema } from "../src/types/index.js";
import {
  buildOptimizationPrompt,
  buildRebalancePrompt,
  buildRiskParityPrompt,
  buildFactorAnalysisPrompt,
  PORTFOLIO_SYSTEM_PROMPT,
} from "../src/capabilities/portfolio/prompts.js";
import { PortfolioOptimizer } from "../src/capabilities/portfolio/index.js";

describe("Portfolio Optimization", () => {
  describe("Schema Validation", () => {
    const validPortfolio = {
      portfolioId: "pf-001",
      method: "black_litterman",
      allocations: [
        {
          ticker: "AAPL",
          currentWeight: 0.30,
          targetWeight: 0.25,
          delta: -0.05,
          riskContribution: 0.28,
          expectedReturn: 0.12,
          rationale: "Reduce concentration risk; still attractive growth",
        },
        {
          ticker: "MSFT",
          currentWeight: 0.20,
          targetWeight: 0.22,
          delta: 0.02,
          riskContribution: 0.18,
          expectedReturn: 0.11,
          rationale: "Increase exposure to cloud/AI secular trend",
        },
        {
          ticker: "BND",
          currentWeight: 0.15,
          targetWeight: 0.20,
          delta: 0.05,
          riskContribution: 0.05,
          expectedReturn: 0.04,
          rationale: "Increase bond allocation for volatility dampening",
        },
      ],
      portfolioMetrics: {
        expectedReturn: 0.095,
        expectedVolatility: 0.14,
        sharpeRatio: 0.68,
        sortinoRatio: 0.92,
        maxDrawdown: -0.18,
        cvar95: -0.22,
        diversificationRatio: 1.35,
        effectiveBets: 4.2,
        turnover: 0.12,
      },
      factorExposures: [
        { factor: "market", exposure: 0.85, intentional: true, comment: "Slightly underweight market beta" },
        { factor: "momentum", exposure: 0.15, intentional: false, comment: "Unintended momentum tilt from tech overweight" },
        { factor: "quality", exposure: 0.22, intentional: true, comment: "Deliberate quality tilt" },
      ],
      rebalancingPlan: {
        urgency: "scheduled" as const,
        trades: [
          {
            ticker: "AAPL",
            action: "trim" as const,
            shares: 28,
            dollarAmount: 5460,
            priority: 1,
            reason: "Reduce overweight to target",
          },
          {
            ticker: "BND",
            action: "buy" as const,
            shares: 70,
            dollarAmount: 5000,
            priority: 2,
            reason: "Increase defensive allocation",
          },
        ],
        estimatedCost: 15.50,
        taxImplications: "AAPL trim triggers short-term capital gains on recent lots",
      },
      scenarioAnalysis: [
        {
          scenario: "Bull case — soft landing",
          probability: 0.35,
          portfolioReturn: 0.18,
          worstPosition: "BND",
          bestPosition: "AAPL",
          recommendation: "Hold current allocation; trim bonds if confirmed",
        },
        {
          scenario: "Bear case — recession",
          probability: 0.20,
          portfolioReturn: -0.15,
          worstPosition: "AAPL",
          bestPosition: "BND",
          recommendation: "Accelerate bond allocation; add defensive names",
        },
      ],
      constraints: {
        maxPositionSize: 0.30,
        maxSectorConcentration: 0.40,
        minCashReserve: 0.05,
        maxTurnover: 0.20,
      },
      summary: "Portfolio is modestly overweight tech. Black-Litterman suggests trimming AAPL and adding bonds to improve risk-adjusted returns.",
      timestamp: new Date().toISOString(),
    };

    it("validates a complete portfolio optimization", () => {
      const result = PortfolioOptimizationSchema.safeParse(validPortfolio);
      expect(result.success).toBe(true);
    });

    it("validates all optimization methods", () => {
      const methods = ["mean_variance", "black_litterman", "risk_parity", "min_variance", "max_diversification"];
      for (const method of methods) {
        const data = { ...validPortfolio, method };
        expect(PortfolioOptimizationSchema.safeParse(data).success).toBe(true);
      }
    });

    it("rejects invalid optimization method", () => {
      const data = { ...validPortfolio, method: "monte_carlo" };
      expect(PortfolioOptimizationSchema.safeParse(data).success).toBe(false);
    });

    it("rejects weights outside 0-1 range", () => {
      const data = {
        ...validPortfolio,
        allocations: [
          { ...validPortfolio.allocations[0], targetWeight: 1.5 },
        ],
      };
      expect(PortfolioOptimizationSchema.safeParse(data).success).toBe(false);
    });

    it("rejects negative volatility", () => {
      const data = {
        ...validPortfolio,
        portfolioMetrics: { ...validPortfolio.portfolioMetrics, expectedVolatility: -0.1 },
      };
      expect(PortfolioOptimizationSchema.safeParse(data).success).toBe(false);
    });

    it("validates trade priorities are 1-5", () => {
      const data = {
        ...validPortfolio,
        rebalancingPlan: {
          ...validPortfolio.rebalancingPlan,
          trades: [
            { ...validPortfolio.rebalancingPlan.trades[0], priority: 6 },
          ],
        },
      };
      expect(PortfolioOptimizationSchema.safeParse(data).success).toBe(false);
    });

    it("validates scenario probabilities are 0-1", () => {
      const data = {
        ...validPortfolio,
        scenarioAnalysis: [
          { ...validPortfolio.scenarioAnalysis[0], probability: 1.5 },
        ],
      };
      expect(PortfolioOptimizationSchema.safeParse(data).success).toBe(false);
    });
  });

  describe("Prompt Engineering", () => {
    it("builds optimization prompt with positions", () => {
      const prompt = buildOptimizationPrompt({
        positions: [
          { ticker: "AAPL", currentWeight: 0.3, expectedReturn: 0.12 },
          { ticker: "MSFT", currentWeight: 0.2 },
        ],
        portfolioValue: 100000,
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("MSFT");
      expect(prompt).toContain("black_litterman");
      expect(prompt).toContain("$100,000");
      expect(prompt).toContain("12.0%");
    });

    it("respects method parameter", () => {
      const prompt = buildOptimizationPrompt({
        positions: [{ ticker: "SPY", currentWeight: 1.0 }],
        portfolioValue: 50000,
        method: "risk_parity",
      });
      expect(prompt).toContain("risk_parity");
    });

    it("includes risk tolerance", () => {
      const prompt = buildOptimizationPrompt({
        positions: [{ ticker: "SPY", currentWeight: 1.0 }],
        portfolioValue: 50000,
        riskTolerance: "conservative",
      });
      expect(prompt).toContain("conservative");
    });

    it("builds rebalance prompt with drift indicators", () => {
      const prompt = buildRebalancePrompt({
        positions: [
          { ticker: "AAPL", currentWeight: 0.35, targetWeight: 0.25 },
          { ticker: "MSFT", currentWeight: 0.18, targetWeight: 0.20 },
        ],
        portfolioValue: 100000,
        driftThreshold: 0.05,
      });
      expect(prompt).toContain("NEEDS REBALANCE");
      expect(prompt).toContain("OK");
      expect(prompt).toContain("drift");
    });

    it("builds risk parity prompt", () => {
      const prompt = buildRiskParityPrompt({
        tickers: ["SPY", "TLT", "GLD", "VWO"],
        portfolioValue: 200000,
      });
      expect(prompt).toContain("risk parity");
      expect(prompt).toContain("SPY");
      expect(prompt).toContain("TLT");
      expect(prompt).toContain("GLD");
    });

    it("builds factor analysis prompt", () => {
      const prompt = buildFactorAnalysisPrompt({
        positions: [
          { ticker: "AAPL", weight: 0.25 },
          { ticker: "NVDA", weight: 0.15 },
        ],
        benchmarkTicker: "QQQ",
      });
      expect(prompt).toContain("QQQ");
      expect(prompt).toContain("Market");
      expect(prompt).toContain("Momentum");
      expect(prompt).toContain("Quality");
    });

    it("system prompt covers key optimization concepts", () => {
      expect(PORTFOLIO_SYSTEM_PROMPT).toContain("Markowitz");
      expect(PORTFOLIO_SYSTEM_PROMPT).toContain("Black-Litterman");
      expect(PORTFOLIO_SYSTEM_PROMPT).toContain("Risk parity");
      expect(PORTFOLIO_SYSTEM_PROMPT).toContain("Sharpe");
      expect(PORTFOLIO_SYSTEM_PROMPT).toContain("CVaR");
      expect(PORTFOLIO_SYSTEM_PROMPT).toContain("factor");
      expect(PORTFOLIO_SYSTEM_PROMPT).toContain("diversification");
    });
  });

  describe("PortfolioOptimizer", () => {
    it("can be instantiated without orchestrator", () => {
      const optimizer = new PortfolioOptimizer();
      expect(optimizer).toBeInstanceOf(PortfolioOptimizer);
    });

    it("exposes all optimization methods", () => {
      const optimizer = new PortfolioOptimizer();
      expect(typeof optimizer.optimize).toBe("function");
      expect(typeof optimizer.rebalance).toBe("function");
      expect(typeof optimizer.riskParity).toBe("function");
      expect(typeof optimizer.factorAnalysis).toBe("function");
      expect(typeof optimizer.consensus).toBe("function");
    });
  });
});
