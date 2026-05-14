import type { ModelProvider } from "../types/index.js";

export type ErrorCategory =
  | "transient"
  | "rate_limit"
  | "auth"
  | "timeout"
  | "validation"
  | "provider_error"
  | "network"
  | "unknown";

export interface ClassifiedError {
  category: ErrorCategory;
  retryable: boolean;
  provider?: ModelProvider;
  statusCode?: number;
  message: string;
  originalError: Error;
}

const PATTERNS: Array<{
  test: (msg: string, err: Error) => boolean;
  category: ErrorCategory;
  retryable: boolean;
}> = [
  {
    test: (msg) =>
      msg.includes("rate limit") ||
      msg.includes("429") ||
      msg.includes("too many requests") ||
      msg.includes("quota exceeded"),
    category: "rate_limit",
    retryable: true,
  },
  {
    test: (msg) =>
      msg.includes("timed out") ||
      msg.includes("timeout") ||
      msg.includes("deadline exceeded") ||
      msg.includes("aborted"),
    category: "timeout",
    retryable: true,
  },
  {
    test: (msg) =>
      msg.includes("econnreset") ||
      msg.includes("econnrefused") ||
      msg.includes("socket hang up") ||
      msg.includes("network") ||
      msg.includes("fetch failed") ||
      msg.includes("dns") ||
      msg.includes("enotfound"),
    category: "network",
    retryable: true,
  },
  {
    test: (msg) =>
      msg.includes("502") ||
      msg.includes("503") ||
      msg.includes("504") ||
      msg.includes("bad gateway") ||
      msg.includes("service unavailable"),
    category: "transient",
    retryable: true,
  },
  {
    test: (msg) =>
      msg.includes("401") ||
      msg.includes("403") ||
      msg.includes("unauthorized") ||
      msg.includes("forbidden") ||
      msg.includes("invalid api key") ||
      msg.includes("authentication"),
    category: "auth",
    retryable: false,
  },
  {
    test: (msg) =>
      msg.includes("400") ||
      msg.includes("422") ||
      msg.includes("invalid") ||
      msg.includes("malformed"),
    category: "validation",
    retryable: false,
  },
  {
    test: (msg) =>
      msg.includes("500") ||
      msg.includes("internal server error"),
    category: "provider_error",
    retryable: true,
  },
];

export function classifyError(
  error: Error,
  provider?: ModelProvider
): ClassifiedError {
  const msg = error.message.toLowerCase();

  for (const pattern of PATTERNS) {
    if (pattern.test(msg, error)) {
      const statusMatch = error.message.match(/\b(\d{3})\b/);
      return {
        category: pattern.category,
        retryable: pattern.retryable,
        provider,
        statusCode: statusMatch ? parseInt(statusMatch[1], 10) : undefined,
        message: error.message,
        originalError: error,
      };
    }
  }

  return {
    category: "unknown",
    retryable: false,
    provider,
    message: error.message,
    originalError: error,
  };
}

export function getRetryDelay(
  classified: ClassifiedError,
  attempt: number
): number {
  const baseDelays: Record<ErrorCategory, number> = {
    rate_limit: 2000,
    timeout: 1000,
    network: 1500,
    transient: 1000,
    provider_error: 2000,
    auth: 0,
    validation: 0,
    unknown: 0,
  };

  const base = baseDelays[classified.category];
  if (base === 0) return 0;

  const exponential = base * 2 ** (attempt - 1);
  const capped = Math.min(exponential, 16_000);
  const jitter = Math.random() * capped * 0.3;
  return capped + jitter;
}

export function shouldOpenCircuit(classified: ClassifiedError): boolean {
  return classified.category !== "auth" && classified.category !== "validation";
}
