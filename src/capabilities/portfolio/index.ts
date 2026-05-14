import { Orchestrator } from "../../orchestrator/index.js";
import {
  PortfolioOptimizationSchema,
  type PortfolioOptimization,
} from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  PORTFOLIO_SYSTEM_PROMPT,
  buildOptimizationPrompt,
  buildRebalancePrompt,
  buildRiskParityPrompt,
  buildFactorAnalysisPrompt,
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
      expectedReturn?: number;
      volatility?: number;
    }>;
    portfolioValue: number;
    method?: "mean_variance" | "black_litterman" | "risk_parity" | "min_variance" | "max_diversification";
    riskTolerance?: "conservative" | "moderate" | "aggressive";
    constraints?: string;
  }): Promise<PortfolioOptimization> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
      prompt: buildOptimizationPrompt(params),
    });

    return parsePortfolioResponse(response.content);
  }

  async rebalance(params: {
    positions: Array<{
      ticker: string;
      currentWeight: number;
      targetWeight: number;
    }>;
    portfolioValue: number;
    driftThreshold?: number;
    taxLots?: string;
  }): Promise<PortfolioOptimization> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
      prompt: buildRebalancePrompt(params),
    });

    return parsePortfolioResponse(response.content);
  }

  async riskParity(params: {
    tickers: string[];
    correlationData?: string;
    volatilityData?: string;
    portfolioValue: number;
  }): Promise<PortfolioOptimization> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
      prompt: buildRiskParityPrompt(params),
    });

    return parsePortfolioResponse(response.content);
  }

  async factorAnalysis(params: {
    positions: Array<{ ticker: string; weight: number }>;
    benchmarkTicker?: string;
  }): Promise<PortfolioOptimization> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
      prompt: buildFactorAnalysisPrompt(params),
    });

    return parsePortfolioResponse(response.content);
  }

  async consensus(params: {
    positions: Array<{
      ticker: string;
      currentWeight: number;
      expectedReturn?: number;
      volatility?: number;
    }>;
    portfolioValue: number;
    method?: string;
    providers?: Array<"claude" | "grok" | "perplexity">;
  }): Promise<{
    optimizations: PortfolioOptimization[];
    avgSharpe: number;
    agreement: number;
  }> {
    const responses = await this.orchestrator.consensus(
      {
        intent: "reasoning",
        systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
        prompt: buildOptimizationPrompt(params),
      },
      params.providers ?? ["claude", "grok"]
    );

    const optimizations: PortfolioOptimization[] = [];
    for (const r of responses) {
      try {
        optimizations.push(parsePortfolioResponse(r.content));
      } catch {
        // Skip unparseable responses
      }
    }

    if (optimizations.length === 0) {
      throw new Error("No valid portfolio optimizations from any model");
    }

    const sharpes = optimizations.map((o) => o.portfolioMetrics.sharpeRatio);
    const avgSharpe = sharpes.reduce((sum, s) => sum + s, 0) / sharpes.length;

    const allocationSets = optimizations.map((o) =>
      new Map(o.allocations.map((a) => [a.ticker, a.targetWeight]))
    );
    let totalDiff = 0;
    let comparisons = 0;
    for (let i = 0; i < allocationSets.length; i++) {
      for (let j = i + 1; j < allocationSets.length; j++) {
        const tickers = new Set([
          ...allocationSets[i].keys(),
          ...allocationSets[j].keys(),
        ]);
        for (const t of tickers) {
          totalDiff += Math.abs(
            (allocationSets[i].get(t) ?? 0) - (allocationSets[j].get(t) ?? 0)
          );
          comparisons++;
        }
      }
    }
    const agreement = comparisons > 0
      ? Math.max(0, 1 - totalDiff / comparisons)
      : 1;

    return { optimizations, avgSharpe, agreement };
  }
}

function parsePortfolioResponse(content: string): PortfolioOptimization {
  return parseJsonResponse(content, PortfolioOptimizationSchema);
}

export { PORTFOLIO_SYSTEM_PROMPT } from "./prompts.js";
