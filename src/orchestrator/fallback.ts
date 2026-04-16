/**
 * CoreIntent AI — Fallback Engine
 *
 * Executes a task against a chain of providers, falling through on failure.
 * Integrates with the circuit breaker to skip providers that are known to be
 * down, and provides resilience via retries with exponential backoff.
 */

import type { ModelProvider, TokenUsage } from "../types/index.js";
import { getAdapter } from "../models/index.js";
import type { CompletionRequest, CompletionResponse } from "../models/base.js";
import { CircuitBreaker } from "./circuit-breaker.js";

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
  errors: Array<{ provider: ModelProvider; error: string }>;
}

/**
 * Execute a completion request across a chain of providers.
 * Tries each provider in order. On failure, logs the error and moves
 * to the next provider in the chain.
 *
 * When a circuit breaker is provided, providers whose circuits are OPEN
 * are skipped (unless all providers are down — then we try the first anyway).
 */
export async function executeWithFallback(
  options: FallbackOptions
): Promise<FallbackResult> {
  const { providers, request, maxRetries, circuitBreaker, onAttempt, onFailure } =
    options;

  // Filter out providers with open circuits
  const chain = circuitBreaker
    ? circuitBreaker.filterAvailable(providers)
    : providers;

  const attemptedProviders: ModelProvider[] = [];
  const errors: Array<{ provider: ModelProvider; error: string }> = [];

  for (const provider of chain) {
    attemptedProviders.push(provider);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      onAttempt?.(provider, attempt);

      try {
        const adapter = getAdapter(provider);

        // Apply timeout if specified
        const response = request.timeoutMs
          ? await withTimeout(adapter.complete(request), request.timeoutMs)
          : await adapter.complete(request);

        // Success — record it and return
        circuitBreaker?.recordSuccess(provider);

        return {
          response,
          fallbackUsed: attemptedProviders.length > 1,
          attemptedProviders,
          errors,
        };
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error(String(err));

        onFailure?.(provider, error);
        errors.push({ provider, error: error.message });

        // Only retry on the same provider for transient errors
        if (!isTransient(error) || attempt === maxRetries) {
          // Record the failure with the circuit breaker
          circuitBreaker?.recordFailure(provider);
          break;
        }

        // Exponential backoff between retries on same provider
        await sleep(Math.min(1000 * 2 ** (attempt - 1), 8000));
      }
    }
  }

  throw new CoreIntentAIError(
    `All providers failed: ${errors.map((e) => `${e.provider}: ${e.error}`).join("; ")}`,
    errors
  );
}

// ---------------------------------------------------------------------------
// Transient Error Detection
// ---------------------------------------------------------------------------

/** Substring patterns that indicate a transient (retryable) failure. */
const TRANSIENT_SUBSTRINGS = [
  "timeout",
  "timed out",
  "rate limit",
  "econnreset",
  "econnrefused",
  "enotfound",
  "epipe",
  "ehostunreach",
  "enetunreach",
  "socket hang up",
  "network error",
  "fetch failed",
  "aborted",
  "econnaborted",
  "service unavailable",
  "overloaded",
  "capacity",
] as const;

/**
 * Regex patterns for HTTP status codes — use word boundaries to avoid
 * matching codes embedded in larger numbers (e.g. "4500 tokens").
 */
const TRANSIENT_CODE_PATTERNS = [
  /\b429\b/,
  /\b500\b/,
  /\b502\b/,
  /\b503\b/,
] as const;

export function isTransient(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return (
    TRANSIENT_SUBSTRINGS.some((pattern) => msg.includes(pattern)) ||
    TRANSIENT_CODE_PATTERNS.some((rx) => rx.test(msg))
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
