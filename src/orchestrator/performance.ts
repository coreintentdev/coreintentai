import type { ModelProvider, TaskIntent, TokenUsage } from "../types/index.js";

interface TimestampedSample {
  latencyMs: number;
  tokens: number;
  success: boolean;
  timestamp: number;
}

interface ProviderMetrics {
  samples: TimestampedSample[];
  lastSeen: number;
}

interface IntentMetrics {
  providers: Map<ModelProvider, ProviderMetrics>;
}

export interface PerformanceReport {
  provider: ModelProvider;
  intent: TaskIntent;
  successRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  avgTokensPerRequest: number;
  totalRequests: number;
  score: number;
}

export interface ProviderRanking {
  intent: TaskIntent;
  rankings: Array<{
    provider: ModelProvider;
    score: number;
    reason: string;
  }>;
}

const MAX_SAMPLES = 500;

export class PerformanceTracker {
  private intents: Map<TaskIntent, IntentMetrics> = new Map();
  private windowMs: number;

  constructor(windowMs: number = 3_600_000) {
    this.windowMs = windowMs;
  }

  record(obs: {
    provider: ModelProvider;
    intent: TaskIntent;
    latencyMs: number;
    success: boolean;
    tokenUsage: TokenUsage;
  }): void {
    if (!this.intents.has(obs.intent)) {
      this.intents.set(obs.intent, { providers: new Map() });
    }

    const intentMetrics = this.intents.get(obs.intent)!;

    if (!intentMetrics.providers.has(obs.provider)) {
      intentMetrics.providers.set(obs.provider, {
        samples: [],
        lastSeen: 0,
      });
    }

    const metrics = intentMetrics.providers.get(obs.provider)!;
    metrics.lastSeen = Date.now();

    metrics.samples.push({
      latencyMs: obs.latencyMs,
      tokens: obs.tokenUsage.totalTokens,
      success: obs.success,
      timestamp: metrics.lastSeen,
    });

    if (metrics.samples.length > MAX_SAMPLES) {
      metrics.samples.shift();
    }
  }

  private getActiveSamples(metrics: ProviderMetrics): TimestampedSample[] {
    const cutoff = Date.now() - this.windowMs;
    const inWindow = metrics.samples.filter((s) => s.timestamp >= cutoff);
    return inWindow.length > 0 ? inWindow : metrics.samples;
  }

  getReport(
    provider: ModelProvider,
    intent: TaskIntent
  ): PerformanceReport | null {
    const metrics = this.intents.get(intent)?.providers.get(provider);
    if (!metrics || metrics.samples.length === 0) return null;

    const active = this.getActiveSamples(metrics);
    const latencies = active.map((s) => s.latencyMs);
    const sorted = [...latencies].sort((a, b) => a - b);
    const p = (pct: number) => sorted[Math.floor(sorted.length * pct)] ?? 0;

    const successCount = active.filter((s) => s.success).length;
    const successRate = successCount / active.length;
    const avgLatencyMs =
      latencies.reduce((s, l) => s + l, 0) / latencies.length;
    const avgTokens =
      active.reduce((s, o) => s + o.tokens, 0) / active.length;

    const latencyScore = Math.max(0, 1 - avgLatencyMs / 30_000);
    const score = successRate * 0.6 + latencyScore * 0.4;

    return {
      provider,
      intent,
      successRate,
      avgLatencyMs: Math.round(avgLatencyMs),
      p50LatencyMs: Math.round(p(0.5)),
      p95LatencyMs: Math.round(p(0.95)),
      p99LatencyMs: Math.round(p(0.99)),
      avgTokensPerRequest: Math.round(avgTokens),
      totalRequests: active.length,
      score,
    };
  }

  rankProviders(intent: TaskIntent): ProviderRanking {
    const intentMetrics = this.intents.get(intent);
    const rankings: ProviderRanking["rankings"] = [];

    if (intentMetrics) {
      for (const [provider] of intentMetrics.providers) {
        const report = this.getReport(provider, intent);
        if (report) {
          let reason = `${(report.successRate * 100).toFixed(0)}% success, ${report.avgLatencyMs}ms avg`;
          if (report.successRate < 0.8) {
            reason += " (reliability concern)";
          }
          rankings.push({ provider, score: report.score, reason });
        }
      }
    }

    rankings.sort((a, b) => b.score - a.score);
    return { intent, rankings };
  }

  getRecommendedProvider(
    intent: TaskIntent,
    minObservations: number = 5
  ): ModelProvider | null {
    const ranking = this.rankProviders(intent);
    const qualified = ranking.rankings.filter((r) => {
      const report = this.getReport(r.provider, intent);
      return report && report.totalRequests >= minObservations;
    });

    return qualified.length > 0 ? qualified[0].provider : null;
  }

  getFullReport(): PerformanceReport[] {
    const reports: PerformanceReport[] = [];

    for (const [intent, intentMetrics] of this.intents) {
      for (const [provider] of intentMetrics.providers) {
        const report = this.getReport(provider, intent);
        if (report) reports.push(report);
      }
    }

    return reports.sort((a, b) => b.score - a.score);
  }

  getSummary(): {
    totalObservations: number;
    intentsTracked: number;
    providersTracked: Set<ModelProvider>;
    topPerformers: Array<{
      intent: TaskIntent;
      provider: ModelProvider;
      score: number;
    }>;
  } {
    let totalObservations = 0;
    const providersTracked = new Set<ModelProvider>();
    const topPerformers: Array<{
      intent: TaskIntent;
      provider: ModelProvider;
      score: number;
    }> = [];

    for (const [intent, intentMetrics] of this.intents) {
      let bestScore = -1;
      let bestProvider: ModelProvider | null = null;

      for (const [provider, metrics] of intentMetrics.providers) {
        totalObservations += metrics.samples.length;
        providersTracked.add(provider);
        const report = this.getReport(provider, intent);
        if (report && report.score > bestScore) {
          bestScore = report.score;
          bestProvider = provider;
        }
      }

      if (bestProvider) {
        topPerformers.push({
          intent,
          provider: bestProvider,
          score: bestScore,
        });
      }
    }

    return {
      totalObservations,
      intentsTracked: this.intents.size,
      providersTracked,
      topPerformers,
    };
  }

  reset(): void {
    this.intents.clear();
  }
}
