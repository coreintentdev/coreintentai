/**
 * CoreIntent AI — Orchestrator
 *
 * The central brain of the AI layer. Receives high-level requests,
 * routes them to the optimal model via intent-based routing, and
 * handles fallback gracefully.
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
import { CircuitBreaker, type CircuitBreakerOptions } from "./circuit-breaker.js";

export interface OrchestratorOptions {
  maxRetries?: number;
  defaultTimeoutMs?: number;
  fallbackEnabled?: boolean;
  circuitBreaker?: Partial<CircuitBreakerOptions> | false;
  onRoute?: (request: OrchestrationRequest, providers: string[]) => void;
  onComplete?: (response: OrchestrationResponse) => void;
  onError?: (error: Error) => void;
}

export class Orchestrator {
  private options: Required<Omit<OrchestratorOptions, "circuitBreaker">> & { circuitBreaker: CircuitBreaker | null };

  constructor(options: OrchestratorOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 2,
      defaultTimeoutMs: options.defaultTimeoutMs ?? 30_000,
      fallbackEnabled: options.fallbackEnabled ?? true,
      circuitBreaker: options.circuitBreaker === false
        ? null
        : new CircuitBreaker(typeof options.circuitBreaker === "object" ? options.circuitBreaker : undefined),
      onRoute: options.onRoute ?? (() => {}),
      onComplete: options.onComplete ?? (() => {}),
      onError: options.onError ?? (() => {}),
    };
  }

  getCircuitBreaker(): CircuitBreaker | null {
    return this.options.circuitBreaker;
  }

  async execute(
    request: OrchestrationRequest
  ): Promise<OrchestrationResponse> {
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
        circuitBreaker: this.options.circuitBreaker ?? undefined,
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
          errors: result.errors,
          finishReason: result.response.finishReason,
        },
      };

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
}

export { resolveRoute, getProviderChain } from "./router.js";
export { executeWithFallback, CoreIntentAIError } from "./fallback.js";
export { CircuitBreaker } from "./circuit-breaker.js";
export type { CircuitState, CircuitBreakerOptions } from "./circuit-breaker.js";
