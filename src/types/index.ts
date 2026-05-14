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
// Liquidity Intelligence
// ---------------------------------------------------------------------------

export const LiquidityRegime = z.enum(["abundant", "normal", "thin", "crisis"]);

export type LiquidityRegimeType = z.infer<typeof LiquidityRegime>;

export const ExecutionUrgency = z.enum(["patient", "normal", "urgent", "immediate"]);

export type ExecutionUrgencyType = z.infer<typeof ExecutionUrgency>;

export const LiquidityAssessmentSchema = z.object({
  ticker: z.string(),
  regime: LiquidityRegime,
  depthScore: z.number().min(0).max(100),
  spreadBps: z.number().min(0),
  averageDailyVolume: z.number().min(0),
  relativeLiquidity: z.number().min(0).max(1),
  timeOfDayEffect: z.string(),
  eventProximity: z.object({
    nearby: z.boolean(),
    description: z.string(),
  }),
  darkPoolPct: z.number().min(0).max(1),
  executionWindows: z.array(
    z.object({
      window: z.string(),
      quality: z.enum(["excellent", "good", "fair", "poor"]),
      reason: z.string(),
    })
  ),
  risks: z.array(z.string()),
  summary: z.string(),
  timestamp: z.string().datetime(),
});

export type LiquidityAssessment = z.infer<typeof LiquidityAssessmentSchema>;

export const ExecutionAlgorithm = z.enum(["TWAP", "VWAP", "IS", "Iceberg", "Block"]);

export const ExecutionPlanSchema = z.object({
  ticker: z.string(),
  action: z.enum(["buy", "sell"]),
  quantity: z.number().positive(),
  urgency: ExecutionUrgency,
  algorithm: ExecutionAlgorithm,
  expectedSlippageBps: z.number().min(0),
  optimalTiming: z.string(),
  splitStrategy: z.array(
    z.object({
      tranche: z.number().int().positive(),
      quantity: z.number().positive(),
      timing: z.string(),
      venue: z.string(),
      limitOffset: z.string().optional(),
    })
  ),
  darkPoolRecommendation: z.string(),
  risks: z.array(z.string()),
  contingencies: z.array(z.string()),
  summary: z.string(),
  timestamp: z.string().datetime(),
});

export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;

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
// Narrative Intelligence
// ---------------------------------------------------------------------------

export const NarrativeCategory = z.enum([
  "macro",
  "sector",
  "company",
  "geopolitical",
  "structural",
  "thematic",
]);

export type NarrativeCategoryType = z.infer<typeof NarrativeCategory>;

export const NarrativeStage = z.enum([
  "emerging",
  "accelerating",
  "consensus",
  "exhausted",
  "reversing",
]);

export type NarrativeStageType = z.infer<typeof NarrativeStage>;

export const NarrativeSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: NarrativeCategory,
  stage: NarrativeStage,
  strength: z.number().min(0).max(100),
  conviction: z.number().min(0).max(1),
  freshness: z.number().min(0).max(1),
  crowding: z.number().min(0).max(1),
  priceReflexivity: z.number().min(0).max(1),
  description: z.string(),
  keyDrivers: z.array(z.string()),
  supportingEvidence: z.array(z.string()),
  counterArguments: z.array(z.string()),
  affectedTickers: z.array(z.string()),
  relatedNarratives: z.array(z.string()),
  tradeImplication: z.string(),
});

export type Narrative = z.infer<typeof NarrativeSchema>;

export const NarrativeReportSchema = z.object({
  ticker: z.string().optional(),
  sector: z.string().optional(),
  narratives: z.array(NarrativeSchema),
  dominantNarrative: z.string(),
  narrativeConflicts: z.array(
    z.object({
      narrativeA: z.string(),
      narrativeB: z.string(),
      tension: z.string(),
      resolution: z.string().optional(),
    })
  ),
  shiftSignals: z.array(
    z.object({
      narrative: z.string(),
      signal: z.string(),
      direction: z.enum(["advancing", "stalling", "reversing"]),
      confidence: z.number().min(0).max(1),
    })
  ),
  tradingImplications: z.array(z.string()),
  summary: z.string(),
  timestamp: z.string().datetime(),
});

