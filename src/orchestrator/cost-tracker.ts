import type { ModelProvider, TaskIntent, TokenUsage } from "../types/index.js";

interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

const PRICING: Record<ModelProvider, ModelPricing> = {
  claude: { inputPer1M: 3.00, outputPer1M: 15.00 },
  grok: { inputPer1M: 3.00, outputPer1M: 15.00 },
  perplexity: { inputPer1M: 1.00, outputPer1M: 5.00 },
};

export interface CostEntry {
  provider: ModelProvider;
  intent: TaskIntent;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  timestamp: number;
}

export interface CostSnapshot {
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  requestCount: number;
  costByProvider: Record<ModelProvider, { costUsd: number; requests: number; tokens: number }>;
  costByIntent: Record<string, { costUsd: number; requests: number }>;
  avgCostPerRequest: number;
  projectedDailyCostUsd: number;
}

export class CostTracker {
  private entries: CostEntry[] = [];
  private startedAt = Date.now();
  private customPricing: Record<ModelProvider, ModelPricing>;
  private lifetimeCostUsd = 0;
  private lifetimeInputTokens = 0;
  private lifetimeOutputTokens = 0;
  private lifetimeRequestCount = 0;

  constructor(pricing?: Partial<Record<ModelProvider, Partial<ModelPricing>>>) {
    this.customPricing = {
      claude: { ...PRICING.claude, ...pricing?.claude },
      grok: { ...PRICING.grok, ...pricing?.grok },
      perplexity: { ...PRICING.perplexity, ...pricing?.perplexity },
    };
  }

  static estimateCostStatic(provider: ModelProvider, tokenUsage: TokenUsage): number {
    const pricing = PRICING[provider];
    const inputCost = (tokenUsage.inputTokens / 1_000_000) * pricing.inputPer1M;
    const outputCost = (tokenUsage.outputTokens / 1_000_000) * pricing.outputPer1M;
    return inputCost + outputCost;
  }

  estimateCost(provider: ModelProvider, tokenUsage: TokenUsage): number {
    const pricing = this.customPricing[provider];
    const inputCost = (tokenUsage.inputTokens / 1_000_000) * pricing.inputPer1M;
    const outputCost = (tokenUsage.outputTokens / 1_000_000) * pricing.outputPer1M;
    return inputCost + outputCost;
  }

  record(provider: ModelProvider, intent: TaskIntent, tokenUsage: TokenUsage): CostEntry {
    const costUsd = this.estimateCost(provider, tokenUsage);
    const entry: CostEntry = {
      provider,
      intent,
      inputTokens: tokenUsage.inputTokens,
      outputTokens: tokenUsage.outputTokens,
      costUsd,
      timestamp: Date.now(),
    };

    this.lifetimeCostUsd += costUsd;
    this.lifetimeInputTokens += tokenUsage.inputTokens;
    this.lifetimeOutputTokens += tokenUsage.outputTokens;
    this.lifetimeRequestCount++;

    this.entries.push(entry);
    if (this.entries.length > 10_000) {
      this.entries.shift();
    }
    return entry;
  }

  getSnapshot(): CostSnapshot {
    const costByProvider: Record<string, { costUsd: number; requests: number; tokens: number }> = {};
    const costByIntent: Record<string, { costUsd: number; requests: number }> = {};

    for (const entry of this.entries) {
      if (!costByProvider[entry.provider]) {
        costByProvider[entry.provider] = { costUsd: 0, requests: 0, tokens: 0 };
      }
      costByProvider[entry.provider].costUsd += entry.costUsd;
      costByProvider[entry.provider].requests++;
      costByProvider[entry.provider].tokens += entry.inputTokens + entry.outputTokens;

      if (!costByIntent[entry.intent]) {
        costByIntent[entry.intent] = { costUsd: 0, requests: 0 };
      }
      costByIntent[entry.intent].costUsd += entry.costUsd;
      costByIntent[entry.intent].requests++;
    }

    const elapsedMs = Date.now() - this.startedAt;
    const elapsedHours = elapsedMs / 3_600_000;
    const projectedDaily = elapsedHours > 0 ? (this.lifetimeCostUsd / elapsedHours) * 24 : 0;

    return {
      totalCostUsd: this.lifetimeCostUsd,
      totalInputTokens: this.lifetimeInputTokens,
      totalOutputTokens: this.lifetimeOutputTokens,
      requestCount: this.lifetimeRequestCount,
      costByProvider: costByProvider as CostSnapshot["costByProvider"],
      costByIntent,
      avgCostPerRequest: this.lifetimeRequestCount > 0 ? this.lifetimeCostUsd / this.lifetimeRequestCount : 0,
      projectedDailyCostUsd: projectedDaily,
    };
  }

  getRecentCost(windowMs = 3_600_000): number {
    const cutoff = Date.now() - windowMs;
    return this.entries
      .filter((e) => e.timestamp >= cutoff)
      .reduce((sum, e) => sum + e.costUsd, 0);
  }

  reset(): void {
    this.entries = [];
    this.lifetimeCostUsd = 0;
    this.lifetimeInputTokens = 0;
    this.lifetimeOutputTokens = 0;
    this.lifetimeRequestCount = 0;
    this.startedAt = Date.now();
  }
}
