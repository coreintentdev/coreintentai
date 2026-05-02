import { randomUUID } from "crypto";

export interface TraceSpan {
  spanId: string;
  parentSpanId?: string;
  operation: string;
  provider?: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: "ok" | "error";
  metadata?: Record<string, unknown>;
}

export class Tracer {
  private spans: TraceSpan[] = [];
  readonly traceId: string;

  constructor(traceId?: string) {
    this.traceId = traceId ?? randomUUID();
  }

  startSpan(
    operation: string,
    parentSpanId?: string,
    metadata?: Record<string, unknown>
  ): TraceSpan {
    const span: TraceSpan = {
      spanId: randomUUID(),
      parentSpanId,
      operation,
      startTime: performance.now(),
      status: "ok",
      metadata,
    };
    this.spans.push(span);
    return span;
  }

  endSpan(
    span: TraceSpan,
    status: "ok" | "error" = "ok",
    metadata?: Record<string, unknown>
  ): void {
    span.endTime = performance.now();
    span.durationMs = Math.round(span.endTime - span.startTime);
    span.status = status;
    if (metadata) {
      span.metadata = { ...span.metadata, ...metadata };
    }
  }

  getSpans(): TraceSpan[] {
    return [...this.spans];
  }

  getSummary(): {
    traceId: string;
    totalDurationMs: number;
    spanCount: number;
    errors: number;
    providerLatencies: Record<string, number>;
  } {
    const errors = this.spans.filter((s) => s.status === "error").length;
    const firstStart = Math.min(...this.spans.map((s) => s.startTime));
    const lastEnd = Math.max(
      ...this.spans.map((s) => s.endTime ?? s.startTime)
    );

    const providerLatencies: Record<string, number> = {};
    for (const span of this.spans) {
      if (span.provider && span.durationMs !== undefined) {
        providerLatencies[span.provider] = span.durationMs;
      }
    }

    return {
      traceId: this.traceId,
      totalDurationMs: Math.round(lastEnd - firstStart),
      spanCount: this.spans.length,
      errors,
      providerLatencies,
    };
  }
}

export function generateTraceId(): string {
  return randomUUID();
}
