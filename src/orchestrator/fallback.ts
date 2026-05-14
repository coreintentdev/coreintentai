/**
 * CoreIntent AI — Fallback Engine
 *
 * Executes a task against a chain of providers, falling through on failure.
 * Provides resilience and ensures the system degrades gracefully.
 */

import type { ModelProvider, TokenUsage } from "../types/index.js";
import { getAdapter } from "../models/index.js";
import type { CompletionRequest, CompletionResponse } from "../models/base.js";
import type { CircuitBreaker } from "./circuit-breaker.js";
import {
  classifyError,
  getRetryDelay,
  shouldOpenCircuit,
  type ClassifiedError,
} from "./errors.js";

export interface FallbackOptions {
  providers: ModelProvider[];
  request: CompletionRequest;
  maxRetries: number;
  circuitBreaker?: CircuitBreaker;
  onAttempt?: (provider: ModelProvider, attempt: number) => void;
  onFailure?: (provider: ModelProvider, error: Error) => void;
}

export interface FallbackResult {
  response: CompletionResponse;
  fallbackUsed: boolean;
  attemptedProviders: ModelProvider[];
  errors: Array<{ provider: ModelProvider; error: string; category?: string }>;
}

/**
 * Execute a completion request across a chain of providers.
 * Tries each provider in order. On failure, logs the error and moves
 * to the next provider in the chain.
 */
export async function executeWithFallback(
  options: FallbackOptions
): Promise<FallbackResult> {
  const { providers, request, maxRetries, circuitBreaker, onAttempt, onFailure } = options;

  const chain = circuitBreaker
    ? circuitBreaker.rankProviders(providers)
    : providers;

  const attemptedProviders: ModelProvider[] = [];
  const errors: Array<{ provider: ModelProvider; error: string; category?: string }> = [];

  for (const provider of chain) {
    if (circuitBreaker && !circuitBreaker.canAttempt(provider)) {
      errors.push({ provider, error: "circuit open", category: "circuit_open" });
      continue;
    }

    attemptedProviders.push(provider);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      onAttempt?.(provider, attempt);

      try {
        const adapter = getAdapter(provider);
        const start = performance.now();

        // Apply timeout if specified
        const response = request.timeoutMs
          ? await withTimeout(adapter.complete(request), request.timeoutMs)
          : await adapter.complete(request);

        circuitBreaker?.recordSuccess(provider, Math.round(performance.now() - start));

        return {
          response,
          fallbackUsed: attemptedProviders.length > 1,
          attemptedProviders,
          errors,
        };
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error(String(err));
        const classified = classifyError(error, provider);

        onFailure?.(provider, error);
        if (shouldOpenCircuit(classified)) {
          circuitBreaker?.recordFailure(provider);
        }
        errors.push({ provider, error: error.message, category: classified.category });

        if (!classified.retryable || attempt === maxRetries) {
          break;
        }

        const delay = getRetryDelay(classified, attempt);
        if (delay > 0) await sleep(delay);
      }
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
