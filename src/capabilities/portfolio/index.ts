import { z } from "zod";
import { Orchestrator } from "../../orchestrator/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  PORTFOLIO_SYSTEM_PROMPT,
  buildPortfolioOptimizationPrompt,
  buildRebalancePrompt,
  buildRiskParityPrompt,
} from "./prompts.js";

const AllocationSchema = z.object({
  ticker: z.string(),
  weight: z.number().min(0).max(1),
  currentWeight: z.number().min(0).max(1).nullable(),
  targetWeight: z.number().min(0).max(1),
  conviction: z.number().min(0).max(1),
  rationale: z.string(),
});

const RebalanceActionSchema = z.object({
  ticker: z.string(),
  action: z.enum(["buy", "sell", "hold", "trim", "add"]),
  currentWeight: z.number(),
  targetWeight: z.number(),
  urgency: z.enum(["immediate", "next_session", "this_week", "optional"]),
});

const PortfolioOptimizationSchema = z.object({
  portfolioName: z.string(),
  strategy: z.enum([
    "mean_variance",
    "risk_parity",
    "black_litterman",
    "max_diversification",
    "min_variance",
    "custom",
  ]),
  allocations: z.array(AllocationSchema),
  metrics: z.object({
    expectedReturn: z.number(),
    expectedVolatility: z.number(),
    sharpeRatio: z.number(),
    maxDrawdown: z.number(),
    diversificationRatio: z.number(),
    concentrationRisk: z.number().min(0).max(1),
  }),
  rebalanceActions: z.array(RebalanceActionSchema),
  regimeAdaptation: z.object({
    currentRegime: z.string(),
    adaptations: z.array(z.string()),
    triggerToRebalance: z.string(),
  }),
  riskBudget: z.object({
    totalRiskBudget: z.number(),
    riskPerPosition: z.array(
      z.object({
        ticker: z.string(),
        riskContribution: z.number().min(0).max(1),
        marginalRisk: z.number(),
      })
    ),
  }),
  constraints: z.object({
    maxPositionSize: z.number(),
    minPositionSize: z.number(),
    maxSectorExposure: z.number(),
    cashReserve: z.number(),
  }),
  summary: z.string(),
  timestamp: z.string().datetime(),
});

export type PortfolioOptimization = z.infer<typeof PortfolioOptimizationSchema>;

export { PortfolioOptimizationSchema, AllocationSchema, RebalanceActionSchema };

export class PortfolioOptimizer {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  async optimize(params: {
    holdings: Array<{
      ticker: string;
      weight: number;
      currentPrice: number;
    }>;
    strategy?: "mean_variance" | "risk_parity" | "black_litterman" | "max_diversification" | "min_variance" | "custom";
    riskTolerance?: "conservative" | "moderate" | "aggressive";
    investmentHorizon?: string;
    constraints?: {
      maxPositionSize?: number;
      minPositionSize?: number;
      sectorLimits?: Record<string, number>;
      excludeTickers?: string[];
      cashReserve?: number;
    };
    marketContext?: string;
    regimeData?: string;
    correlationData?: string;
  }): Promise<PortfolioOptimization> {
    const response = await this.orchestrator.execute({
      intent: "portfolio",
      systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
      prompt: buildPortfolioOptimizationPrompt(params),
    });

    return parseJsonResponse(response.content, PortfolioOptimizationSchema);
  }

  async riskParity(params: {
    tickers: string[];
    volatilities: Record<string, number>;
    correlationSummary?: string;
    targetRisk?: number;
  }): Promise<PortfolioOptimization> {
    const response = await this.orchestrator.execute({
      intent: "portfolio",
      systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
      prompt: buildRiskParityPrompt(params),
    });

    return parseJsonResponse(response.content, PortfolioOptimizationSchema);
  }

  async rebalance(params: {
    currentPortfolio: Array<{
      ticker: string;
      weight: number;
      gainLossPct: number;
    }>;
    targetPortfolio: Array<{
      ticker: string;
      weight: number;
    }>;
    portfolioValue: number;
    taxContext?: string;
    transactionCosts?: string;
  }): Promise<PortfolioOptimization> {
    const response = await this.orchestrator.execute({
      intent: "portfolio",
      systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
      prompt: buildRebalancePrompt(params),
    });

    return parseJsonResponse(response.content, PortfolioOptimizationSchema);
  }

