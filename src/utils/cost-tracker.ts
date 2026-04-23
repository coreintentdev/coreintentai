/**
 * CoreIntent AI — Cost Tracker
 *
 * Estimates token costs per provider and tracks cumulative session spend.
 * Prices are configurable and default to approximate public API rates.
 */

import type {
  ModelProvider,
  TokenUsage,
  CostEstimate,
  SessionCostSummary,
  TaskIntent,
} from "../types/index.js";

export interface ProviderPricing {
  inputPer1MTokens: number;
  outputPer1MTokens: number;
}

const DEFAULT_PRICING: Record<ModelProvider, ProviderPricing> = {
  claude: { inputPer1MTokens: 3.0, outputPer1MTokens: 15.0 },
  grok: { inputPer1MTokens: 2.0, outputPer1MTokens: 10.0 },
  perplexity: { inputPer1MTokens: 3.0, outputPer1MTokens: 15.0 },
};

export class CostTracker {
  private pricing: Record<ModelProvider, ProviderPricing>;
  private entries: Array<{
    provider: ModelProvider;
    model: string;
    intent: TaskIntent;
    cost: CostEstimate;
    timestamp: string;
  }> = [];

  constructor(pricing?: Partial<Record<ModelProvider, ProviderPricing>>) {
    this.pricing = {
      ...DEFAULT_PRICING,
      ...pricing,
    };
  }

  estimate(
    provider: ModelProvider,
    model: string,
    tokenUsage: TokenUsage
  ): CostEstimate {
    const rates = this.pricing[provider];
    const inputCostUsd =
      (tokenUsage.inputTokens / 1_000_000) * rates.inputPer1MTokens;
    const outputCostUsd =
      (tokenUsage.outputTokens / 1_000_000) * rates.outputPer1MTokens;

    return {
      provider,
      model,
      inputTokens: tokenUsage.inputTokens,
      outputTokens: tokenUsage.outputTokens,
      inputCostUsd: round6(inputCostUsd),
      outputCostUsd: round6(outputCostUsd),
      totalCostUsd: round6(inputCostUsd + outputCostUsd),
    };
  }

  record(
    provider: ModelProvider,
    model: string,
    intent: TaskIntent,
    tokenUsage: TokenUsage
  ): CostEstimate {
    const cost = this.estimate(provider, model, tokenUsage);
    this.entries.push({
      provider,
      model,
      intent,
      cost,
      timestamp: new Date().toISOString(),
    });
    return cost;
  }

  summarize(): SessionCostSummary {
    const costByProvider: Record<string, number> = {};
    const costByIntent: Record<string, number> = {};
    let totalCostUsd = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const entry of this.entries) {
      totalCostUsd += entry.cost.totalCostUsd;
      totalInputTokens += entry.cost.inputTokens;
      totalOutputTokens += entry.cost.outputTokens;

      costByProvider[entry.provider] =
        (costByProvider[entry.provider] ?? 0) + entry.cost.totalCostUsd;
      costByIntent[entry.intent] =
        (costByIntent[entry.intent] ?? 0) + entry.cost.totalCostUsd;
    }

    return {
      totalCostUsd: round6(totalCostUsd),
      totalInputTokens,
      totalOutputTokens,
      requestCount: this.entries.length,
      costByProvider,
      costByIntent,
    };
  }

  reset(): void {
    this.entries = [];
  }

  get requestCount(): number {
    return this.entries.length;
  }
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
