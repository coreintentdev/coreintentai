import type {
  OrchestrationRequest,
  OrchestrationResponse,
} from "../types/index.js";
import { getProviderChain } from "./router.js";
import { executeWithFallback, CoreIntentAIError } from "./fallback.js";
import {
  CircuitBreaker,
  type CircuitBreakerOptions,
} from "./circuit-breaker.js";
import type { Telemetry } from "../telemetry/index.js";
import type { AdaptiveRouter } from "./adaptive-router.js";

export interface OrchestratorOptions {
  maxRetries?: number;
  defaultTimeoutMs?: number;
  fallbackEnabled?: boolean;
  circuitBreaker?: Partial<CircuitBreakerOptions> | false;
  telemetry?: Telemetry;
  adaptiveRouter?: AdaptiveRouter;
  enableCaching?: boolean;
  enableThinking?: boolean;
  thinkingBudget?: number;
  onRoute?: (request: OrchestrationRequest, providers: string[]) => void;
  onComplete?: (response: OrchestrationResponse) => void;
  onError?: (error: Error) => void;
}

export class Orchestrator {
  private options: Required<
    Omit<
      OrchestratorOptions,
      | "circuitBreaker"
      | "telemetry"
      | "adaptiveRouter"
      | "enableCaching"
      | "enableThinking"
      | "thinkingBudget"
    >
  > & {
    circuitBreaker: CircuitBreaker | null;
    telemetry: Telemetry | null;
    adaptiveRouter: AdaptiveRouter | null;
    enableCaching: boolean;
    enableThinking: boolean;
    thinkingBudget: number;
  };

  constructor(options: OrchestratorOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 2,
      defaultTimeoutMs: options.defaultTimeoutMs ?? 30_000,
      fallbackEnabled: options.fallbackEnabled ?? true,
      circuitBreaker:
        options.circuitBreaker === false
          ? null
          : new CircuitBreaker(
              typeof options.circuitBreaker === "object"
                ? options.circuitBreaker
                : undefined
            ),
      telemetry: options.telemetry ?? null,
      adaptiveRouter: options.adaptiveRouter ?? null,
      enableCaching: options.enableCaching ?? false,
      enableThinking: options.enableThinking ?? false,
      thinkingBudget: options.thinkingBudget ?? 8000,
      onRoute: options.onRoute ?? (() => {}),
      onComplete: options.onComplete ?? (() => {}),
      onError: options.onError ?? (() => {}),
    };
  }

  getCircuitBreaker(): CircuitBreaker | null {
    return this.options.circuitBreaker;
  }

  getTelemetry(): Telemetry | null {
    return this.options.telemetry;
  }

  getAdaptiveRouter(): AdaptiveRouter | null {
    return this.options.adaptiveRouter;
  }

  async execute(
    request: OrchestrationRequest
  ): Promise<OrchestrationResponse> {
    const providers = this.options.adaptiveRouter
      ? this.options.adaptiveRouter.getOptimizedChain(
          request.intent,
          request.preferredProvider
        )
      : getProviderChain(request.intent, request.preferredProvider);

    const chain = this.options.fallbackEnabled
      ? providers
      : providers.slice(0, 1);

    this.options.onRoute(request, chain);

    const start = performance.now();
    const tel = this.options.telemetry;
    const requestId = tel?.generateRequestId();

    if (tel && requestId) {
      tel.emit("request_start", {
        requestId,
        provider: chain[0],
        intent: request.intent,
        timestamp: Date.now(),
      });
    }

    try {
      const result = await executeWithFallback({
        providers: chain,
        request: {
          systemPrompt: request.systemPrompt,
          prompt: request.prompt,
          timeoutMs: request.timeoutMs ?? this.options.defaultTimeoutMs,
          enableCaching: this.options.enableCaching,
          enableThinking: this.options.enableThinking,
          thinkingBudget: this.options.thinkingBudget,
        },
        maxRetries: request.maxRetries ?? this.options.maxRetries,
        circuitBreaker: this.options.circuitBreaker ?? undefined,
      });

      const latencyMs = Math.round(performance.now() - start);

      if (tel && requestId) {
        const costUsd = tel.calculateCost(
          result.response.provider,
          result.response.tokenUsage,
          result.response.cacheMetrics
        );

        tel.emit("request_complete", {
          requestId,
          provider: result.response.provider,
          intent: request.intent,
          latencyMs,
          tokenUsage: result.response.tokenUsage,
          costUsd,
          cached: !!result.response.cacheMetrics?.cacheReadInputTokens,
          timestamp: Date.now(),
        });

        if (result.response.cacheMetrics?.cacheReadInputTokens) {
          const fullCost = tel.calculateCost(
            result.response.provider,
            result.response.tokenUsage
          );
          tel.emit("cache_hit", {
            provider: result.response.provider,
            cacheReadTokens:
              result.response.cacheMetrics.cacheReadInputTokens,
            cacheCreationTokens:
              result.response.cacheMetrics.cacheCreationInputTokens,
            estimatedSavingsUsd: fullCost - costUsd,
            timestamp: Date.now(),
          });
        }
      }

      if (this.options.adaptiveRouter) {
        // Record failures for providers that failed before the successful one
        for (const err of result.errors) {
          this.options.adaptiveRouter.recordOutcome(
            request.intent,
            err.provider,
            { success: false, latencyMs: 0, costUsd: 0 }
          );
        }

        const costUsd = tel
          ? tel.calculateCost(
              result.response.provider,
              result.response.tokenUsage,
              result.response.cacheMetrics
            )
          : 0;

        this.options.adaptiveRouter.recordOutcome(
          request.intent,
          result.response.provider,
          { success: true, latencyMs, costUsd }
        );
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
          ...(result.response.thinking
            ? { thinking: result.response.thinking }
            : {}),
          ...(result.response.cacheMetrics
            ? { cacheMetrics: result.response.cacheMetrics }
            : {}),
        },
      };

      this.options.onComplete(response);
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (tel && requestId) {
        tel.emit("request_error", {
          requestId,
          provider: chain[0],
          intent: request.intent,
          error: err.message,
          transient: false,
          timestamp: Date.now(),
        });
      }

      if (this.options.adaptiveRouter) {
        // Record failures for all providers that were attempted
        const failedProviders =
          error instanceof CoreIntentAIError
            ? error.providerErrors.map((e) => e.provider)
            : [chain[0]];

        for (const provider of failedProviders) {
          this.options.adaptiveRouter.recordOutcome(
            request.intent,
            provider,
            {
              success: false,
              latencyMs: Math.round(performance.now() - start),
              costUsd: 0,
            }
          );
        }
      }

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
export type {
  CircuitState,
  CircuitBreakerOptions,
} from "./circuit-breaker.js";
export { AdaptiveRouter } from "./adaptive-router.js";
export type {
  ProviderScore,
  AdaptiveRouterOptions,
} from "./adaptive-router.js";
