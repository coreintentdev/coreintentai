/**
 * CoreIntent AI — Fallback Engine
 *
 * Executes a task against a chain of providers, falling through on failure.
 * Provides resilience and ensures the system degrades gracefully.
 */

import type { ModelProvider, TokenUsage } from "../types/index.js";
import { getAdapter } from "../models/index.js";
import type { CompletionRequest, CompletionResponse } from "../models/base.js";

export interface FallbackOptions {
  providers: ModelProvider[];
  request: CompletionRequest;
  maxRetries: number;
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
 */
export async function executeWithFallback(
  options: FallbackOptions
): Promise<FallbackResult> {
  const { providers, request, maxRetries, onAttempt, onFailure } = options;

  const attemptedProviders: ModelProvider[] = [];
  const errors: Array<{ provider: ModelProvider; error: string }> = [];

  for (const provider of providers) {
    attemptedProviders.push(provider);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      onAttempt?.(provider, attempt);

      try {
        const adapter = getAdapter(provider);

        // Apply timeout if specified
        const response = request.timeoutMs
          ? await withTimeout(adapter.complete(request), request.timeoutMs)
          : await adapter.complete(request);

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
// Helpers
// ---------------------------------------------------------------------------

function isTransient(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
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
