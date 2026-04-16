/**
 * CoreIntent AI — Telemetry & Observability
 *
 * Tracks cost, latency, token usage, and provider health across all AI
 * operations. Essential for:
 * - Budget control (know exactly what you're spending per provider)
 * - Performance monitoring (which providers are slow/fast)
 * - Reliability tracking (error rates, fallback frequency)
 * - Capacity planning (token usage trends)
 *
 * All data is in-memory. For persistent monitoring, attach listeners
 * and forward events to your observability stack.
 */

import type { ModelProvider, TokenUsage, OrchestrationResponse } from "../types/index.js";

// ---------------------------------------------------------------------------
// Cost Tracking
// ---------------------------------------------------------------------------

/** Per-1K-token pricing (approximate, as of early 2025) */
const DEFAULT_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-20250514": { input: 0.003, output: 0.015 },
  "claude-opus-4-20250514": { input: 0.015, output: 0.075 },
  "claude-haiku-4-5-20251001": { input: 0.0008, output: 0.004 },
  "grok-3": { input: 0.003, output: 0.015 },
  "grok-3-fast": { input: 0.005, output: 0.025 },
  "sonar-pro": { input: 0.003, output: 0.015 },
  "sonar": { input: 0.001, output: 0.001 },
};

export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: "USD";
}

export function estimateCost(
  model: string,
  tokenUsage: TokenUsage,
  customPricing?: Record<string, { input: number; output: number }>
): CostEstimate {
  const pricing = { ...DEFAULT_PRICING, ...customPricing };
  const modelPricing = pricing[model] ?? { input: 0.003, output: 0.015 };

  const inputCost = (tokenUsage.inputTokens / 1000) * modelPricing.input;
  const outputCost = (tokenUsage.outputTokens / 1000) * modelPricing.output;

  return {
    inputCost: round6(inputCost),
    outputCost: round6(outputCost),
    totalCost: round6(inputCost + outputCost),
    currency: "USD",
  };
}

// ---------------------------------------------------------------------------
// Telemetry Collector
// ---------------------------------------------------------------------------

export interface TelemetryEvent {
  timestamp: string;
  provider: ModelProvider;
  model: string;
  intent: string;
  latencyMs: number;
  tokenUsage: TokenUsage;
  cost: CostEstimate;
  fallbackUsed: boolean;
  cached: boolean;
  success: boolean;
  errorCategory?: string;
}

export interface ProviderMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cachedRequests: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  totalTokens: TokenUsage;
  totalCost: CostEstimate;
  errorRate: number;
  fallbackRate: number;
}

export interface TelemetrySummary {
  byProvider: Record<string, ProviderMetrics>;
  overall: {
    totalRequests: number;
    totalCost: number;
    avgLatencyMs: number;
    cacheHitRate: number;
    errorRate: number;
  };
  windowStartMs: number;
  windowEndMs: number;
}

export class TelemetryCollector {
  private events: TelemetryEvent[] = [];
  private maxEvents: number;
  private listeners: Array<(event: TelemetryEvent) => void> = [];

  constructor(maxEvents: number = 10_000) {
    this.maxEvents = maxEvents;
  }

