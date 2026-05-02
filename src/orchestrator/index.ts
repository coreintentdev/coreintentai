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
  ModelProvider,
  OrchestrationRequest,
  OrchestrationResponse,
} from "../types/index.js";
import { getProviderChain } from "./router.js";
import { executeWithFallback } from "./fallback.js";
import { CircuitBreaker, type CircuitBreakerOptions } from "./circuit-breaker.js";
import { AdaptiveRouter, type AdaptiveRouterOptions } from "./adaptive-router.js";
import { Tracer } from "../utils/trace.js";

export interface OrchestratorOptions {
  maxRetries?: number;
  defaultTimeoutMs?: number;
  fallbackEnabled?: boolean;
  circuitBreaker?: Partial<CircuitBreakerOptions> | false;
  adaptiveRouter?: Partial<AdaptiveRouterOptions> | false;
  enableTracing?: boolean;
  onRoute?: (request: OrchestrationRequest, providers: string[]) => void;
  onComplete?: (response: OrchestrationResponse) => void;
  onError?: (error: Error) => void;
}

export class Orchestrator {
  private options: Required<
    Omit<OrchestratorOptions, "circuitBreaker" | "adaptiveRouter">
  > & {
    circuitBreaker: CircuitBreaker | null;
    adaptiveRouter: AdaptiveRouter | null;
  };

  constructor(options: OrchestratorOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 2,
      defaultTimeoutMs: options.defaultTimeoutMs ?? 30_000,
      fallbackEnabled: options.fallbackEnabled ?? true,
      enableTracing: options.enableTracing ?? false,
      circuitBreaker:
        options.circuitBreaker === false
          ? null
          : new CircuitBreaker(
              typeof options.circuitBreaker === "object"
                ? options.circuitBreaker
                : undefined
            ),
      adaptiveRouter:
        options.adaptiveRouter === false
          ? null
          : new AdaptiveRouter(
              typeof options.adaptiveRouter === "object"
                ? options.adaptiveRouter
                : undefined
            ),
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

  async execute(
    request: OrchestrationRequest
  ): Promise<OrchestrationResponse> {
    const tracer = this.options.enableTracing ? new Tracer() : null;
    const rootSpan = tracer?.startSpan("orchestrator.execute", undefined, {
      intent: request.intent,
    });

    let providers: ModelProvider[];
    if (this.options.adaptiveRouter) {
      const route = this.options.adaptiveRouter.resolveRoute(
        request.intent,
        request.preferredProvider
      );
      providers = [route.primary, ...route.fallbacks];
    } else {
      providers = getProviderChain(request.intent, request.preferredProvider);
    }

    const chain = this.options.fallbackEnabled
      ? providers
      : providers.slice(0, 1);

    this.options.onRoute(request, chain);

    const start = performance.now();

    try {
      const fallbackSpan = tracer?.startSpan(
        "fallback.execute",
        rootSpan?.spanId
      );

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

      if (fallbackSpan) {
        tracer!.endSpan(fallbackSpan, "ok", {
          provider: result.response.provider,
          fallbackUsed: result.fallbackUsed,
        });
        fallbackSpan.provider = result.response.provider;
      }

      this.options.adaptiveRouter?.recordOutcome(
        result.response.provider,
        request.intent,
        true,
        result.response.latencyMs
      );

      const failedProviders = new Set(
        result.errors
          .map((entry) => entry.provider)
          .filter((provider) => provider !== result.response.provider)
      );
      for (const provider of failedProviders) {
        this.options.adaptiveRouter?.recordOutcome(
          provider,
          request.intent,
          false,
          this.options.defaultTimeoutMs
        );
      }

      if (rootSpan) tracer!.endSpan(rootSpan, "ok");
      const traceSummary = tracer?.getSummary();

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
          ...(result.response.cacheInfo && {
            cacheInfo: result.response.cacheInfo,
          }),
          ...(traceSummary && { trace: traceSummary }),
        },
      };

      this.options.onComplete(response);
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      for (const provider of chain) {
        this.options.adaptiveRouter?.recordOutcome(
          provider,
          request.intent,
          false,
          this.options.defaultTimeoutMs
        );
      }

      if (rootSpan) tracer!.endSpan(rootSpan, "error");
      this.options.onError(err);
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
export type { AdaptiveRouterOptions } from "./adaptive-router.js";
