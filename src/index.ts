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
// Resilience & Performance
// ---------------------------------------------------------------------------
export { CircuitBreaker } from "./orchestrator/circuit-breaker.js";
export { ResponseCache } from "./orchestrator/cache.js";
export { HealthTracker } from "./orchestrator/health.js";

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
// Utilities
// ---------------------------------------------------------------------------
export {
  extractJSON,
  extractAndValidate,
  extractAndValidateArray,
  JSONExtractionError,
} from "./utils/json-extract.js";

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
  ResearchResult,
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
  ResearchResultSchema,
} from "./types/index.js";

export type {
  CircuitState,
  CircuitBreakerConfig,
} from "./orchestrator/circuit-breaker.js";
export type { CacheConfig } from "./orchestrator/cache.js";
export type { ProviderHealthSnapshot } from "./orchestrator/health.js";
