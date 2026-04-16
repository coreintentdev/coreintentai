/**
 * CoreIntent AI — Fallback Engine
 *
 * Executes a task against a chain of providers, falling through on failure.
 * Provides resilience and ensures the system degrades gracefully.
 *
 * Hardened with:
 * - Circuit breaker integration (skip known-bad providers)
 * - Jittered exponential backoff (prevent thundering herd)
 * - Detailed error classification
 */

import type { ModelProvider, TokenUsage } from "../types/index.js";
import { getAdapter } from "../models/index.js";
import type { CompletionRequest, CompletionResponse } from "../models/base.js";
import { CircuitBreaker } from "../utils/circuit-breaker.js";

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
  skippedProviders: ModelProvider[];
  errors: Array<{ provider: ModelProvider; error: string; category: ErrorCategory }>;
}

export type ErrorCategory =
  | "timeout"
  | "rate_limit"
  | "auth"
  | "server_error"
  | "network"
  | "invalid_response"
  | "unknown";

/**
 * Execute a completion request across a chain of providers.
 * Tries each provider in order. On failure, logs the error and moves
 * to the next provider in the chain.
 *
 * With circuit breaker: providers whose circuits are open are skipped
 * entirely, saving latency. On success/failure, the circuit breaker
 * is updated so future requests benefit from the knowledge.
 */
export async function executeWithFallback(
  options: FallbackOptions
): Promise<FallbackResult> {
  const { providers, request, maxRetries, circuitBreaker, onAttempt, onFailure } = options;

  const attemptedProviders: ModelProvider[] = [];
  const skippedProviders: ModelProvider[] = [];
  const errors: Array<{ provider: ModelProvider; error: string; category: ErrorCategory }> = [];

  // Filter providers through circuit breaker if available
  const availableProviders = circuitBreaker
    ? circuitBreaker.filterAvailable(providers)
    : providers;

  // Track which providers were skipped by the circuit breaker
  for (const p of providers) {
    if (!availableProviders.includes(p)) {
      skippedProviders.push(p);
    }
  }

  for (const provider of availableProviders) {
    attemptedProviders.push(provider);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      onAttempt?.(provider, attempt);

      try {
        const adapter = getAdapter(provider);

        // Apply timeout if specified
        const response = request.timeoutMs
          ? await withTimeout(adapter.complete(request), request.timeoutMs)
          : await adapter.complete(request);

        // Record success with circuit breaker
        circuitBreaker?.recordSuccess(provider);

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
        const category = classifyError(error);

        onFailure?.(provider, error);
        errors.push({ provider, error: error.message, category });

        // Record failure with circuit breaker
        circuitBreaker?.recordFailure(provider);

        // Only retry on the same provider for transient errors
        if (!isTransient(error) || attempt === maxRetries) {
          break;
        }

        // Jittered exponential backoff between retries on same provider
        // Base: 1s, 2s, 4s, 8s cap. Jitter: ±25% to prevent thundering herd.
        const baseDelay = Math.min(1000 * 2 ** (attempt - 1), 8000);
        const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1); // ±25%
        await sleep(baseDelay + jitter);
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

function isTransient(error: Error): boolean {
  const category = classifyError(error);
  return (
    category === "timeout" ||
    category === "rate_limit" ||
    category === "server_error" ||
    category === "network"
  );
}

function classifyError(error: Error): ErrorCategory {
  const msg = error.message.toLowerCase();

  if (msg.includes("timeout") || msg.includes("timed out")) return "timeout";
  if (msg.includes("rate limit") || msg.includes("429") || msg.includes("too many requests")) return "rate_limit";
  if (msg.includes("401") || msg.includes("403") || msg.includes("unauthorized") || msg.includes("forbidden") || msg.includes("invalid api key")) return "auth";
  if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("internal server error") || msg.includes("service unavailable")) return "server_error";
  if (msg.includes("econnreset") || msg.includes("econnrefused") || msg.includes("socket hang up") || msg.includes("network") || msg.includes("dns")) return "network";
  if (msg.includes("json") || msg.includes("parse") || msg.includes("unexpected token")) return "invalid_response";

  return "unknown";
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
    category?: ErrorCategory;
  }>;

  constructor(
    message: string,
    providerErrors: Array<{ provider: ModelProvider; error: string; category?: ErrorCategory }>
  ) {
    super(message);
    this.name = "CoreIntentAIError";
    this.providerErrors = providerErrors;
  }
}
