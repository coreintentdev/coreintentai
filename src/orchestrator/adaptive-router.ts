/**
 * CoreIntent AI — Adaptive Router
 *
 * Evolves beyond static routing tables. The adaptive router maintains
 * per-provider, per-intent performance metrics and dynamically adjusts
 * routing priorities based on observed behavior.
 *
 * How it works:
 *   1. Starts from the static route table (same as router.ts).
 *   2. Records latency, success/failure, and token cost for every request.
 *   3. Computes a composite score for each provider per intent:
 *        score = w_success * successRate
 *              + w_latency * (1 - normalizedLatency)
 *              + w_cost    * (1 - normalizedCost)
 *   4. When routing, providers are sorted by score (highest first).
 *   5. A minimum sample threshold prevents premature re-ranking.
 *
 * The static table remains as the cold-start default. The adaptive layer
 * only kicks in after enough observations accumulate.
 *
 * Why this matters for trading:
 *   - Provider performance varies by time of day, load, and query type.
 *   - A static table can't adapt to "Grok is slow today" or
 *     "Perplexity keeps timing out on sentiment queries."
 *   - The adaptive router learns and adjusts in real time.
 */

import type { ModelProvider, TaskIntent } from "../types/index.js";
import { resolveRoute } from "./router.js";

export interface AdaptiveRouterConfig {
  /** Minimum observations before adaptive scoring overrides static table. Default: 10 */
  minSamples: number;
  /** Weight for success rate in composite score. Default: 0.5 */
  weightSuccess: number;
  /** Weight for latency (lower is better). Default: 0.3 */
  weightLatency: number;
  /** Weight for cost efficiency (fewer tokens is better). Default: 0.2 */
  weightCost: number;
  /** Maximum observations to keep per provider-intent pair (sliding window). Default: 100 */
  maxObservations: number;
  /** Decay factor for older observations (0-1). 1.0 = no decay. Default: 0.95 */
  decayFactor: number;
}

interface Observation {
  timestamp: number;
  latencyMs: number;
  success: boolean;
  totalTokens: number;
}

interface ProviderIntentMetrics {
  observations: Observation[];
  cachedScore: number | null;
  lastScoreUpdate: number;
}

const DEFAULT_CONFIG: AdaptiveRouterConfig = {
  minSamples: 10,
  weightSuccess: 0.5,
  weightLatency: 0.3,
  weightCost: 0.2,
  maxObservations: 100,
  decayFactor: 0.95,
};

type MetricKey = `${ModelProvider}:${TaskIntent}`;

export class AdaptiveRouter {
  private metrics = new Map<MetricKey, ProviderIntentMetrics>();
  private config: AdaptiveRouterConfig;

