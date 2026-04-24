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
  | "correlation"    // Cross-asset correlation — Claude primary, Grok fallback
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
// Correlation Intelligence
// ---------------------------------------------------------------------------

export const CorrelationStrength = z.enum([
  "strong_positive",
  "moderate_positive",
  "weak",
  "moderate_negative",
  "strong_negative",
]);

export const CorrelationPairSchema = z.object({
  asset1: z.string(),
  asset2: z.string(),
  correlation: z.number().min(-1).max(1),
  relationship: CorrelationStrength,
  stability: z.enum(["stable", "shifting", "unstable"]),
  regimeSensitivity: z.string(),
});

export const CorrelationResultSchema = z.object({
  assets: z.array(z.string()).min(2),
  pairs: z.array(CorrelationPairSchema),
  regimeContext: z
    .object({
      currentRegime: z.string(),
      regimeSensitivity: z.enum(["low", "moderate", "high"]),
      historicalShifts: z.string(),
    })
    .optional(),
  diversificationScore: z.number().min(0).max(100).optional(),
  contagionRisk: z.enum(["low", "moderate", "elevated", "high"]).optional(),
  portfolioImplications: z.object({
    effectiveDiversification: z.string(),
    concentrationWarnings: z.array(z.string()),
    hedgingSuggestions: z.array(z.string()),
  }),
  summary: z.string(),
  timestamp: z.string().datetime(),
});

export type CorrelationResult = z.infer<typeof CorrelationResultSchema>;

// ---------------------------------------------------------------------------
// Structured Research
// ---------------------------------------------------------------------------

export const ResearchFindingSchema = z.object({
  title: z.string(),
  content: z.string(),
  relevance: z.enum(["high", "medium", "low"]),
  source: z.string().optional(),
  recency: z.enum(["breaking", "recent", "dated"]).optional(),
});

export const ResearchResultSchema = z.object({
  topic: z.string(),
  ticker: z.string().optional(),
  findings: z.array(ResearchFindingSchema),
  overallSentiment: z.enum(["bullish", "bearish", "neutral", "mixed"]).optional(),
  keyMetrics: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
        trend: z.enum(["improving", "stable", "deteriorating"]).optional(),
      })
    )
    .optional(),
  catalysts: z
    .array(
      z.object({
        event: z.string(),
        expectedDate: z.string().optional(),
        impact: z.enum(["positive", "negative", "uncertain"]),
        magnitude: z.enum(["high", "medium", "low"]),
      })
    )
    .optional(),
  risks: z.array(z.string()).optional(),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  timestamp: z.string().datetime(),
});

export type StructuredResearchResult = z.infer<typeof ResearchResultSchema>;

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
