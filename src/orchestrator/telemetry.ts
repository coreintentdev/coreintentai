import type { ModelProvider, TaskIntent, TokenUsage } from "../types/index.js";

export type TelemetryEventType =
  | "request_start"
  | "request_complete"
  | "request_error"
  | "fallback_triggered"
  | "circuit_open"
  | "circuit_close"
  | "cache_hit"
  | "cache_miss"
  | "escalation"
  | "provider_degraded"
  | "provider_recovered";

export interface TelemetryEvent {
  type: TelemetryEventType;
  timestamp: string;
  intent?: TaskIntent;
  provider?: ModelProvider;
  latencyMs?: number;
  tokenUsage?: TokenUsage;
  error?: string;
  metadata?: Record<string, unknown>;
}

export type TelemetryListener = (event: TelemetryEvent) => void;

export interface TelemetrySnapshot {
  totalRequests: number;
  totalErrors: number;
  totalFallbacks: number;
  totalCacheHits: number;
  totalEscalations: number;
  avgLatencyMs: number;
  providerBreakdown: Map<ModelProvider, {
    requests: number;
    errors: number;
    avgLatencyMs: number;
    totalTokens: number;
  }>;
  intentBreakdown: Map<TaskIntent, {
    requests: number;
    avgLatencyMs: number;
  }>;
  uptime: number;
}

export class Telemetry {
  private listeners: TelemetryListener[] = [];
  private events: TelemetryEvent[] = [];
  private maxEvents: number;
  private startedAt: number;

  private counters = {
    requests: 0,
    errors: 0,
    fallbacks: 0,
    cacheHits: 0,
    escalations: 0,
  };

  private providerStats = new Map<ModelProvider, {
    requests: number;
    errors: number;
    totalLatencyMs: number;
    totalTokens: number;
  }>();

  private intentStats = new Map<TaskIntent, {
    requests: number;
    totalLatencyMs: number;
  }>();

  constructor(maxEvents = 1000) {
    this.maxEvents = maxEvents;
    this.startedAt = Date.now();
  }

  on(listener: TelemetryListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  emit(event: Omit<TelemetryEvent, "timestamp">): void {
    const full: TelemetryEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    this.events.push(full);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    this.updateCounters(full);

    for (const listener of this.listeners) {
      try {
        listener(full);
      } catch {
        // Never let a listener crash the system
      }
    }
  }

  private updateCounters(event: TelemetryEvent): void {
    switch (event.type) {
      case "request_start":
        this.counters.requests++;
        if (event.provider) {
          const ps = this.getProviderStats(event.provider);
          ps.requests++;
        }
        if (event.intent) {
          const is = this.getIntentStats(event.intent);
          is.requests++;
        }
        break;
      case "request_complete":
        if (event.provider && event.latencyMs !== undefined) {
          const ps = this.getProviderStats(event.provider);
          ps.totalLatencyMs += event.latencyMs;
          if (event.tokenUsage) {
            ps.totalTokens += event.tokenUsage.totalTokens;
          }
        }
        if (event.intent && event.latencyMs !== undefined) {
          const is = this.getIntentStats(event.intent);
          is.totalLatencyMs += event.latencyMs;
        }
        break;
      case "request_error":
        this.counters.errors++;
        if (event.provider) {
          this.getProviderStats(event.provider).errors++;
        }
        break;
      case "fallback_triggered":
        this.counters.fallbacks++;
        break;
      case "cache_hit":
        this.counters.cacheHits++;
        break;
      case "escalation":
        this.counters.escalations++;
        break;
    }
  }

  private getProviderStats(provider: ModelProvider) {
    let s = this.providerStats.get(provider);
    if (!s) {
      s = { requests: 0, errors: 0, totalLatencyMs: 0, totalTokens: 0 };
      this.providerStats.set(provider, s);
    }
    return s;
  }

  private getIntentStats(intent: TaskIntent) {
    let s = this.intentStats.get(intent);
    if (!s) {
      s = { requests: 0, totalLatencyMs: 0 };
      this.intentStats.set(intent, s);
    }
    return s;
  }

  getSnapshot(): TelemetrySnapshot {
    const providerBreakdown = new Map<ModelProvider, {
      requests: number;
      errors: number;
      avgLatencyMs: number;
      totalTokens: number;
    }>();

    for (const [provider, stats] of this.providerStats) {
      providerBreakdown.set(provider, {
        requests: stats.requests,
        errors: stats.errors,
        avgLatencyMs: stats.requests > 0 ? stats.totalLatencyMs / stats.requests : 0,
        totalTokens: stats.totalTokens,
      });
    }

    const intentBreakdown = new Map<TaskIntent, {
      requests: number;
      avgLatencyMs: number;
    }>();

    for (const [intent, stats] of this.intentStats) {
      intentBreakdown.set(intent, {
        requests: stats.requests,
        avgLatencyMs: stats.requests > 0 ? stats.totalLatencyMs / stats.requests : 0,
      });
    }

    let totalLatency = 0;
    for (const stats of this.providerStats.values()) {
      totalLatency += stats.totalLatencyMs;
    }

    return {
      totalRequests: this.counters.requests,
      totalErrors: this.counters.errors,
      totalFallbacks: this.counters.fallbacks,
      totalCacheHits: this.counters.cacheHits,
      totalEscalations: this.counters.escalations,
      avgLatencyMs: this.counters.requests > 0
        ? totalLatency / this.counters.requests
        : 0,
      providerBreakdown,
      intentBreakdown,
      uptime: Date.now() - this.startedAt,
    };
  }

  getRecentEvents(count = 50): TelemetryEvent[] {
    return this.events.slice(-count);
  }

  reset(): void {
    this.events = [];
    this.counters = {
      requests: 0,
      errors: 0,
      fallbacks: 0,
      cacheHits: 0,
      escalations: 0,
    };
    this.providerStats.clear();
    this.intentStats.clear();
    this.startedAt = Date.now();
  }
}
