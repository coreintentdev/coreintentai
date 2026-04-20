import { z } from "zod";
import { Orchestrator } from "../../orchestrator/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  CORRELATION_SYSTEM_PROMPT,
  buildCorrelationAnalysisPrompt,
  buildPairCorrelationPrompt,
  buildPortfolioOptimizationPrompt,
} from "./prompts.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CorrelationPairSchema = z.object({
  tickerA: z.string(),
  tickerB: z.string(),
  correlation: z.number().min(-1).max(1),
  correlationType: z.enum(["direct", "indirect", "inverse", "regime_dependent"]),
  stressCorrelation: z.number().min(-1).max(1),
  explanation: z.string(),
});

const ClusterSchema = z.object({
  clusterId: z.number(),
  name: z.string(),
  tickers: z.array(z.string()),
  dominantFactor: z.string(),
  clusterWeight: z.number().min(0).max(1),
  riskContribution: z.number().min(0).max(1),
});

const ConcentrationRiskSchema = z.object({
  type: z.enum(["sector", "factor", "geographic", "macro"]),
  description: z.string(),
  severity: z.enum(["low", "moderate", "high", "critical"]),
  affectedTickers: z.array(z.string()),
  recommendation: z.string(),
});

const HedgeRecommendationSchema = z.object({
  hedgeType: z.enum([
    "direct_hedge",
    "tail_hedge",
    "factor_hedge",
    "correlation_trade",
  ]),
  instrument: z.string(),
  rationale: z.string(),
  expectedCost: z.string(),
  riskReduction: z.string(),
});

const StressScenarioSchema = z.object({
  scenario: z.string(),
  expectedCorrelationShift: z.string(),
  estimatedDrawdown: z.string(),
  mostVulnerable: z.array(z.string()),
});

export const CorrelationAnalysisSchema = z.object({
  portfolioId: z.string(),
  correlationPairs: z.array(CorrelationPairSchema),
  clusterAnalysis: z.array(ClusterSchema),
  diversificationScore: z.number().min(0).max(1),
  effectivePositions: z.number().min(0),
  concentrationRisks: z.array(ConcentrationRiskSchema),
  hedgeRecommendations: z.array(HedgeRecommendationSchema),
  stressScenarios: z.array(StressScenarioSchema),
  summary: z.string(),
  timestamp: z.string().datetime(),
});

export type CorrelationAnalysis = z.infer<typeof CorrelationAnalysisSchema>;

export const PairCorrelationSchema = z.object({
  tickerA: z.string(),
  tickerB: z.string(),
  correlation: z.number().min(-1).max(1),
  correlationType: z.enum(["direct", "indirect", "inverse", "regime_dependent"]),
  stressCorrelation: z.number().min(-1).max(1),
  rollingCorrelation: z.object({
    "30d": z.number().min(-1).max(1),
    "90d": z.number().min(-1).max(1),
    "1y": z.number().min(-1).max(1),
  }),
  sharedFactors: z.array(z.string()),
  divergenceRisk: z.number().min(0).max(1),
  tradingImplications: z.string(),
  explanation: z.string(),
  timestamp: z.string().datetime(),
});

export type PairCorrelation = z.infer<typeof PairCorrelationSchema>;

const OptimizedPositionSchema = z.object({
  ticker: z.string(),
  currentWeight: z.number().min(0).max(1),
  optimizedWeight: z.number().min(0).max(1),
  change: z.number(),
  rationale: z.string(),
});

const PortfolioStatsSchema = z.object({
  expectedReturn: z.number(),
  expectedVolatility: z.number(),
  sharpeRatio: z.number(),
  maxDrawdown: z.string(),
});

const RebalanceActionSchema = z.object({
  action: z.enum(["increase", "decrease", "add", "remove"]),
  ticker: z.string(),
  fromWeight: z.number().min(0).max(1),
  toWeight: z.number().min(0).max(1),
  priority: z.enum(["high", "medium", "low"]),
});

