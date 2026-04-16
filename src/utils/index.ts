/**
 * CoreIntent AI — Utilities
 *
 * Quantitative computation, caching, resilience, and observability.
 */

export {
  // Position Sizing
  kellyFraction,
  positionSize,
  // Risk Metrics
  historicalVaR,
  parametricVaR,
  conditionalVaR,
  // Performance Metrics
  sharpeRatio,
  sortinoRatio,
  maxDrawdown,
  calmarRatio,
  // Statistics
  correlation,
  correlationMatrix,
  beta,
  annualizedVolatility,
  standardDeviation,
  sma,
  ema,
  // Risk-Reward
  riskRewardRatio,
  expectedValue,
  profitFactor,
  // Portfolio
  portfolioVariance,
  portfolioVolatility,
  concentrationHHI,
  effectivePositions,
} from "./quant.js";

export { ResponseCache } from "./cache.js";
export type { CacheConfig, CacheStats } from "./cache.js";

export { CircuitBreaker } from "./circuit-breaker.js";
export type { CircuitBreakerConfig, CircuitState } from "./circuit-breaker.js";

export { TelemetryCollector, estimateCost } from "./telemetry.js";
export type {
  TelemetryEvent,
  TelemetrySummary,
  ProviderMetrics,
  CostEstimate,
} from "./telemetry.js";
