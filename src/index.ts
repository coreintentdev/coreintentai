/**
 * @coreintent/ai — Sovereign Multi-Model Orchestration for Trading Intelligence
 *
 * The AI layer that powers CoreIntent. Multi-model orchestration across Claude,
 * Grok, and Perplexity — routing each task to the model best suited for the job.
 *
 * @author Corey McIvor <corey@coreintent.dev>
 * @license MIT
 */

// ---------------------------------------------------------------------------
// Core Orchestrator
// ---------------------------------------------------------------------------
export { Orchestrator } from "./orchestrator/index.js";
export { resolveRoute, getProviderChain } from "./orchestrator/router.js";
export {
  executeWithFallback,
  CoreIntentAIError,
} from "./orchestrator/fallback.js";

// ---------------------------------------------------------------------------
// Model Adapters
// ---------------------------------------------------------------------------
export {
  getAdapter,
  clearAdapterCache,
  BaseModelAdapter,
  ClaudeAdapter,
  GrokAdapter,
  PerplexityAdapter,
} from "./models/index.js";

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------
export { SentimentAnalyzer } from "./capabilities/sentiment/index.js";
export { SignalGenerator } from "./capabilities/signals/index.js";
export { RiskAssessor } from "./capabilities/risk/index.js";
export { MarketResearcher } from "./capabilities/research/index.js";

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------
export {
  createAgentTeam,
  runTradingPipeline,
  BaseAgent,
  MarketAnalystAgent,
  RiskManagerAgent,
  TradeExecutorAgent,
} from "./agents/index.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
export {
  getModelConfig,
  getAllConfigs,
  validateProviderKeys,
  CLAUDE_CONFIG,
  GROK_CONFIG,
  PERPLEXITY_CONFIG,
} from "./config/models.js";

// ---------------------------------------------------------------------------
// Utilities — Quant Engine, Caching, Resilience, Observability
// ---------------------------------------------------------------------------
export {
  // Quant: Position Sizing
  kellyFraction,
  positionSize,
  // Quant: Risk Metrics
  historicalVaR,
  parametricVaR,
  conditionalVaR,
  // Quant: Performance Metrics
  sharpeRatio,
  sortinoRatio,
  maxDrawdown,
  calmarRatio,
  // Quant: Statistics
  correlation,
  correlationMatrix,
  beta,
  annualizedVolatility,
  standardDeviation,
  sma,
  ema,
  // Quant: Risk-Reward
  riskRewardRatio,
  expectedValue,
  profitFactor,
  // Quant: Portfolio
  portfolioVariance,
  portfolioVolatility,
  concentrationHHI,
  effectivePositions,
  // Caching
  ResponseCache,
  // Resilience
  CircuitBreaker,
  // Observability
  TelemetryCollector,
  estimateCost,
} from "./utils/index.js";

export type {
  CacheConfig,
  CacheStats,
  CircuitBreakerConfig,
  CircuitState,
  TelemetryEvent,
  TelemetrySummary,
  ProviderMetrics,
  CostEstimate,
} from "./utils/index.js";

export type { ErrorCategory } from "./orchestrator/index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type {
  ModelProvider,
  ModelConfig,
  TaskIntent,
  OrchestrationRequest,
  OrchestrationResponse,
  TokenUsage,
  SentimentResult,
  TradingSignal,
  RiskAssessment,
  AgentConfig,
  AgentMessage,
  AgentResult,
  PipelineStage,
  PipelineResult,
} from "./types/index.js";

export {
  SentimentResultSchema,
  TradingSignalSchema,
  RiskAssessmentSchema,
} from "./types/index.js";
