import type { ModelProvider, TaskIntent, TokenUsage } from "../types/index.js";

export interface SpanData {
  id: string;
  traceId: string;
  parentId: string | null;
  name: string;
  kind: "orchestrator" | "model" | "capability" | "agent" | "pipeline" | "custom";
  startMs: number;
  endMs: number | null;
  durationMs: number | null;
  provider: ModelProvider | null;
  intent: TaskIntent | null;
  status: "running" | "ok" | "error";
  error: string | null;
  tokenUsage: TokenUsage | null;
  metadata: Record<string, unknown>;
}

export class Span {
  private data: SpanData;
  private children: Span[] = [];

  constructor(
    traceId: string,
    name: string,
    kind: SpanData["kind"],
    parentId: string | null = null
  ) {
    this.data = {
      id: generateId(),
      traceId,
      parentId,
      name,
      kind,
      startMs: performance.now(),
      endMs: null,
      durationMs: null,
      provider: null,
      intent: null,
      status: "running",
      error: null,
      tokenUsage: null,
      metadata: {},
    };
  }

  get id(): string {
    return this.data.id;
  }

  setProvider(provider: ModelProvider): this {
    this.data.provider = provider;
    return this;
  }

  setIntent(intent: TaskIntent): this {
    this.data.intent = intent;
    return this;
  }

  setTokenUsage(usage: TokenUsage): this {
    this.data.tokenUsage = usage;
    return this;
  }

  setMetadata(key: string, value: unknown): this {
    this.data.metadata[key] = value;
    return this;
  }

  startChild(name: string, kind: SpanData["kind"]): Span {
    const child = new Span(this.data.traceId, name, kind, this.data.id);
    this.children.push(child);
    return child;
  }

  end(status: "ok" | "error" = "ok", error?: string): void {
    this.data.endMs = performance.now();
    this.data.durationMs = Math.round(this.data.endMs - this.data.startMs);
    this.data.status = status;
    if (error) this.data.error = error;
  }

  toJSON(): SpanData & { children: ReturnType<Span["toJSON"]>[] } {
    return {
      ...this.data,
      children: this.children.map((c) => c.toJSON()),
    };
  }
}

export class Trace {
  readonly id: string;
  readonly name: string;
  private rootSpan: Span;
  private allSpans = new Map<string, Span>();
  private startTime: number;

  constructor(name: string) {
    this.id = generateId();
    this.name = name;
    this.startTime = performance.now();
    this.rootSpan = new Span(this.id, name, "pipeline");
    this.allSpans.set(this.rootSpan.id, this.rootSpan);
  }

  get root(): Span {
    return this.rootSpan;
  }

  startSpan(name: string, kind: SpanData["kind"], parent?: Span): Span {
    const parentSpan = parent ?? this.rootSpan;
    const span = parentSpan.startChild(name, kind);
    this.allSpans.set(span.id, span);
    return span;
  }

  end(status: "ok" | "error" = "ok", error?: string): void {
    this.rootSpan.end(status, error);
  }

  get durationMs(): number {
    return Math.round(performance.now() - this.startTime);
  }

  toJSON(): {
    id: string;
    name: string;
    durationMs: number;
    spans: ReturnType<Span["toJSON"]>;
  } {
    return {
      id: this.id,
      name: this.name,
      durationMs: this.durationMs,
      spans: this.rootSpan.toJSON(),
    };
  }
}

export class Tracer {
  private traces: Trace[] = [];
  private maxTraces: number;
  private listeners: Array<(trace: Trace) => void> = [];

  constructor(options?: { maxTraces?: number }) {
    this.maxTraces = options?.maxTraces ?? 100;
  }

  startTrace(name: string): Trace {
    const trace = new Trace(name);
    this.traces.push(trace);
    if (this.traces.length > this.maxTraces) {
      this.traces.shift();
    }
    return trace;
  }

  endTrace(trace: Trace, status: "ok" | "error" = "ok", error?: string): void {
    trace.end(status, error);
    for (const listener of this.listeners) {
      listener(trace);
    }
  }

  onTraceComplete(listener: (trace: Trace) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getRecentTraces(limit = 10): Trace[] {
    return this.traces.slice(-limit);
  }

  getSummary(): {
    totalTraces: number;
    avgDurationMs: number;
    errorRate: number;
  } {
    const completed = this.traces.filter((t) => {
      const json = t.toJSON();
      return json.spans.status !== "running";
    });

    if (completed.length === 0) {
      return { totalTraces: 0, avgDurationMs: 0, errorRate: 0 };
    }

    const durations = completed.map((t) => t.toJSON().durationMs);
    const errors = completed.filter(
      (t) => t.toJSON().spans.status === "error"
    ).length;

    return {
      totalTraces: completed.length,
      avgDurationMs: Math.round(
        durations.reduce((a, b) => a + b, 0) / durations.length
      ),
      errorRate: errors / completed.length,
    };
  }

  clear(): void {
    this.traces = [];
  }
}

let counter = 0;
function generateId(): string {
  const time = Date.now().toString(36);
  const seq = (counter++).toString(36).padStart(4, "0");
  const rand = Math.random().toString(36).slice(2, 6);
  return `${time}-${seq}-${rand}`;
}
