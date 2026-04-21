import type { TelemetryEvent, TelemetryEventType } from "../types/index.js";

type TelemetryListener = (event: TelemetryEvent) => void;

export class Telemetry {
  private listeners = new Map<TelemetryEventType | "*", Set<TelemetryListener>>();
  private buffer: TelemetryEvent[] = [];
  private bufferLimit: number;
  private enabled: boolean;

  constructor(options: { bufferLimit?: number; enabled?: boolean } = {}) {
    this.bufferLimit = options.bufferLimit ?? 1000;
    this.enabled = options.enabled ?? true;
  }

  on(type: TelemetryEventType | "*", listener: TelemetryListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);

    return () => {
      this.listeners.get(type)?.delete(listener);
    };
  }

  emit(event: Omit<TelemetryEvent, "timestamp">): void {
    if (!this.enabled) return;

    const fullEvent: TelemetryEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    this.buffer.push(fullEvent);
    if (this.buffer.length > this.bufferLimit) {
      this.buffer.shift();
    }

    const typeListeners = this.listeners.get(fullEvent.type);
    if (typeListeners) {
      for (const listener of typeListeners) {
        listener(fullEvent);
      }
    }

    const wildcardListeners = this.listeners.get("*");
    if (wildcardListeners) {
      for (const listener of wildcardListeners) {
        listener(fullEvent);
      }
    }
  }

  getBuffer(): TelemetryEvent[] {
    return [...this.buffer];
  }

  getBufferByType(type: TelemetryEventType): TelemetryEvent[] {
    return this.buffer.filter((e) => e.type === type);
  }

  getLatencyStats(provider?: string): {
    count: number;
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  } {
    let events = this.getBufferByType("request_complete");
    if (provider) {
      events = events.filter((e) => e.provider === provider);
    }

    const latencies = events
      .map((e) => e.latencyMs)
      .filter((l): l is number => l != null)
      .sort((a, b) => a - b);

    if (latencies.length === 0) {
      return { count: 0, avgMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0 };
    }

    const sum = latencies.reduce((a, b) => a + b, 0);
    return {
      count: latencies.length,
      avgMs: Math.round(sum / latencies.length),
      p50Ms: latencies[Math.floor(latencies.length * 0.5)],
      p95Ms: latencies[Math.floor(latencies.length * 0.95)],
      p99Ms: latencies[Math.floor(latencies.length * 0.99)],
    };
  }

  getErrorRate(provider?: string): { total: number; errors: number; rate: number } {
    const completions = this.getBufferByType("request_complete").filter(
      (e) => !provider || e.provider === provider
    );
    const errors = this.getBufferByType("request_error").filter(
      (e) => !provider || e.provider === provider
    );

    const total = completions.length + errors.length;
    return {
      total,
      errors: errors.length,
      rate: total > 0 ? errors.length / total : 0,
    };
  }

  clear(): void {
    this.buffer = [];
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

let globalTelemetry: Telemetry | null = null;

export function getTelemetry(): Telemetry {
  if (!globalTelemetry) {
    globalTelemetry = new Telemetry();
  }
  return globalTelemetry;
}

export function setGlobalTelemetry(telemetry: Telemetry): void {
  globalTelemetry = telemetry;
}
