import type {
  ModelProvider,
  OrchestrationRequest,
  OrchestrationResponse,
} from "../types/index.js";
import { getProviderChain } from "./router.js";
import { executeWithFallback } from "./fallback.js";
import { CircuitBreaker, type CircuitBreakerOptions } from "./circuit-breaker.js";
import { AdaptiveRouter, type AdaptiveRouterOptions } from "./adaptive-router.js";
import { ResponseCache, type ResponseCacheOptions } from "./response-cache.js";
import { Telemetry } from "./telemetry.js";
import { CostTracker } from "./cost-tracker.js";
import { RateLimiter, type RateLimiterOptions } from "./rate-limiter.js";

export interface OrchestratorOptions {
  maxRetries?: number;
  defaultTimeoutMs?: number;
  fallbackEnabled?: boolean;
  circuitBreaker?: Partial<CircuitBreakerOptions> | false;
  adaptiveRouting?: Partial<AdaptiveRouterOptions> | false;
  cache?: Partial<ResponseCacheOptions> | false;
  telemetry?: boolean;
  costTracking?: boolean;
  rateLimiter?: Partial<RateLimiterOptions> | false;
  onRoute?: (request: OrchestrationRequest, providers: string[]) => void;
  onComplete?: (response: OrchestrationResponse) => void;
  onError?: (error: Error) => void;
}

export class Orchestrator {
  private maxRetries: number;
  private defaultTimeoutMs: number;
  private fallbackEnabled: boolean;
  private circuitBreaker: CircuitBreaker | null;
  private adaptiveRouter: AdaptiveRouter | null;
  private responseCache: ResponseCache | null;
  private telemetry: Telemetry | null;
  private costTracker: CostTracker | null;
  private rateLimiter: RateLimiter | null;
  private onRoute: (request: OrchestrationRequest, providers: string[]) => void;
  private onComplete: (response: OrchestrationResponse) => void;
  private onError: (error: Error) => void;

  constructor(options: OrchestratorOptions = {}) {
    this.maxRetries = options.maxRetries ?? 2;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 30_000;
    this.fallbackEnabled = options.fallbackEnabled ?? true;
    this.circuitBreaker = options.circuitBreaker === false
      ? null
      : new CircuitBreaker(typeof options.circuitBreaker === "object" ? options.circuitBreaker : undefined);
    this.adaptiveRouter = options.adaptiveRouting === false
      ? null
      : new AdaptiveRouter(typeof options.adaptiveRouting === "object" ? options.adaptiveRouting : undefined);
    this.responseCache = options.cache === false
      ? null
      : new ResponseCache(typeof options.cache === "object" ? options.cache : undefined);
    this.telemetry = options.telemetry === false ? null : new Telemetry();
    this.costTracker = options.costTracking === false ? null : new CostTracker();
    this.rateLimiter = options.rateLimiter === false
      ? null
      : options.rateLimiter
        ? new RateLimiter(typeof options.rateLimiter === "object" ? options.rateLimiter : undefined)
        : null;
    this.onRoute = options.onRoute ?? (() => {});
    this.onComplete = options.onComplete ?? (() => {});
    this.onError = options.onError ?? (() => {});
  }

  getCircuitBreaker(): CircuitBreaker | null {
    return this.circuitBreaker;
  }

  getAdaptiveRouter(): AdaptiveRouter | null {
    return this.adaptiveRouter;
  }

  getResponseCache(): ResponseCache | null {
    return this.responseCache;
  }

  getTelemetry(): Telemetry | null {
    return this.telemetry;
  }

  getCostTracker(): CostTracker | null {
    return this.costTracker;
  }

  getRateLimiter(): RateLimiter | null {
    return this.rateLimiter;
  }

