/**
 * CoreIntent AI — Orchestrator
 *
 * The central brain of the AI layer. Receives high-level requests,
 * routes them to the optimal model via intent-based routing, and
 * handles fallback gracefully.
 *
 * Enhanced with:
 * - Circuit breaker integration for provider resilience
 * - Response caching to avoid duplicate API calls
 * - Observability hooks for cost/latency tracking
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
import { CircuitBreaker } from "../utils/circuit-breaker.js";
import { ResponseCache } from "../utils/cache.js";

export interface OrchestratorOptions {
  maxRetries?: number;
  defaultTimeoutMs?: number;
  fallbackEnabled?: boolean;
  cacheEnabled?: boolean;
  circuitBreakerEnabled?: boolean;
  onRoute?: (request: OrchestrationRequest, providers: string[]) => void;
  onComplete?: (response: OrchestrationResponse) => void;
  onError?: (error: Error) => void;
  onCacheHit?: (request: OrchestrationRequest) => void;
}

export class Orchestrator {
  private options: Required<OrchestratorOptions>;
  private circuitBreaker: CircuitBreaker;
  private cache: ResponseCache<OrchestrationResponse>;

  constructor(options: OrchestratorOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 2,
      defaultTimeoutMs: options.defaultTimeoutMs ?? 30_000,
      fallbackEnabled: options.fallbackEnabled ?? true,
      cacheEnabled: options.cacheEnabled ?? false,
      circuitBreakerEnabled: options.circuitBreakerEnabled ?? true,
      onRoute: options.onRoute ?? (() => {}),
      onComplete: options.onComplete ?? (() => {}),
      onError: options.onError ?? (() => {}),
      onCacheHit: options.onCacheHit ?? (() => {}),
    };

    this.circuitBreaker = new CircuitBreaker();
    this.cache = new ResponseCache({ enabled: this.options.cacheEnabled });
  }

  async execute(
    request: OrchestrationRequest
  ): Promise<OrchestrationResponse> {
    // Check cache first
    if (this.options.cacheEnabled) {
      const cacheKey = ResponseCache.buildKey({
        provider: request.preferredProvider,
        intent: request.intent,
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
      });
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.options.onCacheHit(request);
        return { ...cached, metadata: { ...cached.metadata, cached: true } };
      }
    }

    const providers = getProviderChain(
      request.intent,
      request.preferredProvider
    );

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

      // Store in cache
      if (this.options.cacheEnabled) {
        const cacheKey = ResponseCache.buildKey({
          provider: request.preferredProvider,
          intent: request.intent,
          prompt: request.prompt,
          systemPrompt: request.systemPrompt,
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
   * Get circuit breaker health status for all providers.
   */
  getProviderHealth() {
    return this.circuitBreaker.getStatus();
  }

  /**
   * Get cache performance statistics.
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Clear the response cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Reset circuit breakers for all providers.
   */
  resetCircuitBreakers(): void {
    this.circuitBreaker.resetAll();
  }
}

export { resolveRoute, getProviderChain } from "./router.js";
export { executeWithFallback, CoreIntentAIError } from "./fallback.js";
export type { ErrorCategory } from "./fallback.js";
