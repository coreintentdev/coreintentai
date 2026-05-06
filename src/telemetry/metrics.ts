import type { ModelProvider } from "../types/index.js";

export interface LatencyStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface ProviderStats {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  reliability: number;
  latency: LatencyStats | null;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export interface MetricsSnapshot {
  providers: Record<string, ProviderStats>;
  totalRequests: number;
  totalFailures: number;
  overallReliability: number;
  uptimeMs: number;
}

export class MetricsCollector {
  private latencies = new Map<string, number[]>();
  private tokenUsage = new Map<
    string,
    { input: number; output: number }
  >();
  private requestCounts = new Map<
    string,
    { success: number; failure: number }
  >();
  private startTime = Date.now();
  private windowSize: number;

  constructor(options?: { windowSize?: number }) {
    this.windowSize = options?.windowSize ?? 500;
  }

  recordLatency(key: string, ms: number): void {
    let arr = this.latencies.get(key);
    if (!arr) {
      arr = [];
      this.latencies.set(key, arr);
    }
    arr.push(ms);
    if (arr.length > this.windowSize) {
      arr.shift();
    }
  }

  recordTokens(
    provider: string,
    inputTokens: number,
    outputTokens: number
  ): void {
    const existing = this.tokenUsage.get(provider) ?? {
      input: 0,
      output: 0,
    };
    existing.input += inputTokens;
    existing.output += outputTokens;
    this.tokenUsage.set(provider, existing);
  }

  recordRequest(provider: string, success: boolean): void {
    const counts = this.requestCounts.get(provider) ?? {
      success: 0,
      failure: 0,
    };
    if (success) {
      counts.success++;
    } else {
      counts.failure++;
    }
    this.requestCounts.set(provider, counts);
  }

  getPercentile(key: string, p: number): number | null {
    const arr = this.latencies.get(key);
    if (!arr || arr.length === 0) return null;

    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  getLatencyStats(key: string): LatencyStats | null {
    const arr = this.latencies.get(key);
    if (!arr || arr.length === 0) return null;

    const sorted = [...arr].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count: sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: Math.round(sum / sorted.length),
      p50: sorted[Math.max(0, Math.ceil(0.5 * sorted.length) - 1)],
      p95: sorted[Math.max(0, Math.ceil(0.95 * sorted.length) - 1)],
      p99: sorted[Math.max(0, Math.ceil(0.99 * sorted.length) - 1)],
    };
  }

  getReliability(provider: string): number {
    const counts = this.requestCounts.get(provider);
    if (!counts) return 1;
    const total = counts.success + counts.failure;
    if (total === 0) return 1;
    return counts.success / total;
  }

  getProviderStats(provider: string): ProviderStats {
    const counts = this.requestCounts.get(provider) ?? {
      success: 0,
      failure: 0,
    };
    const tokens = this.tokenUsage.get(provider) ?? {
      input: 0,
      output: 0,
    };
    const total = counts.success + counts.failure;

    return {
      totalRequests: total,
      successCount: counts.success,
      failureCount: counts.failure,
      reliability: total === 0 ? 1 : counts.success / total,
      latency: this.getLatencyStats(provider),
      totalInputTokens: tokens.input,
      totalOutputTokens: tokens.output,
    };
  }

  getSnapshot(): MetricsSnapshot {
    const providers: Record<string, ProviderStats> = {};
    const allProviders = new Set([
      ...this.requestCounts.keys(),
      ...this.tokenUsage.keys(),
      ...this.latencies.keys(),
    ]);

    let totalRequests = 0;
    let totalFailures = 0;

    for (const provider of allProviders) {
      const stats = this.getProviderStats(provider);
      providers[provider] = stats;
      totalRequests += stats.totalRequests;
      totalFailures += stats.failureCount;
    }

    return {
      providers,
      totalRequests,
      totalFailures,
      overallReliability:
        totalRequests === 0
          ? 1
          : (totalRequests - totalFailures) / totalRequests,
      uptimeMs: Date.now() - this.startTime,
    };
  }

  reset(): void {
    this.latencies.clear();
    this.tokenUsage.clear();
    this.requestCounts.clear();
    this.startTime = Date.now();
  }
}