  /**
   * Record a completed orchestration response.
   */
  record(params: {
    response: OrchestrationResponse;
    intent: string;
    cached?: boolean;
    success?: boolean;
    errorCategory?: string;
  }): void {
    const { response, intent, cached = false, success = true, errorCategory } = params;

    const event: TelemetryEvent = {
      timestamp: new Date().toISOString(),
      provider: response.provider,
      model: response.model,
      intent,
      latencyMs: response.latencyMs,
      tokenUsage: response.tokenUsage,
      cost: estimateCost(response.model, response.tokenUsage),
      fallbackUsed: response.fallbackUsed,
      cached,
      success,
      errorCategory,
    };

    this.events.push(event);

    // Evict oldest events if over capacity
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Notify listeners
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /**
   * Record an error (no response available).
   */
  recordError(params: {
    provider: ModelProvider;
    model: string;
    intent: string;
    latencyMs: number;
    errorCategory: string;
  }): void {
    const event: TelemetryEvent = {
      timestamp: new Date().toISOString(),
      provider: params.provider,
      model: params.model,
      intent: params.intent,
      latencyMs: params.latencyMs,
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      cost: { inputCost: 0, outputCost: 0, totalCost: 0, currency: "USD" },
      fallbackUsed: false,
      cached: false,
      success: false,
      errorCategory: params.errorCategory,
    };

    this.events.push(event);

    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /**
   * Get aggregate metrics for a time window.
   */
  getSummary(windowMs?: number): TelemetrySummary {
    const now = Date.now();
    const cutoff = windowMs ? now - windowMs : 0;

    const filtered = this.events.filter(
      (e) => new Date(e.timestamp).getTime() >= cutoff
    );

    const byProvider: Record<string, ProviderMetrics> = {};
    let totalCost = 0;
    let totalLatency = 0;
    let cachedCount = 0;
    let errorCount = 0;
    let fallbackCount = 0;
    const providerFallbackCounts: Record<string, number> = {};

    for (const event of filtered) {
      const key = event.provider;
      if (!byProvider[key]) {
        byProvider[key] = {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          cachedRequests: 0,
          totalLatencyMs: 0,
          avgLatencyMs: 0,
          p95LatencyMs: 0,
          totalTokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          totalCost: { inputCost: 0, outputCost: 0, totalCost: 0, currency: "USD" },
          errorRate: 0,
          fallbackRate: 0,
        };
      }

      const m = byProvider[key];
      m.totalRequests++;
      m.totalLatencyMs += event.latencyMs;
      m.totalTokens.inputTokens += event.tokenUsage.inputTokens;
      m.totalTokens.outputTokens += event.tokenUsage.outputTokens;
      m.totalTokens.totalTokens += event.tokenUsage.totalTokens;
      m.totalCost.inputCost += event.cost.inputCost;
      m.totalCost.outputCost += event.cost.outputCost;
      m.totalCost.totalCost += event.cost.totalCost;

      if (event.success) m.successfulRequests++;
      else m.failedRequests++;
      if (event.cached) m.cachedRequests++;
      if (event.fallbackUsed) {
        fallbackCount++;
        providerFallbackCounts[key] = (providerFallbackCounts[key] ?? 0) + 1;
      }

      totalCost += event.cost.totalCost;
      totalLatency += event.latencyMs;
      if (event.cached) cachedCount++;
      if (!event.success) errorCount++;
    }

    // Calculate derived metrics per provider
    for (const key of Object.keys(byProvider)) {
      const m = byProvider[key];
      m.avgLatencyMs = m.totalRequests > 0 ? Math.round(m.totalLatencyMs / m.totalRequests) : 0;
      m.errorRate = m.totalRequests > 0 ? m.failedRequests / m.totalRequests : 0;
      m.fallbackRate = m.totalRequests > 0 ? (providerFallbackCounts[key] ?? 0) / m.totalRequests : 0;

      // P95 latency
      const providerLatencies = filtered
        .filter((e) => e.provider === key)
        .map((e) => e.latencyMs)
        .sort((a, b) => a - b);
      const p95Index = Math.floor(providerLatencies.length * 0.95);
      m.p95LatencyMs = providerLatencies[p95Index] ?? 0;

      // Round costs
      m.totalCost.inputCost = round6(m.totalCost.inputCost);
      m.totalCost.outputCost = round6(m.totalCost.outputCost);
      m.totalCost.totalCost = round6(m.totalCost.totalCost);
    }

    return {
      byProvider,
      overall: {
        totalRequests: filtered.length,
        totalCost: round6(totalCost),
        avgLatencyMs: filtered.length > 0 ? Math.round(totalLatency / filtered.length) : 0,
        cacheHitRate: filtered.length > 0 ? cachedCount / filtered.length : 0,
        errorRate: filtered.length > 0 ? errorCount / filtered.length : 0,
      },
      windowStartMs: cutoff,
      windowEndMs: now,
    };
  }

  /**
   * Subscribe to telemetry events in real-time.
   */
  onEvent(listener: (event: TelemetryEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Get raw events (for export/debugging).
   */
  getEvents(limit?: number): TelemetryEvent[] {
    return limit ? this.events.slice(-limit) : [...this.events];
  }

  /**
   * Clear all recorded events.
   */
  clear(): void {
    this.events = [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
