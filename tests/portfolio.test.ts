import { describe, it, expect } from "vitest";
import {
  PortfolioAllocationSchema,
  PositionAllocationSchema,
  RebalanceAction,
  RebalanceUrgency,
} from "../src/types/index.js";
import {
  buildOptimizationPrompt,
  buildRebalancePrompt,
  buildScenarioPrompt,
} from "../src/capabilities/portfolio/prompts.js";

describe("Portfolio Types", () => {
  describe("PositionAllocationSchema", () => {
    it("validates a well-formed position allocation", () => {
      const result = PositionAllocationSchema.safeParse({
        ticker: "AAPL",
        currentWeight: 0.15,
        targetWeight: 0.12,
        action: "decrease",
        sizingRationale: "Trim due to elevated concentration risk",
        riskBudget: 15,
        conviction: 0.7,
        signals: {
          sentiment: "bullish",
          momentum: "positive",
          regime: "trending_up",
          riskLevel: "moderate",
        },
      });
      expect(result.success).toBe(true);
    });

    it("validates with optional signal fields", () => {
      const result = PositionAllocationSchema.safeParse({
        ticker: "TSLA",
        currentWeight: 0,
        targetWeight: 0.05,
        action: "initiate",
        sizingRationale: "New position based on momentum breakout",
        riskBudget: 8,
        conviction: 0.6,
        signals: {},
      });
      expect(result.success).toBe(true);
    });

    it("rejects weight outside 0-1", () => {
      const result = PositionAllocationSchema.safeParse({
        ticker: "AAPL",
        currentWeight: 1.5,
        targetWeight: 0.1,
        action: "decrease",
        sizingRationale: "test",
        riskBudget: 10,
        conviction: 0.5,
        signals: {},
      });
      expect(result.success).toBe(false);
    });

    it("rejects conviction outside 0-1", () => {
      const result = PositionAllocationSchema.safeParse({
        ticker: "AAPL",
        currentWeight: 0.1,
        targetWeight: 0.1,
        action: "hold",
        sizingRationale: "test",
        riskBudget: 10,
        conviction: 1.5,
        signals: {},
      });
      expect(result.success).toBe(false);
    });

    it("validates all action types", () => {
      const actions = ["increase", "decrease", "hold", "initiate", "exit"] as const;
      for (const action of actions) {
        const result = PositionAllocationSchema.safeParse({
          ticker: "TEST",
          currentWeight: 0.1,
          targetWeight: 0.1,
          action,
          sizingRationale: "test",
          riskBudget: 10,
          conviction: 0.5,
          signals: {},
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe("PortfolioAllocationSchema", () => {
    const validAllocation = {
      positions: [
        {
          ticker: "AAPL",
          currentWeight: 0.2,
          targetWeight: 0.15,
          action: "decrease" as const,
          sizingRationale: "Reduce concentration",
          riskBudget: 18,
          conviction: 0.75,
          signals: { sentiment: "bullish" as const, momentum: "positive" as const },
        },
        {
          ticker: "MSFT",
          currentWeight: 0.1,
          targetWeight: 0.12,
          action: "increase" as const,
          sizingRationale: "Strong momentum",
          riskBudget: 14,
          conviction: 0.8,
          signals: { sentiment: "bullish" as const },
        },
      ],
      cashAllocation: 0.3,
      totalRiskBudget: 65,
      diversificationScore: 0.72,
      regimeContext: "Trending up with moderate volatility",
      rebalancingUrgency: "moderate" as const,
      rebalancingActions: [
        {
          ticker: "AAPL",
          action: "trim" as const,
          targetDelta: -0.05,
          rationale: "Reduce overweight to target",
          priority: 2,
        },
      ],
      summary: "Portfolio is moderately concentrated in tech. Recommend trimming AAPL and adding MSFT exposure.",
      timestamp: new Date().toISOString(),
    };

    it("validates a complete portfolio allocation", () => {
      const result = PortfolioAllocationSchema.safeParse(validAllocation);
      expect(result.success).toBe(true);
    });

    it("rejects cashAllocation outside 0-1", () => {
      const result = PortfolioAllocationSchema.safeParse({
        ...validAllocation,
        cashAllocation: -0.1,
      });
      expect(result.success).toBe(false);
    });

    it("rejects totalRiskBudget outside 0-100", () => {
      const result = PortfolioAllocationSchema.safeParse({
        ...validAllocation,
        totalRiskBudget: 150,
      });
      expect(result.success).toBe(false);
    });

    it("rejects diversificationScore outside 0-1", () => {
      const result = PortfolioAllocationSchema.safeParse({
        ...validAllocation,
        diversificationScore: 1.5,
      });
      expect(result.success).toBe(false);
    });

    it("validates all rebalance actions", () => {
      const actions = ["buy", "sell", "trim", "add"] as const;
      for (const action of actions) {
        const result = RebalanceAction.safeParse(action);
        expect(result.success).toBe(true);
      }
    });

    it("validates all urgency levels", () => {
      const levels = ["none", "low", "moderate", "high", "critical"] as const;
      for (const level of levels) {
        const result = RebalanceUrgency.safeParse(level);
        expect(result.success).toBe(true);
      }
    });

    it("validates rebalancingActions priority range", () => {
      const result = PortfolioAllocationSchema.safeParse({
        ...validAllocation,
        rebalancingActions: [
          {
            ticker: "AAPL",
            action: "sell",
            targetDelta: -0.1,
            rationale: "test",
            priority: 6,
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("validates empty positions array", () => {
      const result = PortfolioAllocationSchema.safeParse({
        ...validAllocation,
        positions: [],
      });
      expect(result.success).toBe(true);
    });

    it("validates riskBudget range in positions", () => {
      const result = PortfolioAllocationSchema.safeParse({
        ...validAllocation,
        positions: [
          {
            ...validAllocation.positions[0],
            riskBudget: 150,
          },
        ],
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("Portfolio Prompts", () => {
  describe("buildOptimizationPrompt", () => {
    it("includes portfolio value and risk tolerance", () => {
      const prompt = buildOptimizationPrompt({
        positions: [{ ticker: "AAPL", currentWeight: 0.2 }],
        portfolioValue: 500_000,
        riskTolerancePct: 1.5,
        intelligence: {},
      });

      expect(prompt).toContain("500,000");
      expect(prompt).toContain("1.5%");
    });

    it("includes position details", () => {
      const prompt = buildOptimizationPrompt({
        positions: [
          { ticker: "AAPL", currentWeight: 0.2, currentPrice: 185.5 },
          { ticker: "MSFT", currentWeight: 0.15 },
        ],
        portfolioValue: 100_000,
        riskTolerancePct: 1,
        intelligence: {},
      });

      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("20.0%");
      expect(prompt).toContain("$185.5");
      expect(prompt).toContain("MSFT");
    });

    it("includes intelligence when provided", () => {
      const prompt = buildOptimizationPrompt({
        positions: [{ ticker: "AAPL", currentWeight: 0.1 }],
        portfolioValue: 100_000,
        riskTolerancePct: 1,
        intelligence: {
          sentiment: "Bullish on AAPL",
          regime: "Trending up",
          momentum: "Accelerating",
        },
      });

      expect(prompt).toContain("Sentiment Intelligence");
      expect(prompt).toContain("Bullish on AAPL");
      expect(prompt).toContain("Regime Intelligence");
      expect(prompt).toContain("Momentum Intelligence");
    });

    it("includes constraints when provided", () => {
      const prompt = buildOptimizationPrompt({
        positions: [{ ticker: "AAPL", currentWeight: 0.1 }],
        portfolioValue: 100_000,
        riskTolerancePct: 1,
        intelligence: {},
        constraints: "No short positions allowed",
      });

      expect(prompt).toContain("No short positions allowed");
    });

    it("excludes missing intelligence sections", () => {
      const prompt = buildOptimizationPrompt({
        positions: [{ ticker: "AAPL", currentWeight: 0.1 }],
        portfolioValue: 100_000,
        riskTolerancePct: 1,
        intelligence: { sentiment: "Bullish" },
      });

      expect(prompt).toContain("Sentiment Intelligence");
      expect(prompt).not.toContain("Regime Intelligence");
      expect(prompt).not.toContain("Correlation Intelligence");
    });
  });

  describe("buildRebalancePrompt", () => {
    it("shows position drift correctly", () => {
      const prompt = buildRebalancePrompt({
        currentPositions: [
          { ticker: "AAPL", currentWeight: 0.25, targetWeight: 0.15, drift: 0.1 },
          { ticker: "MSFT", currentWeight: 0.05, targetWeight: 0.12, drift: -0.07 },
        ],
        regime: "trending_up",
        urgency: "moderate",
      });

      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("overweight");
      expect(prompt).toContain("MSFT");
      expect(prompt).toContain("underweight");
      expect(prompt).toContain("trending_up");
    });

    it("includes transaction costs when specified", () => {
      const prompt = buildRebalancePrompt({
        currentPositions: [
          { ticker: "AAPL", currentWeight: 0.2, targetWeight: 0.15, drift: 0.05 },
        ],
        regime: "ranging",
        urgency: "low",
        transactionCostBps: 10,
      });

      expect(prompt).toContain("10 bps");
    });

    it("includes zero transaction cost", () => {
      const prompt = buildRebalancePrompt({
        currentPositions: [
          { ticker: "AAPL", currentWeight: 0.2, targetWeight: 0.15, drift: 0.05 },
        ],
        regime: "ranging",
        urgency: "low",
        transactionCostBps: 0,
      });

      expect(prompt).toContain("0 bps");
    });
  });

  describe("buildScenarioPrompt", () => {
    it("includes scenario and severity", () => {
      const prompt = buildScenarioPrompt({
        portfolio: [
          { ticker: "AAPL", weight: 0.3 },
          { ticker: "MSFT", weight: 0.2 },
        ],
        scenario: "Fed raises rates 100bps unexpectedly",
        severity: "severe",
      });

      expect(prompt).toContain("Fed raises rates 100bps unexpectedly");
      expect(prompt).toContain("severe");
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("30.0%");
    });

    it("defaults severity prompt correctly", () => {
      const prompt = buildScenarioPrompt({
        portfolio: [{ ticker: "SPY", weight: 0.5 }],
        scenario: "Recession onset",
        severity: "moderate",
      });

      expect(prompt).toContain("moderate");
    });
  });
});
