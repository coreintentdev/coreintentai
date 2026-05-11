import type { ModelProvider } from "../types/index.js";

export interface RateLimiterOptions {
  burstMultiplier: number;
}

export interface ProviderLimits {
  requestsPerMinute: number;
  tokensPerMinute: number;
}

interface TokenBucket {
  tokens: number;
  capacity: number;
  refillRate: number;
  lastRefill: number;
}

interface ProviderState {
  requestBucket: TokenBucket;
  tokenBucket: TokenBucket;
  totalRequests: number;
  totalTokensUsed: number;
  throttledRequests: number;
  lastRequest: number;
}

const DEFAULT_LIMITS: Record<ModelProvider, ProviderLimits> = {
  claude: { requestsPerMinute: 50, tokensPerMinute: 100_000 },
  grok: { requestsPerMinute: 60, tokensPerMinute: 150_000 },
  perplexity: { requestsPerMinute: 50, tokensPerMinute: 100_000 },
};

const DEFAULTS: RateLimiterOptions = {
  burstMultiplier: 1.5,
};

export class RateLimiter {
  private state = new Map<ModelProvider, ProviderState>();
  private options: RateLimiterOptions;
  private providerLimits: Record<ModelProvider, ProviderLimits>;

  constructor(
    options?: Partial<RateLimiterOptions>,
    providerLimits?: Partial<Record<ModelProvider, Partial<ProviderLimits>>>
  ) {
    this.options = { ...DEFAULTS, ...options };
    this.providerLimits = { ...DEFAULT_LIMITS };
    if (providerLimits) {
      for (const [provider, limits] of Object.entries(providerLimits)) {
        const p = provider as ModelProvider;
        this.providerLimits[p] = { ...this.providerLimits[p], ...limits };
      }
    }
  }

  private getState(provider: ModelProvider): ProviderState {
    let s = this.state.get(provider);
    if (!s) {
      const limits = this.providerLimits[provider];
      const burstCapacity = Math.ceil(
        limits.requestsPerMinute * this.options.burstMultiplier
      );
      const tokenBurstCapacity = Math.ceil(
        limits.tokensPerMinute * this.options.burstMultiplier
      );

      s = {
        requestBucket: {
          tokens: burstCapacity,
          capacity: burstCapacity,
          refillRate: limits.requestsPerMinute / 60_000,
          lastRefill: Date.now(),
        },
        tokenBucket: {
          tokens: tokenBurstCapacity,
          capacity: tokenBurstCapacity,
          refillRate: limits.tokensPerMinute / 60_000,
          lastRefill: Date.now(),
        },
        totalRequests: 0,
        totalTokensUsed: 0,
        throttledRequests: 0,
        lastRequest: 0,
      };
      this.state.set(provider, s);
    }
    return s;
  }

  private refillBucket(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const refill = elapsed * bucket.refillRate;
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + refill);
    bucket.lastRefill = now;
  }

  canRequest(provider: ModelProvider): boolean {
    const s = this.getState(provider);
    this.refillBucket(s.requestBucket);
    return s.requestBucket.tokens >= 1;
  }

  canConsumeTokens(provider: ModelProvider, tokenCount: number): boolean {
    const s = this.getState(provider);
    this.refillBucket(s.tokenBucket);
    return s.tokenBucket.tokens >= tokenCount;
  }

  acquire(provider: ModelProvider): boolean {
    const s = this.getState(provider);
    this.refillBucket(s.requestBucket);

    if (s.requestBucket.tokens < 1) {
      s.throttledRequests++;
      return false;
    }

    s.requestBucket.tokens -= 1;
    s.totalRequests++;
    s.lastRequest = Date.now();
    return true;
  }

  consumeTokens(provider: ModelProvider, tokenCount: number): boolean {
    const s = this.getState(provider);
    this.refillBucket(s.tokenBucket);

    if (s.tokenBucket.tokens < tokenCount) {
      return false;
    }

    s.tokenBucket.tokens -= tokenCount;
    s.totalTokensUsed += tokenCount;
    return true;
  }

  async waitForSlot(
    provider: ModelProvider,
    maxWaitMs: number = 10_000
  ): Promise<boolean> {
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      if (this.acquire(provider)) return true;

      const s = this.getState(provider);
      const tokensNeeded = 1 - s.requestBucket.tokens;
      const waitMs = Math.min(
        Math.ceil(tokensNeeded / s.requestBucket.refillRate),
        deadline - Date.now()
      );

      if (waitMs <= 0) break;
      await sleep(Math.min(waitMs, 100));
    }

    return false;
  }

  getWaitTimeMs(provider: ModelProvider): number {
    const s = this.getState(provider);
    this.refillBucket(s.requestBucket);

    if (s.requestBucket.tokens >= 1) return 0;

    const tokensNeeded = 1 - s.requestBucket.tokens;
    return Math.ceil(tokensNeeded / s.requestBucket.refillRate);
  }

  getSnapshot(): Map<
    ModelProvider,
    {
      availableRequests: number;
      availableTokens: number;
      totalRequests: number;
      totalTokensUsed: number;
      throttledRequests: number;
      utilizationPct: number;
    }
  > {
    const snap = new Map<
      ModelProvider,
      {
        availableRequests: number;
        availableTokens: number;
        totalRequests: number;
        totalTokensUsed: number;
        throttledRequests: number;
        utilizationPct: number;
      }
    >();

    for (const provider of ["claude", "grok", "perplexity"] as ModelProvider[]) {
      const s = this.getState(provider);
      this.refillBucket(s.requestBucket);
      this.refillBucket(s.tokenBucket);

      const totalAttempts = s.totalRequests + s.throttledRequests;
      const utilizationPct =
        totalAttempts > 0
          ? (s.totalRequests / totalAttempts) * 100
          : 100;

      snap.set(provider, {
        availableRequests: Math.floor(s.requestBucket.tokens),
        availableTokens: Math.floor(s.tokenBucket.tokens),
        totalRequests: s.totalRequests,
        totalTokensUsed: s.totalTokensUsed,
        throttledRequests: s.throttledRequests,
        utilizationPct: Math.round(utilizationPct),
      });
    }

    return snap;
  }

  reset(provider?: ModelProvider): void {
    if (provider) {
      this.state.delete(provider);
    } else {
      this.state.clear();
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
