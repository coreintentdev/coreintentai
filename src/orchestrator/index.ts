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
import { AdaptiveRouter, type AdaptiveRouterOptions } from "./adaptive-router.js";
import { Telemetry } from "../utils/telemetry.js";

export interface OrchestratorOptions {
  maxRetries?: number;
  defaultTimeoutMs?: number;
  fallbackEnabled?: boolean;
  circuitBreaker?: Partial<CircuitBreakerOptions> | false;
  adaptiveRouter?: Partial<AdaptiveRouterOptions> | false;
  telemetry?: Telemetry | false;
  onRoute?: (request: OrchestrationRequest, providers: string[]) => void;
  onComplete?: (response: OrchestrationResponse) => void;
  onError?: (error: Error) => void;
}

export class Orchestrator {
  private options: Required<Omit<OrchestratorOptions, "circuitBreaker" | "adaptiveRouter" | "telemetry">> & {
    circuitBreaker: CircuitBreaker | null;
    adaptiveRouter: AdaptiveRouter | null;
    telemetry: Telemetry | null;
  };

  constructor(options: OrchestratorOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 2,
      defaultTimeoutMs: options.defaultTimeoutMs ?? 30_000,
      fallbackEnabled: options.fallbackEnabled ?? true,
      circuitBreaker: options.circuitBreaker === false
        ? null
        : new CircuitBreaker(typeof options.circuitBreaker === "object" ? options.circuitBreaker : undefined),
      adaptiveRouter: options.adaptiveRouter === false
        ? null
        : new AdaptiveRouter(typeof options.adaptiveRouter === "object" ? options.adaptiveRouter : undefined),
      telemetry: options.telemetry === false
        ? null
        : (options.telemetry instanceof Telemetry ? options.telemetry : new Telemetry()),
      onRoute: options.onRoute ?? (() => {}),
      onComplete: options.onComplete ?? (() => {}),
      onError: options.onError ?? (() => {}),
    };
  }

  getCircuitBreaker(): CircuitBreaker | null {
    return this.options.circuitBreaker;
  }

  getAdaptiveRouter(): AdaptiveRouter | null {
    return this.options.adaptiveRouter;
  }

  getTelemetry(): Telemetry | null {
    return this.options.telemetry;
  }

  async execute(
    request: OrchestrationRequest
  ): Promise<OrchestrationResponse> {
    const traceId = this.options.telemetry?.startTrace() ?? "";

    let providers = getProviderChain(
      request.intent,
      request.preferredProvider
    );

    if (this.options.adaptiveRouter && !request.preferredProvider) {
      const ranked = this.options.adaptiveRouter.rankProviders(
        request.intent,
        providers,
        providers[0]
      );
      providers = ranked;

      this.options.telemetry?.record({
        traceId,
        type: "adaptive_route",
        intent: request.intent,
        metadata: { rankedProviders: ranked, staticProviders: getProviderChain(request.intent) },
      });
    }

    const chain = this.options.fallbackEnabled
      ? providers
      : providers.slice(0, 1);

    this.options.onRoute(request, chain);

    this.options.telemetry?.record({
      traceId,
      type: "route_decision",
      intent: request.intent,
      metadata: { chain, fallbackEnabled: this.options.fallbackEnabled },
    });

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

      const latencyMs = Math.round(performance.now() - start);

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
          traceId,
        },
      };

      this.options.adaptiveRouter?.record({
        intent: request.intent,
        provider: result.response.provider,
        success: true,
        latencyMs,
      });

      if (result.fallbackUsed) {
        for (const err of result.errors) {
          this.options.adaptiveRouter?.record({
            intent: request.intent,
            provider: err.provider,
            success: false,
            latencyMs: 0,
          });

          this.options.telemetry?.record({
            traceId,
            type: "fallback_triggered",
            provider: err.provider,
            intent: request.intent,
            metadata: { error: err.error },
          });
        }
      }

      this.options.telemetry?.record({
        traceId,
        type: "model_response",
        provider: result.response.provider,
        intent: request.intent,
        durationMs: latencyMs,
        metadata: {
          success: true,
          model: result.response.model,
          tokenUsage: result.response.tokenUsage,
          fallbackUsed: result.fallbackUsed,
        },
      });

      this.options.onComplete(response);
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      this.options.telemetry?.record({
        traceId,
        type: "model_response",
        intent: request.intent,
        durationMs: Math.round(performance.now() - start),
        metadata: { success: false, error: err.message },
      });

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
export { AdaptiveRouter } from "./adaptive-router.js";
export type { AdaptiveRouterOptions } from "./adaptive-router.js";
