/**
 * CoreIntent AI — Telemetry & Observability
 *
 * Event-driven observability layer for monitoring AI orchestration.
 * Tracks provider health, latency distributions, token spend, and
 * circuit breaker state — all without external dependencies.
 *
 * Usage:
 *   const telemetry = new Telemetry();
 *   telemetry.on("route", (e) => console.log(`Routed to ${e.providers}`));
 *   telemetry.on("success", (e) => console.log(`${e.provider} responded in ${e.latencyMs}ms`));
 *   telemetry.on("circuit_open", (e) => console.log(`${e.provider} circuit breaker tripped`));
 *
 *   const orchestrator = new Orchestrator({
 *     onRoute: (req, providers) => telemetry.emit("route", { intent: req.intent, providers }),
 *     onComplete: (res) => telemetry.recordSuccess(res.provider, res.latencyMs, res.tokenUsage),
 *     onError: (err) => telemetry.emit("error", { error: err.message }),
 *   });
 */

import type { ModelProvider, TokenUsage } from "../types/index.js";

// ---------------------------------------------------------------------------
// Event Types
// ---------------------------------------------------------------------------

export interface TelemetryEvents {
  route: RouteEvent;
  attempt: AttemptEvent;
  success: SuccessEvent;
  fallback: FallbackEvent;
  error: ErrorEvent;
  circuit_open: CircuitEvent;
  circuit_close: CircuitEvent;
  health_report: HealthReport;
}

export interface RouteEvent {
  intent: string;
  providers: string[];
  timestamp: string;
}

export interface AttemptEvent {
  provider: ModelProvider;
  attempt: number;
  timestamp: string;
}

export interface SuccessEvent {
  provider: ModelProvider;
  latencyMs: number;
  tokenUsage: TokenUsage;
  fallbackUsed: boolean;
  timestamp: string;
}

export interface FallbackEvent {
  failedProvider: ModelProvider;
  nextProvider: ModelProvider;
  error: string;
  timestamp: string;
}

export interface ErrorEvent {
  provider?: ModelProvider;
  error: string;
  timestamp: string;
}

export interface CircuitEvent {
  provider: ModelProvider;
  failureRate: number;
  timestamp: string;
}

export interface HealthReport {
  providers: Record<ModelProvider, ProviderHealth>;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Provider Health Tracking
// ---------------------------------------------------------------------------

export interface ProviderHealth {
  provider: ModelProvider;
  status: "healthy" | "degraded" | "unhealthy";
  circuitState: "closed" | "open" | "half_open";
  successRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  totalRequests: number;
  totalFailures: number;
  totalTokens: number;
  lastSuccess?: string;
  lastFailure?: string;
}

interface ProviderMetrics {
  successes: number;
  failures: number;
  latencies: number[];
  totalTokens: number;
  lastSuccess?: string;
  lastFailure?: string;
  circuitState: "closed" | "open" | "half_open";
  circuitOpenedAt?: number;
}

// ---------------------------------------------------------------------------
// Circuit Breaker Config
// ---------------------------------------------------------------------------

export interface CircuitBreakerConfig {
  /** Number of failures before tripping the circuit. Default: 5 */
  failureThreshold: number;
  /** Time in ms before attempting to half-open. Default: 30000 (30s) */
  resetTimeoutMs: number;
  /** Window size for tracking recent requests. Default: 20 */
  windowSize: number;
  /** Failure rate (0-1) to trip the circuit. Default: 0.5 */
  failureRateThreshold: number;
}

const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  windowSize: 20,
  failureRateThreshold: 0.5,
};

// ---------------------------------------------------------------------------
// Telemetry Class
// ---------------------------------------------------------------------------

type EventHandler<T> = (event: T) => void;

export class Telemetry {
  private listeners = new Map<string, Array<EventHandler<unknown>>>();
  private metrics = new Map<ModelProvider, ProviderMetrics>();
  private circuitConfig: CircuitBreakerConfig;
  private recentResults = new Map<ModelProvider, Array<"success" | "failure">>();

