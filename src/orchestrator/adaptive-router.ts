import type { ModelProvider, TaskIntent } from "../types/index.js";

interface PerformanceRecord {
  intent: TaskIntent;
  provider: ModelProvider;
  success: boolean;
  latencyMs: number;
  timestamp: number;
}

interface ProviderStats {
  attempts: number;
  successes: number;
  totalLatencyMs: number;
  recentLatencies: number[];
}

export interface AdaptiveRouterOptions {
  explorationRate: number;
  maxHistorySize: number;
  decayHalfLifeMs: number;
  minSamples: number;
  latencyWindowSize: number;
}

const DEFAULTS: AdaptiveRouterOptions = {
  explorationRate: 0.1,
  maxHistorySize: 10_000,
  decayHalfLifeMs: 24 * 60 * 60 * 1000,
  minSamples: 5,
  latencyWindowSize: 50,
};

const ALL_PROVIDERS: ModelProvider[] = ["claude", "grok", "perplexity"];

export class AdaptiveRouter {
  private history: PerformanceRecord[] = [];
  private options: AdaptiveRouterOptions;

  constructor(options?: Partial<AdaptiveRouterOptions>) {
    this.options = { ...DEFAULTS, ...options };
  }

  record(entry: {
    intent: TaskIntent;
    provider: ModelProvider;
    success: boolean;
    latencyMs: number;
  }): void {
    this.history.push({ ...entry, timestamp: Date.now() });

    if (this.history.length > this.options.maxHistorySize) {
      this.history = this.history.slice(-Math.floor(this.options.maxHistorySize * 0.8));
    }
  }

  selectProvider(
    intent: TaskIntent,
    available: ModelProvider[] = ALL_PROVIDERS,
    staticPrimary?: ModelProvider
  ): ModelProvider {
    if (available.length === 0) {
      throw new Error("No providers available");
    }

    if (available.length === 1) {
      return available[0];
    }

    if (Math.random() < this.options.explorationRate) {
      return available[Math.floor(Math.random() * available.length)];
    }

    const scores = new Map<ModelProvider, number>();
    for (const provider of available) {
      scores.set(provider, this.computeScore(intent, provider, staticPrimary));
    }

    let best = available[0];
    let bestScore = scores.get(best) ?? 0;
    for (const provider of available) {
      const score = scores.get(provider) ?? 0;
      if (score > bestScore) {
        best = provider;
        bestScore = score;
      }
    }

    return best;
  }

  rankProviders(
    intent: TaskIntent,
    available: ModelProvider[] = ALL_PROVIDERS,
    staticPrimary?: ModelProvider
  ): ModelProvider[] {
    const scored = available.map((provider) => ({
      provider,
      score: this.computeScore(intent, provider, staticPrimary),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.provider);
  }

  private computeScore(
    intent: TaskIntent,
    provider: ModelProvider,
    staticPrimary?: ModelProvider
  ): number {
    const stats = this.getStats(intent, provider);

    if (stats.attempts < this.options.minSamples) {
      return provider === staticPrimary ? 0.6 : 0.5;
    }

    const successRate = stats.successes / stats.attempts;

    const avgLatency = stats.totalLatencyMs / stats.attempts;
    const latencyScore = 1 / (1 + avgLatency / 1000);

    return successRate * 0.7 + latencyScore * 0.3;
  }

  getStats(intent: TaskIntent, provider: ModelProvider): ProviderStats {
    const now = Date.now();
    const relevant = this.history.filter(
      (r) => r.intent === intent && r.provider === provider
    );

    let weightedAttempts = 0;
    let weightedSuccesses = 0;
    let weightedLatency = 0;
    const recentLatencies: number[] = [];

    for (const record of relevant) {
      const age = now - record.timestamp;
      const weight = Math.pow(0.5, age / this.options.decayHalfLifeMs);

      weightedAttempts += weight;
      if (record.success) {
        weightedSuccesses += weight;
      }
      weightedLatency += record.latencyMs * weight;
      recentLatencies.push(record.latencyMs);
    }

    return {
      attempts: Math.round(weightedAttempts * 100) / 100,
      successes: Math.round(weightedSuccesses * 100) / 100,
      totalLatencyMs: Math.round(weightedLatency),
      recentLatencies: recentLatencies.slice(-this.options.latencyWindowSize),
    };
  }

  getPerformanceSummary(): Map<
    string,
    { successRate: number; avgLatencyMs: number; samples: number }
  > {
    const summary = new Map<
      string,
      { successRate: number; avgLatencyMs: number; samples: number }
    >();

    const intents: TaskIntent[] = [
      "reasoning", "fast_analysis", "research", "sentiment", "signal", "risk", "general",
    ];

    for (const intent of intents) {
      for (const provider of ALL_PROVIDERS) {
        const stats = this.getStats(intent, provider);
        if (stats.attempts < 0.01) continue;

        const key = `${intent}:${provider}`;
        summary.set(key, {
          successRate: stats.attempts > 0 ? stats.successes / stats.attempts : 0,
          avgLatencyMs: stats.attempts > 0 ? stats.totalLatencyMs / stats.attempts : 0,
          samples: Math.round(stats.attempts),
        });
      }
    }

    return summary;
  }

  exportWeights(): PerformanceRecord[] {
    return [...this.history];
  }

  importWeights(records: PerformanceRecord[]): void {
    this.history = [...records];
    if (this.history.length > this.options.maxHistorySize) {
      this.history = this.history.slice(-this.options.maxHistorySize);
    }
  }

  reset(): void {
    this.history = [];
  }

  get historySize(): number {
    return this.history.length;
  }
}
