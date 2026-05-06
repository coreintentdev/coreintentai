import { describe, it, expect, vi, beforeEach } from "vitest";
import { AIEventBus } from "../src/telemetry/event-bus.js";
import { MetricsCollector } from "../src/telemetry/metrics.js";
import { CostTracker } from "../src/telemetry/cost-tracker.js";
import { Telemetry } from "../src/telemetry/index.js";
import type { AIEvent } from "../src/telemetry/event-bus.js";

// ---------------------------------------------------------------------------
// AIEventBus
// ---------------------------------------------------------------------------

describe("AIEventBus", () => {
  let bus: AIEventBus;

  beforeEach(() => {
    bus = new AIEventBus();
  });

  it("emits events to typed listeners", () => {
    const handler = vi.fn();
    bus.on("request.complete", handler);

    const event: AIEvent = {
      type: "request.complete",
      timestamp: new Date().toISOString(),
      provider: "claude",
      model: "claude-sonnet-4-20250514",
      latencyMs: 450,
      tokens: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      fallbackUsed: false,
      cached: false,
    };

    bus.emit(event);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it("wildcard listeners receive all events", () => {
    const handler = vi.fn();
    bus.on("*", handler);

    bus.emit({
      type: "request.start",
      timestamp: new Date().toISOString(),
      intent: "sentiment",
      providers: ["grok", "claude"],
      jsonMode: false,
    });

    bus.emit({
      type: "request.complete",
      timestamp: new Date().toISOString(),
      provider: "grok",
      model: "grok-3",
      latencyMs: 200,
      tokens: { inputTokens: 50, outputTokens: 30, totalTokens: 80 },
      fallbackUsed: false,
      cached: false,
    });

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("unsubscribe stops delivery", () => {
    const handler = vi.fn();
    const unsub = bus.on("request.error", handler);

    bus.emit({
      type: "request.error",
      timestamp: new Date().toISOString(),
      provider: "perplexity",
      error: "timeout",
      retryable: true,
      attemptNumber: 1,
    });

    expect(handler).toHaveBeenCalledTimes(1);

    unsub();

    bus.emit({
      type: "request.error",
      timestamp: new Date().toISOString(),
      provider: "perplexity",
      error: "timeout",
      retryable: true,
      attemptNumber: 2,
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("maintains event history", () => {
    bus.emit({
      type: "request.start",
      timestamp: new Date().toISOString(),
      intent: "reasoning",
      providers: ["claude"],
      jsonMode: false,
    });

    bus.emit({
      type: "cost.incurred",
      timestamp: new Date().toISOString(),
      provider: "claude",
      model: "claude-sonnet-4-20250514",
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: 0.0105,
    });

    expect(bus.getHistory()).toHaveLength(2);
    expect(bus.getHistory("request.start")).toHaveLength(1);
    expect(bus.getHistory("cost.incurred")).toHaveLength(1);
  });

  it("caps history at maxHistory", () => {
    const smallBus = new AIEventBus({ maxHistory: 3 });

    for (let i = 0; i < 5; i++) {
      smallBus.emit({
        type: "request.start",
        timestamp: new Date().toISOString(),
        intent: "general",
        providers: ["claude"],
        jsonMode: false,
      });
    }

    expect(smallBus.getHistory()).toHaveLength(3);
  });

  it("clear empties history", () => {
    bus.emit({
      type: "request.start",
      timestamp: new Date().toISOString(),
      intent: "signal",
      providers: ["claude"],
      jsonMode: true,
    });

    bus.clear();
    expect(bus.getHistory()).toHaveLength(0);
  });

  it("reports listener counts", () => {
    bus.on("request.start", () => {});
    bus.on("request.start", () => {});
    bus.on("*", () => {});

    expect(bus.listenerCount("request.start")).toBe(2);
    expect(bus.listenerCount("*")).toBe(1);
    expect(bus.listenerCount("request.error")).toBe(0);
    expect(bus.listenerCount()).toBe(3);
  });

  it("removeAllListeners clears specific type", () => {
    bus.on("request.start", () => {});
    bus.on("request.complete", () => {});

    bus.removeAllListeners("request.start");
    expect(bus.listenerCount("request.start")).toBe(0);
    expect(bus.listenerCount("request.complete")).toBe(1);
  });

  it("removeAllListeners with no arg clears all", () => {
    bus.on("request.start", () => {});
    bus.on("request.complete", () => {});
    bus.on("*", () => {});

    bus.removeAllListeners();
    expect(bus.listenerCount()).toBe(0);
  });

  it("handles circuit state change events", () => {
    const handler = vi.fn();
    bus.on("circuit.state_change", handler);

    bus.emit({
      type: "circuit.state_change",
      timestamp: new Date().toISOString(),
      provider: "grok",
      from: "closed",
      to: "open",
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].from).toBe("closed");
    expect(handler.mock.calls[0][0].to).toBe("open");
  });

  it("handles fallback events", () => {
    const handler = vi.fn();
    bus.on("fallback.triggered", handler);

    bus.emit({
      type: "fallback.triggered",
      timestamp: new Date().toISOString(),
      fromProvider: "grok",
      toProvider: "claude",
      reason: "rate limit",
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        fromProvider: "grok",
        toProvider: "claude",
      })
    );
  });

  it("handles capability events", () => {
    const handler = vi.fn();
    bus.on("capability.execute", handler);

    bus.emit({
      type: "capability.execute",
      timestamp: new Date().toISOString(),
      capability: "SentimentAnalyzer",
      method: "analyze",
      ticker: "AAPL",
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: "SentimentAnalyzer",
        ticker: "AAPL",
      })
    );
  });

  it("handles agent step events", () => {
    const handler = vi.fn();
    bus.on("agent.step", handler);

    bus.emit({
      type: "agent.step",
      timestamp: new Date().toISOString(),
      agent: "MarketAnalyst",
      step: 2,
      intent: "research",
      latencyMs: 3200,
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "MarketAnalyst",
        step: 2,
      })
    );
  });
});

// ---------------------------------------------------------------------------
// MetricsCollector
// ---------------------------------------------------------------------------

describe("MetricsCollector", () => {
  let metrics: MetricsCollector;

  beforeEach(() => {
    metrics = new MetricsCollector();
  });

  it("records and retrieves latencies", () => {
    metrics.recordLatency("claude", 100);
    metrics.recordLatency("claude", 200);
    metrics.recordLatency("claude", 300);

    const stats = metrics.getLatencyStats("claude");
    expect(stats).not.toBeNull();
    expect(stats!.count).toBe(3);
    expect(stats!.min).toBe(100);
    expect(stats!.max).toBe(300);
    expect(stats!.mean).toBe(200);
  });

  it("computes percentiles correctly", () => {
    for (let i = 1; i <= 100; i++) {
      metrics.recordLatency("test", i);
    }

    expect(metrics.getPercentile("test", 50)).toBe(50);
    expect(metrics.getPercentile("test", 95)).toBe(95);
    expect(metrics.getPercentile("test", 99)).toBe(99);
  });

  it("returns null for unknown keys", () => {
    expect(metrics.getPercentile("unknown", 50)).toBeNull();
    expect(metrics.getLatencyStats("unknown")).toBeNull();
  });

  it("caps latency window at windowSize", () => {
    const small = new MetricsCollector({ windowSize: 5 });
    for (let i = 0; i < 10; i++) {
      small.recordLatency("test", i * 100);
    }

    const stats = small.getLatencyStats("test");
    expect(stats!.count).toBe(5);
    expect(stats!.min).toBe(500);
  });

  it("tracks token usage by provider", () => {
    metrics.recordTokens("claude", 1000, 500);
    metrics.recordTokens("claude", 2000, 800);
    metrics.recordTokens("grok", 500, 200);

    const snapshot = metrics.getSnapshot();
    expect(snapshot.providers["claude"].totalInputTokens).toBe(3000);
    expect(snapshot.providers["claude"].totalOutputTokens).toBe(1300);
    expect(snapshot.providers["grok"].totalInputTokens).toBe(500);
  });

  it("tracks request success/failure rates", () => {
    metrics.recordRequest("claude", true);
    metrics.recordRequest("claude", true);
    metrics.recordRequest("claude", false);

    expect(metrics.getReliability("claude")).toBeCloseTo(0.667, 2);
  });

  it("defaults reliability to 1 for unknown provider", () => {
    expect(metrics.getReliability("unknown")).toBe(1);
  });

  it("provides complete provider stats", () => {
    metrics.recordLatency("grok", 80);
    metrics.recordLatency("grok", 120);
    metrics.recordTokens("grok", 500, 200);
    metrics.recordRequest("grok", true);
    metrics.recordRequest("grok", true);
    metrics.recordRequest("grok", false);

    const stats = metrics.getProviderStats("grok");
    expect(stats.totalRequests).toBe(3);
    expect(stats.successCount).toBe(2);
    expect(stats.failureCount).toBe(1);
    expect(stats.reliability).toBeCloseTo(0.667, 2);
    expect(stats.latency).not.toBeNull();
    expect(stats.latency!.mean).toBe(100);
    expect(stats.totalInputTokens).toBe(500);
  });

  it("produces overall snapshot", () => {
    metrics.recordRequest("claude", true);
    metrics.recordRequest("grok", true);
    metrics.recordRequest("grok", false);

    const snapshot = metrics.getSnapshot();
    expect(snapshot.totalRequests).toBe(3);
    expect(snapshot.totalFailures).toBe(1);
    expect(snapshot.overallReliability).toBeCloseTo(0.667, 2);
    expect(snapshot.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it("reset clears all state", () => {
    metrics.recordLatency("claude", 100);
    metrics.recordTokens("claude", 1000, 500);
    metrics.recordRequest("claude", true);

    metrics.reset();

    expect(metrics.getLatencyStats("claude")).toBeNull();
    expect(metrics.getReliability("claude")).toBe(1);
    expect(metrics.getSnapshot().totalRequests).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// CostTracker
// ---------------------------------------------------------------------------

describe("CostTracker", () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  it("calculates cost for known models", () => {
    const cost = tracker.calculateCost(
      "claude-sonnet-4-20250514",
      1_000_000,
      500_000
    );
    // $3/M input + $15/M * 0.5 = $3 + $7.5 = $10.5
    expect(cost).toBeCloseTo(10.5, 2);
  });

  it("estimates cost for unknown models", () => {
    const cost = tracker.calculateCost("unknown-model", 1_000_000, 1_000_000);
    // Default: $3/M input + $15/M output = $18
    expect(cost).toBeCloseTo(18, 2);
  });

  it("records entries and tracks total", () => {
    tracker.record({
      model: "grok-3",
      provider: "grok",
      inputTokens: 1000,
      outputTokens: 500,
    });

    tracker.record({
      model: "claude-sonnet-4-20250514",
      provider: "claude",
      inputTokens: 2000,
      outputTokens: 1000,
    });

    const total = tracker.getTotalCost();
    expect(total).toBeGreaterThan(0);
  });

  it("breaks down cost by provider", () => {
    tracker.record({
      model: "grok-3",
      provider: "grok",
      inputTokens: 1_000_000,
      outputTokens: 0,
    });

    tracker.record({
      model: "claude-sonnet-4-20250514",
      provider: "claude",
      inputTokens: 1_000_000,
      outputTokens: 0,
    });

    const byProvider = tracker.getCostByProvider();
    expect(byProvider["grok"]).toBeCloseTo(3, 2);
    expect(byProvider["claude"]).toBeCloseTo(3, 2);
  });

  it("breaks down cost by model", () => {
    tracker.record({
      model: "grok-3",
      provider: "grok",
      inputTokens: 1_000_000,
      outputTokens: 0,
    });

    const byModel = tracker.getCostByModel();
    expect(byModel["grok-3"]).toBeCloseTo(3, 2);
  });

  it("breaks down cost by capability", () => {
    tracker.record({
      model: "grok-3",
      provider: "grok",
      inputTokens: 1_000_000,
      outputTokens: 0,
      capability: "sentiment",
    });

    tracker.record({
      model: "claude-sonnet-4-20250514",
      provider: "claude",
      inputTokens: 1_000_000,
      outputTokens: 0,
      capability: "signals",
    });

    const byCap = tracker.getCostByCapability();
    expect(byCap["sentiment"]).toBeCloseTo(3, 2);
    expect(byCap["signals"]).toBeCloseTo(3, 2);
  });

  it("uses 'uncategorized' for entries without capability", () => {
    tracker.record({
      model: "grok-3",
      provider: "grok",
      inputTokens: 1000,
      outputTokens: 0,
    });

    const byCap = tracker.getCostByCapability();
    expect(byCap["uncategorized"]).toBeDefined();
  });

  it("tracks budget", () => {
    const budgeted = new CostTracker({ budgetUsd: 10 });

    budgeted.record({
      model: "claude-sonnet-4-20250514",
      provider: "claude",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });

    expect(budgeted.isOverBudget()).toBe(true);
    expect(budgeted.getRemainingBudget()).toBe(0);
  });

  it("returns null remaining budget when no budget set", () => {
    expect(tracker.getRemainingBudget()).toBeNull();
    expect(tracker.isOverBudget()).toBe(false);
  });

  it("returns remaining budget when under", () => {
    const budgeted = new CostTracker({ budgetUsd: 100 });
    budgeted.record({
      model: "grok-3",
      provider: "grok",
      inputTokens: 1000,
      outputTokens: 500,
    });

    expect(budgeted.isOverBudget()).toBe(false);
    const remaining = budgeted.getRemainingBudget()!;
    expect(remaining).toBeLessThan(100);
    expect(remaining).toBeGreaterThan(99);
  });

  it("supports custom pricing", () => {
    const custom = new CostTracker({
      pricing: {
        "my-model": { inputPer1MTokens: 10, outputPer1MTokens: 30 },
      },
    });

    const cost = custom.calculateCost("my-model", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(40, 2);
  });

  it("produces snapshot", () => {
    tracker.record({
      model: "grok-3",
      provider: "grok",
      inputTokens: 5000,
      outputTokens: 2000,
      capability: "sentiment",
    });

    const snap = tracker.getSnapshot();
    expect(snap.totalCostUsd).toBeGreaterThan(0);
    expect(snap.totalInputTokens).toBe(5000);
    expect(snap.totalOutputTokens).toBe(2000);
    expect(snap.entries).toBe(1);
    expect(snap.byProvider["grok"]).toBeDefined();
    expect(snap.byCapability["sentiment"]).toBeDefined();
  });

  it("reset clears all entries", () => {
    tracker.record({
      model: "grok-3",
      provider: "grok",
      inputTokens: 1000,
      outputTokens: 500,
    });

    tracker.reset();
    expect(tracker.getTotalCost()).toBe(0);
    expect(tracker.getSnapshot().entries).toBe(0);
  });

  it("handles opus pricing", () => {
    const cost = tracker.calculateCost(
      "claude-opus-4-20250514",
      1_000_000,
      1_000_000
    );
    // $15/M input + $75/M output = $90
    expect(cost).toBeCloseTo(90, 2);
  });

  it("handles haiku pricing", () => {
    const cost = tracker.calculateCost(
      "claude-haiku-4-20250514",
      1_000_000,
      1_000_000
    );
    // $0.8/M input + $4/M output = $4.8
    expect(cost).toBeCloseTo(4.8, 2);
  });

  it("applies cache-aware pricing for Claude", () => {
    // 1M total input: 800K from cache read, 100K cache creation, 100K standard
    const cost = tracker.calculateCost(
      "claude-sonnet-4-20250514",
      1_000_000, // total inputTokens (includes cache)
      500_000,   // output
      800_000,   // cacheReadTokens (90% discount)
      100_000    // cacheCreationTokens (25% premium)
    );
    // Standard input: (1M - 800K - 100K) = 100K @ $3/M = $0.30
    // Cache read: 800K @ $3/M * 0.1 = $0.24
    // Cache creation: 100K @ $3/M * 1.25 = $0.375
    // Output: 500K @ $15/M = $7.50
    // Total = $0.30 + $0.24 + $0.375 + $7.50 = $8.415
    expect(cost).toBeCloseTo(8.415, 2);
  });

  it("cache-aware cost is less than non-cached cost", () => {
    const cachedCost = tracker.calculateCost(
      "claude-sonnet-4-20250514",
      1_000_000,
      500_000,
      900_000, // 90% served from cache
      0
    );
    const nonCachedCost = tracker.calculateCost(
      "claude-sonnet-4-20250514",
      1_000_000,
      500_000
    );
    expect(cachedCost).toBeLessThan(nonCachedCost);
  });

  it("records cache tokens in cost entries", () => {
    const entry = tracker.record({
      model: "claude-sonnet-4-20250514",
      provider: "claude",
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      cacheReadTokens: 800_000,
      cacheCreationTokens: 0,
    });

    expect(entry.cacheReadTokens).toBe(800_000);
    expect(entry.costUsd).toBeLessThan(
      tracker.calculateCost("claude-sonnet-4-20250514", 1_000_000, 500_000)
    );
  });
});

// ---------------------------------------------------------------------------
// Telemetry (integrated)
// ---------------------------------------------------------------------------

describe("Telemetry", () => {
  let telemetry: Telemetry;

  beforeEach(() => {
    telemetry = new Telemetry();
  });

  it("creates with default options", () => {
    expect(telemetry.events).toBeInstanceOf(AIEventBus);
    expect(telemetry.metrics).toBeInstanceOf(MetricsCollector);
    expect(telemetry.costs).toBeInstanceOf(CostTracker);
  });

  it("auto-wires request.complete to metrics", () => {
    telemetry.events.emit({
      type: "request.complete",
      timestamp: new Date().toISOString(),
      provider: "claude",
      model: "claude-sonnet-4-20250514",
      latencyMs: 500,
      tokens: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
      fallbackUsed: false,
      cached: false,
    });

    const stats = telemetry.metrics.getProviderStats("claude");
    expect(stats.totalRequests).toBe(1);
    expect(stats.successCount).toBe(1);
    expect(stats.totalInputTokens).toBe(1000);
    expect(stats.latency!.mean).toBe(500);
  });

  it("auto-wires request.error to metrics", () => {
    telemetry.events.emit({
      type: "request.error",
      timestamp: new Date().toISOString(),
      provider: "grok",
      error: "rate limit",
      retryable: true,
      attemptNumber: 1,
    });

    expect(telemetry.metrics.getReliability("grok")).toBe(0);
  });

  it("provides unified snapshot", () => {
    telemetry.events.emit({
      type: "request.complete",
      timestamp: new Date().toISOString(),
      provider: "claude",
      model: "claude-sonnet-4-20250514",
      latencyMs: 400,
      tokens: { inputTokens: 500, outputTokens: 200, totalTokens: 700 },
      fallbackUsed: false,
      cached: false,
    });

    const snap = telemetry.getSnapshot();
    expect(snap.metrics.totalRequests).toBe(1);
    expect(snap.eventCount).toBe(1);
  });

  it("accepts budget option", () => {
    const t = new Telemetry({ budgetUsd: 50 });
    expect(t.costs.getRemainingBudget()).toBe(50);
  });

  it("reset clears everything", () => {
    telemetry.events.emit({
      type: "request.start",
      timestamp: new Date().toISOString(),
      intent: "sentiment",
      providers: ["grok"],
      jsonMode: false,
    });

    telemetry.reset();
    expect(telemetry.events.getHistory()).toHaveLength(0);
    expect(telemetry.metrics.getSnapshot().totalRequests).toBe(0);
    expect(telemetry.costs.getTotalCost()).toBe(0);
  });
});
