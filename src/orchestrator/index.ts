/**
 * CoreIntent AI — Orchestrator
 *
 * The central brain of the AI layer. Receives high-level requests,
 * routes them to the optimal model via intent-based routing, and
 * handles fallback gracefully.
 *
 * Now with:
 *   - Circuit breaker: skip providers that are consistently failing
 *   - Response cache: avoid redundant API calls for identical requests
 *   - Adaptive routing: learn from runtime metrics to optimize provider selection
 *   - Request tracing: correlation IDs through the full pipeline
 *
 * Usage:
 *   const orchestrator = new Orchestrator();
 *   const result = await orchestrator.execute({
 *     intent: "sentiment",
 *     prompt: "Analyze AAPL sentiment from today's earnings call",
 *   });
 */

import type {
  OrchestrationRequest,
  OrchestrationResponse,
  ModelProvider,
} from "../types/index.js";
import { getProviderChain } from "./router.js";
import { executeWithFallback } from "./fallback.js";
import { CircuitBreakerRegistry } from "./circuit-breaker.js";
import type { CircuitBreakerConfig } from "./circuit-breaker.js";
import { ResponseCache } from "./cache.js";
import type { CacheConfig } from "./cache.js";
import { AdaptiveRouter } from "./adaptive-router.js";
import type { AdaptiveRouterConfig } from "./adaptive-router.js";
import { TraceContext } from "./trace.js";
import type { TraceListener } from "./trace.js";

export interface OrchestratorOptions {
  maxRetries?: number;
  defaultTimeoutMs?: number;
  fallbackEnabled?: boolean;

  /** Enable response caching. Default: true */
  cacheEnabled?: boolean;
  /** Cache configuration overrides */
  cacheConfig?: Partial<CacheConfig>;

  /** Enable circuit breaker. Default: true */
  circuitBreakerEnabled?: boolean;
  /** Circuit breaker configuration overrides */
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>;

  /** Enable adaptive routing (learns from runtime metrics). Default: true */
  adaptiveRoutingEnabled?: boolean;
  /** Adaptive router configuration overrides */
  adaptiveRouterConfig?: Partial<AdaptiveRouterConfig>;

  /** Trace listeners for observability */
  traceListeners?: TraceListener[];

  // Legacy hooks (still supported)
  onRoute?: (request: OrchestrationRequest, providers: string[]) => void;
  onComplete?: (response: OrchestrationResponse) => void;
  onError?: (error: Error) => void;
}

export class Orchestrator {
  private maxRetries: number;
  private defaultTimeoutMs: number;
  private fallbackEnabled: boolean;
  private onRoute: (request: OrchestrationRequest, providers: string[]) => void;
  private onComplete: (response: OrchestrationResponse) => void;
  private onError: (error: Error) => void;

  // New subsystems
  readonly circuitBreaker: CircuitBreakerRegistry;
  readonly cache: ResponseCache;
  readonly adaptiveRouter: AdaptiveRouter;

  private circuitBreakerEnabled: boolean;
  private cacheEnabled: boolean;
  private adaptiveRoutingEnabled: boolean;
  private traceListeners: TraceListener[];

  constructor(options: OrchestratorOptions = {}) {
    this.maxRetries = options.maxRetries ?? 2;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 30_000;
    this.fallbackEnabled = options.fallbackEnabled ?? true;
    this.onRoute = options.onRoute ?? (() => {});
    this.onComplete = options.onComplete ?? (() => {});
    this.onError = options.onError ?? (() => {});

    this.circuitBreakerEnabled = options.circuitBreakerEnabled ?? true;
    this.cacheEnabled = options.cacheEnabled ?? true;
    this.adaptiveRoutingEnabled = options.adaptiveRoutingEnabled ?? true;

    this.circuitBreaker = new CircuitBreakerRegistry(
      options.circuitBreakerConfig
    );
    this.cache = new ResponseCache(options.cacheConfig);
    this.adaptiveRouter = new AdaptiveRouter(options.adaptiveRouterConfig);
    this.traceListeners = options.traceListeners ?? [];
  }

