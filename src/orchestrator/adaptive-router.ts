import type { ModelProvider, TaskIntent } from "../types/index.js";
import { getProviderChain } from "./router.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProviderScore {
  successRate: number;
  avgLatencyMs: number;
  avgCostUsd: number;
  sampleCount: number;
}

interface PerformanceRecord {
  success: boolean;
  latencyMs: number;
  costUsd: number;
  timestamp: number;
}

export interface AdaptiveRouterOptions {
  windowSize: number;
  minSamples: number;
  weights: {
    successRate: number;
    latency: number;
    cost: number;
  };
  ttlMs: number;
}

const DEFAULTS: AdaptiveRouterOptions = {
  windowSize: 100,
  minSamples: 10,
  weights: {
    successRate: 0.5,
    latency: 0.3,
    cost: 0.2,
  },
  ttlMs: 3_600_000,
};

// ---------------------------------------------------------------------------
// Adaptive Router
// ---------------------------------------------------------------------------

export class AdaptiveRouter {
  private options: AdaptiveRouterOptions;
  private history = new Map<string, PerformanceRecord[]>();

  constructor(options?: Partial<AdaptiveRouterOptions>) {
    this.options = {
      ...DEFAULTS,
      ...options,
      weights: { ...DEFAULTS.weights, ...options?.weights },
    };
  }

  private key(intent: TaskIntent, provider: ModelProvider): string {
    return `${intent}:${provider}`;
  }

  recordOutcome(
    intent: TaskIntent,
    provider: ModelProvider,
    outcome: { success: boolean; latencyMs: number; costUsd: number }
  ): void {
    const k = this.key(intent, provider);
    let records = this.history.get(k);
    if (!records) {
      records = [];
      this.history.set(k, records);
    }

    records.push({
      success: outcome.success,
      latencyMs: outcome.latencyMs,
      costUsd: outcome.costUsd,
      timestamp: Date.now(),
    });

    if (records.length > this.options.windowSize) {
      records.splice(0, records.length - this.options.windowSize);
    }
  }

  getScore(intent: TaskIntent, provider: ModelProvider): ProviderScore | null {
    const k = this.key(intent, provider);
    const records = this.history.get(k);
    if (!records || records.length === 0) return null;

    const now = Date.now();
    const valid = records.filter((r) => now - r.timestamp < this.options.ttlMs);
    if (valid.length === 0) return null;

    const successes = valid.filter((r) => r.success).length;
    const avgLatency =
      valid.reduce((sum, r) => sum + r.latencyMs, 0) / valid.length;
    const avgCost =
      valid.reduce((sum, r) => sum + r.costUsd, 0) / valid.length;

    return {
      successRate: successes / valid.length,
      avgLatencyMs: avgLatency,
      avgCostUsd: avgCost,
      sampleCount: valid.length,
    };
  }

  compositeScore(intent: TaskIntent, provider: ModelProvider): number | null {
    const score = this.getScore(intent, provider);
    if (!score || score.sampleCount < this.options.minSamples) return null;

    const w = this.options.weights;
    const successComponent = score.successRate * w.successRate;
    const latencyNorm = Math.max(0, 1 - score.avgLatencyMs / 30_000);
    const latencyComponent = latencyNorm * w.latency;
    const costNorm = Math.max(0, 1 - score.avgCostUsd / 0.1);
    const costComponent = costNorm * w.cost;

    return successComponent + latencyComponent + costComponent;
  }

  getOptimizedChain(
    intent: TaskIntent,
    preferredProvider?: ModelProvider
  ): ModelProvider[] {
    const staticChain = getProviderChain(intent, preferredProvider);

    const scored = staticChain.map((provider) => ({
      provider,
      score: this.compositeScore(intent, provider),
    }));

    const allScored = scored.every((s) => s.score !== null);
    if (!allScored) return staticChain;

    return scored
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .map((s) => s.provider);
  }

  getSnapshot(): Map<string, ProviderScore> {
    const snap = new Map<string, ProviderScore>();
    for (const [key] of this.history) {
      const [intent, provider] = key.split(":") as [TaskIntent, ModelProvider];
      const score = this.getScore(intent, provider);
      if (score) snap.set(key, score);
    }
    return snap;
  }

  reset(): void {
    this.history.clear();
  }
}