export type NarrativeReport = z.infer<typeof NarrativeReportSchema>;

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

// ---------------------------------------------------------------------------
// Options Intelligence
// ---------------------------------------------------------------------------

export const FlowType = z.enum([
  "sweep",
  "block",
  "unusual_volume",
  "opening_position",
  "closing_position",
  "roll",
  "spread",
]);

export const StrategyCategory = z.enum([
  "directional",
  "volatility",
  "income",
  "hedge",
  "arbitrage",
]);

export const GexRegime = z.enum(["positive", "negative", "neutral"]);

export const OptionsFlowSchema = z.object({
  ticker: z.string(),
  flowBias: z.enum([
    "strongly_bullish",
    "bullish",
    "neutral",
    "bearish",
    "strongly_bearish",
  ]),
  confidence: z.number().min(0).max(1),
  totalPremium: z.object({
    calls: z.number().min(0),
    puts: z.number().min(0),
    ratio: z.number().min(0),
  }),
  significantTrades: z.array(
    z.object({
      type: FlowType,
      side: z.enum(["call", "put"]),
      strike: z.number().positive(),
      expiry: z.string(),
      premium: z.number().min(0),
      size: z.number().int().positive(),
      sentiment: z.enum(["bullish", "bearish", "neutral"]),
      interpretation: z.string(),
    })
  ),
  smartMoneySignal: z.string(),
  keyLevels: z.object({
    maxPainStrike: z.number().positive(),
    highestCallOI: z.number().positive(),
    highestPutOI: z.number().positive(),
    gammaFlip: z.number().positive().optional(),
  }),
  summary: z.string(),
  timestamp: z.string().datetime(),
});

export type OptionsFlow = z.infer<typeof OptionsFlowSchema>;

export const VolatilitySurfaceSchema = z.object({
  ticker: z.string(),
  ivRank: z.number().min(0).max(100),
  ivPercentile: z.number().min(0).max(100),
  currentIV30: z.number().min(0),
  realizedVol30: z.number().min(0),
  ivRvSpread: z.number(),
  skew: z.object({
    put25Delta: z.number().min(0),
    call25Delta: z.number().min(0),
    skewIndex: z.number().min(0),
    interpretation: z.string(),
  }),
  termStructure: z.object({
    shape: z.enum(["contango", "backwardation", "flat", "humped"]),
    frontMonth: z.number().min(0),
    backMonth: z.number().min(0),
    eventPremium: z.number().min(0),
    interpretation: z.string(),
  }),
  surfaceSignals: z.array(
    z.object({
      signal: z.string(),
      location: z.string(),
      significance: z.enum(["high", "medium", "low"]),
      tradeable: z.boolean(),
    })
  ),
  regime: z.enum(["low_vol", "normal", "elevated", "crisis"]),
  outlook: z.string(),
  summary: z.string(),
  timestamp: z.string().datetime(),
});

export type VolatilitySurface = z.infer<typeof VolatilitySurfaceSchema>;

export const OptionsStrategySchema = z.object({
  ticker: z.string(),
  strategy: z.object({
    name: z.string(),
    category: StrategyCategory,
    legs: z.array(
      z.object({
        action: z.enum(["buy", "sell"]),
        type: z.enum(["call", "put"]),
        strike: z.number().positive(),
        expiry: z.string(),
        quantity: z.number().int().positive(),
        estimatedPrice: z.number().min(0),
      })
    ),
    netDebit: z.number(),
    maxProfit: z.number(),
    maxLoss: z.number(),
    breakeven: z.array(z.number().positive()),
    probabilityOfProfit: z.number().min(0).max(1),
    riskRewardRatio: z.number().positive(),
  }),
  greeksExposure: z.object({
    delta: z.number(),
    gamma: z.number(),
    theta: z.number(),
    vega: z.number(),
  }),
  managementRules: z.object({
    profitTarget: z.string(),
    stopLoss: z.string(),
    adjustment: z.string(),
    rollTrigger: z.string(),
  }),
  rationale: z.string(),
  alternatives: z.array(
    z.object({
      name: z.string(),
      tradeoff: z.string(),
    })
  ),
  warnings: z.array(z.string()),
  summary: z.string(),
  timestamp: z.string().datetime(),
});

