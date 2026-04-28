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
export { CircuitBreaker } from "./orchestrator/circuit-breaker.js";
export type {
  CircuitState,
  CircuitBreakerOptions,
} from "./orchestrator/circuit-breaker.js";

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
export { RegimeDetector } from "./capabilities/regime/index.js";
export { CorrelationAnalyzer } from "./capabilities/correlation/index.js";
export { AnomalyDetector } from "./capabilities/anomaly/index.js";
export { ConsensusEngine } from "./capabilities/consensus/index.js";
export { MomentumScorer } from "./capabilities/momentum/index.js";
export { VolatilityAnalyzer } from "./capabilities/volatility/index.js";
export { PortfolioOptimizer } from "./capabilities/portfolio/index.js";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
export {
  parseJsonResponse,
  parseJsonArrayResponse,
  ParseError,
} from "./utils/json-parser.js";

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
  StrategyAdvisorAgent,
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
  MarketRegime,
  CorrelationPair,
  CorrelationMatrix,
  AnomalyReport,
  ConsensusResult,
  MomentumRanking,
  MomentumReport,
  VolatilityAnalysis,
  PortfolioAnalysis,
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
  MarketRegimeSchema,
  CorrelationPairSchema,
  CorrelationMatrixSchema,
  CorrelationStrength,
  RegimeType,
  VolatilityRegime,
  AnomalyReportSchema,
  AnomalyType,
  AlertLevel,
  ConsensusResultSchema,
  AgreementLevel,
  MomentumRankingSchema,
  MomentumReportSchema,
  AccelerationSignal,
  TimeframeAlignment,
  BreadthAssessment,
  VolatilityAnalysisSchema,
  TermStructureShape,
  SkewPattern,
  VolStrategyType,
  VolForecastDirection,
  PortfolioAnalysisSchema,
  AllocationAction,
  TradePriority,
  ConcentrationRiskType,
} from "./types/index.js";
