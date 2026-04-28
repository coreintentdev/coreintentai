/**
 * CoreIntent AI — Type System
 *
 * Shared types for the sovereign multi-model orchestration layer.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Model Identity
// ---------------------------------------------------------------------------

export type ModelProvider = "claude" | "grok" | "perplexity";

export interface ModelConfig {
  provider: ModelProvider;
  model: string;
  apiKey: string;
  baseUrl?: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export type TaskIntent =
  | "reasoning"      // Complex analysis — route to Claude
  | "fast_analysis"  // Speed-critical — route to Grok
  | "research"       // Web-grounded lookup — route to Perplexity
  | "sentiment"      // Market sentiment — Grok primary, Claude fallback
  | "signal"         // Trade signal generation — Claude primary
  | "risk"           // Risk assessment — Claude primary
  | "general";       // Default — use configured primary

export interface OrchestrationRequest {
  intent: TaskIntent;
  prompt: string;
  systemPrompt?: string;
  context?: Record<string, unknown>;
  preferredProvider?: ModelProvider;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface OrchestrationResponse {
  content: string;
  provider: ModelProvider;
  model: string;
  latencyMs: number;
  tokenUsage: TokenUsage;
  fallbackUsed: boolean;
  metadata?: Record<string, unknown>;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// ---------------------------------------------------------------------------
// Market Sentiment
// ---------------------------------------------------------------------------

export const SentimentRating = z.enum([
  "strongly_bullish",
  "bullish",
  "slightly_bullish",
  "neutral",
  "slightly_bearish",
  "bearish",
  "strongly_bearish",
]);

export const SentimentResultSchema = z.object({
  ticker: z.string(),
  sentiment: z.enum([
    "strongly_bullish",
    "bullish",
    "slightly_bullish",
    "neutral",
    "slightly_bearish",
    "bearish",
    "strongly_bearish",
  ]),
  confidence: z.number().min(0).max(1),
  score: z.number().min(-1).max(1),
  drivers: z.array(
    z.object({
      factor: z.string(),
      impact: z.enum(["positive", "negative", "neutral"]),
      weight: z.number().min(0).max(1),
    })
  ),
  summary: z.string(),
  timeHorizon: z.enum(["intraday", "short_term", "medium_term", "long_term"]),
  sources: z.array(z.string()).optional(),
  timestamp: z.string().datetime(),
});

export type SentimentResult = z.infer<typeof SentimentResultSchema>;

// ---------------------------------------------------------------------------
// Trading Signals
// ---------------------------------------------------------------------------

export const SignalAction = z.enum(["strong_buy", "buy", "hold", "sell", "strong_sell"]);

export const TradingSignalSchema = z.object({
  ticker: z.string(),
  action: SignalAction,
  confidence: z.number().min(0).max(1),
  entryPrice: z.number().positive().optional(),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.array(z.number().positive()).optional(),
  timeframe: z.enum(["scalp", "day", "swing", "position"]),
  reasoning: z.string(),
  technicalFactors: z.array(
    z.object({
      indicator: z.string(),
      value: z.string(),
      signal: z.enum(["bullish", "bearish", "neutral"]),
    })
  ),
  fundamentalFactors: z.array(
    z.object({
      factor: z.string(),
      assessment: z.string(),
      impact: z.enum(["positive", "negative", "neutral"]),
    })
  ).optional(),
  riskRewardRatio: z.number().positive().optional(),
  timestamp: z.string().datetime(),
});

export type TradingSignal = z.infer<typeof TradingSignalSchema>;

// ---------------------------------------------------------------------------
// Risk Assessment
// ---------------------------------------------------------------------------

export const RiskLevel = z.enum(["minimal", "low", "moderate", "elevated", "high", "critical"]);

export const RiskAssessmentSchema = z.object({
  ticker: z.string().optional(),
  portfolioScope: z.boolean(),
  overallRisk: RiskLevel,
  riskScore: z.number().min(0).max(100),
  components: z.array(
    z.object({
      category: z.enum([
        "market_risk",
        "volatility_risk",
        "liquidity_risk",
        "concentration_risk",
        "correlation_risk",
        "drawdown_risk",
        "event_risk",
      ]),
      level: RiskLevel,
      score: z.number().min(0).max(100),
      description: z.string(),
    })
  ),
  positionSizing: z
    .object({
      maxPositionPct: z.number().min(0).max(100),
      recommendedPositionPct: z.number().min(0).max(100),
      kellyFraction: z.number().min(0).max(1).optional(),
    })
    .optional(),
  warnings: z.array(z.string()),
  recommendations: z.array(z.string()),
  timestamp: z.string().datetime(),
});

export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;

// ---------------------------------------------------------------------------
// Market Regime Detection
// ---------------------------------------------------------------------------

export const RegimeType = z.enum([
  "trending_up",
  "trending_down",
  "ranging",
  "volatile_expansion",
  "compression",
  "crisis",
  "rotation",
]);

export const VolatilityRegime = z.enum(["low", "normal", "elevated", "extreme"]);

export const MarketRegimeSchema = z.object({
  ticker: z.string(),
  regime: RegimeType,
  confidence: z.number().min(0).max(1),
  volatilityRegime: VolatilityRegime,
  trendStrength: z.number().min(0).max(1),
  regimeAge: z.string(),
  transitionProbability: z.number().min(0).max(1),
  transitionTargets: z.array(
    z.object({
      regime: z.string(),
      probability: z.number().min(0).max(1),
      trigger: z.string(),
    })
  ),
  indicators: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
      signal: z.string(),
    })
  ),
  strategyImplications: z.object({
    recommended: z.array(z.string()),
    avoid: z.array(z.string()),
    positionSizing: z.string(),
    stopLossApproach: z.string(),
  }),
  summary: z.string(),
  timestamp: z.string().datetime(),
});

export type MarketRegime = z.infer<typeof MarketRegimeSchema>;

// ---------------------------------------------------------------------------
// Correlation Analysis
// ---------------------------------------------------------------------------

export const CorrelationStrength = z.enum([
  "strong_positive",
  "moderate_positive",
  "weak_positive",
  "uncorrelated",
  "weak_negative",
  "moderate_negative",
  "strong_negative",
]);

export const CorrelationPairSchema = z.object({
  tickerA: z.string(),
  tickerB: z.string(),
  correlation: z.number().min(-1).max(1),
  strength: CorrelationStrength,
  timeframe: z.string(),
  stability: z.number().min(0).max(1),
  leadLag: z.object({
    leader: z.string(),
    lagDays: z.number().min(0),
    confidence: z.number().min(0).max(1),
  }).optional(),
  regime: z.string().optional(),
});

export type CorrelationPair = z.infer<typeof CorrelationPairSchema>;

export const CorrelationMatrixSchema = z.object({
  tickers: z.array(z.string()),
  analysisDate: z.string().datetime(),
  timeframe: z.string(),
  pairs: z.array(CorrelationPairSchema),
  clusters: z.array(
    z.object({
      name: z.string(),
      tickers: z.array(z.string()),
      avgCorrelation: z.number().min(-1).max(1),
      driver: z.string(),
    })
  ),
  diversificationScore: z.number().min(0).max(1),
  hiddenRisks: z.array(
    z.object({
      description: z.string(),
      severity: z.enum(["low", "medium", "high", "critical"]),
      affectedTickers: z.array(z.string()),
    })
  ),
  recommendations: z.array(z.string()),
  summary: z.string(),
  timestamp: z.string().datetime(),
});

export type CorrelationMatrix = z.infer<typeof CorrelationMatrixSchema>;

// ---------------------------------------------------------------------------
// Anomaly Detection
// ---------------------------------------------------------------------------

export const AnomalyType = z.enum([
  "volume_spike",
  "price_dislocation",
  "volatility_anomaly",
  "correlation_break",
  "options_flow",
  "order_flow",
  "fundamental_divergence",
  "cross_asset_signal",
]);

export const AlertLevel = z.enum(["none", "watch", "alert", "critical"]);

export const AnomalyReportSchema = z.object({
  ticker: z.string(),
  anomalies: z.array(
    z.object({
      type: AnomalyType,
      severity: z.number().min(0).max(100),
      description: z.string(),
      evidence: z.array(z.string()),
      possibleCauses: z.array(z.string()),
      historicalPrecedent: z.string().optional(),
      actionable: z.boolean(),
      suggestedAction: z.string().optional(),
    })
  ),
  overallAnomalyScore: z.number().min(0).max(100),
  marketContext: z.string(),
  crossAssetSignals: z.array(z.string()),
  alertLevel: AlertLevel,
  summary: z.string(),
  timestamp: z.string().datetime(),
});

export type AnomalyReport = z.infer<typeof AnomalyReportSchema>;

// ---------------------------------------------------------------------------
// Multi-Model Consensus
// ---------------------------------------------------------------------------

export const AgreementLevel = z.enum([
  "unanimous",
  "strong_majority",
  "majority",
  "split",
  "contradictory",
]);

export const ConsensusResultSchema = z.object({
  query: z.string(),
  verdict: z.string(),
  confidence: z.number().min(0).max(1),
  agreementLevel: AgreementLevel,
  modelContributions: z.array(
    z.object({
      provider: z.string(),
      position: z.string(),
      strengthOfEvidence: z.number().min(0).max(1),
      uniqueInsight: z.string().optional(),
    })
  ),
  keyAgreements: z.array(z.string()),
  keyDisagreements: z.array(
    z.object({
      topic: z.string(),
      positions: z.array(z.string()),
      resolution: z.string(),
    })
  ),
  blindSpots: z.array(z.string()),
  synthesizedAnalysis: z.string(),
  actionableInsight: z.string(),
  uncertaintyFactors: z.array(z.string()),
  timestamp: z.string().datetime(),
});

export type ConsensusResult = z.infer<typeof ConsensusResultSchema>;

// ---------------------------------------------------------------------------
// Momentum Scoring
// ---------------------------------------------------------------------------

export const AccelerationSignal = z.enum([
  "accelerating",
  "steady",
  "decelerating",
  "reversing",
]);

export const TimeframeAlignment = z.enum([
  "aligned",
  "mixed",
  "conflicting",
]);

export const MomentumRankingSchema = z.object({
  ticker: z.string(),
  compositeScore: z.number().min(0).max(100),
  rank: z.number().int().positive(),
  priceScore: z.number().min(0).max(100),
  volumeScore: z.number().min(0).max(100),
  relativeStrengthScore: z.number().min(0).max(100),
  accelerationSignal: AccelerationSignal,
  timeframeAlignment: TimeframeAlignment,
  exhaustionRisk: z.number().min(0).max(1),
  keyDriver: z.string(),
  watchFor: z.string(),
});

export type MomentumRanking = z.infer<typeof MomentumRankingSchema>;

export const BreadthAssessment = z.enum([
  "healthy",
  "narrowing",
  "deteriorating",
  "capitulation",
]);

export const MomentumReportSchema = z.object({
  rankings: z.array(MomentumRankingSchema),
  topPick: z.string(),
  avoidList: z.array(z.string()),
  sectorRotation: z.object({
    leading: z.array(z.string()),
    lagging: z.array(z.string()),
    emerging: z.array(z.string()),
  }),
  marketBreadth: z.object({
    score: z.number().min(0).max(100),
    assessment: BreadthAssessment,
  }),
  summary: z.string(),
  timestamp: z.string().datetime(),
});

export type MomentumReport = z.infer<typeof MomentumReportSchema>;

// ---------------------------------------------------------------------------
// Volatility Analysis
// ---------------------------------------------------------------------------

export const TermStructureShape = z.enum([
  "contango",
  "backwardation",
  "flat",
  "kinked",
  "steep_contango",
]);

export const SkewPattern = z.enum(["normal", "reverse", "smile", "smirk"]);

export const VolStrategyType = z.enum([
  "long_vol",
  "short_vol",
  "skew_trade",
  "term_structure",
  "gamma_scalp",
  "hedging",
]);

export const VolForecastDirection = z.enum([
  "expanding",
  "contracting",
  "stable",
]);

export const VolatilityAnalysisSchema = z.object({
  ticker: z.string(),
  currentIV: z.number().min(0).max(300),
  currentRV: z.number().min(0).max(300),
  ivRank: z.number().min(0).max(100),
  ivPercentile: z.number().min(0).max(100),
  ivRvSpread: z.number(),
  volatilityRegime: VolatilityRegime,
  termStructure: z.object({
    shape: TermStructureShape,
    steepness: z.number().min(-1).max(1),
    frontMonthIV: z.number().min(0),
    backMonthIV: z.number().min(0),
    eventPremium: z.string().nullable(),
    interpretation: z.string(),
  }),
  skew: z.object({
    pattern: SkewPattern,
    putCallSkew: z.number(),
    skewPercentile: z.number().min(0).max(100),
    interpretation: z.string(),
  }),
  volForecast: z.object({
    direction: VolForecastDirection,
    catalyst: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  strategies: z.array(
    z.object({
      name: z.string(),
      type: VolStrategyType,
      rationale: z.string(),
      edge: z.string(),
      risk: z.string(),
      conviction: z.number().min(0).max(1),
    })
  ),
  summary: z.string(),
  timestamp: z.string().datetime(),
});

export type VolatilityAnalysis = z.infer<typeof VolatilityAnalysisSchema>;

// ---------------------------------------------------------------------------
// Portfolio Optimization
// ---------------------------------------------------------------------------

export const AllocationAction = z.enum([
  "increase",
  "decrease",
  "hold",
  "add",
  "exit",
]);

export const TradePriority = z.enum([
  "immediate",
  "next_rebalance",
  "opportunistic",
]);

export const ConcentrationRiskType = z.enum([
  "single_position",
  "sector",
  "factor",
  "geography",
  "correlation",
]);

export const PortfolioAnalysisSchema = z.object({
  portfolioName: z.string(),
  totalValue: z.number().positive(),
  currentAllocations: z.array(
    z.object({
      ticker: z.string(),
      weight: z.number().min(0).max(1),
      currentValue: z.number().min(0),
      sector: z.string(),
    })
  ),
  riskMetrics: z.object({
    sharpeRatio: z.number(),
    sortinoRatio: z.number(),
    maxDrawdown: z.number().min(0).max(1),
    beta: z.number(),
    valueAtRisk95: z.number(),
    expectedShortfall: z.number(),
    annualizedReturn: z.number(),
    annualizedVolatility: z.number().min(0),
  }),
  optimizedAllocations: z.array(
    z.object({
      ticker: z.string(),
      currentWeight: z.number().min(0).max(1),
      targetWeight: z.number().min(0).max(1),
      action: AllocationAction,
      rationale: z.string(),
    })
  ),
  rebalancingTrades: z.array(
    z.object({
      ticker: z.string(),
      side: z.enum(["buy", "sell"]),
      amount: z.number().positive(),
      priority: TradePriority,
      reason: z.string(),
    })
  ),
  concentrationRisks: z.array(
    z.object({
      type: ConcentrationRiskType,
      description: z.string(),
      severity: z.enum(["low", "medium", "high", "critical"]),
      affectedPositions: z.array(z.string()),
      mitigation: z.string(),
    })
  ),
  scenarioAnalysis: z.array(
    z.object({
      scenario: z.string(),
      probability: z.number().min(0).max(1),
      portfolioImpact: z.number(),
      worstHit: z.string(),
      bestPerformer: z.string(),
      recommendation: z.string(),
    })
  ),
  summary: z.string(),
  timestamp: z.string().datetime(),
});

export type PortfolioAnalysis = z.infer<typeof PortfolioAnalysisSchema>;

// ---------------------------------------------------------------------------
// Agent System
// ---------------------------------------------------------------------------

export interface AgentConfig {
  name: string;
  role: string;
  systemPrompt: string;
  provider: ModelProvider;
  model?: string;
  tools?: AgentTool[];
  maxTurns?: number;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: z.ZodType;
  execute: (params: unknown) => Promise<unknown>;
}

export interface AgentMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface AgentResult {
  agentName: string;
  output: string;
  messages: AgentMessage[];
  turnsUsed: number;
  totalLatencyMs: number;
  tokenUsage: TokenUsage;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export interface PipelineStage<TInput, TOutput> {
  name: string;
  execute: (input: TInput) => Promise<TOutput>;
}

export interface PipelineResult<T> {
  output: T;
  stages: Array<{
    name: string;
    latencyMs: number;
    success: boolean;
  }>;
  totalLatencyMs: number;
}
