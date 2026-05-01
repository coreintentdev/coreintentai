import type { ModelProvider, TaskIntent } from "../types/index.js";

export type TraceEventType =
  | "route_decision"
  | "model_call"
  | "model_response"
  | "fallback_triggered"
  | "circuit_breaker_trip"
  | "circuit_breaker_recovery"
  | "capability_start"
  | "capability_complete"
  | "capability_error"
  | "agent_start"
  | "agent_step"
  | "agent_complete"
  | "pipeline_start"
  | "pipeline_stage"
  | "pipeline_complete"
  | "consensus_start"
  | "consensus_complete"
  | "parse_error"
  | "adaptive_route";

export interface TraceEvent {
  id: string;
  traceId: string;
  parentId?: string;
  type: TraceEventType;
  timestamp: number;
  durationMs?: number;
  provider?: ModelProvider;
  intent?: TaskIntent;
  metadata: Record<string, unknown>;
}

export interface TelemetrySummary {
  totalEvents: number;
  eventsByType: Record<string, number>;
  providerStats: Record<
    string,
    {
      calls: number;
      successes: number;
      failures: number;
      avgLatencyMs: number;
      p95LatencyMs: number;
    }
  >;
  errorRate: number;
  fallbackRate: number;
  uptimeMs: number;
}

type TelemetryListener = (event: TraceEvent) => void;

let idCounter = 0;

function generateId(): string {
  return `evt_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;
}

function generateTraceId(): string {
  return `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export class Telemetry {
  private events: TraceEvent[] = [];
  private listeners: TelemetryListener[] = [];
  private maxEvents: number;
  private startTime: number;

  constructor(options?: { maxEvents?: number }) {
    this.maxEvents = options?.maxEvents ?? 50_000;
    this.startTime = Date.now();
  }

  startTrace(): string {
    return generateTraceId();
  }

  record(
    event: Omit<TraceEvent, "id" | "timestamp"> & { timestamp?: number }
  ): string {
    const id = generateId();
    const full: TraceEvent = {
      ...event,
      id,
      timestamp: event.timestamp ?? Date.now(),
    };

    this.events.push(full);

    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-Math.floor(this.maxEvents * 0.8));
    }

    for (const listener of this.listeners) {
      try {
        listener(full);
      } catch {
        // listeners must not crash telemetry
      }
    }

    return id;
  }

  subscribe(listener: TelemetryListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  query(filter: {
    type?: TraceEventType;
    traceId?: string;
    provider?: ModelProvider;
    intent?: TaskIntent;
    since?: number;
    until?: number;
  }): TraceEvent[] {
    return this.events.filter((e) => {
      if (filter.type && e.type !== filter.type) return false;
      if (filter.traceId && e.traceId !== filter.traceId) return false;
      if (filter.provider && e.provider !== filter.provider) return false;
      if (filter.intent && e.intent !== filter.intent) return false;
      if (filter.since && e.timestamp < filter.since) return false;
      if (filter.until && e.timestamp > filter.until) return false;
      return true;
    });
  }

  getTrace(traceId: string): TraceEvent[] {
    return this.events
      .filter((e) => e.traceId === traceId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  summary(): TelemetrySummary {
    const eventsByType: Record<string, number> = {};
    const providerLatencies: Record<string, number[]> = {};
    const providerSuccesses: Record<string, number> = {};
    const providerFailures: Record<string, number> = {};
    let fallbackCount = 0;
    let modelCalls = 0;

    for (const event of this.events) {
      eventsByType[event.type] = (eventsByType[event.type] ?? 0) + 1;

      if (event.type === "model_response" && event.provider) {
        modelCalls++;
        const p = event.provider;
        const success = event.metadata.success !== false;

        if (success) {
          providerSuccesses[p] = (providerSuccesses[p] ?? 0) + 1;
        } else {
          providerFailures[p] = (providerFailures[p] ?? 0) + 1;
        }

        if (event.durationMs !== undefined) {
          if (!providerLatencies[p]) providerLatencies[p] = [];
          providerLatencies[p].push(event.durationMs);
        }
      }

      if (event.type === "fallback_triggered") {
        fallbackCount++;
      }
    }

    const providerStats: TelemetrySummary["providerStats"] = {};
    for (const p of Object.keys({ ...providerSuccesses, ...providerFailures })) {
      const latencies = providerLatencies[p] ?? [];
      const sorted = [...latencies].sort((a, b) => a - b);
      const avg = latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;
      const p95Idx = Math.floor(sorted.length * 0.95);
      const p95 = sorted[p95Idx] ?? 0;

      providerStats[p] = {
        calls: (providerSuccesses[p] ?? 0) + (providerFailures[p] ?? 0),
        successes: providerSuccesses[p] ?? 0,
        failures: providerFailures[p] ?? 0,
        avgLatencyMs: Math.round(avg),
        p95LatencyMs: Math.round(p95),
      };
    }

    const totalErrors = Object.values(providerFailures).reduce(
      (a, b) => a + b,
      0
    );

    return {
      totalEvents: this.events.length,
      eventsByType,
      providerStats,
      errorRate: modelCalls > 0 ? totalErrors / modelCalls : 0,
      fallbackRate: modelCalls > 0 ? fallbackCount / modelCalls : 0,
      uptimeMs: Date.now() - this.startTime,
    };
  }

  clear(): void {
    this.events = [];
  }

  get size(): number {
    return this.events.length;
  }
}