  /**
   * Two-pass optimization: build with Claude, stress-test with Grok.
   */
  async optimizeWithStressTest(params: {
    holdings: Array<{
      ticker: string;
      weight: number;
      currentPrice: number;
    }>;
    strategy?: "mean_variance" | "risk_parity" | "black_litterman" | "max_diversification" | "min_variance" | "custom";
    riskTolerance?: "conservative" | "moderate" | "aggressive";
    stressScenarios?: string[];
  }): Promise<{
    portfolio: PortfolioOptimization;
    stressTestPassed: boolean;
    stressResults: string;
  }> {
    const portfolio = await this.optimize({
      holdings: params.holdings,
      strategy: params.strategy,
      riskTolerance: params.riskTolerance,
    });

    const scenarios =
      params.stressScenarios ??
      [
        "Interest rates rise 200bps suddenly",
        "Flash crash — S&P drops 10% in one session",
        "Liquidity crisis — bid-ask spreads widen 5x",
        "Correlation spike — all assets correlate to 0.9",
      ];

    const stressResponse = await this.orchestrator.execute({
      intent: "portfolio",
      systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
      prompt: `Stress-test this portfolio:

${JSON.stringify(portfolio.allocations, null, 2)}

Portfolio Metrics:
- Expected return: ${portfolio.metrics.expectedReturn}%
- Expected vol: ${portfolio.metrics.expectedVolatility}%
- Sharpe: ${portfolio.metrics.sharpeRatio}

Stress Scenarios:
${scenarios.map((s, i) => `${i + 1}. ${s}`).join("\n")}

For each scenario:
1. Estimated portfolio drawdown
2. Which positions are most vulnerable
3. Does the portfolio survive without forced liquidation?
4. Recommended hedging actions

Overall verdict — respond with EXACTLY one of these on its own line:
VERDICT: PASS
VERDICT: FAIL

Then explain your reasoning. If FAIL, what specific changes are needed?`,
      preferredProvider: "grok",
    });

    const verdictMatch = stressResponse.content.match(/VERDICT:\s*(PASS|FAIL)/i);
    const passed = verdictMatch ? verdictMatch[1].toUpperCase() === "PASS" : false;

    return {
      portfolio,
      stressTestPassed: passed,
      stressResults: stressResponse.content,
    };
  }

  /**
   * Multi-model portfolio consensus: each model optimizes independently,
   * then a synthesis pass finds the robust allocation.
   */
  async consensusOptimize(params: {
    holdings: Array<{
      ticker: string;
      weight: number;
      currentPrice: number;
    }>;
    riskTolerance?: "conservative" | "moderate" | "aggressive";
    providers?: Array<"claude" | "grok" | "perplexity">;
  }): Promise<{
    portfolios: PortfolioOptimization[];
    synthesis: PortfolioOptimization;
    agreement: number;
  }> {
    const providers = params.providers ?? ["claude", "grok"];
    const prompt = buildPortfolioOptimizationPrompt({
      holdings: params.holdings,
      riskTolerance: params.riskTolerance,
    });

    const responses = await this.orchestrator.consensus(
      {
        intent: "reasoning",
        systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
        prompt,
      },
      providers
    );

    const portfolios: PortfolioOptimization[] = [];
    for (const r of responses) {
      try {
        portfolios.push(
          parseJsonResponse(r.content, PortfolioOptimizationSchema)
        );
      } catch {
        // Skip unparseable responses
      }
    }

    if (portfolios.length === 0) {
      throw new Error("No valid portfolio optimizations from any model");
    }

    if (portfolios.length === 1) {
      return { portfolios, synthesis: portfolios[0], agreement: 1 };
    }

    // Synthesize: average allocations across models
    const tickerWeights = new Map<string, number[]>();
    for (const p of portfolios) {
      for (const a of p.allocations) {
        const arr = tickerWeights.get(a.ticker) ?? [];
        arr.push(a.targetWeight);
        tickerWeights.set(a.ticker, arr);
      }
    }

    // Agreement: how similar are the weight vectors?
    // Pad missing tickers with 0 — a ticker in one model but not another is disagreement
    const numPortfolios = portfolios.length;
    let totalVariance = 0;
    let count = 0;
    for (const weights of tickerWeights.values()) {
      while (weights.length < numPortfolios) weights.push(0);
      const mean = weights.reduce((a, b) => a + b, 0) / weights.length;
      const variance =
        weights.reduce((sum, w) => sum + (w - mean) ** 2, 0) /
        weights.length;
      totalVariance += variance;
      count++;
    }
    const agreement = count > 0 ? Math.max(0, 1 - Math.sqrt(totalVariance / count) * 5) : 1;

    // Final synthesis pass
    const synthResponse = await this.orchestrator.execute({
      intent: "portfolio",
      systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
      prompt: `Synthesize these ${portfolios.length} portfolio optimizations into one robust allocation.

${portfolios.map((p, i) => `Model ${i + 1} (${p.strategy}):\n${p.allocations.map((a) => `  ${a.ticker}: ${(a.targetWeight * 100).toFixed(1)}%`).join("\n")}\n  Sharpe: ${p.metrics.sharpeRatio}`).join("\n\n")}

Agreement between models: ${(agreement * 100).toFixed(0)}%

Build the FINAL portfolio. Where models agree, use the consensus weight. Where they disagree, explain your reasoning for the chosen weight. Set the timestamp to "${new Date().toISOString()}".`,
      preferredProvider: "claude",
    });

    const synthesis = parseJsonResponse(
      synthResponse.content,
      PortfolioOptimizationSchema
    );

    return { portfolios, synthesis, agreement };
  }
}

export { PORTFOLIO_SYSTEM_PROMPT } from "./prompts.js";
