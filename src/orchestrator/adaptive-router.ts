import type { ModelProvider, TaskIntent } from "../types/index.js";
import { resolveRoute, type RouteConfig } from "./router.js";

interface ProviderMetrics {
  totalRequests: number;
  successes: number;
  failures: number;
  totalLatencyMs: number;
  recentLatencies: number[];
  lastFailure: number | null;
  consecutiveFailures: number;
}

export interface AdaptiveRouterOptions {
  latencyWindowSize?: number;
  failurePenaltyMs?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerCooldownMs?: number;
}

export class AdaptiveRouter {
  private metrics = new Map<ModelProvider, ProviderMetrics>();
  private options: Required<AdaptiveRouterOptions>;

  constructor(options: AdaptiveRouterOptions = {}) {
    this.options = {
      latencyWindowSize: options.latencyWindowSize ?? 20,
      failurePenaltyMs: options.failurePenaltyMs ?? 5000,
      circuitBreakerThreshold: options.circuitBreakerThreshold ?? 5,
      circuitBreakerCooldownMs: options.circuitBreakerCooldownMs ?? 60_000,
    };

    for (const provider of ["claude", "grok", "perplexity"] as ModelProvider[]) {
      this.metrics.set(provider, {
        totalRequests: 0,
        successes: 0,
        failures: 0,
        totalLatencyMs: 0,
        recentLatencies: [],
        lastFailure: null,
        consecutiveFailures: 0,
      });
    }
  }

  recordSuccess(provider: ModelProvider, latencyMs: number): void {
    const m = this.getMetrics(provider);
    m.totalRequests++;
    m.successes++;
    m.consecutiveFailures = 0;
    m.totalLatencyMs += latencyMs;
    m.recentLatencies.push(latencyMs);
    if (m.recentLatencies.length > this.options.latencyWindowSize) {
      m.recentLatencies.shift();
    }
  }

  recordFailure(provider: ModelProvider): void {
    const m = this.getMetrics(provider);
    m.totalRequests++;
    m.failures++;
    m.consecutiveFailures++;
    m.lastFailure = Date.now();
  }

  resolveRoute(
    intent: TaskIntent,
    preferredProvider?: ModelProvider
  ): RouteConfig {
    const base = resolveRoute(intent, preferredProvider);
    const chain = [base.primary, ...base.fallbacks];

    const available = chain.filter((p) => !this.isCircuitOpen(p));

    if (available.length === 0) {
      return base;
    }

    if (preferredProvider && available.includes(preferredProvider)) {
      const fallbacks = available
        .filter((p) => p !== preferredProvider)
        .map((p) => ({ provider: p, score: this.score(p) }))
        .sort((a, b) => b.score - a.score)
        .map((s) => s.provider);

      return { primary: preferredProvider, fallbacks };
    }

    const scored = available
      .map((p) => ({ provider: p, score: this.score(p) }))
      .sort((a, b) => b.score - a.score);

    return {
      primary: scored[0].provider,
      fallbacks: scored.slice(1).map((s) => s.provider),
    };
  }

  getProviderStats(provider: ModelProvider): {
    successRate: number;
    avgLatencyMs: number;
    circuitOpen: boolean;
  } {
    const m = this.getMetrics(provider);
    return {
      successRate: m.totalRequests > 0 ? m.successes / m.totalRequests : 1,
      avgLatencyMs:
        m.recentLatencies.length > 0
          ? m.recentLatencies.reduce((s, l) => s + l, 0) /
            m.recentLatencies.length
          : 0,
      circuitOpen: this.isCircuitOpen(provider),
    };
  }

  getAllStats(): Record<
    string,
    { successRate: number; avgLatencyMs: number; circuitOpen: boolean }
  > {
    const stats: Record<
      string,
      { successRate: number; avgLatencyMs: number; circuitOpen: boolean }
    > = {};
    for (const provider of ["claude", "grok", "perplexity"] as ModelProvider[]) {
      stats[provider] = this.getProviderStats(provider);
    }
    return stats;
  }

  reset(): void {
    for (const [, m] of this.metrics) {
      m.totalRequests = 0;
      m.successes = 0;
      m.failures = 0;
      m.totalLatencyMs = 0;
      m.recentLatencies = [];
      m.lastFailure = null;
      m.consecutiveFailures = 0;
    }
  }

  private score(provider: ModelProvider): number {
    const m = this.getMetrics(provider);

    if (m.totalRequests === 0) return 100;

    const successRate = m.successes / m.totalRequests;
    const avgLatency =
      m.recentLatencies.length > 0
        ? m.recentLatencies.reduce((s, l) => s + l, 0) /
          m.recentLatencies.length
        : 0;

    const latencyPenalty = Math.min(avgLatency / 100, 50);
    const failurePenalty =
      m.consecutiveFailures * (this.options.failurePenaltyMs / 100);

    return successRate * 100 - latencyPenalty - failurePenalty;
  }

  private isCircuitOpen(provider: ModelProvider): boolean {
    const m = this.getMetrics(provider);

    if (
      m.consecutiveFailures >= this.options.circuitBreakerThreshold &&
      m.lastFailure !== null
    ) {
      const elapsed = Date.now() - m.lastFailure;
      return elapsed < this.options.circuitBreakerCooldownMs;
    }

    return false;
  }

  private getMetrics(provider: ModelProvider): ProviderMetrics {
    let m = this.metrics.get(provider);
    if (!m) {
      m = {
        totalRequests: 0,
        successes: 0,
        failures: 0,
        totalLatencyMs: 0,
        recentLatencies: [],
        lastFailure: null,
        consecutiveFailures: 0,
      };
      this.metrics.set(provider, m);
    }
    return m;
  }
}
