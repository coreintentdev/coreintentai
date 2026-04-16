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
  | "consensus"      // Multi-model arbitration — Claude as judge
  | "regime"         // Market regime detection — Claude primary
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
// Consensus Engine
// ---------------------------------------------------------------------------

export const ConsensusDivergenceSchema = z.object({
  topic: z.string(),
  positions: z.array(z.string()),
  resolution: z.string(),
});

export const ConsensusResultSchema = z.object({
  verdict: z.string(),
  confidence: z.number().min(0).max(1),
  agreementScore: z.number().min(0).max(1),
  strongPoints: z.array(z.string()),
  divergencePoints: z.array(ConsensusDivergenceSchema),
  synthesizedView: z.string(),
  riskFactors: z.array(z.string()),
  actionableInsight: z.string(),
});

export type ConsensusResult = z.infer<typeof ConsensusResultSchema>;
export type ConsensusDivergence = z.infer<typeof ConsensusDivergenceSchema>;

// ---------------------------------------------------------------------------
// Market Regime Detection
// ---------------------------------------------------------------------------

export const MarketRegime = z.enum([
  "trending_bull",
  "trending_bear",
  "ranging",
  "volatile",
  "crisis",
]);

export const RegimeIndicatorSchema = z.object({
  name: z.string(),
  value: z.string(),
  signal: z.enum(["confirms", "contradicts", "neutral"]),
  weight: z.number().min(0).max(1),
});

export const RegimeTransitionSchema = z.object({
  probability: z.number().min(0).max(1),
  likelyNextRegime: z.string(),
  earlyWarnings: z.array(z.string()),
});

export const StrategyImplicationsSchema = z.object({
  favoredStrategies: z.array(z.string()),
  avoidStrategies: z.array(z.string()),
  positionSizing: z.enum(["aggressive", "normal", "reduced", "defensive"]),
  hedgingAdvice: z.string(),
});

export const RegimeDetectionResultSchema = z.object({
  regime: MarketRegime,
  confidence: z.number().min(0).max(1),
  subRegime: z.string(),
  indicators: z.array(RegimeIndicatorSchema),
  transitionRisk: RegimeTransitionSchema,
  strategyImplications: StrategyImplicationsSchema,
  timeframe: z.enum(["intraday", "daily", "weekly", "monthly"]),
  invalidation: z.string(),
  timestamp: z.string().datetime(),
});

export type RegimeDetectionResult = z.infer<typeof RegimeDetectionResultSchema>;

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
