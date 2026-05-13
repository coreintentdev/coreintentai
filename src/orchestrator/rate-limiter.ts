import type { ModelProvider } from "../types/index.js";

export interface RateLimiterOptions {
  requestsPerMinute: Partial<Record<ModelProvider, number>>;
  requestsPerDay: Partial<Record<ModelProvider, number>>;
  tokensPerMinute: Partial<Record<ModelProvider, number>>;
  dailyBudgetUsd: number;
}

const DEFAULTS: RateLimiterOptions = {
  requestsPerMinute: {
    claude: 50,
    grok: 60,
    perplexity: 50,
  },
  requestsPerDay: {
    claude: 5000,
    grok: 10000,
    perplexity: 5000,
  },
  tokensPerMinute: {
    claude: 100_000,
    grok: 150_000,
    perplexity: 100_000,
  },
  dailyBudgetUsd: 50,
};

interface Window {
  timestamps: number[];
  tokenCounts: number[];
}

export interface RateLimitStatus {
  provider: ModelProvider;
  allowed: boolean;
  reason?: string;
  minuteRequests: number;
  minuteLimit: number;
  dayRequests: number;
  dayLimit: number;
  minuteTokens: number;
  minuteTokenLimit: number;
  dailySpendUsd: number;
  dailyBudgetUsd: number;
}

export class RateLimiter {
  private options: RateLimiterOptions;
  private minuteWindows = new Map<ModelProvider, Window>();
  private dayWindows = new Map<ModelProvider, Window>();
  private dailySpend = 0;
  private dayStartMs = Date.now();

  constructor(options?: Partial<RateLimiterOptions>) {
    this.options = {
      requestsPerMinute: { ...DEFAULTS.requestsPerMinute, ...options?.requestsPerMinute },
      requestsPerDay: { ...DEFAULTS.requestsPerDay, ...options?.requestsPerDay },
      tokensPerMinute: { ...DEFAULTS.tokensPerMinute, ...options?.tokensPerMinute },
      dailyBudgetUsd: options?.dailyBudgetUsd ?? DEFAULTS.dailyBudgetUsd,
    };
  }

  private getMinuteWindow(provider: ModelProvider): Window {
    let w = this.minuteWindows.get(provider);
    if (!w) {
      w = { timestamps: [], tokenCounts: [] };
      this.minuteWindows.set(provider, w);
    }
    return w;
  }

  private getDayWindow(provider: ModelProvider): Window {
    let w = this.dayWindows.get(provider);
    if (!w) {
      w = { timestamps: [], tokenCounts: [] };
      this.dayWindows.set(provider, w);
    }
    return w;
  }

  private pruneWindow(window: Window, cutoffMs: number): void {
    const now = Date.now();
    let i = 0;
    while (i < window.timestamps.length && now - window.timestamps[i] > cutoffMs) {
      i++;
    }
    if (i > 0) {
      window.timestamps.splice(0, i);
      window.tokenCounts.splice(0, i);
    }
  }

  private resetDayIfNeeded(): void {
    const elapsed = Date.now() - this.dayStartMs;
    if (elapsed > 86_400_000) {
      this.dayWindows.clear();
      this.dailySpend = 0;
      this.dayStartMs = Date.now();
    }
  }

  canRequest(provider: ModelProvider): RateLimitStatus {
    this.resetDayIfNeeded();

    const minuteWin = this.getMinuteWindow(provider);
    const dayWin = this.getDayWindow(provider);
    this.pruneWindow(minuteWin, 60_000);

    const minuteLimit = this.options.requestsPerMinute[provider] ?? 60;
    const dayLimit = this.options.requestsPerDay[provider] ?? 10000;
    const tokenLimit = this.options.tokensPerMinute[provider] ?? 100_000;

    const minuteRequests = minuteWin.timestamps.length;
    const dayRequests = dayWin.timestamps.length;
    const minuteTokens = minuteWin.tokenCounts.reduce((a, b) => a + b, 0);

    const base: Omit<RateLimitStatus, "allowed" | "reason"> = {
      provider,
      minuteRequests,
      minuteLimit,
      dayRequests,
      dayLimit,
      minuteTokens,
      minuteTokenLimit: tokenLimit,
      dailySpendUsd: this.dailySpend,
      dailyBudgetUsd: this.options.dailyBudgetUsd,
    };

    if (minuteRequests >= minuteLimit) {
      return { ...base, allowed: false, reason: `Rate limit: ${minuteRequests}/${minuteLimit} requests/min for ${provider}` };
    }

    if (dayRequests >= dayLimit) {
      return { ...base, allowed: false, reason: `Daily limit: ${dayRequests}/${dayLimit} requests/day for ${provider}` };
    }

    if (minuteTokens >= tokenLimit) {
      return { ...base, allowed: false, reason: `Token limit: ${minuteTokens}/${tokenLimit} tokens/min for ${provider}` };
    }

    if (this.dailySpend >= this.options.dailyBudgetUsd) {
      return { ...base, allowed: false, reason: `Daily budget exhausted: $${this.dailySpend.toFixed(2)}/$${this.options.dailyBudgetUsd.toFixed(2)}` };
    }

    return { ...base, allowed: true };
  }

  recordRequest(provider: ModelProvider, tokenCount: number, costUsd: number): void {
    this.resetDayIfNeeded();

    const now = Date.now();
    const minuteWin = this.getMinuteWindow(provider);
    const dayWin = this.getDayWindow(provider);

    minuteWin.timestamps.push(now);
    minuteWin.tokenCounts.push(tokenCount);
    dayWin.timestamps.push(now);
    dayWin.tokenCounts.push(tokenCount);

    this.dailySpend += costUsd;
  }

  getDailySpend(): number {
    this.resetDayIfNeeded();
    return this.dailySpend;
  }

  getSnapshot(): Map<ModelProvider, RateLimitStatus> {
    const snap = new Map<ModelProvider, RateLimitStatus>();
    const providers: ModelProvider[] = ["claude", "grok", "perplexity"];
    for (const p of providers) {
      snap.set(p, this.canRequest(p));
    }
    return snap;
  }

  reset(): void {
    this.minuteWindows.clear();
    this.dayWindows.clear();
    this.dailySpend = 0;
    this.dayStartMs = Date.now();
  }
}
