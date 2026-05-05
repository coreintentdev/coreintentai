import { EventEmitter } from "events";
import type { ModelProvider, TaskIntent, TokenUsage } from "../types/index.js";

// ---------------------------------------------------------------------------
// Event Types
// ---------------------------------------------------------------------------

export interface RequestStartEvent {
  requestId: string;
  provider: ModelProvider;
  intent: TaskIntent;
  timestamp: number;
}

export interface RequestCompleteEvent {
  requestId: string;
  provider: ModelProvider;
  intent: TaskIntent;
  latencyMs: number;
  tokenUsage: TokenUsage;
  costUsd: number;
  cached: boolean;
  timestamp: number;
}

export interface RequestErrorEvent {
  requestId: string;
  provider: ModelProvider;
  intent: TaskIntent;
  error: string;
  transient: boolean;
  timestamp: number;
}

export interface FallbackTriggeredEvent {
  requestId: string;
  fromProvider: ModelProvider;
  toProvider: ModelProvider;
  reason: string;
  timestamp: number;
}

export interface CircuitBreakerTelemetryEvent {
  provider: ModelProvider;
  previousState: string;
  newState: string;
  timestamp: number;
}

export interface CacheHitEvent {
  provider: ModelProvider;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  estimatedSavingsUsd: number;
  timestamp: number;
}

export interface TelemetryEventMap {
  request_start: RequestStartEvent;
  request_complete: RequestCompleteEvent;
  request_error: RequestErrorEvent;
  fallback_triggered: FallbackTriggeredEvent;
  circuit_breaker_state_change: CircuitBreakerTelemetryEvent;
  cache_hit: CacheHitEvent;
}

// ---------------------------------------------------------------------------
// Cost Model — per 1M tokens (USD)
// ---------------------------------------------------------------------------

const TOKEN_COSTS: Record<
  string,
  { input: number; output: number; cacheRead: number; cacheWrite: number }
> = {
  claude: {
    input: 3.0,
    output: 15.0,
    cacheRead: 0.3,
    cacheWrite: 3.75,
  },
  grok: {
    input: 3.0,
    output: 15.0,
    cacheRead: 3.0,
    cacheWrite: 3.0,
  },
  perplexity: {
    input: 1.0,
    output: 5.0,
    cacheRead: 1.0,
    cacheWrite: 1.0,
  },
};

// ---------------------------------------------------------------------------
// Metrics Types
// ---------------------------------------------------------------------------

export interface ProviderMetrics {
  requests: number;
  successes: number;
  failures: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  tokens: { input: number; output: number };
}

export interface IntentMetrics {
  requests: number;
  avgLatencyMs: number;
  avgCostUsd: number;
}

export interface MetricsSnapshot {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalCostUsd: number;
  totalTokens: { input: number; output: number };
  cacheSavingsUsd: number;
  byProvider: Record<string, ProviderMetrics>;
  byIntent: Record<string, IntentMetrics>;
  latencyP50Ms: number;
  latencyP95Ms: number;
  latencyP99Ms: number;
  uptimeMs: number;
}

// ---------------------------------------------------------------------------
// Telemetry Engine
// ---------------------------------------------------------------------------

export class Telemetry {
  private emitter = new EventEmitter();
  private startTime = Date.now();

  private requests = 0;
  private successes = 0;
  private failures = 0;
  private totalCostUsd = 0;
  private totalTokensInput = 0;
  private totalTokensOutput = 0;
  private cacheSavingsUsd = 0;
  private latencies: number[] = [];

  private providerStats = new Map<string, ProviderMetrics>();
  private intentStats = new Map<string, IntentMetrics>();

  on<K extends keyof TelemetryEventMap>(
    event: K,
    listener: (data: TelemetryEventMap[K]) => void
  ): this {
    this.emitter.on(event, listener);
    return this;
  }

  off<K extends keyof TelemetryEventMap>(
    event: K,
    listener: (data: TelemetryEventMap[K]) => void
  ): this {
    this.emitter.off(event, listener);
    return this;
  }

  emit<K extends keyof TelemetryEventMap>(
    event: K,
    data: TelemetryEventMap[K]
  ): void {
    this.track(event, data);
    this.emitter.emit(event, data);
  }

  generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  calculateCost(
    provider: ModelProvider,
    tokenUsage: TokenUsage,
    cacheMetrics?: {
      cacheReadInputTokens: number;
      cacheCreationInputTokens: number;
    }
  ): number {
    const costs = TOKEN_COSTS[provider] ?? TOKEN_COSTS.claude;

    let inputCost: number;
    if (cacheMetrics) {
      const regularInputTokens =
        tokenUsage.inputTokens -
        cacheMetrics.cacheReadInputTokens -
        cacheMetrics.cacheCreationInputTokens;
      inputCost =
        (Math.max(0, regularInputTokens) / 1_000_000) * costs.input +
        (cacheMetrics.cacheReadInputTokens / 1_000_000) * costs.cacheRead +
        (cacheMetrics.cacheCreationInputTokens / 1_000_000) * costs.cacheWrite;
    } else {
      inputCost = (tokenUsage.inputTokens / 1_000_000) * costs.input;
    }

    const outputCost = (tokenUsage.outputTokens / 1_000_000) * costs.output;
    return inputCost + outputCost;
  }

  getSnapshot(): MetricsSnapshot {
    const byProvider: Record<string, ProviderMetrics> = {};
    for (const [k, v] of this.providerStats) {
      byProvider[k] = { ...v, tokens: { ...v.tokens } };
    }

    const byIntent: Record<string, IntentMetrics> = {};
    for (const [k, v] of this.intentStats) {
      byIntent[k] = { ...v };
    }

    return {
      totalRequests: this.requests,
      successfulRequests: this.successes,
      failedRequests: this.failures,
      totalCostUsd: this.totalCostUsd,
      totalTokens: {
        input: this.totalTokensInput,
        output: this.totalTokensOutput,
      },
      cacheSavingsUsd: this.cacheSavingsUsd,
      byProvider,
      byIntent,
      latencyP50Ms: this.percentile(this.latencies, 50),
      latencyP95Ms: this.percentile(this.latencies, 95),
      latencyP99Ms: this.percentile(this.latencies, 99),
      uptimeMs: Date.now() - this.startTime,
    };
  }

  reset(): void {
    this.requests = 0;
    this.successes = 0;
    this.failures = 0;
    this.totalCostUsd = 0;
    this.totalTokensInput = 0;
    this.totalTokensOutput = 0;
    this.cacheSavingsUsd = 0;
    this.latencies = [];
    this.providerStats.clear();
    this.intentStats.clear();
    this.startTime = Date.now();
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private track(event: string, data: unknown): void {
    if (event === "request_start") {
      this.requests++;
    }

    if (event === "request_complete") {
      const d = data as RequestCompleteEvent;
      this.successes++;
      this.totalCostUsd += d.costUsd;
      this.totalTokensInput += d.tokenUsage.inputTokens;
      this.totalTokensOutput += d.tokenUsage.outputTokens;
      this.latencies.push(d.latencyMs);
      if (this.latencies.length > 10_000) {
        this.latencies = this.latencies.slice(-10_000);
      }

      const pm = this.getOrCreateProvider(d.provider);
      pm.requests++;
      pm.successes++;
      pm.totalCostUsd += d.costUsd;
      pm.tokens.input += d.tokenUsage.inputTokens;
      pm.tokens.output += d.tokenUsage.outputTokens;
      pm.avgLatencyMs =
        pm.avgLatencyMs === 0
          ? d.latencyMs
          : pm.avgLatencyMs * 0.9 + d.latencyMs * 0.1;

      const im = this.getOrCreateIntent(d.intent);
      im.requests++;
      im.avgLatencyMs =
        im.avgLatencyMs === 0
          ? d.latencyMs
          : im.avgLatencyMs * 0.9 + d.latencyMs * 0.1;
      im.avgCostUsd =
        im.avgCostUsd === 0
          ? d.costUsd
          : im.avgCostUsd * 0.9 + d.costUsd * 0.1;
    }

    if (event === "request_error") {
      const d = data as RequestErrorEvent;
      this.failures++;
      const pm = this.getOrCreateProvider(d.provider);
      pm.requests++;
      pm.failures++;
    }

    if (event === "cache_hit") {
      const d = data as CacheHitEvent;
      this.cacheSavingsUsd += d.estimatedSavingsUsd;
    }
  }

  private getOrCreateProvider(provider: string): ProviderMetrics {
    let m = this.providerStats.get(provider);
    if (!m) {
      m = {
        requests: 0,
        successes: 0,
        failures: 0,
        totalCostUsd: 0,
        avgLatencyMs: 0,
        tokens: { input: 0, output: 0 },
      };
      this.providerStats.set(provider, m);
    }
    return m;
  }

  private getOrCreateIntent(intent: string): IntentMetrics {
    let m = this.intentStats.get(intent);
    if (!m) {
      m = { requests: 0, avgLatencyMs: 0, avgCostUsd: 0 };
      this.intentStats.set(intent, m);
    }
    return m;
  }

  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }
}
