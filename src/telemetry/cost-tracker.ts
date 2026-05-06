export interface ModelPricing {
  inputPer1MTokens: number;
  outputPer1MTokens: number;
}

export interface CostEntry {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  costUsd: number;
  timestamp: string;
  capability?: string;
}

export interface CostSnapshot {
  totalCostUsd: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  byCapability: Record<string, number>;
  totalInputTokens: number;
  totalOutputTokens: number;
  entries: number;
}

const DEFAULT_PRICING: Record<string, ModelPricing> = {
  "claude-sonnet-4-20250514": {
    inputPer1MTokens: 3,
    outputPer1MTokens: 15,
  },
  "claude-opus-4-20250514": {
    inputPer1MTokens: 15,
    outputPer1MTokens: 75,
  },
  "claude-haiku-4-20250514": {
    inputPer1MTokens: 0.8,
    outputPer1MTokens: 4,
  },
  "grok-3": {
    inputPer1MTokens: 3,
    outputPer1MTokens: 15,
  },
  "grok-3-mini": {
    inputPer1MTokens: 0.3,
    outputPer1MTokens: 0.5,
  },
  "sonar-pro": {
    inputPer1MTokens: 3,
    outputPer1MTokens: 15,
  },
  "sonar": {
    inputPer1MTokens: 1,
    outputPer1MTokens: 1,
  },
};

export class CostTracker {
  private entries: CostEntry[] = [];
  private pricing: Record<string, ModelPricing>;
  private budgetUsd: number | null;

  constructor(options?: {
    pricing?: Record<string, ModelPricing>;
    budgetUsd?: number;
  }) {
    this.pricing = { ...DEFAULT_PRICING, ...options?.pricing };
    this.budgetUsd = options?.budgetUsd ?? null;
  }

  calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
    cacheReadTokens?: number,
    cacheCreationTokens?: number
  ): number {
    const p = this.pricing[model];
    if (!p) {
      return this.estimateCost(inputTokens, outputTokens);
    }

    const cacheRead = cacheReadTokens ?? 0;
    const cacheCreation = cacheCreationTokens ?? 0;
    const standardInput = inputTokens - cacheRead - cacheCreation;

    return (
      (standardInput / 1_000_000) * p.inputPer1MTokens +
      (cacheRead / 1_000_000) * p.inputPer1MTokens * 0.1 +
      (cacheCreation / 1_000_000) * p.inputPer1MTokens * 1.25 +
      (outputTokens / 1_000_000) * p.outputPer1MTokens
    );
  }

  record(params: {
    model: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
    capability?: string;
  }): CostEntry {
    const costUsd = this.calculateCost(
      params.model,
      params.inputTokens,
      params.outputTokens,
      params.cacheReadTokens,
      params.cacheCreationTokens
    );

    const entry: CostEntry = {
      model: params.model,
      provider: params.provider,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      cacheReadTokens: params.cacheReadTokens,
      cacheCreationTokens: params.cacheCreationTokens,
      costUsd,
      timestamp: new Date().toISOString(),
      capability: params.capability,
    };

    this.entries.push(entry);
    return entry;
  }

  getTotalCost(): number {
    return this.entries.reduce((sum, e) => sum + e.costUsd, 0);
  }

  getCostByProvider(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const entry of this.entries) {
      result[entry.provider] =
        (result[entry.provider] ?? 0) + entry.costUsd;
    }
    return result;
  }

  getCostByModel(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const entry of this.entries) {
      result[entry.model] =
        (result[entry.model] ?? 0) + entry.costUsd;
    }
    return result;
  }

  getCostByCapability(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const entry of this.entries) {
      const key = entry.capability ?? "uncategorized";
      result[key] = (result[key] ?? 0) + entry.costUsd;
    }
    return result;
  }

  isOverBudget(): boolean {
    if (this.budgetUsd === null) return false;
    return this.getTotalCost() > this.budgetUsd;
  }

  getRemainingBudget(): number | null {
    if (this.budgetUsd === null) return null;
    return Math.max(0, this.budgetUsd - this.getTotalCost());
  }

  getSnapshot(): CostSnapshot {
    let totalInput = 0;
    let totalOutput = 0;
    for (const e of this.entries) {
      totalInput += e.inputTokens;
      totalOutput += e.outputTokens;
    }

    return {
      totalCostUsd: this.getTotalCost(),
      byProvider: this.getCostByProvider(),
      byModel: this.getCostByModel(),
      byCapability: this.getCostByCapability(),
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      entries: this.entries.length,
    };
  }

  reset(): void {
    this.entries = [];
  }

  private estimateCost(inputTokens: number, outputTokens: number): number {
    return (
      (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15
    );
  }
}
