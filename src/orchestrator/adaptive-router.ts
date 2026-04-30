import type { ModelProvider, TaskIntent } from "../types/index.js";
import type { RouteConfig } from "./router.js";
import { resolveRoute } from "./router.js";

interface PerformanceRecord {
  provider: ModelProvider;
  intent: TaskIntent;
  success: boolean;
  latencyMs: number;
  timestamp: number;
}

interface ProviderScore {
  provider: ModelProvider;
  score: number;
  successRate: number;
  avgLatency: number;
  sampleCount: number;
}

export interface AdaptiveRouterOptions {
  minSamples: number;
  decayHalfLifeMs: number;
  maxRecords: number;
  successWeight: number;
  latencyWeight: number;
  recencyWeight: number;
}

const DEFAULTS: AdaptiveRouterOptions = {
  minSamples: 5,
  decayHalfLifeMs: 3_600_000, // 1 hour
  maxRecords: 500,
  successWeight: 0.4,
  latencyWeight: 0.3,
  recencyWeight: 0.3,
};

export class AdaptiveRouter {
  private records: PerformanceRecord[] = [];
  private options: AdaptiveRouterOptions;

  constructor(options?: Partial<AdaptiveRouterOptions>) {
    this.options = { ...DEFAULTS, ...options };
  }

  recordOutcome(
    provider: ModelProvider,
    intent: TaskIntent,
    success: boolean,
    latencyMs: number
  ): void {
    this.records.push({
      provider,
      intent,
      success,
      latencyMs,
      timestamp: Date.now(),
    });

    if (this.records.length > this.options.maxRecords) {
      this.records = this.records.slice(-this.options.maxRecords);
    }
  }

  resolveRoute(
    intent: TaskIntent,
    preferredProvider?: ModelProvider
  ): RouteConfig {
    const staticRoute = resolveRoute(intent, preferredProvider);

    const intentRecords = this.records.filter((r) => r.intent === intent);
    if (intentRecords.length < this.options.minSamples) {
      return staticRoute;
    }

    const allProviders = [
      staticRoute.primary,
      ...staticRoute.fallbacks,
    ] as ModelProvider[];

    const scores = allProviders.map((p) =>
      this.scoreProvider(p, intentRecords)
    );

    scores.sort((a, b) => b.score - a.score);

    if (preferredProvider) {
      const preferred = scores.find((s) => s.provider === preferredProvider);
      if (preferred && preferred.successRate > 0.5) {
        const rest = scores
          .filter((s) => s.provider !== preferredProvider)
          .map((s) => s.provider);
        return { primary: preferredProvider, fallbacks: rest };
      }
    }

    const [primary, ...fallbacks] = scores.map((s) => s.provider);
    return { primary, fallbacks };
  }

  getProviderChain(
    intent: TaskIntent,
    preferredProvider?: ModelProvider
  ): ModelProvider[] {
    const route = this.resolveRoute(intent, preferredProvider);
    return [route.primary, ...route.fallbacks];
  }

  getScores(intent: TaskIntent): ProviderScore[] {
    const intentRecords = this.records.filter((r) => r.intent === intent);
    const providers: ModelProvider[] = ["claude", "grok", "perplexity"];
    return providers
      .map((p) => this.scoreProvider(p, intentRecords))
      .filter((s) => s.sampleCount > 0)
      .sort((a, b) => b.score - a.score);
  }

  getStats(): {
    totalRecords: number;
    byIntent: Record<string, number>;
    byProvider: Record<string, { total: number; successRate: number }>;
  } {
    const byIntent: Record<string, number> = {};
    const byProvider: Record<
      string,
      { total: number; successes: number }
    > = {};

    for (const r of this.records) {
      byIntent[r.intent] = (byIntent[r.intent] ?? 0) + 1;
      const p = (byProvider[r.provider] ??= { total: 0, successes: 0 });
      p.total++;
      if (r.success) p.successes++;
    }

    const providerStats: Record<
      string,
      { total: number; successRate: number }
    > = {};
    for (const [k, v] of Object.entries(byProvider)) {
      providerStats[k] = {
        total: v.total,
        successRate: v.total > 0 ? v.successes / v.total : 0,
      };
    }

    return {
      totalRecords: this.records.length,
      byIntent,
      byProvider: providerStats,
    };
  }

  reset(): void {
    this.records = [];
  }

  private scoreProvider(
    provider: ModelProvider,
    intentRecords: PerformanceRecord[]
  ): ProviderScore {
    const providerRecords = intentRecords.filter(
      (r) => r.provider === provider
    );

    if (providerRecords.length === 0) {
      return {
        provider,
        score: 0,
        successRate: 0,
        avgLatency: Infinity,
        sampleCount: 0,
      };
    }

    const now = Date.now();
    const { decayHalfLifeMs, successWeight, latencyWeight, recencyWeight } =
      this.options;

    let weightedSuccesses = 0;
    let weightedTotal = 0;
    let weightedLatencySum = 0;
    let weightedLatencyCount = 0;
    let recencySum = 0;

    for (const r of providerRecords) {
      const age = now - r.timestamp;
      const decay = Math.exp((-Math.LN2 * age) / decayHalfLifeMs);

      weightedTotal += decay;
      if (r.success) {
        weightedSuccesses += decay;
        weightedLatencySum += r.latencyMs * decay;
        weightedLatencyCount += decay;
      }
      recencySum += decay;
    }

    const successRate =
      weightedTotal > 0 ? weightedSuccesses / weightedTotal : 0;

    const avgLatency =
      weightedLatencyCount > 0
        ? weightedLatencySum / weightedLatencyCount
        : Infinity;

    // Normalize latency to 0-1 (lower is better). Cap at 30s.
    const latencyScore = Math.max(0, 1 - avgLatency / 30_000);

    // Recency = how much recent data we have (normalized by sample count)
    const recencyScore = Math.min(1, recencySum / this.options.minSamples);

    const score =
      successRate * successWeight +
      latencyScore * latencyWeight +
      recencyScore * recencyWeight;

    return {
      provider,
      score,
      successRate,
      avgLatency: avgLatency === Infinity ? -1 : Math.round(avgLatency),
      sampleCount: providerRecords.length,
    };
  }
}
