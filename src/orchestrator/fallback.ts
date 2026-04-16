/**
 * CoreIntent AI — Fallback Engine
 *
 * Executes a task against a chain of providers, falling through on failure.
 * Integrates circuit breaker for resilience and health tracking for
 * adaptive routing.
 */

import type { ModelProvider, TokenUsage } from "../types/index.js";
import { getAdapter } from "../models/index.js";
import type { CompletionRequest, CompletionResponse } from "../models/base.js";
import { CircuitBreaker } from "./circuit-breaker.js";
import { HealthTracker } from "./health.js";

export interface FallbackOptions {
  providers: ModelProvider[];
  request: CompletionRequest;
  maxRetries: number;
  circuitBreaker?: CircuitBreaker;
  healthTracker?: HealthTracker;
  onAttempt?: (provider: ModelProvider, attempt: number) => void;
  onFailure?: (provider: ModelProvider, error: Error) => void;
}

export interface FallbackResult {
  response: CompletionResponse;
  fallbackUsed: boolean;
  attemptedProviders: ModelProvider[];
  skippedProviders: ModelProvider[];
  errors: Array<{ provider: ModelProvider; error: string }>;
}

/**
 * Execute a completion request across a chain of providers.
 * Checks circuit breakers before attempting each provider.
 * Records health metrics after every attempt.
 */
export async function executeWithFallback(
  options: FallbackOptions
): Promise<FallbackResult> {
  const {
    providers,
    request,
    maxRetries,
    circuitBreaker,
    healthTracker,
    onAttempt,
    onFailure,
  } = options;

  const attemptedProviders: ModelProvider[] = [];
  const skippedProviders: ModelProvider[] = [];
  const errors: Array<{ provider: ModelProvider; error: string }> = [];

  for (const provider of providers) {
    // Circuit breaker check — skip providers that are down
    if (circuitBreaker && !circuitBreaker.canRequest(provider)) {
      skippedProviders.push(provider);
      errors.push({
        provider,
        error: "Circuit breaker open — provider temporarily disabled",
      });
      continue;
    }

    attemptedProviders.push(provider);
    let providerFailed = false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      onAttempt?.(provider, attempt);

      try {
        const adapter = getAdapter(provider);
        const start = performance.now();

        // Apply timeout if specified
        const response = request.timeoutMs
          ? await withTimeout(adapter.complete(request), request.timeoutMs)
          : await adapter.complete(request);

        const latency = performance.now() - start;

        // Record success in circuit breaker and health tracker
        circuitBreaker?.recordSuccess(provider);
        healthTracker?.recordSuccess(provider, latency);

        return {
          response,
          fallbackUsed: attemptedProviders.length > 1 || skippedProviders.length > 0,
          attemptedProviders,
          skippedProviders,
          errors,
        };
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error(String(err));

        onFailure?.(provider, error);
        errors.push({ provider, error: error.message });

        // Track failed attempts for observability.
        healthTracker?.recordError(provider);
        providerFailed = true;

        // Only retry on the same provider for transient errors
        if (!isTransient(error) || attempt === maxRetries) {
          break;
        }

        // Exponential backoff between retries on same provider
        await sleep(Math.min(1000 * 2 ** (attempt - 1), 8000));
      }
    }

    // Circuit breaker tracks provider-level request outcomes, not per-attempt retries.
    if (providerFailed) {
      circuitBreaker?.recordFailure(provider);
    }
  }

  throw new CoreIntentAIError(
    `All providers failed: ${errors.map((e) => `${e.provider}: ${e.error}`).join("; ")}`,
    errors
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isTransient(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("rate limit") ||
    msg.includes("429") ||
    msg.includes("503") ||
    msg.includes("econnreset") ||
    msg.includes("socket hang up")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Request timed out after ${ms}ms`)),
      ms
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export class CoreIntentAIError extends Error {
  public readonly providerErrors: Array<{
    provider: ModelProvider;
    error: string;
  }>;

  constructor(
    message: string,
    providerErrors: Array<{ provider: ModelProvider; error: string }>
  ) {
    super(message);
    this.name = "CoreIntentAIError";
    this.providerErrors = providerErrors;
  }
}
