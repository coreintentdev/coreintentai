import type { ModelProvider, TokenUsage } from "../types/index.js";

interface RequestRecord {
  id: string;
  intent: string;
  provider: ModelProvider;
  model: string;
  latencyMs: number;
  tokenUsage: TokenUsage;
  costUsd: number;
  fallbackUsed: boolean;
  success: boolean;
  timestamp: number;
}

interface ProviderMetrics {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  totalTokens: number;
  totalCostUsd: number;
  latencies: number[];
}

interface CostTable {
  inputPer1k: number;
  outputPer1k: number;
}

const COST_PER_1K_TOKENS: Record<ModelProvider, CostTable> = {
  claude: { inputPer1k: 0.003, outputPer1k: 0.015 },
  grok: { inputPer1k: 0.005, outputPer1k: 0.015 },
  perplexity: { inputPer1k: 0.001, outputPer1k: 0.001 },
};

export class Telemetry {
  private records: RequestRecord[] = [];
  private providerMetrics = new Map<ModelProvider, ProviderMetrics>();
  private maxRecords: number;
  private costOverrides: Partial<Record<ModelProvider, CostTable>>;

  constructor(options?: {
    maxRecords?: number;
    costOverrides?: Partial<Record<ModelProvider, CostTable>>;
  }) {
    this.maxRecords = options?.maxRecords ?? 10_000;
    this.costOverrides = options?.costOverrides ?? {};
  }

  record(params: {
    intent: string;
    provider: ModelProvider;
    model: string;
    latencyMs: number;
    tokenUsage: TokenUsage;
    fallbackUsed: boolean;
    success: boolean;
  }): RequestRecord {
    const cost = this.calculateCost(
      params.provider,
      params.tokenUsage
    );

    const record: RequestRecord = {
      id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      intent: params.intent,
      provider: params.provider,
      model: params.model,
      latencyMs: params.latencyMs,
      tokenUsage: params.tokenUsage,
      costUsd: cost,
      fallbackUsed: params.fallbackUsed,
      success: params.success,
      timestamp: Date.now(),
    };

    this.records.push(record);
    if (this.records.length > this.maxRecords) {
      this.records.shift();
    }

    this.updateMetrics(record);
    return record;
  }

  private calculateCost(
    provider: ModelProvider,
    usage: TokenUsage
  ): number {
    const table =
      this.costOverrides[provider] ?? COST_PER_1K_TOKENS[provider];
    return (
      (usage.inputTokens / 1000) * table.inputPer1k +
      (usage.outputTokens / 1000) * table.outputPer1k
    );
  }

  private updateMetrics(record: RequestRecord): void {
    let m = this.providerMetrics.get(record.provider);
    if (!m) {
      m = {
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        latencies: [],
      };
      this.providerMetrics.set(record.provider, m);
    }

    m.totalRequests++;
    if (record.success) m.successCount++;
    else m.failureCount++;
    m.totalTokens += record.tokenUsage.totalTokens;
    m.totalCostUsd += record.costUsd;
    m.latencies.push(record.latencyMs);
    if (m.latencies.length > 1000) m.latencies.shift();
  }

  getTotalCost(): number {
    let total = 0;
    for (const m of this.providerMetrics.values()) {
      total += m.totalCostUsd;
    }
    return total;
  }

  getCostByProvider(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [provider, m] of this.providerMetrics) {
      result[provider] = m.totalCostUsd;
    }
    return result;
  }

  getLatencyPercentiles(
    provider: ModelProvider
  ): { p50: number; p90: number; p99: number } | null {
    const m = this.providerMetrics.get(provider);
    if (!m || m.latencies.length === 0) return null;

    const sorted = [...m.latencies].sort((a, b) => a - b);
    return {
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  getSuccessRate(provider: ModelProvider): number | null {
    const m = this.providerMetrics.get(provider);
    if (!m || m.totalRequests === 0) return null;
    return m.successCount / m.totalRequests;
  }

  getSnapshot(): TelemetrySnapshot {
    const providers: Record<
      string,
      {
        requests: number;
        successRate: number;
        totalCostUsd: number;
        totalTokens: number;
        latency: { p50: number; p90: number; p99: number } | null;
      }
    > = {};

    for (const [provider, m] of this.providerMetrics) {
      providers[provider] = {
        requests: m.totalRequests,
        successRate:
          m.totalRequests > 0 ? m.successCount / m.totalRequests : 0,
        totalCostUsd: m.totalCostUsd,
        totalTokens: m.totalTokens,
        latency: this.getLatencyPercentiles(provider),
      };
    }

    const totalCost = this.getTotalCost();
    const totalRequests = this.records.length;
    const fallbackRate =
      totalRequests > 0
        ? this.records.filter((r) => r.fallbackUsed).length / totalRequests
        : 0;

    return {
      totalRequests,
      totalCostUsd: totalCost,
      fallbackRate,
      providers,
      recentErrors: this.records
        .filter((r) => !r.success)
        .slice(-10)
        .map((r) => ({
          intent: r.intent,
          provider: r.provider,
          timestamp: r.timestamp,
        })),
    };
  }

  getRecentRecords(count: number = 20): RequestRecord[] {
    return this.records.slice(-count);
  }

  getCostForWindow(windowMs: number): number {
    const cutoff = Date.now() - windowMs;
    return this.records
      .filter((r) => r.timestamp >= cutoff)
      .reduce((sum, r) => sum + r.costUsd, 0);
  }

  getProviderScore(provider: ModelProvider): number {
    const successRate = this.getSuccessRate(provider);
    if (successRate === null) return 0.5;

    const latency = this.getLatencyPercentiles(provider);
    const latencyScore = latency
      ? Math.max(0, 1 - latency.p50 / 30_000)
      : 0.5;

    return successRate * 0.6 + latencyScore * 0.4;
  }

  reset(): void {
    this.records = [];
    this.providerMetrics.clear();
  }
}

export interface TelemetrySnapshot {
  totalRequests: number;
  totalCostUsd: number;
  fallbackRate: number;
  providers: Record<
    string,
    {
      requests: number;
      successRate: number;
      totalCostUsd: number;
      totalTokens: number;
      latency: { p50: number; p90: number; p99: number } | null;
    }
  >;
  recentErrors: Array<{
    intent: string;
    provider: string;
    timestamp: number;
  }>;
}
