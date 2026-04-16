/**
 * CoreIntent AI — Request Tracing
 *
 * Structured tracing for AI requests through the orchestration pipeline.
 * Every request gets a unique trace ID that follows it through routing,
 * fallback, provider calls, and caching — providing full observability
 * without external dependencies.
 *
 * Trace events are emitted via a simple callback, making it easy to:
 *   - Log to console during development
 *   - Stream to a file or database in production
 *   - Feed into observability platforms (Datadog, Grafana, etc.)
 *
 * Why this matters for trading:
 *   - When a signal arrives late, you need to know WHY. Was it a fallback?
 *     A cache miss? A slow provider? A retry?
 *   - Trace IDs correlate the full journey of every request.
 *   - Post-incident analysis becomes possible without guesswork.
 */

import type { ModelProvider, TaskIntent } from "../types/index.js";

export type TraceEventType =
  | "request_start"
  | "route_resolved"
  | "cache_hit"
  | "cache_miss"
  | "provider_attempt"
  | "provider_success"
  | "provider_failure"
  | "circuit_open"
  | "fallback_triggered"
  | "request_complete"
  | "request_error";

export interface TraceEvent {
  traceId: string;
  timestamp: number;
  event: TraceEventType;
  intent?: TaskIntent;
  provider?: ModelProvider;
  latencyMs?: number;
  tokens?: number;
  cached?: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

export type TraceListener = (event: TraceEvent) => void;

let traceCounter = 0;

/**
 * Generate a unique trace ID.
 * Format: "ci-{timestamp_base36}-{counter_base36}"
 * Short, sortable, and collision-free within a single process.
 */
export function generateTraceId(): string {
  traceCounter++;
  const ts = Date.now().toString(36);
  const seq = traceCounter.toString(36).padStart(4, "0");
  return `ci-${ts}-${seq}`;
}

/**
 * Trace context that collects events for a single request lifecycle.
 */
export class TraceContext {
  readonly traceId: string;
  private events: TraceEvent[] = [];
  private listeners: TraceListener[];
  private startTime: number;

  constructor(traceId?: string, listeners: TraceListener[] = []) {
    this.traceId = traceId ?? generateTraceId();
    this.listeners = listeners;
    this.startTime = Date.now();
  }

  /**
   * Emit a trace event.
   */
  emit(
    event: TraceEventType,
    data: Omit<TraceEvent, "traceId" | "timestamp" | "event"> = {}
  ): void {
    const traceEvent: TraceEvent = {
      traceId: this.traceId,
      timestamp: Date.now(),
      event,
      ...data,
    };

    this.events.push(traceEvent);

    for (const listener of this.listeners) {
      try {
        listener(traceEvent);
      } catch {
        // Trace listeners should never break the main flow
      }
    }
  }

  /**
   * Get all events recorded in this trace.
   */
  getEvents(): TraceEvent[] {
    return [...this.events];
  }

  /**
   * Get total elapsed time since trace creation.
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Build a structured summary of the trace.
   */
  summarize(): {
    traceId: string;
    totalMs: number;
    events: number;
    providers: ModelProvider[];
    cached: boolean;
    fallbackUsed: boolean;
    errors: string[];
  } {
    const providers = new Set<ModelProvider>();
    const errors: string[] = [];
    let cached = false;
    let fallbackUsed = false;

    for (const e of this.events) {
      if (e.provider) providers.add(e.provider);
      if (e.event === "cache_hit") cached = true;
      if (e.event === "fallback_triggered") fallbackUsed = true;
      if (e.error) errors.push(e.error);
    }

    return {
      traceId: this.traceId,
      totalMs: this.elapsed(),
      events: this.events.length,
      providers: [...providers],
      cached,
      fallbackUsed,
      errors,
    };
  }
}

/**
 * Global trace listener registry.
 * Attach listeners here to receive events from all traces.
 */
class TraceRegistry {
  private listeners: TraceListener[] = [];

  addListener(listener: TraceListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getListeners(): TraceListener[] {
    return [...this.listeners];
  }

  clear(): void {
    this.listeners = [];
  }
}

export const globalTraceRegistry = new TraceRegistry();

/**
 * Create a new trace context with global listeners attached.
 */
export function createTrace(traceId?: string): TraceContext {
  return new TraceContext(traceId, globalTraceRegistry.getListeners());
}

/**
 * Convenience: console trace listener for development.
 * Formats events as compact, readable log lines.
 */
export function consoleTraceListener(event: TraceEvent): void {
  const parts = [
    `[${event.traceId}]`,
    event.event.toUpperCase().padEnd(20),
  ];

  if (event.provider) parts.push(`provider=${event.provider}`);
  if (event.intent) parts.push(`intent=${event.intent}`);
  if (event.latencyMs !== undefined) parts.push(`${event.latencyMs}ms`);
  if (event.tokens !== undefined) parts.push(`${event.tokens}tok`);
  if (event.cached) parts.push("CACHED");
  if (event.error) parts.push(`err="${event.error}"`);

  console.log(parts.join(" "));
}
