import { describe, it, expect, beforeEach } from "vitest";
import { Tracer, Trace, Span } from "../src/utils/tracer.js";

describe("Span", () => {
  it("creates with running status", () => {
    const span = new Span("trace-1", "test-span", "model");
    const json = span.toJSON();
    expect(json.name).toBe("test-span");
    expect(json.kind).toBe("model");
    expect(json.status).toBe("running");
    expect(json.endMs).toBeNull();
    expect(json.durationMs).toBeNull();
  });

  it("records duration on end", () => {
    const span = new Span("trace-1", "test-span", "capability");
    span.end("ok");
    const json = span.toJSON();
    expect(json.status).toBe("ok");
    expect(json.endMs).not.toBeNull();
    expect(json.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("records error on failure", () => {
    const span = new Span("trace-1", "test-span", "model");
    span.end("error", "timeout after 30s");
    const json = span.toJSON();
    expect(json.status).toBe("error");
    expect(json.error).toBe("timeout after 30s");
  });

  it("sets provider, intent, tokenUsage, metadata", () => {
    const span = new Span("trace-1", "test", "model");
    span
      .setProvider("claude")
      .setIntent("reasoning")
      .setTokenUsage({ inputTokens: 100, outputTokens: 50, totalTokens: 150 })
      .setMetadata("ticker", "AAPL");

    const json = span.toJSON();
    expect(json.provider).toBe("claude");
    expect(json.intent).toBe("reasoning");
    expect(json.tokenUsage).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });
    expect(json.metadata.ticker).toBe("AAPL");
  });

  it("supports child spans", () => {
    const parent = new Span("trace-1", "parent", "pipeline");
    const child = parent.startChild("child", "model");
    child.setProvider("grok").end("ok");
    parent.end("ok");

    const json = parent.toJSON();
    expect(json.children).toHaveLength(1);
    expect(json.children[0].name).toBe("child");
    expect(json.children[0].parentId).toBe(json.id);
    expect(json.children[0].provider).toBe("grok");
  });

  it("supports deeply nested spans", () => {
    const root = new Span("trace-1", "pipeline", "pipeline");
    const agent = root.startChild("analyst", "agent");
    const model = agent.startChild("claude-call", "model");
    model.end("ok");
    agent.end("ok");
    root.end("ok");

    const json = root.toJSON();
    expect(json.children[0].children[0].name).toBe("claude-call");
  });
});

describe("Trace", () => {
  it("creates with root span", () => {
    const trace = new Trace("test-pipeline");
    expect(trace.name).toBe("test-pipeline");
    expect(trace.id).toBeTruthy();
    expect(trace.root).toBeDefined();
  });

  it("starts spans under root", () => {
    const trace = new Trace("pipeline");
    const span = trace.startSpan("model-call", "model");
    span.setProvider("claude").end("ok");
    trace.end("ok");

    const json = trace.toJSON();
    expect(json.spans.children).toHaveLength(1);
    expect(json.spans.children[0].provider).toBe("claude");
  });

  it("starts spans under specific parent", () => {
    const trace = new Trace("pipeline");
    const agentSpan = trace.startSpan("agent", "agent");
    const modelSpan = trace.startSpan("model", "model", agentSpan);
    modelSpan.end("ok");
    agentSpan.end("ok");
    trace.end("ok");

    const json = trace.toJSON();
    const agentChild = json.spans.children[0];
    expect(agentChild.children).toHaveLength(1);
    expect(agentChild.children[0].name).toBe("model");
  });

  it("tracks duration", () => {
    const trace = new Trace("test");
    expect(trace.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("freezes duration after ending", async () => {
    const trace = new Trace("test");
    trace.end("ok");
    const endedDuration = trace.durationMs;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(trace.durationMs).toBe(endedDuration);
  });

  it("serializes to JSON", () => {
    const trace = new Trace("test");
    trace.end("ok");
    const json = trace.toJSON();
    expect(json.id).toBe(trace.id);
    expect(json.name).toBe("test");
    expect(json.durationMs).toBeGreaterThanOrEqual(0);
    expect(json.spans).toBeDefined();
  });
});

describe("Tracer", () => {
  let tracer: Tracer;

  beforeEach(() => {
    tracer = new Tracer({ maxTraces: 5 });
  });

  it("starts and ends traces", () => {
    const trace = tracer.startTrace("test");
    tracer.endTrace(trace, "ok");

    const recent = tracer.getRecentTraces();
    expect(recent).toHaveLength(1);
    expect(recent[0].id).toBe(trace.id);
  });

  it("limits stored traces to maxTraces", () => {
    for (let i = 0; i < 10; i++) {
      const t = tracer.startTrace(`trace-${i}`);
      tracer.endTrace(t, "ok");
    }

    expect(tracer.getRecentTraces(100)).toHaveLength(5);
  });

  it("returns limited recent traces", () => {
    for (let i = 0; i < 5; i++) {
      const t = tracer.startTrace(`trace-${i}`);
      tracer.endTrace(t, "ok");
    }

    expect(tracer.getRecentTraces(2)).toHaveLength(2);
  });

  it("fires listeners on trace completion", () => {
    const completed: string[] = [];
    tracer.onTraceComplete((trace) => completed.push(trace.name));

    const t1 = tracer.startTrace("first");
    tracer.endTrace(t1, "ok");
    const t2 = tracer.startTrace("second");
    tracer.endTrace(t2, "ok");

    expect(completed).toEqual(["first", "second"]);
  });

  it("unsubscribes listeners", () => {
    const completed: string[] = [];
    const unsub = tracer.onTraceComplete((trace) =>
      completed.push(trace.name)
    );

    const t1 = tracer.startTrace("first");
    tracer.endTrace(t1, "ok");
    unsub();
    const t2 = tracer.startTrace("second");
    tracer.endTrace(t2, "ok");

    expect(completed).toEqual(["first"]);
  });

  it("calculates summary statistics", () => {
    for (let i = 0; i < 3; i++) {
      const t = tracer.startTrace(`ok-${i}`);
      tracer.endTrace(t, "ok");
    }
    const errTrace = tracer.startTrace("err");
    tracer.endTrace(errTrace, "error", "boom");

    const summary = tracer.getSummary();
    expect(summary.totalTraces).toBe(4);
    expect(summary.errorRate).toBe(0.25);
    expect(summary.avgDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns zero summary when empty", () => {
    const summary = tracer.getSummary();
    expect(summary.totalTraces).toBe(0);
    expect(summary.avgDurationMs).toBe(0);
    expect(summary.errorRate).toBe(0);
  });

  it("clears all traces", () => {
    const t = tracer.startTrace("test");
    tracer.endTrace(t, "ok");
    tracer.clear();
    expect(tracer.getRecentTraces()).toHaveLength(0);
  });
});
