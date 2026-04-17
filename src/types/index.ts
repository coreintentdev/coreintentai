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
// Market Regime Detection
// ---------------------------------------------------------------------------

export const MarketRegime = z.enum([
  "trending_bull",
  "trending_bear",
  "ranging",
  "high_volatility",
  "crisis",
  "recovery",
]);

export const VolatilityLevel = z.enum(["low", "normal", "elevated", "extreme"]);
export const MomentumBias = z.enum(["bullish", "bearish", "neutral"]);
export const MarketBreadth = z.enum(["strong", "moderate", "weak", "divergent"]);
export const RiskAppetite = z.enum(["risk_on", "neutral", "risk_off", "panic"]);

export const RegimeCharacteristicsSchema = z.object({
  trendStrength: z.number().min(-1).max(1),
  volatilityLevel: VolatilityLevel,
  momentumBias: MomentumBias,
  breadth: MarketBreadth,
  riskAppetite: RiskAppetite,
});

export const StrategyAdjustmentsSchema = z.object({
  positionSizing: z.enum(["increase", "maintain", "reduce", "minimize"]),
  stopLossWidth: z.enum(["tight", "normal", "wide"]),
  takeProfitStrategy: z.enum(["aggressive", "standard", "conservative", "trail_tight"]),
  preferredTimeframes: z.array(z.enum(["scalp", "day", "swing", "position"])),
  avoidPatterns: z.array(z.string()),
  favorPatterns: z.array(z.string()),
});

export const RegimeDetectionSchema = z.object({
  regime: MarketRegime,
  confidence: z.number().min(0).max(1),
  characteristics: RegimeCharacteristicsSchema,
  indicators: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
      signal: z.enum(["bullish", "bearish", "neutral"]),
    })
  ),
  strategyAdjustments: StrategyAdjustmentsSchema,
  summary: z.string(),
  transitionRisk: z.enum(["low", "moderate", "high"]),
  timestamp: z.string().datetime(),
});

export type RegimeDetection = z.infer<typeof RegimeDetectionSchema>;
export type RegimeCharacteristics = z.infer<typeof RegimeCharacteristicsSchema>;
export type StrategyAdjustments = z.infer<typeof StrategyAdjustmentsSchema>;

export const RegimeTransitionSchema = z.object({
  currentRegime: MarketRegime,
  persistProbability: z.number().min(0).max(1),
  transitions: z.array(
    z.object({
      toRegime: MarketRegime,
      probability: z.number().min(0).max(1),
      triggers: z.array(z.string()),
      timeHorizon: z.enum(["days", "weeks", "months"]),
    })
  ),
  earlyWarningSignals: z.array(z.string()),
  timestamp: z.string().datetime(),
});

export type RegimeTransition = z.infer<typeof RegimeTransitionSchema>;

// ---------------------------------------------------------------------------
// Strategy Synthesis
// ---------------------------------------------------------------------------

export const StrategySynthesisSchema = z.object({
  decision: z.enum(["strong_go", "go", "conditional_go", "wait", "no_go"]),
  confidence: z.number().min(0).max(1),
  thesis: z.string(),
  regime: MarketRegime,
  regimeAlignment: z.number().min(0).max(1),
  adjustedSignal: z.object({
    action: z.enum(["strong_buy", "buy", "hold", "sell", "strong_sell"]),
    positionSizePct: z.number().min(0).max(100),
    entryStrategy: z.string(),
    exitStrategy: z.string(),
    stopLoss: z.string(),
    timeframe: z.string(),
  }),
  riskBudget: z.object({
    maxLossPct: z.number(),
    maxPositionPct: z.number(),
    hedgeRecommendation: z.string().optional(),
  }),
  conditions: z.array(z.string()),
  invalidationCriteria: z.array(z.string()),
  summary: z.string(),
  timestamp: z.string().datetime(),
});

export type StrategySynthesis = z.infer<typeof StrategySynthesisSchema>;

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
