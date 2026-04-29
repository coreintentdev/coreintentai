import { describe, it, expect } from "vitest";
import {
  PortfolioOptimizationSchema,
  AllocationSchema,
  RebalanceActionSchema,
} from "../src/capabilities/portfolio/index.js";
import {
  buildPortfolioOptimizationPrompt,
  buildRebalancePrompt,
  buildRiskParityPrompt,
} from "../src/capabilities/portfolio/prompts.js";

describe("Portfolio Optimizer", () => {
  describe("PortfolioOptimizationSchema", () => {
    const validPortfolio = {
      portfolioName: "Balanced Growth Portfolio",
      strategy: "mean_variance",
      allocations: [
        {
          ticker: "AAPL",
          weight: 0.25,
          currentWeight: 0.3,
          targetWeight: 0.25,
          conviction: 0.8,
          rationale: "Core tech holding, trimming overweight",
        },
        {
          ticker: "MSFT",
          weight: 0.2,
          currentWeight: 0.15,
          targetWeight: 0.2,
          conviction: 0.85,
          rationale: "AI tailwind, increasing position",
        },
        {
          ticker: "TLT",
          weight: 0.15,
          currentWeight: null,
          targetWeight: 0.15,
          conviction: 0.6,
          rationale: "Duration hedge against equity risk",
        },
        {
          ticker: "GLD",
          weight: 0.1,
          currentWeight: 0.1,
          targetWeight: 0.1,
          conviction: 0.7,
          rationale: "Inflation hedge and crisis alpha",
        },
        {
          ticker: "CASH",
          weight: 0.3,
          currentWeight: 0.45,
          targetWeight: 0.3,
          conviction: 1.0,
          rationale: "Deploying excess cash into market",
        },
      ],
      metrics: {
        expectedReturn: 12.5,
        expectedVolatility: 15.2,
        sharpeRatio: 0.82,
        maxDrawdown: -18.5,
        diversificationRatio: 1.35,
        concentrationRisk: 0.28,
      },
      rebalanceActions: [
        {
          ticker: "AAPL",
          action: "trim",
          currentWeight: 0.3,
          targetWeight: 0.25,
          urgency: "next_session",
        },
        {
          ticker: "MSFT",
          action: "add",
          currentWeight: 0.15,
          targetWeight: 0.2,
          urgency: "this_week",
        },
        {
          ticker: "TLT",
          action: "buy",
          currentWeight: 0,
          targetWeight: 0.15,
          urgency: "this_week",
        },
      ],
      regimeAdaptation: {
        currentRegime: "trending_up",
        adaptations: [
          "Increased equity exposure from 45% to 45% (maintaining through trend)",
          "Added duration via TLT as vol hedge",
        ],
        triggerToRebalance: "VIX spike above 25 or regime change to volatile_expansion",
      },
      riskBudget: {
        totalRiskBudget: 15.2,
        riskPerPosition: [
          { ticker: "AAPL", riskContribution: 0.35, marginalRisk: 22.5 },
          { ticker: "MSFT", riskContribution: 0.3, marginalRisk: 20.1 },
          { ticker: "TLT", riskContribution: 0.15, marginalRisk: 12.3 },
          { ticker: "GLD", riskContribution: 0.1, marginalRisk: 16.0 },
          { ticker: "CASH", riskContribution: 0.0, marginalRisk: 0 },
        ],
      },
      constraints: {
        maxPositionSize: 0.3,
        minPositionSize: 0.05,
        maxSectorExposure: 0.45,
        cashReserve: 0.05,
      },
      summary:
        "Balanced portfolio targeting 12.5% return at 15.2% vol. Deploying cash into equities and bonds during trending_up regime. AAPL trimmed to reduce concentration.",
      timestamp: "2026-04-29T10:00:00.000Z",
    };

    it("validates a correct portfolio optimization", () => {
      const result = PortfolioOptimizationSchema.safeParse(validPortfolio);
      expect(result.success).toBe(true);
    });

    it("rejects invalid strategy type", () => {
      const invalid = { ...validPortfolio, strategy: "yolo" };
      const result = PortfolioOptimizationSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects weight outside 0-1 range", () => {
      const invalid = {
        ...validPortfolio,
        allocations: [
          { ...validPortfolio.allocations[0], weight: 1.5 },
        ],
      };
      const result = PortfolioOptimizationSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("accepts null currentWeight for new positions", () => {
      const result = AllocationSchema.safeParse({
        ticker: "NEW",
        weight: 0.1,
        currentWeight: null,
        targetWeight: 0.1,
        conviction: 0.7,
        rationale: "New position",
      });
      expect(result.success).toBe(true);
    });

    it("validates rebalance action urgency levels", () => {
      for (const urgency of ["immediate", "next_session", "this_week", "optional"]) {
        const result = RebalanceActionSchema.safeParse({
          ticker: "AAPL",
          action: "buy",
          currentWeight: 0,
          targetWeight: 0.1,
          urgency,
        });
        expect(result.success).toBe(true);
      }
    });

    it("validates all strategy types", () => {
      for (const strategy of [
        "mean_variance",
        "risk_parity",
        "black_litterman",
        "max_diversification",
        "min_variance",
        "custom",
      ]) {
        const result = PortfolioOptimizationSchema.safeParse({
          ...validPortfolio,
          strategy,
        });
        expect(result.success).toBe(true);
      }
    });

    it("validates concentration risk bounds", () => {
      const low = {
        ...validPortfolio,
        metrics: { ...validPortfolio.metrics, concentrationRisk: 0 },
      };
      const high = {
        ...validPortfolio,
        metrics: { ...validPortfolio.metrics, concentrationRisk: 1 },
      };
      const over = {
        ...validPortfolio,
        metrics: { ...validPortfolio.metrics, concentrationRisk: 1.5 },
      };

      expect(PortfolioOptimizationSchema.safeParse(low).success).toBe(true);
      expect(PortfolioOptimizationSchema.safeParse(high).success).toBe(true);
      expect(PortfolioOptimizationSchema.safeParse(over).success).toBe(false);
    });
  });

  describe("Prompt Builders", () => {
    it("buildPortfolioOptimizationPrompt includes all holdings", () => {
      const prompt = buildPortfolioOptimizationPrompt({
        holdings: [
          { ticker: "AAPL", weight: 0.3, currentPrice: 175 },
          { ticker: "MSFT", weight: 0.2, currentPrice: 380 },
        ],
      });

      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("30.0%");
      expect(prompt).toContain("MSFT");
      expect(prompt).toContain("20.0%");
      expect(prompt).toContain("mean_variance");
    });

    it("buildPortfolioOptimizationPrompt includes constraints", () => {
      const prompt = buildPortfolioOptimizationPrompt({
        holdings: [{ ticker: "AAPL", weight: 0.5, currentPrice: 175 }],
        constraints: {
          maxPositionSize: 0.3,
          minPositionSize: 0.05,
          cashReserve: 0.1,
          excludeTickers: ["TSLA", "MEME"],
          sectorLimits: { Technology: 0.4 },
        },
      });

      expect(prompt).toContain("Max position size: 30%");
      expect(prompt).toContain("Min position size: 5%");
      expect(prompt).toContain("Cash reserve: 10%");
      expect(prompt).toContain("TSLA, MEME");
      expect(prompt).toContain("Max Technology exposure: 40%");
    });

    it("buildPortfolioOptimizationPrompt includes optional context", () => {
      const prompt = buildPortfolioOptimizationPrompt({
        holdings: [{ ticker: "SPY", weight: 1.0, currentPrice: 500 }],
        regimeData: "Trending up with low vol",
        correlationData: "SPY-TLT: -0.3",
        marketContext: "Fed pausing rate hikes",
        riskTolerance: "conservative",
        investmentHorizon: "long_term (3+ years)",
      });

      expect(prompt).toContain("conservative");
      expect(prompt).toContain("long_term (3+ years)");
      expect(prompt).toContain("Trending up with low vol");
      expect(prompt).toContain("SPY-TLT: -0.3");
      expect(prompt).toContain("Fed pausing rate hikes");
    });

    it("buildRebalancePrompt includes P&L context", () => {
      const prompt = buildRebalancePrompt({
        currentPortfolio: [
          { ticker: "AAPL", weight: 0.3, gainLossPct: 15.2 },
          { ticker: "MSFT", weight: 0.2, gainLossPct: -3.5 },
        ],
        targetPortfolio: [
          { ticker: "AAPL", weight: 0.25 },
          { ticker: "MSFT", weight: 0.25 },
        ],
        portfolioValue: 250_000,
      });

      expect(prompt).toContain("+15.2% P&L");
      expect(prompt).toContain("-3.5% P&L");
      expect(prompt).toContain("$250,000");
      expect(prompt).toContain("tax-loss harvesting");
    });

    it("buildRiskParityPrompt includes volatilities", () => {
      const prompt = buildRiskParityPrompt({
        tickers: ["SPY", "TLT", "GLD"],
        volatilities: { SPY: 0.18, TLT: 0.12, GLD: 0.15 },
        targetRisk: 0.1,
      });

      expect(prompt).toContain("risk parity");
      expect(prompt).toContain("SPY: 18.0% annualized vol");
      expect(prompt).toContain("TLT: 12.0% annualized vol");
      expect(prompt).toContain("Target Portfolio Volatility: 10.0%");
    });

    it("buildRebalancePrompt includes tax and cost context", () => {
      const prompt = buildRebalancePrompt({
        currentPortfolio: [{ ticker: "AAPL", weight: 0.5, gainLossPct: 50 }],
        targetPortfolio: [{ ticker: "AAPL", weight: 0.3 }],
        portfolioValue: 100_000,
        taxContext: "Long-term capital gains rate: 15%",
        transactionCosts: "Commission: $0.005/share",
      });

      expect(prompt).toContain("Long-term capital gains rate: 15%");
      expect(prompt).toContain("Commission: $0.005/share");
    });
  });
});