export const PortfolioOptimizationSchema = z.object({
  objective: z.string(),
  currentPortfolio: PortfolioStatsSchema,
  optimizedPortfolio: z.object({
    positions: z.array(OptimizedPositionSchema),
    expectedReturn: z.number(),
    expectedVolatility: z.number(),
    sharpeRatio: z.number(),
    maxDrawdown: z.string(),
    diversificationRatio: z.number(),
  }),
  rebalancingActions: z.array(RebalanceActionSchema),
  summary: z.string(),
  timestamp: z.string().datetime(),
});

export type PortfolioOptimization = z.infer<typeof PortfolioOptimizationSchema>;

// ---------------------------------------------------------------------------
// Capability Class
// ---------------------------------------------------------------------------

export class CorrelationAnalyzer {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  /**
   * Full portfolio correlation analysis — identifies clusters, concentration
   * risks, hedge recommendations, and stress scenarios.
   */
  async analyzePortfolio(params: {
    positions: Array<{ ticker: string; weight: number; sector?: string }>;
    marketConditions?: string;
    lookbackPeriod?: string;
  }): Promise<CorrelationAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "risk",
      systemPrompt: CORRELATION_SYSTEM_PROMPT,
      prompt: buildCorrelationAnalysisPrompt(params),
    });

    return parseJsonResponse(response.content, CorrelationAnalysisSchema);
  }

  /**
   * Deep-dive correlation between two specific assets.
   */
  async analyzePair(params: {
    tickerA: string;
    tickerB: string;
    priceDataA?: string;
    priceDataB?: string;
    context?: string;
  }): Promise<PairCorrelation> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: CORRELATION_SYSTEM_PROMPT,
      prompt: buildPairCorrelationPrompt(params),
    });

    return parseJsonResponse(response.content, PairCorrelationSchema);
  }

  /**
   * Portfolio optimization — suggests rebalancing to improve risk-adjusted
   * returns based on correlation structure.
   */
  async optimize(params: {
    positions: Array<{ ticker: string; weight: number; expectedReturn?: number }>;
    constraints?: {
      maxPositionWeight?: number;
      minPositionWeight?: number;
      maxSectorWeight?: number;
      targetVolatility?: number;
    };
    objective?: "max_sharpe" | "min_variance" | "risk_parity" | "max_diversification";
  }): Promise<PortfolioOptimization> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: CORRELATION_SYSTEM_PROMPT,
      prompt: buildPortfolioOptimizationPrompt(params),
    });

    return parseJsonResponse(response.content, PortfolioOptimizationSchema);
  }

  /**
   * Multi-model consensus on portfolio correlation — useful for high-stakes
   * portfolio decisions where you want independent verification.
   */
  async consensusAnalysis(params: {
    positions: Array<{ ticker: string; weight: number; sector?: string }>;
    providers?: Array<"claude" | "grok" | "perplexity">;
  }): Promise<{
    analyses: CorrelationAnalysis[];
    avgDiversificationScore: number;
    agreement: number;
  }> {
    const responses = await this.orchestrator.consensus(
      {
        intent: "risk",
        systemPrompt: CORRELATION_SYSTEM_PROMPT,
        prompt: buildCorrelationAnalysisPrompt(params),
      },
      params.providers ?? ["claude", "grok"]
    );

    const analyses: CorrelationAnalysis[] = [];
    for (const r of responses) {
      try {
        analyses.push(
          parseJsonResponse(r.content, CorrelationAnalysisSchema)
        );
      } catch {
        // Skip unparseable responses
      }
    }

    if (analyses.length === 0) {
      throw new Error("No valid correlation analyses from any model");
    }

    const scores = analyses.map((a) => a.diversificationScore);
    const avgDiversificationScore =
      scores.reduce((sum, s) => sum + s, 0) / scores.length;

    const mean = avgDiversificationScore;
    const variance =
      scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
    const agreement = Math.max(0, 1 - Math.sqrt(variance));

    return { analyses, avgDiversificationScore, agreement };
  }
}

export { CORRELATION_SYSTEM_PROMPT } from "./prompts.js";
