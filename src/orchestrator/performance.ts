import type { ModelProvider, TaskIntent, TokenUsage } from "../types/index.js";

interface Observation {
  provider: ModelProvider;
  intent: TaskIntent;
  latencyMs: number;
  success: boolean;
  tokenUsage: TokenUsage;
  timestamp: number;
}

interface ProviderMetrics {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  totalLatencyMs: number;
  totalTokens: number;
  latencies: number[];
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

const MAX_LATENCY_SAMPLES = 500;

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
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        totalLatencyMs: 0,
        totalTokens: 0,
        latencies: [],
        lastSeen: 0,
      });
    }

    const metrics = intentMetrics.providers.get(obs.provider)!;
    metrics.totalRequests++;
    metrics.totalLatencyMs += obs.latencyMs;
    metrics.totalTokens += obs.tokenUsage.totalTokens;
    metrics.lastSeen = Date.now();

    if (obs.success) {
      metrics.successCount++;
    } else {
      metrics.failureCount++;
    }

    metrics.latencies.push(obs.latencyMs);
    if (metrics.latencies.length > MAX_LATENCY_SAMPLES) {
      metrics.latencies.shift();
    }
  }

  getReport(
    provider: ModelProvider,
    intent: TaskIntent
  ): PerformanceReport | null {
    const metrics = this.intents.get(intent)?.providers.get(provider);
    if (!metrics || metrics.totalRequests === 0) return null;

    const sorted = [...metrics.latencies].sort((a, b) => a - b);
    const p = (pct: number) => sorted[Math.floor(sorted.length * pct)] ?? 0;

    const successRate = metrics.successCount / metrics.totalRequests;
    const avgLatencyMs = metrics.totalLatencyMs / metrics.totalRequests;
    const avgTokens = metrics.totalTokens / metrics.totalRequests;

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
      totalRequests: metrics.totalRequests,
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
        totalObservations += metrics.totalRequests;
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