  constructor(config: Partial<AdaptiveRouterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private key(provider: ModelProvider, intent: TaskIntent): MetricKey {
    return `${provider}:${intent}`;
  }

  private getMetrics(
    provider: ModelProvider,
    intent: TaskIntent
  ): ProviderIntentMetrics {
    const k = this.key(provider, intent);
    let m = this.metrics.get(k);
    if (!m) {
      m = { observations: [], cachedScore: null, lastScoreUpdate: 0 };
      this.metrics.set(k, m);
    }
    return m;
  }

  /**
   * Record an observation for a provider-intent pair.
   */
  record(params: {
    provider: ModelProvider;
    intent: TaskIntent;
    latencyMs: number;
    success: boolean;
    totalTokens: number;
  }): void {
    const m = this.getMetrics(params.provider, params.intent);

    m.observations.push({
      timestamp: Date.now(),
      latencyMs: params.latencyMs,
      success: params.success,
      totalTokens: params.totalTokens,
    });

    // Trim to max window
    if (m.observations.length > this.config.maxObservations) {
      m.observations = m.observations.slice(-this.config.maxObservations);
    }

    // Invalidate cached score
    m.cachedScore = null;
  }

  /**
   * Compute the composite score for a provider-intent pair.
   * Higher is better. Returns null if insufficient samples.
   */
  private computeScore(
    provider: ModelProvider,
    intent: TaskIntent
  ): number | null {
    const m = this.getMetrics(provider, intent);

    if (m.observations.length < this.config.minSamples) {
      return null;
    }

    // Use cached score if still fresh (< 5s old)
    if (m.cachedScore !== null && Date.now() - m.lastScoreUpdate < 5000) {
      return m.cachedScore;
    }

    const { decayFactor } = this.config;
    const n = m.observations.length;

    let weightedSuccessSum = 0;
    let weightedLatencySum = 0;
    let weightedCostSum = 0;
    let totalWeight = 0;

    // Find max values for normalization (across this provider-intent)
    let maxLatency = 0;
    let maxTokens = 0;
    for (const obs of m.observations) {
      if (obs.latencyMs > maxLatency) maxLatency = obs.latencyMs;
      if (obs.totalTokens > maxTokens) maxTokens = obs.totalTokens;
    }

    // Avoid division by zero
    maxLatency = maxLatency || 1;
    maxTokens = maxTokens || 1;

    for (let i = 0; i < n; i++) {
      const obs = m.observations[i];
      // Exponential decay: more recent observations weigh more
      const age = n - 1 - i;
      const weight = Math.pow(decayFactor, age);

      weightedSuccessSum += (obs.success ? 1 : 0) * weight;
      weightedLatencySum += (obs.latencyMs / maxLatency) * weight;
      weightedCostSum += (obs.totalTokens / maxTokens) * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) return null;

    const successRate = weightedSuccessSum / totalWeight;
    const normalizedLatency = weightedLatencySum / totalWeight;
    const normalizedCost = weightedCostSum / totalWeight;

    const score =
      this.config.weightSuccess * successRate +
      this.config.weightLatency * (1 - normalizedLatency) +
      this.config.weightCost * (1 - normalizedCost);

    m.cachedScore = score;
    m.lastScoreUpdate = Date.now();

    return score;
  }

  /**
   * Get the optimal provider chain for an intent, considering adaptive metrics.
   * Falls back to the static route table if insufficient data.
   */
  getProviderChain(
    intent: TaskIntent,
    preferredProvider?: ModelProvider
  ): ModelProvider[] {
    const staticRoute = resolveRoute(intent, preferredProvider);
    const allProviders: ModelProvider[] = [
      staticRoute.primary,
      ...staticRoute.fallbacks,
    ];

    // Score each provider
    const scored: Array<{ provider: ModelProvider; score: number | null }> =
      allProviders.map((provider) => ({
        provider,
        score: this.computeScore(provider, intent),
      }));

    // Check if we have enough data to adaptively route
    const hasAdaptiveData = scored.some((s) => s.score !== null);

    if (!hasAdaptiveData) {
      // Cold start — use static routing
      return allProviders;
    }

    // Sort by score (descending). Providers without scores go to the end
    // but maintain their static order relative to each other.
    scored.sort((a, b) => {
      if (a.score !== null && b.score !== null) return b.score - a.score;
      if (a.score !== null) return -1;
      if (b.score !== null) return 1;
      return 0;
    });

    // If preferred provider specified, ensure it's first
    if (preferredProvider) {
      const idx = scored.findIndex((s) => s.provider === preferredProvider);
      if (idx > 0) {
        const [preferred] = scored.splice(idx, 1);
        scored.unshift(preferred);
      }
    }

    return scored.map((s) => s.provider);
  }

  /**
   * Get performance summary for all tracked provider-intent pairs.
   */
  getSummary(): Array<{
    provider: ModelProvider;
    intent: TaskIntent;
    samples: number;
    score: number | null;
    avgLatencyMs: number;
    successRate: number;
    avgTokens: number;
  }> {
    const results: Array<{
      provider: ModelProvider;
      intent: TaskIntent;
      samples: number;
      score: number | null;
      avgLatencyMs: number;
      successRate: number;
      avgTokens: number;
    }> = [];

    for (const [key, m] of this.metrics) {
      const [provider, intent] = key.split(":") as [ModelProvider, TaskIntent];
      const n = m.observations.length;

      if (n === 0) continue;

      const avgLatencyMs =
        m.observations.reduce((sum, o) => sum + o.latencyMs, 0) / n;
      const successRate =
        m.observations.filter((o) => o.success).length / n;
      const avgTokens =
        m.observations.reduce((sum, o) => sum + o.totalTokens, 0) / n;

      results.push({
        provider,
        intent,
        samples: n,
        score: this.computeScore(provider, intent),
        avgLatencyMs: Math.round(avgLatencyMs),
        successRate: Math.round(successRate * 1000) / 1000,
        avgTokens: Math.round(avgTokens),
      });
    }

    return results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }

  /**
   * Reset all tracked metrics.
   */
  reset(): void {
    this.metrics.clear();
  }
}
