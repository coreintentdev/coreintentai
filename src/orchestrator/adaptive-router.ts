import type { ModelProvider, TaskIntent } from "../types/index.js";
import type { CircuitBreaker } from "./circuit-breaker.js";

export interface ProviderScore {
  provider: ModelProvider;
  qualityScore: number;
  avgLatencyMs: number;
  successRate: number;
  costWeight: number;
  sampleCount: number;
}

export interface AdaptiveRouterOptions {
  explorationRate: number;
  qualityWeight: number;
  latencyWeight: number;
  costWeight: number;
  minSamples: number;
  decayFactor: number;
  confidenceEscalation: boolean;
  escalationThreshold: number;
}

const DEFAULTS: AdaptiveRouterOptions = {
  explorationRate: 0.1,
  qualityWeight: 0.5,
  latencyWeight: 0.3,
  costWeight: 0.2,
  minSamples: 5,
  decayFactor: 0.95,
  confidenceEscalation: true,
  escalationThreshold: 0.4,
};

const COST_WEIGHTS: Record<ModelProvider, number> = {
  claude: 1.0,
  grok: 0.6,
  perplexity: 0.4,
};

interface ProviderStats {
  totalRequests: number;
  totalSuccesses: number;
  totalFailures: number;
  qualityScores: number[];
  latencies: number[];
  recentQuality: number;
  recentLatency: number;
}

export class AdaptiveRouter {
  private stats = new Map<string, ProviderStats>();
  private options: AdaptiveRouterOptions;

  constructor(options?: Partial<AdaptiveRouterOptions>) {
    this.options = { ...DEFAULTS, ...options };
  }

  private key(intent: TaskIntent, provider: ModelProvider): string {
    return `${intent}:${provider}`;
  }

  private getStats(intent: TaskIntent, provider: ModelProvider): ProviderStats {
    const k = this.key(intent, provider);
    let s = this.stats.get(k);
    if (!s) {
      s = {
        totalRequests: 0,
        totalSuccesses: 0,
        totalFailures: 0,
        qualityScores: [],
        latencies: [],
        recentQuality: 0.5,
        recentLatency: 1000,
      };
      this.stats.set(k, s);
    }
    return s;
  }

  recordOutcome(params: {
    intent: TaskIntent;
    provider: ModelProvider;
    success: boolean;
    latencyMs: number;
    qualityScore?: number;
  }): void {
    const s = this.getStats(params.intent, params.provider);
    s.totalRequests++;

    if (params.success) {
      s.totalSuccesses++;
    } else {
      s.totalFailures++;
    }

    const quality = params.qualityScore ?? (params.success ? 0.7 : 0.0);
    s.qualityScores.push(quality);
    s.latencies.push(params.latencyMs);

    if (s.qualityScores.length > 100) s.qualityScores.shift();
    if (s.latencies.length > 100) s.latencies.shift();

    s.recentQuality =
      s.recentQuality * this.options.decayFactor +
      quality * (1 - this.options.decayFactor);
    s.recentLatency =
      s.recentLatency * this.options.decayFactor +
      params.latencyMs * (1 - this.options.decayFactor);
  }

  scoreProvider(intent: TaskIntent, provider: ModelProvider): ProviderScore {
    const s = this.getStats(intent, provider);
    const successRate =
      s.totalRequests > 0 ? s.totalSuccesses / s.totalRequests : 0.5;
    const avgLatency =
      s.latencies.length > 0
        ? s.latencies.reduce((a, b) => a + b, 0) / s.latencies.length
        : 1000;

    return {
      provider,
      qualityScore: s.recentQuality,
      avgLatencyMs: avgLatency,
      successRate,
      costWeight: COST_WEIGHTS[provider],
      sampleCount: s.totalRequests,
    };
  }

  private compositeScore(score: ProviderScore): number {
    const normalizedLatency = Math.max(0, 1 - score.avgLatencyMs / 30_000);
    const normalizedCost = 1 - score.costWeight;

    return (
      score.qualityScore * this.options.qualityWeight +
      normalizedLatency * this.options.latencyWeight +
      normalizedCost * this.options.costWeight
    ) * score.successRate;
  }

  rankProviders(
    intent: TaskIntent,
    candidates: ModelProvider[],
    circuitBreaker?: CircuitBreaker
  ): ModelProvider[] {
    if (Math.random() < this.options.explorationRate) {
      const shuffled = [...candidates];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }

    const scored = candidates.map((p) => ({
      provider: p,
      score: this.compositeScore(this.scoreProvider(intent, p)),
      sampleCount: this.getStats(intent, p).totalRequests,
    }));

    scored.sort((a, b) => {
      if (a.sampleCount < this.options.minSamples && b.sampleCount >= this.options.minSamples) return -1;
      if (b.sampleCount < this.options.minSamples && a.sampleCount >= this.options.minSamples) return 1;
      if (a.sampleCount < this.options.minSamples && b.sampleCount < this.options.minSamples) return 0;
      return b.score - a.score;
    });

    const ranked = scored.map((s) => s.provider);

    return circuitBreaker ? circuitBreaker.rankProviders(ranked) : ranked;
  }

  shouldEscalate(confidence: number): boolean {
    if (!this.options.confidenceEscalation) return false;
    return confidence < this.options.escalationThreshold;
  }

  getEscalationTarget(
    intent: TaskIntent,
    currentProvider: ModelProvider
  ): ModelProvider | null {
    const deepProviders: ModelProvider[] = ["claude", "grok", "perplexity"];
    const candidates = deepProviders.filter((p) => p !== currentProvider);

    if (candidates.length === 0) return null;

    const scored = candidates.map((p) => ({
      provider: p,
      score: this.scoreProvider(intent, p).qualityScore,
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored[0].provider;
  }

  getInsights(): Map<string, ProviderScore[]> {
    const insights = new Map<string, ProviderScore[]>();
    const intents: TaskIntent[] = [
      "reasoning", "fast_analysis", "research", "sentiment",
      "signal", "risk", "general",
    ];
    const providers: ModelProvider[] = ["claude", "grok", "perplexity"];

    for (const intent of intents) {
      const scores: ProviderScore[] = [];
      for (const provider of providers) {
        const s = this.getStats(intent, provider);
        if (s.totalRequests > 0) {
          scores.push(this.scoreProvider(intent, provider));
        }
      }
      if (scores.length > 0) {
        insights.set(intent, scores);
      }
    }

    return insights;
  }

  reset(): void {
    this.stats.clear();
  }
}