  async execute(
    request: OrchestrationRequest
  ): Promise<OrchestrationResponse> {
    // Check cache first
    if (this.responseCache) {
      const cached = this.responseCache.get(
        request.intent,
        request.prompt,
        request.systemPrompt,
        request.preferredProvider
      );
      if (cached) {
        this.telemetry?.emit({
          type: "cache_hit",
          intent: request.intent,
          provider: cached.provider,
        });
        return {
          content: cached.content,
          provider: cached.provider,
          model: cached.model,
          latencyMs: 0,
          tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          fallbackUsed: false,
          metadata: { fromCache: true },
        };
      }
      this.telemetry?.emit({ type: "cache_miss", intent: request.intent });
    }

    let providers: ModelProvider[] = getProviderChain(
      request.intent,
      request.preferredProvider
    );

    // Filter out rate-limited providers
    if (this.rateLimiter) {
      providers = providers.filter((p) => this.rateLimiter!.canRequest(p).allowed);
      if (providers.length === 0) {
        throw new Error("All providers are rate-limited. Try again later.");
      }
    }

    // Use adaptive routing if available (rerank by learned performance)
    if (this.adaptiveRouter && !request.preferredProvider) {
      providers = this.adaptiveRouter.rankProviders(
        request.intent,
        providers,
        this.circuitBreaker ?? undefined
      );
    }

    const chain = this.fallbackEnabled
      ? providers
      : providers.slice(0, 1);

    this.onRoute(request, chain);
    this.telemetry?.emit({
      type: "request_start",
      intent: request.intent,
      provider: chain[0],
    });

    const start = performance.now();

    try {
      const result = await executeWithFallback({
        providers: chain,
        request: {
          systemPrompt: request.systemPrompt,
          prompt: request.prompt,
          timeoutMs: request.timeoutMs ?? this.defaultTimeoutMs,
        },
        maxRetries: request.maxRetries ?? this.maxRetries,
        circuitBreaker: this.circuitBreaker ?? undefined,
      });

      const latencyMs = Math.round(performance.now() - start);

      if (result.fallbackUsed) {
        this.telemetry?.emit({
          type: "fallback_triggered",
          intent: request.intent,
          provider: result.response.provider,
          metadata: { attemptedProviders: result.attemptedProviders },
        });
      }

      const response: OrchestrationResponse = {
        content: result.response.content,
        provider: result.response.provider,
        model: result.response.model,
        latencyMs,
        tokenUsage: result.response.tokenUsage,
        fallbackUsed: result.fallbackUsed,
        metadata: {
          attemptedProviders: result.attemptedProviders,
          errors: result.errors,
          finishReason: result.response.finishReason,
        },
      };

      // Record outcome for adaptive routing
      this.adaptiveRouter?.recordOutcome({
        intent: request.intent,
        provider: result.response.provider,
        success: true,
        latencyMs,
      });

      // Track cost
      let costUsd: number | undefined;
      if (this.costTracker) {
        const entry = this.costTracker.record(
          result.response.provider,
          request.intent,
          result.response.tokenUsage
        );
        costUsd = entry.costUsd;
      }

      // Record rate limiter usage — estimate cost even without costTracker
      if (this.rateLimiter) {
        const cost = costUsd ?? CostTracker.estimateCostStatic(
          result.response.provider,
          result.response.tokenUsage
        );
        this.rateLimiter.recordRequest(
          result.response.provider,
          result.response.tokenUsage.totalTokens,
          cost
        );
      }

      this.telemetry?.emit({
        type: "request_complete",
        intent: request.intent,
        provider: result.response.provider,
        latencyMs,
        tokenUsage: result.response.tokenUsage,
        metadata: costUsd !== undefined ? { costUsd } : undefined,
      });

      // Cache the response
      this.responseCache?.set({
        intent: request.intent,
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        preferredProvider: request.preferredProvider,
        provider: result.response.provider,
        model: result.response.model,
        content: result.response.content,
      });

      this.onComplete(response);
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      this.adaptiveRouter?.recordOutcome({
        intent: request.intent,
        provider: chain[0],
        success: false,
        latencyMs: Math.round(performance.now() - start),
      });

      this.telemetry?.emit({
        type: "request_error",
        intent: request.intent,
        provider: chain[0],
        error: err.message,
      });

      this.onError(err);
      throw err;
    }
  }

  async fan(
    requests: OrchestrationRequest[]
  ): Promise<OrchestrationResponse[]> {
    return Promise.all(requests.map((r) => this.execute(r)));
  }

  async consensus(
    request: Omit<OrchestrationRequest, "preferredProvider">,
    providers: Array<"claude" | "grok" | "perplexity">
  ): Promise<OrchestrationResponse[]> {
    const requests = providers.map((provider) => ({
      ...request,
      preferredProvider: provider,
    }));
    return this.fan(requests as OrchestrationRequest[]);
  }
}

export { resolveRoute, getProviderChain } from "./router.js";
export { executeWithFallback, CoreIntentAIError } from "./fallback.js";
export { CircuitBreaker } from "./circuit-breaker.js";
export type { CircuitState, CircuitBreakerOptions } from "./circuit-breaker.js";
export { AdaptiveRouter } from "./adaptive-router.js";
export type { ProviderScore, AdaptiveRouterOptions } from "./adaptive-router.js";
export { ResponseCache } from "./response-cache.js";
export type { ResponseCacheOptions } from "./response-cache.js";
export { Telemetry } from "./telemetry.js";
export type {
  TelemetryEvent,
  TelemetryEventType,
  TelemetryListener,
  TelemetrySnapshot,
} from "./telemetry.js";
export { CostTracker } from "./cost-tracker.js";
export type { CostEntry, CostSnapshot } from "./cost-tracker.js";
export { RateLimiter } from "./rate-limiter.js";
export type { RateLimiterOptions, RateLimitStatus } from "./rate-limiter.js";
