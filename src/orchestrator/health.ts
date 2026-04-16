/**
 * CoreIntent AI — Provider Health Metrics
 *
 * Tracks real-time performance metrics per provider: latency, error rates,
 * availability. Enables adaptive routing — the orchestrator can prefer
 * providers that are performing well and deprioritize sluggish ones.
 *
 * Uses an exponentially weighted moving average (EWMA) for latency to
 * emphasize recent performance without losing historical signal.
 */

import type { ModelProvider } from "../types/index.js";

export interface ProviderHealthSnapshot {
  provider: ModelProvider;
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
  totalRequests: number;
  totalErrors: number;
  lastRequestTime: number;
  lastErrorTime: number;
  uptime: number; // 0-1
  status: "healthy" | "degraded" | "unhealthy";
}

interface ProviderMetrics {
  latencies: number[]; // Rolling window of recent latencies
  totalRequests: number;
  totalErrors: number;
  lastRequestTime: number;
  lastErrorTime: number;
  ewmaLatency: number; // Exponentially weighted moving average
}

const MAX_LATENCY_WINDOW = 50; // Keep last 50 latency samples
const EWMA_ALPHA = 0.3; // Weight for new observations (higher = more reactive)

export class HealthTracker {
  private metrics: Map<ModelProvider, ProviderMetrics> = new Map();

  /**
   * Record a successful request with its latency.
   */
  recordSuccess(provider: ModelProvider, latencyMs: number): void {
    const m = this.getMetrics(provider);
    m.totalRequests++;
    m.lastRequestTime = Date.now();
    m.latencies.push(latencyMs);

    if (m.latencies.length > MAX_LATENCY_WINDOW) {
      m.latencies.shift();
    }

    // Update EWMA
    m.ewmaLatency =
      m.ewmaLatency === 0
        ? latencyMs
        : EWMA_ALPHA * latencyMs + (1 - EWMA_ALPHA) * m.ewmaLatency;
  }

  /**
   * Record a failed request.
   */
  recordError(provider: ModelProvider): void {
    const m = this.getMetrics(provider);
    m.totalRequests++;
    m.totalErrors++;
    m.lastRequestTime = Date.now();
    m.lastErrorTime = Date.now();
  }

  /**
   * Get a health snapshot for a specific provider.
   */
  getHealth(provider: ModelProvider): ProviderHealthSnapshot {
    const m = this.getMetrics(provider);

    const avgLatency =
      m.latencies.length > 0
        ? m.latencies.reduce((a, b) => a + b, 0) / m.latencies.length
        : 0;

    const p95Latency = this.calculateP95(m.latencies);
    const errorRate =
      m.totalRequests > 0 ? m.totalErrors / m.totalRequests : 0;
    const uptime = m.totalRequests > 0 ? 1 - errorRate : 1;

    let status: "healthy" | "degraded" | "unhealthy";
    if (errorRate > 0.5 || (m.ewmaLatency > 20_000 && m.totalRequests > 5)) {
      status = "unhealthy";
    } else if (
      errorRate > 0.2 ||
      (m.ewmaLatency > 10_000 && m.totalRequests > 5)
    ) {
      status = "degraded";
    } else {
      status = "healthy";
    }

    return {
      provider,
      avgLatencyMs: Math.round(avgLatency),
      p95LatencyMs: Math.round(p95Latency),
      errorRate: Math.round(errorRate * 1000) / 1000,
      totalRequests: m.totalRequests,
      totalErrors: m.totalErrors,
      lastRequestTime: m.lastRequestTime,
      lastErrorTime: m.lastErrorTime,
      uptime: Math.round(uptime * 1000) / 1000,
      status,
    };
  }

  /**
   * Get health snapshots for all tracked providers.
   */
  getAllHealth(): ProviderHealthSnapshot[] {
    const providers: ModelProvider[] = ["claude", "grok", "perplexity"];
    return providers.map((p) => this.getHealth(p));
  }

  /**
   * Rank providers by health, preferring low latency and low error rate.
   * Returns providers sorted best-to-worst.
   */
  rankProviders(providers: ModelProvider[]): ModelProvider[] {
    const scored = providers.map((p) => {
      const health = this.getHealth(p);

      // Score: lower is better
      // Latency component: normalized to 0-1 (0 = 0ms, 1 = 30s)
      const latencyScore = Math.min(health.avgLatencyMs / 30_000, 1);
      // Error rate component: 0-1
      const errorScore = health.errorRate;
      // Freshness bonus: providers used recently get a small boost
      const freshnessBonus =
        health.lastRequestTime > 0
          ? Math.min((Date.now() - health.lastRequestTime) / 300_000, 1) * 0.1
          : 0;

      // Weighted composite (errors matter more than latency)
      const score = errorScore * 0.6 + latencyScore * 0.3 + freshnessBonus;

      return { provider: p, score };
    });

    scored.sort((a, b) => a.score - b.score);
    return scored.map((s) => s.provider);
  }

  /**
   * Reset metrics for a provider.
   */
  reset(provider: ModelProvider): void {
    this.metrics.delete(provider);
  }

  /**
   * Reset all metrics.
   */
  resetAll(): void {
    this.metrics.clear();
  }

  private getMetrics(provider: ModelProvider): ProviderMetrics {
    if (!this.metrics.has(provider)) {
      this.metrics.set(provider, {
        latencies: [],
        totalRequests: 0,
        totalErrors: 0,
        lastRequestTime: 0,
        lastErrorTime: 0,
        ewmaLatency: 0,
      });
    }
    return this.metrics.get(provider)!;
  }

  private calculateP95(latencies: number[]): number {
    if (latencies.length === 0) return 0;
    const sorted = [...latencies].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, idx)];
  }
}
