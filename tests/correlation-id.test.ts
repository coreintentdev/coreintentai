import { describe, it, expect, vi, beforeEach } from "vitest";
import { Orchestrator } from "../src/orchestrator/index.js";
import { Telemetry } from "../src/orchestrator/telemetry.js";

vi.mock("../src/models/index.js", () => ({
  getAdapter: () => ({
    complete: vi.fn().mockResolvedValue({
      content: "test response",
      provider: "claude",
      model: "claude-sonnet-4-6",
      tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      latencyMs: 100,
      finishReason: "end_turn",
    }),
  }),
}));

describe("Correlation ID Tracing", () => {
  let orchestrator: Orchestrator;
  let events: Array<{ type: string; metadata?: Record<string, unknown> }>;

  beforeEach(() => {
    events = [];
    orchestrator = new Orchestrator({
      telemetry: true,
      cache: false,
    });
    orchestrator.getTelemetry()?.on((event) => {
      events.push({ type: event.type, metadata: event.metadata });
    });
  });

  it("generates a correlation ID when none is provided", async () => {
    const response = await orchestrator.execute({
      intent: "reasoning",
      prompt: "test",
    });

    expect(response.correlationId).toBeDefined();
    expect(response.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("preserves a caller-provided correlation ID", async () => {
    const response = await orchestrator.execute({
      intent: "reasoning",
      prompt: "test",
      correlationId: "custom-trace-123",
    });

    expect(response.correlationId).toBe("custom-trace-123");
  });

  it("threads correlation ID through all telemetry events", async () => {
    await orchestrator.execute({
      intent: "reasoning",
      prompt: "test",
      correlationId: "trace-abc",
    });

    const eventsWithCorrelation = events.filter(
      (e) => e.metadata?.correlationId === "trace-abc"
    );
    expect(eventsWithCorrelation.length).toBeGreaterThanOrEqual(2);

    const eventTypes = eventsWithCorrelation.map((e) => e.type);
    expect(eventTypes).toContain("request_start");
    expect(eventTypes).toContain("request_complete");
  });

  it("uses unique IDs for different requests", async () => {
    const r1 = await orchestrator.execute({ intent: "reasoning", prompt: "a" });
    const r2 = await orchestrator.execute({ intent: "reasoning", prompt: "b" });

    expect(r1.correlationId).not.toBe(r2.correlationId);
  });
});