  async execute(
    request: OrchestrationRequest
  ): Promise<OrchestrationResponse> {
    const trace = new TraceContext(undefined, this.traceListeners);

    trace.emit("request_start", { intent: request.intent });

    // --- Resolve provider chain ---
    let providers: ModelProvider[];
    if (this.adaptiveRoutingEnabled) {
      providers = this.adaptiveRouter.getProviderChain(
        request.intent,
        request.preferredProvider
      );
    } else {
      providers = getProviderChain(request.intent, request.preferredProvider);
    }

    // Filter out providers with open circuits
    if (this.circuitBreakerEnabled) {
      const available: ModelProvider[] = [];
      const skipped: ModelProvider[] = [];
      for (const p of providers) {
        if (this.circuitBreaker.canAttempt(p)) {
          available.push(p);
        } else {
          skipped.push(p);
        }
      }
      for (const p of skipped) {
        trace.emit("circuit_open", { provider: p });
      }
      // Only use filtered list if at least one provider is available;
      // otherwise try them all (last resort)
      if (available.length > 0) {
        providers = available;
      }
    }

    // If fallback is disabled, only use the primary provider
    const chain = this.fallbackEnabled ? providers : providers.slice(0, 1);

    trace.emit("route_resolved", {
      intent: request.intent,
      metadata: { providers: chain },
    });

    this.onRoute(request, chain);

    // --- Check cache ---
    if (this.cacheEnabled) {
      const cacheKey = ResponseCache.buildKey({
        intent: request.intent,
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        preferredProvider: request.preferredProvider,
      });

      const cached = this.cache.get(cacheKey);
      if (cached) {
        trace.emit("cache_hit", {
          intent: request.intent,
          cached: true,
        });

        const response: OrchestrationResponse = {
          ...cached,
          metadata: {
            ...cached.metadata,
            cached: true,
            traceId: trace.traceId,
          },
        };

        this.onComplete(response);
        return response;
      }

      trace.emit("cache_miss", { intent: request.intent });
    }

    // --- Execute with fallback ---
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
        onAttempt: (provider, attempt) => {
          trace.emit("provider_attempt", {
            provider,
            metadata: { attempt },
          });
        },
        onFailure: (provider, error) => {
          trace.emit("provider_failure", {
            provider,
            error: error.message,
          });

          // Record failure in circuit breaker
          if (this.circuitBreakerEnabled) {
            this.circuitBreaker.recordFailure(provider);
          }

          // Record failure in adaptive router
          if (this.adaptiveRoutingEnabled) {
            this.adaptiveRouter.record({
              provider,
              intent: request.intent,
              latencyMs: 0,
              success: false,
              totalTokens: 0,
            });
          }
        },
      });

      const latencyMs = Math.round(performance.now() - start);

      // Record success in circuit breaker
      if (this.circuitBreakerEnabled) {
        this.circuitBreaker.recordSuccess(result.response.provider);
      }

      // Record success in adaptive router
      if (this.adaptiveRoutingEnabled) {
        this.adaptiveRouter.record({
          provider: result.response.provider,
          intent: request.intent,
          latencyMs,
          success: true,
          totalTokens: result.response.tokenUsage.totalTokens,
        });
      }

      if (result.fallbackUsed) {
        trace.emit("fallback_triggered", {
          provider: result.response.provider,
          metadata: { attemptedProviders: result.attemptedProviders },
        });
      }

      trace.emit("provider_success", {
        provider: result.response.provider,
        latencyMs,
        tokens: result.response.tokenUsage.totalTokens,
      });

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
          traceId: trace.traceId,
        },
      };

      // Store in cache
      if (this.cacheEnabled) {
        const cacheKey = ResponseCache.buildKey({
          intent: request.intent,
          prompt: request.prompt,
          systemPrompt: request.systemPrompt,
        });
        this.cache.set(cacheKey, response, request.intent);
      }

      trace.emit("request_complete", {
        latencyMs,
        provider: result.response.provider,
        tokens: result.response.tokenUsage.totalTokens,
      });

      this.onComplete(response);
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      trace.emit("request_error", { error: err.message });
      this.onError(err);
      throw err;
    }
  }

  /**
   * Execute multiple requests in parallel across different providers.
   * Useful for getting multiple perspectives on the same data.
   */
  async fan(
    requests: OrchestrationRequest[]
  ): Promise<OrchestrationResponse[]> {
    return Promise.all(requests.map((r) => this.execute(r)));
  }

  /**
   * Execute the same prompt against multiple providers and return all results.
   * Useful for consensus-building or comparing model outputs.
   */
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

  /**
   * Get a health report of all subsystems.
   */
  health(): {
    circuitBreaker: ReturnType<CircuitBreakerRegistry["snapshot"]>;
    cache: ReturnType<ResponseCache["getStats"]>;
    adaptiveRouter: ReturnType<AdaptiveRouter["getSummary"]>;
  } {
    return {
      circuitBreaker: this.circuitBreaker.snapshot(),
      cache: this.cache.getStats(),
      adaptiveRouter: this.adaptiveRouter.getSummary(),
    };
  }
}

export { resolveRoute, getProviderChain } from "./router.js";
export { executeWithFallback, CoreIntentAIError } from "./fallback.js";
export { CircuitBreakerRegistry } from "./circuit-breaker.js";
export { ResponseCache } from "./cache.js";
export { AdaptiveRouter } from "./adaptive-router.js";
export {
  createTrace,
  generateTraceId,
  globalTraceRegistry,
  consoleTraceListener,
  TraceContext,
} from "./trace.js";
