import type { ModelProvider, TaskIntent } from "../types/index.js";
import { resolveRoute, type RouteConfig } from "./router.js";
import { ProviderHealthMonitor } from "./health.js";

export interface ProviderScore {
  provider: ModelProvider;
  score: number;
  reasons: string[];
}

export interface AdaptiveRouteConfig extends RouteConfig {
  scores: ProviderScore[];
  adaptiveOverride: boolean;
}

export interface AdaptiveRouterOptions {
  healthWeight: number;
  latencyWeight: number;
  affinityWeight: number;
  costWeight: number;
}

const DEFAULT_WEIGHTS: AdaptiveRouterOptions = {
  healthWeight: 0.4,
  latencyWeight: 0.2,
  affinityWeight: 0.3,
  costWeight: 0.1,
};

const INTENT_AFFINITY: Record<TaskIntent, Partial<Record<ModelProvider, number>>> = {
  reasoning: { claude: 1.0, grok: 0.6, perplexity: 0.3 },
  fast_analysis: { grok: 1.0, claude: 0.5, perplexity: 0.3 },
  research: { perplexity: 1.0, grok: 0.4, claude: 0.5 },
  sentiment: { grok: 0.9, claude: 0.8, perplexity: 0.5 },
  signal: { claude: 1.0, grok: 0.7, perplexity: 0.2 },
  risk: { claude: 1.0, grok: 0.6, perplexity: 0.2 },
  general: { claude: 0.8, grok: 0.7, perplexity: 0.5 },
};

const RELATIVE_COST: Record<ModelProvider, number> = {
  claude: 1.0,
  grok: 0.6,
  perplexity: 0.8,
};

const MAX_ACCEPTABLE_LATENCY_MS = 15_000;

export class AdaptiveRouter {
  private healthMonitor: ProviderHealthMonitor;
  private weights: AdaptiveRouterOptions;

  constructor(
    healthMonitor: ProviderHealthMonitor,
    weights?: Partial<AdaptiveRouterOptions>
  ) {
    this.healthMonitor = healthMonitor;
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
  }

  resolve(
    intent: TaskIntent,
    preferredProvider?: ModelProvider
  ): AdaptiveRouteConfig {
    const staticRoute = resolveRoute(intent, preferredProvider);
    const allProviders: ModelProvider[] = [
      staticRoute.primary,
      ...staticRoute.fallbacks,
    ];

    const scores = allProviders.map((provider) =>
      this.scoreProvider(provider, intent)
    );

    const availableScores = scores.filter((s) =>
      this.healthMonitor.isAvailable(s.provider)
    );

    if (availableScores.length === 0) {
      return { ...staticRoute, scores, adaptiveOverride: false };
    }

    if (preferredProvider && availableScores.some((s) => s.provider === preferredProvider)) {
      const rest = availableScores
        .filter((s) => s.provider !== preferredProvider)
        .sort((a, b) => b.score - a.score)
        .map((s) => s.provider);
      return {
        primary: preferredProvider,
        fallbacks: rest,
        scores,
        adaptiveOverride: false,
      };
    }

    availableScores.sort((a, b) => b.score - a.score);

    const ranked = availableScores.map((s) => s.provider);
    const adaptiveOverride = ranked[0] !== staticRoute.primary;

    return {
      primary: ranked[0],
      fallbacks: ranked.slice(1),
      scores,
      adaptiveOverride,
    };
  }

  getProviderChain(
    intent: TaskIntent,
    preferredProvider?: ModelProvider
  ): ModelProvider[] {
    if (preferredProvider) {
      const route = this.resolve(intent, preferredProvider);
      return [route.primary, ...route.fallbacks];
    }

    const route = this.resolve(intent);
    return [route.primary, ...route.fallbacks];
  }

  scoreProvider(provider: ModelProvider, intent: TaskIntent): ProviderScore {
    const snapshot = this.healthMonitor.getSnapshot(provider);
    const reasons: string[] = [];

    const healthScore = snapshot.successRate;
    reasons.push(`health=${healthScore.toFixed(2)}`);

    let latencyScore = 1.0;
    if (snapshot.avgLatencyMs > 0) {
      latencyScore = Math.max(
        0,
        1 - snapshot.avgLatencyMs / MAX_ACCEPTABLE_LATENCY_MS
      );
    }
    reasons.push(`latency=${latencyScore.toFixed(2)}`);

    const affinity = INTENT_AFFINITY[intent][provider] ?? 0.5;
    reasons.push(`affinity=${affinity.toFixed(2)}`);

    const costScore = 1 - RELATIVE_COST[provider];
    reasons.push(`cost=${costScore.toFixed(2)}`);

    const total =
      healthScore * this.weights.healthWeight +
      latencyScore * this.weights.latencyWeight +
      affinity * this.weights.affinityWeight +
      costScore * this.weights.costWeight;

    return { provider, score: total, reasons };
  }

  get monitor(): ProviderHealthMonitor {
    return this.healthMonitor;
  }
}
