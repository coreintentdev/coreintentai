import { Orchestrator } from "../../orchestrator/index.js";
import {
  PortfolioAllocationSchema,
  type PortfolioAllocation,
} from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  PORTFOLIO_SYSTEM_PROMPT,
  buildOptimizationPrompt,
  buildRebalancePrompt,
  buildScenarioPrompt,
} from "./prompts.js";

export class PortfolioOptimizer {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  async optimize(params: {
    positions: Array<{
      ticker: string;
      currentWeight: number;
      currentPrice?: number;
    }>;
    portfolioValue: number;
    riskTolerancePct: number;
    intelligence?: {
      sentiment?: string;
      momentum?: string;
      regime?: string;
      risk?: string;
      correlation?: string;
      anomalies?: string;
    };
    constraints?: string;
  }): Promise<PortfolioAllocation> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
      prompt: buildOptimizationPrompt({
        positions: params.positions,
        portfolioValue: params.portfolioValue,
        riskTolerancePct: params.riskTolerancePct,
        intelligence: params.intelligence ?? {},
        constraints: params.constraints,
      }),
    });

    return parseJsonResponse(response.content, PortfolioAllocationSchema);
  }

  async optimizeWithIntelligence(params: {
    positions: Array<{
      ticker: string;
      currentWeight: number;
      currentPrice?: number;
    }>;
    portfolioValue: number;
    riskTolerancePct: number;
    constraints?: string;
  }): Promise<{
    allocation: PortfolioAllocation;
    intelligenceUsed: string[];
    totalLatencyMs: number;
  }> {
    const start = performance.now();
    const tickers = params.positions.map((p) => p.ticker);
    const tickerList = tickers.join(", ");
    const intelligenceUsed: string[] = [];

    const [sentimentRes, momentumRes, regimeRes] = await Promise.all([
      this.orchestrator
        .execute({
          intent: "sentiment",
          prompt: `Quick sentiment read for portfolio positions: ${tickerList}. Give a brief assessment for each ticker.`,
        })
        .then((r) => {
          intelligenceUsed.push("sentiment");
          return r.content;
        })
        .catch(() => undefined),
      this.orchestrator
        .execute({
          intent: "fast_analysis",
          prompt: `Momentum assessment for: ${tickerList}. Which have positive momentum, which are losing steam?`,
        })
        .then((r) => {
          intelligenceUsed.push("momentum");
          return r.content;
        })
        .catch(() => undefined),
      this.orchestrator
        .execute({
          intent: "fast_analysis",
          prompt: `Current market regime assessment. Is the market trending, ranging, volatile, or in crisis? Brief answer.`,
        })
        .then((r) => {
          intelligenceUsed.push("regime");
          return r.content;
        })
        .catch(() => undefined),
    ]);

    const allocation = await this.optimize({
      ...params,
      intelligence: {
        sentiment: sentimentRes,
        momentum: momentumRes,
        regime: regimeRes,
      },
    });

    return {
      allocation,
      intelligenceUsed,
      totalLatencyMs: Math.round(performance.now() - start),
    };
  }

  async rebalance(params: {
    currentPositions: Array<{
      ticker: string;
      currentWeight: number;
      targetWeight: number;
    }>;
    regime: string;
    transactionCostBps?: number;
  }): Promise<PortfolioAllocation> {
    const positionsWithDrift = params.currentPositions.map((p) => ({
      ...p,
      drift: p.currentWeight - p.targetWeight,
    }));

    const maxDrift = Math.max(...positionsWithDrift.map((p) => Math.abs(p.drift)));
    let urgency: string;
    if (maxDrift > 0.1) urgency = "high";
    else if (maxDrift > 0.05) urgency = "moderate";
    else urgency = "low";

    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
      prompt: buildRebalancePrompt({
        currentPositions: positionsWithDrift,
        regime: params.regime,
        urgency,
        transactionCostBps: params.transactionCostBps,
      }),
    });

    return parseJsonResponse(response.content, PortfolioAllocationSchema);
  }

  async stressTest(params: {
    portfolio: Array<{ ticker: string; weight: number }>;
    scenario: string;
    severity?: "mild" | "moderate" | "severe";
  }): Promise<PortfolioAllocation> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
      prompt: buildScenarioPrompt({
        portfolio: params.portfolio,
        scenario: params.scenario,
        severity: params.severity ?? "moderate",
      }),
    });

    return parseJsonResponse(response.content, PortfolioAllocationSchema);
  }

  async consensus(params: {
    positions: Array<{
      ticker: string;
      currentWeight: number;
      currentPrice?: number;
    }>;
    portfolioValue: number;
    riskTolerancePct: number;
    providers?: Array<"claude" | "grok">;
  }): Promise<{
    allocations: PortfolioAllocation[];
    avgCashAllocation: number;
    agreement: number;
  }> {
    const responses = await this.orchestrator.consensus(
      {
        intent: "reasoning",
        systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
        prompt: buildOptimizationPrompt({
          positions: params.positions,
          portfolioValue: params.portfolioValue,
          riskTolerancePct: params.riskTolerancePct,
          intelligence: {},
        }),
      },
      params.providers ?? ["claude", "grok"]
    );

    const allocations: PortfolioAllocation[] = [];
    for (const r of responses) {
      try {
        allocations.push(
          parseJsonResponse(r.content, PortfolioAllocationSchema)
        );
      } catch {
        // Skip unparseable in consensus
      }
    }

    if (allocations.length === 0) {
      throw new Error("No valid portfolio allocations from any model");
    }

    const cashValues = allocations.map((a) => a.cashAllocation);
    const avgCash =
      cashValues.reduce((sum, c) => sum + c, 0) / cashValues.length;

    const diversScores = allocations.map((a) => a.diversificationScore);
    const mean =
      diversScores.reduce((s, v) => s + v, 0) / diversScores.length;
    const variance =
      diversScores.reduce((s, v) => s + (v - mean) ** 2, 0) /
      diversScores.length;
    const agreement = Math.max(0, 1 - Math.sqrt(variance));

    return { allocations, avgCashAllocation: avgCash, agreement };
  }
}

export { PORTFOLIO_SYSTEM_PROMPT } from "./prompts.js";
