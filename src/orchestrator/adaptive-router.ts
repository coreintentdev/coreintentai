import type { ModelProvider, TaskIntent } from "../types/index.js";
import { resolveRoute, type RouteConfig } from "./router.js";

interface PerformanceRecord {
  successRate: number;
  avgLatencyMs: number;
  samples: number;
  lastUpdated: number;
}

export interface AdaptiveRouterOptions {
  decayFactor: number;
  minSamples: number;
  latencyWeight: number;
  successWeight: number;
}

const DEFAULTS: AdaptiveRouterOptions = {
  decayFactor: 0.15,
  minSamples: 3,
  latencyWeight: 0.3,
  successWeight: 0.7,
};

export class AdaptiveRouter {
  private metrics = new Map<string, PerformanceRecord>();
  private options: AdaptiveRouterOptions;

  constructor(options?: Partial<AdaptiveRouterOptions>) {
    this.options = { ...DEFAULTS, ...options };
  }

  private key(provider: ModelProvider, intent: TaskIntent): string {
    return `${provider}:${intent}`;
  }

  recordOutcome(
    provider: ModelProvider,
    intent: TaskIntent,
    success: boolean,
    latencyMs: number
  ): void {
    const k = this.key(provider, intent);
    const existing = this.metrics.get(k);

    if (!existing) {
      this.metrics.set(k, {
        successRate: success ? 1.0 : 0.0,
        avgLatencyMs: latencyMs,
        samples: 1,
        lastUpdated: Date.now(),
      });
      return;
    }

    const alpha = this.options.decayFactor;
    existing.successRate =
      existing.successRate * (1 - alpha) + (success ? 1.0 : 0.0) * alpha;
    existing.avgLatencyMs =
      existing.avgLatencyMs * (1 - alpha) + latencyMs * alpha;
    existing.samples++;
    existing.lastUpdated = Date.now();
  }

  getProviderScore(provider: ModelProvider, intent: TaskIntent): number | null {
    const record = this.metrics.get(this.key(provider, intent));
    if (!record || record.samples < this.options.minSamples) return null;

    const normalizedLatency = Math.max(
      0,
      1 - record.avgLatencyMs / 10_000
    );

    return (
      this.options.successWeight * record.successRate +
      this.options.latencyWeight * normalizedLatency
    );
  }

  resolveRoute(
    intent: TaskIntent,
    preferredProvider?: ModelProvider
  ): RouteConfig {
    const base = resolveRoute(intent, preferredProvider);
    const chain = [base.primary, ...base.fallbacks];

    const scored = chain.map((provider) => ({
      provider,
      score: this.getProviderScore(provider, intent),
    }));

    const withData = scored.filter((s) => s.score !== null);
    if (withData.length < 2) return base;

    const sorted = [...scored].sort((a, b) => {
      if (a.score === null && b.score === null) return 0;
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return b.score - a.score;
    });

    return {
      primary: sorted[0].provider,
      fallbacks: sorted.slice(1).map((s) => s.provider),
    };
  }

  getMetrics(): Map<
    string,
    { successRate: number; avgLatencyMs: number; samples: number }
  > {
    const result = new Map<
      string,
      { successRate: number; avgLatencyMs: number; samples: number }
    >();
    for (const [key, record] of this.metrics) {
      result.set(key, {
        successRate: record.successRate,
        avgLatencyMs: Math.round(record.avgLatencyMs),
        samples: record.samples,
      });
    }
    return result;
  }

  getProviderRanking(intent: TaskIntent): Array<{
    provider: ModelProvider;
    score: number | null;
    successRate: number | null;
    avgLatencyMs: number | null;
  }> {
    const providers: ModelProvider[] = ["claude", "grok", "perplexity"];
    return providers
      .map((provider) => {
        const record = this.metrics.get(this.key(provider, intent));
        return {
          provider,
          score: this.getProviderScore(provider, intent),
          successRate: record?.successRate ?? null,
          avgLatencyMs: record ? Math.round(record.avgLatencyMs) : null,
        };
      })
      .sort((a, b) => {
        if (a.score === null && b.score === null) return 0;
        if (a.score === null) return 1;
        if (b.score === null) return -1;
        return b.score - a.score;
      });
  }

  reset(): void {
    this.metrics.clear();
  }
}