  constructor(circuitConfig?: Partial<CircuitBreakerConfig>) {
    this.circuitConfig = { ...DEFAULT_CIRCUIT_CONFIG, ...circuitConfig };
    this.initProvider("claude");
    this.initProvider("grok");
    this.initProvider("perplexity");
  }

  // -------------------------------------------------------------------------
  // Event Emitter
  // -------------------------------------------------------------------------

  on<K extends keyof TelemetryEvents>(
    event: K,
    handler: EventHandler<TelemetryEvents[K]>
  ): () => void {
    const handlers = this.listeners.get(event) ?? [];
    handlers.push(handler as EventHandler<unknown>);
    this.listeners.set(event, handlers);

    // Return unsubscribe function
    return () => {
      const list = this.listeners.get(event);
      if (list) {
        const idx = list.indexOf(handler as EventHandler<unknown>);
        if (idx >= 0) list.splice(idx, 1);
      }
    };
  }

  emit<K extends keyof TelemetryEvents>(
    event: K,
    data: TelemetryEvents[K]
  ): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch {
          // Never let a listener crash the pipeline
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Recording Methods
  // -------------------------------------------------------------------------

  recordSuccess(
    provider: ModelProvider,
    latencyMs: number,
    tokenUsage: TokenUsage,
    fallbackUsed = false
  ): void {
    const m = this.getMetrics(provider);
    m.successes++;
    m.latencies.push(latencyMs);
    m.totalTokens += tokenUsage.totalTokens;
    m.lastSuccess = new Date().toISOString();

    this.pushResult(provider, "success");

    // If circuit was half-open and this succeeded, close it
    if (m.circuitState === "half_open") {
      m.circuitState = "closed";
      this.emit("circuit_close", {
        provider,
        failureRate: this.getFailureRate(provider),
        timestamp: new Date().toISOString(),
      });
    }

    this.emit("success", {
      provider,
      latencyMs,
      tokenUsage,
      fallbackUsed,
      timestamp: new Date().toISOString(),
    });
  }

  recordFailure(provider: ModelProvider, error: string): void {
    const m = this.getMetrics(provider);
    m.failures++;
    m.lastFailure = new Date().toISOString();

    this.pushResult(provider, "failure");

    this.emit("error", {
      provider,
      error,
      timestamp: new Date().toISOString(),
    });

    // Check circuit breaker
    this.evaluateCircuit(provider);
  }

  recordFallback(
    failedProvider: ModelProvider,
    nextProvider: ModelProvider,
    error: string
  ): void {
    this.emit("fallback", {
      failedProvider,
      nextProvider,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  // -------------------------------------------------------------------------
  // Circuit Breaker
  // -------------------------------------------------------------------------

  /**
   * Check if a provider is available (circuit not open).
   * If the circuit has been open long enough, transition to half-open.
   */
  isProviderAvailable(provider: ModelProvider): boolean {
    const m = this.getMetrics(provider);

    if (m.circuitState === "closed" || m.circuitState === "half_open") {
      return true;
    }

    // Check if reset timeout has elapsed
    if (
      m.circuitOpenedAt &&
      Date.now() - m.circuitOpenedAt >= this.circuitConfig.resetTimeoutMs
    ) {
      m.circuitState = "half_open";
      return true;
    }

    return false;
  }

  /**
   * Filter a provider chain to only include available providers.
   */
  filterAvailableProviders(providers: ModelProvider[]): ModelProvider[] {
    return providers.filter((p) => this.isProviderAvailable(p));
  }

  // -------------------------------------------------------------------------
  // Health & Reporting
  // -------------------------------------------------------------------------

  getProviderHealth(provider: ModelProvider): ProviderHealth {
    const m = this.getMetrics(provider);
    const total = m.successes + m.failures;
    const successRate = total > 0 ? m.successes / total : 1;
    const sortedLatencies = [...m.latencies].sort((a, b) => a - b);

    return {
      provider,
      status:
        successRate >= 0.95
          ? "healthy"
          : successRate >= 0.8
            ? "degraded"
            : "unhealthy",
      circuitState: m.circuitState,
      successRate: Math.round(successRate * 1000) / 1000,
      avgLatencyMs:
        sortedLatencies.length > 0
          ? Math.round(
              sortedLatencies.reduce((a, b) => a + b, 0) /
                sortedLatencies.length
            )
          : 0,
      p95LatencyMs:
        sortedLatencies.length > 0
          ? sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] ?? 0
          : 0,
      totalRequests: total,
      totalFailures: m.failures,
      totalTokens: m.totalTokens,
      lastSuccess: m.lastSuccess,
      lastFailure: m.lastFailure,
    };
  }

  getHealthReport(): HealthReport {
    const providers = {} as Record<ModelProvider, ProviderHealth>;
    for (const p of ["claude", "grok", "perplexity"] as ModelProvider[]) {
      providers[p] = this.getProviderHealth(p);
    }

    const report: HealthReport = {
      providers,
      timestamp: new Date().toISOString(),
    };

    this.emit("health_report", report);
    return report;
  }

  /**
   * Get aggregate stats across all providers.
   */
  getAggregateStats(): {
    totalRequests: number;
    totalTokens: number;
    avgLatencyMs: number;
    providerDistribution: Record<string, number>;
  } {
    let totalRequests = 0;
    let totalTokens = 0;
    let totalLatencySum = 0;
    let totalLatencyCount = 0;
    const distribution: Record<string, number> = {};

    for (const p of ["claude", "grok", "perplexity"] as ModelProvider[]) {
      const m = this.getMetrics(p);
      const requests = m.successes + m.failures;
      totalRequests += requests;
      totalTokens += m.totalTokens;
      totalLatencySum += m.latencies.reduce((a, b) => a + b, 0);
      totalLatencyCount += m.latencies.length;
      distribution[p] = m.successes;
    }

    return {
      totalRequests,
      totalTokens,
      avgLatencyMs:
        totalLatencyCount > 0
          ? Math.round(totalLatencySum / totalLatencyCount)
          : 0,
      providerDistribution: distribution,
    };
  }

  /**
   * Reset all metrics. Useful for test isolation or periodic resets.
   */
  reset(): void {
    this.metrics.clear();
    this.recentResults.clear();
    this.initProvider("claude");
    this.initProvider("grok");
    this.initProvider("perplexity");
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private initProvider(provider: ModelProvider): void {
    this.metrics.set(provider, {
      successes: 0,
      failures: 0,
      latencies: [],
      totalTokens: 0,
      circuitState: "closed",
    });
    this.recentResults.set(provider, []);
  }

  private getMetrics(provider: ModelProvider): ProviderMetrics {
    let m = this.metrics.get(provider);
    if (!m) {
      this.initProvider(provider);
      m = this.metrics.get(provider)!;
    }
    return m;
  }

  private pushResult(
    provider: ModelProvider,
    result: "success" | "failure"
  ): void {
    const window = this.recentResults.get(provider) ?? [];
    window.push(result);
    if (window.length > this.circuitConfig.windowSize) {
      window.shift();
    }
    this.recentResults.set(provider, window);
  }

  private getFailureRate(provider: ModelProvider): number {
    const window = this.recentResults.get(provider) ?? [];
    if (window.length === 0) return 0;
    const failures = window.filter((r) => r === "failure").length;
    return failures / window.length;
  }

  private evaluateCircuit(provider: ModelProvider): void {
    const m = this.getMetrics(provider);
    const failureRate = this.getFailureRate(provider);
    const window = this.recentResults.get(provider) ?? [];

    // Need enough data points before tripping
    if (window.length < this.circuitConfig.failureThreshold) return;

    if (
      failureRate >= this.circuitConfig.failureRateThreshold &&
      m.circuitState === "closed"
    ) {
      m.circuitState = "open";
      m.circuitOpenedAt = Date.now();

      this.emit("circuit_open", {
        provider,
        failureRate,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
