/**
 * CoreIntent AI — Orchestrator
 *
 * The central brain of the AI layer. Receives high-level requests,
 * routes them to the optimal model via intent-based routing, and
 * handles fallback gracefully. Now with:
 *   - Circuit breaker: skip providers that are down
 *   - Response cache: avoid redundant API calls
 *   - Health metrics: track and rank providers by performance
 *   - Adaptive routing: reorder provider chains based on health
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
} from "../types/index.js";
import { getProviderChain } from "./router.js";
import { executeWithFallback } from "./fallback.js";
import { CircuitBreaker, type CircuitBreakerConfig } from "./circuit-breaker.js";
import { ResponseCache, type CacheConfig } from "./cache.js";
import { HealthTracker } from "./health.js";

export interface OrchestratorOptions {
  maxRetries?: number;
  defaultTimeoutMs?: number;
  fallbackEnabled?: boolean;
  /** Enable response caching (default: true) */
  cacheEnabled?: boolean;
  /** Enable circuit breaker (default: true) */
  circuitBreakerEnabled?: boolean;
  /** Enable adaptive routing based on health metrics (default: true) */
  adaptiveRouting?: boolean;
  /** Circuit breaker configuration */
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
  /** Cache configuration */
  cacheConfig?: Partial<CacheConfig>;
  onRoute?: (request: OrchestrationRequest, providers: string[]) => void;
  onComplete?: (response: OrchestrationResponse) => void;
  onError?: (error: Error) => void;
}

export class Orchestrator {
  private options: Required<
    Pick<
      OrchestratorOptions,
      | "maxRetries"
      | "defaultTimeoutMs"
      | "fallbackEnabled"
      | "cacheEnabled"
      | "circuitBreakerEnabled"
      | "adaptiveRouting"
      | "onRoute"
      | "onComplete"
      | "onError"
    >
  >;
  private circuitBreaker: CircuitBreaker;
  private cache: ResponseCache;
  private healthTracker: HealthTracker;

  constructor(options: OrchestratorOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 2,
      defaultTimeoutMs: options.defaultTimeoutMs ?? 30_000,
      fallbackEnabled: options.fallbackEnabled ?? true,
      cacheEnabled: options.cacheEnabled ?? true,
      circuitBreakerEnabled: options.circuitBreakerEnabled ?? true,
      adaptiveRouting: options.adaptiveRouting ?? true,
      onRoute: options.onRoute ?? (() => {}),
      onComplete: options.onComplete ?? (() => {}),
      onError: options.onError ?? (() => {}),
    };

    this.circuitBreaker = new CircuitBreaker(options.circuitBreakerConfig);
    this.cache = new ResponseCache(options.cacheConfig);
    this.healthTracker = new HealthTracker();
  }

  async execute(
    request: OrchestrationRequest
  ): Promise<OrchestrationResponse> {
    // Check cache first
    if (this.options.cacheEnabled) {
      const cacheKey = ResponseCache.buildKey({
        intent: request.intent,
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        preferredProvider: request.preferredProvider,
      });

      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.options.onComplete(cached);
        return cached;
      }
    }

    let providers = getProviderChain(
      request.intent,
      request.preferredProvider
    );

    // Adaptive routing: reorder fallbacks based on health metrics
    if (this.options.adaptiveRouting && providers.length > 1) {
      const primary = providers[0];
      const fallbacks = this.healthTracker.rankProviders(providers.slice(1));
      providers = [primary, ...fallbacks];
    }

    // If fallback is disabled, only use the primary provider
    const chain = this.options.fallbackEnabled
      ? providers
      : providers.slice(0, 1);

    this.options.onRoute(request, chain);

    const start = performance.now();

    try {
      const result = await executeWithFallback({
        providers: chain,
        request: {
          systemPrompt: request.systemPrompt,
          prompt: request.prompt,
          timeoutMs: request.timeoutMs ?? this.options.defaultTimeoutMs,
        },
        maxRetries: request.maxRetries ?? this.options.maxRetries,
        circuitBreaker: this.options.circuitBreakerEnabled
          ? this.circuitBreaker
          : undefined,
        healthTracker: this.healthTracker,
      });

      const response: OrchestrationResponse = {
        content: result.response.content,
        provider: result.response.provider,
        model: result.response.model,
        latencyMs: Math.round(performance.now() - start),
        tokenUsage: result.response.tokenUsage,
        fallbackUsed: result.fallbackUsed,
        metadata: {
          attemptedProviders: result.attemptedProviders,
          skippedProviders: result.skippedProviders,
          errors: result.errors,
          finishReason: result.response.finishReason,
        },
      };

      // Cache the response
      if (this.options.cacheEnabled) {
        const cacheKey = ResponseCache.buildKey({
          intent: request.intent,
          prompt: request.prompt,
          systemPrompt: request.systemPrompt,
          preferredProvider: request.preferredProvider,
        });
        this.cache.set(cacheKey, response, request.intent);
      }

      this.options.onComplete(response);
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.options.onError(err);
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
   * Get health snapshots for all providers.
   */
  getProviderHealth() {
    return this.healthTracker.getAllHealth();
  }

  /**
   * Get circuit breaker state for a provider.
   */
  getCircuitState(provider: "claude" | "grok" | "perplexity") {
    return this.circuitBreaker.getStats(provider);
  }

  /**
   * Get cache statistics.
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Invalidate all cached responses (e.g., after a market event).
   */
  invalidateCache() {
    this.cache.invalidateAll();
  }

  /**
   * Reset circuit breaker for a provider (e.g., after manual recovery).
   */
  resetCircuit(provider: "claude" | "grok" | "perplexity") {
    this.circuitBreaker.reset(provider);
  }
}

export { resolveRoute, getProviderChain } from "./router.js";
export { executeWithFallback, CoreIntentAIError } from "./fallback.js";
export { CircuitBreaker } from "./circuit-breaker.js";
export { ResponseCache } from "./cache.js";
export { HealthTracker } from "./health.js";
