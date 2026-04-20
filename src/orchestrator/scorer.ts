/**
 * CoreIntent AI — Adaptive Model Scorer
 *
 * Tracks model performance across latency, success rate, and output quality,
 * then dynamically adjusts provider routing. The static route table is the
 * baseline — the scorer modifies it in real time based on observed behavior.
 *
 * This is the difference between a dumb router and an intelligent one.
 */

import type { ModelProvider, TaskIntent, TokenUsage } from "../types/index.js";
import type { RouteConfig } from "./router.js";
import { resolveRoute } from "./router.js";

export interface ProviderMetrics {
  provider: ModelProvider;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  avgTokensPerRequest: number;
  lastUsed: number;
  lastFailure: number | null;
  consecutiveFailures: number;
  parseSuccessRate: number;
  intentScores: Partial<Record<TaskIntent, number>>;
}

interface RequestOutcome {
  provider: ModelProvider;
  intent: TaskIntent;
  latencyMs: number;
  success: boolean;
  tokenUsage?: TokenUsage;
  parseSuccess?: boolean;
}

const DEFAULT_WINDOW_SIZE = 100;
const FAILURE_PENALTY_MS = 60_000;
const CONSECUTIVE_FAILURE_THRESHOLD = 3;

export class AdaptiveScorer {
  private metrics: Map<ModelProvider, ProviderMetrics> = new Map();
  private latencyWindows: Map<ModelProvider, number[]> = new Map();
  private windowSize: number;

  constructor(windowSize: number = DEFAULT_WINDOW_SIZE) {
    this.windowSize = windowSize;
    for (const provider of ["claude", "grok", "perplexity"] as ModelProvider[]) {
      this.metrics.set(provider, this.createEmptyMetrics(provider));
      this.latencyWindows.set(provider, []);
    }
  }

  record(outcome: RequestOutcome): void {
    const m = this.metrics.get(outcome.provider);
    if (!m) return;

    m.totalRequests++;
    if (outcome.success) {
      m.successCount++;
      m.consecutiveFailures = 0;
    } else {
      m.failureCount++;
      m.lastFailure = Date.now();
      m.consecutiveFailures++;
    }

    m.lastUsed = Date.now();

    const window = this.latencyWindows.get(outcome.provider)!;
    window.push(outcome.latencyMs);
    if (window.length > this.windowSize) {
      window.shift();
    }
    m.avgLatencyMs = window.reduce((a, b) => a + b, 0) / window.length;
    m.p95LatencyMs = this.percentile(window, 95);

    if (outcome.tokenUsage) {
      const prevTotal = m.avgTokensPerRequest * (m.totalRequests - 1);
      m.avgTokensPerRequest =
        (prevTotal + outcome.tokenUsage.totalTokens) / m.totalRequests;
    }

    if (outcome.parseSuccess !== undefined) {
      const parseTotal =
        m.parseSuccessRate * (m.totalRequests - 1) +
        (outcome.parseSuccess ? 1 : 0);
      m.parseSuccessRate = parseTotal / m.totalRequests;
    }

    const intentScore = this.computeIntentScore(outcome);
    const prevScore = m.intentScores[outcome.intent] ?? 0.5;
    m.intentScores[outcome.intent] =
      prevScore * 0.8 + intentScore * 0.2;
  }

  /**
   * Return a re-ranked route for the given intent, adjusting the static
   * routing table based on observed model performance.
   */
  adaptiveRoute(
    intent: TaskIntent,
    preferredProvider?: ModelProvider
  ): RouteConfig {
    const base = resolveRoute(intent, preferredProvider);
    const allProviders = [base.primary, ...base.fallbacks];

    const scored = allProviders.map((p) => ({
      provider: p,
      score: this.scoreProvider(p, intent),
    }));

    scored.sort((a, b) => b.score - a.score);

    return {
      primary: scored[0].provider,
      fallbacks: scored.slice(1).map((s) => s.provider),
    };
  }

  /**
   * Check if a provider should be temporarily excluded (circuit breaker).
   */
  isCircuitOpen(provider: ModelProvider): boolean {
    const m = this.metrics.get(provider);
    if (!m) return false;

    if (m.consecutiveFailures >= CONSECUTIVE_FAILURE_THRESHOLD) {
      const timeSinceFailure = Date.now() - (m.lastFailure ?? 0);
      return timeSinceFailure < FAILURE_PENALTY_MS;
    }

    return false;
  }

  getMetrics(provider: ModelProvider): ProviderMetrics | undefined {
    const m = this.metrics.get(provider);
    return m ? { ...m } : undefined;
  }

  getAllMetrics(): ProviderMetrics[] {
    return Array.from(this.metrics.values()).map((m) => ({ ...m }));
  }

  /**
   * Get a snapshot of provider health for monitoring/dashboards.
   */
  healthSnapshot(): Array<{
    provider: ModelProvider;
    healthy: boolean;
    successRate: number;
    avgLatencyMs: number;
    circuitOpen: boolean;
  }> {
    return (["claude", "grok", "perplexity"] as ModelProvider[]).map((p) => {
      const m = this.metrics.get(p)!;
      const successRate =
        m.totalRequests > 0 ? m.successCount / m.totalRequests : 1;
      return {
        provider: p,
        healthy: successRate > 0.5 && !this.isCircuitOpen(p),
        successRate,
        avgLatencyMs: Math.round(m.avgLatencyMs),
        circuitOpen: this.isCircuitOpen(p),
      };
    });
  }

  reset(): void {
    for (const provider of ["claude", "grok", "perplexity"] as ModelProvider[]) {
      this.metrics.set(provider, this.createEmptyMetrics(provider));
      this.latencyWindows.set(provider, []);
    }
  }

  private scoreProvider(provider: ModelProvider, intent: TaskIntent): number {
    const m = this.metrics.get(provider);
    if (!m || m.totalRequests === 0) return 0.5;

    if (this.isCircuitOpen(provider)) return 0;

    const successRate = m.successCount / m.totalRequests;
    const latencyScore = Math.max(0, 1 - m.avgLatencyMs / 30_000);
    const parseScore = m.parseSuccessRate;
    const intentScore = m.intentScores[intent] ?? 0.5;
    const recencyBonus =
      Date.now() - m.lastUsed < 300_000 ? 1 : 0;

    return (
      successRate * 0.35 +
      latencyScore * 0.20 +
      parseScore * 0.20 +
      intentScore * 0.20 +
      recencyBonus * 0.05
    );
  }

  private computeIntentScore(outcome: RequestOutcome): number {
    if (!outcome.success) return 0;

    let score = 0.5;

    if (outcome.latencyMs < 5000) score += 0.2;
    else if (outcome.latencyMs < 15000) score += 0.1;

    if (outcome.parseSuccess) score += 0.2;

    if (outcome.tokenUsage && outcome.tokenUsage.totalTokens > 0) {
      score += 0.1;
    }

    return Math.min(1, score);
  }

  private percentile(values: number[], pct: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((pct / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private createEmptyMetrics(provider: ModelProvider): ProviderMetrics {
    return {
      provider,
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      avgTokensPerRequest: 0,
      lastUsed: 0,
      lastFailure: null,
      consecutiveFailures: 0,
      parseSuccessRate: 1,
      intentScores: {},
    };
  }
}