export type OptionsStrategy = z.infer<typeof OptionsStrategySchema>;

export const GreeksAnalysisSchema = z.object({
  ticker: z.string(),
  netGreeks: z.object({
    delta: z.number(),
    gamma: z.number(),
    theta: z.number(),
    vega: z.number(),
    rho: z.number(),
  }),
  secondOrder: z.object({
    gammaRisk: z.string(),
    charm: z.string(),
    vanna: z.string(),
    volga: z.string(),
  }),
  scenarioAnalysis: z.array(
    z.object({
      scenario: z.string(),
      pnl: z.number(),
      newDelta: z.number(),
      risk: z.enum(["low", "medium", "high"]),
    })
  ),
  riskMetrics: z.object({
    dollarDelta: z.number(),
    gammaScalp: z.number(),
    thetaBurn: z.number(),
    vegaExposure: z.number(),
    maxLossScenario: z.string(),
    maxLossAmount: z.number(),
  }),
  recommendations: z.array(z.string()),
  summary: z.string(),
  timestamp: z.string().datetime(),
});

export type GreeksAnalysis = z.infer<typeof GreeksAnalysisSchema>;

export const GexAnalysisSchema = z.object({
  ticker: z.string(),
  netGex: z.number(),
  gexRegime: GexRegime,
  flipPoint: z.number().positive(),
  keyLevels: z.array(
    z.object({
      price: z.number().positive(),
      gammaNotional: z.number(),
      type: z.enum(["support", "resistance", "pin"]),
      strength: z.enum(["strong", "moderate", "weak"]),
      mechanism: z.string(),
    })
  ),
  priceImplications: z.object({
    expectedRange: z.object({
      low: z.number().positive(),
      high: z.number().positive(),
    }),
    pinRisk: z.number().min(0).max(1),
    breakoutProbability: z.number().min(0).max(1),
    volatilitySuppression: z.boolean(),
  }),
  dealerHedging: z.object({
    direction: z.enum(["buying_dips", "selling_rallies", "amplifying_moves"]),
    magnitude: z.enum(["heavy", "moderate", "light"]),
    explanation: z.string(),
  }),
  summary: z.string(),
  timestamp: z.string().datetime(),
});

export type GexAnalysis = z.infer<typeof GexAnalysisSchema>;

// ---------------------------------------------------------------------------
// Performance Tracking
// ---------------------------------------------------------------------------

export const SignalOutcome = z.enum(["win", "loss", "breakeven", "pending"]);

export const SignalRecordSchema = z.object({
  id: z.string(),
  ticker: z.string(),
  action: z.enum(["strong_buy", "buy", "hold", "sell", "strong_sell"]),
  confidence: z.number().min(0).max(1),
  entryPrice: z.number().positive(),
  exitPrice: z.number().positive().optional(),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
  provider: z.string(),
  intent: z.string(),
  generatedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
  outcome: SignalOutcome,
  pnlPct: z.number().optional(),
  holdingPeriodMs: z.number().min(0).optional(),
});

export type SignalRecord = z.infer<typeof SignalRecordSchema>;

export const PerformanceSnapshotSchema = z.object({
  totalSignals: z.number().int().min(0),
  resolvedSignals: z.number().int().min(0),
  pendingSignals: z.number().int().min(0),
  winRate: z.number().min(0).max(1),
  avgWinPct: z.number(),
  avgLossPct: z.number(),
  profitFactor: z.number().min(0),
  expectancy: z.number(),
  bestTrade: z.object({ ticker: z.string(), pnlPct: z.number() }).optional(),
  worstTrade: z.object({ ticker: z.string(), pnlPct: z.number() }).optional(),
  byProvider: z.record(
    z.string(),
    z.object({
      signals: z.number().int().min(0),
      winRate: z.number().min(0).max(1),
      avgPnlPct: z.number(),
    })
  ),
  byIntent: z.record(
    z.string(),
    z.object({
      signals: z.number().int().min(0),
      winRate: z.number().min(0).max(1),
      avgPnlPct: z.number(),
    })
  ),
  generatedAt: z.string().datetime(),
});

export type PerformanceSnapshot = z.infer<typeof PerformanceSnapshotSchema>;
