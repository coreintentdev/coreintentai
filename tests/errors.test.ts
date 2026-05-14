import { describe, it, expect } from "vitest";
import {
  classifyError,
  getRetryDelay,
  shouldOpenCircuit,
} from "../src/orchestrator/errors.js";

describe("Error Classification", () => {
  describe("classifyError", () => {
    it("classifies rate limit errors", () => {
      const err = new Error("Rate limit exceeded (429)");
      const classified = classifyError(err, "claude");
      expect(classified.category).toBe("rate_limit");
      expect(classified.retryable).toBe(true);
      expect(classified.provider).toBe("claude");
      expect(classified.statusCode).toBe(429);
    });

    it("classifies timeout errors", () => {
      const err = new Error("Request timed out after 30000ms");
      const classified = classifyError(err);
      expect(classified.category).toBe("timeout");
      expect(classified.retryable).toBe(true);
    });

    it("classifies network errors", () => {
      const variants = [
        "ECONNRESET",
        "ECONNREFUSED",
        "socket hang up",
        "fetch failed",
        "DNS resolution failed (ENOTFOUND)",
      ];

      for (const msg of variants) {
        const classified = classifyError(new Error(msg));
        expect(classified.category).toBe("network");
        expect(classified.retryable).toBe(true);
      }
    });

    it("classifies transient server errors", () => {
      const variants = [
        "502 Bad Gateway",
        "503 Service Unavailable",
        "504 Gateway Timeout",
      ];

      for (const msg of variants) {
        const classified = classifyError(new Error(msg));
        expect(classified.retryable).toBe(true);
      }
    });

    it("classifies auth errors as non-retryable", () => {
      const err = new Error("401 Unauthorized: Invalid API key");
      const classified = classifyError(err, "grok");
      expect(classified.category).toBe("auth");
      expect(classified.retryable).toBe(false);
      expect(classified.provider).toBe("grok");
    });

    it("classifies validation errors as non-retryable", () => {
      const err = new Error("400 Bad Request: malformed JSON");
      const classified = classifyError(err);
      expect(classified.category).toBe("validation");
      expect(classified.retryable).toBe(false);
    });

    it("classifies unknown errors as non-retryable", () => {
      const err = new Error("Something completely unexpected");
      const classified = classifyError(err);
      expect(classified.category).toBe("unknown");
      expect(classified.retryable).toBe(false);
    });

    it("preserves original error reference", () => {
      const err = new Error("timeout");
      const classified = classifyError(err);
      expect(classified.originalError).toBe(err);
    });

    it("extracts status codes from error messages", () => {
      const err = new Error("HTTP 503 Service Unavailable");
      const classified = classifyError(err);
      expect(classified.statusCode).toBe(503);
    });
  });

  describe("getRetryDelay", () => {
    it("returns 0 for non-retryable errors", () => {
      const classified = classifyError(new Error("401 Unauthorized"));
      expect(getRetryDelay(classified, 1)).toBe(0);
    });

    it("returns increasing delays with exponential backoff", () => {
      const classified = classifyError(new Error("timeout"));
      const delay1 = getRetryDelay(classified, 1);
      const delay2 = getRetryDelay(classified, 2);
      const delay3 = getRetryDelay(classified, 3);

      // Each should be roughly double the previous (plus jitter)
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it("uses longer base delay for rate limits than timeouts", () => {
      const rateLimit = classifyError(new Error("rate limit"));
      const timeout = classifyError(new Error("timeout"));

      // Sample multiple times to account for jitter
      const rateLimitDelays = Array.from({ length: 20 }, () => getRetryDelay(rateLimit, 1));
      const timeoutDelays = Array.from({ length: 20 }, () => getRetryDelay(timeout, 1));

      const avgRateLimit = rateLimitDelays.reduce((a, b) => a + b) / 20;
      const avgTimeout = timeoutDelays.reduce((a, b) => a + b) / 20;

      expect(avgRateLimit).toBeGreaterThan(avgTimeout);
    });

    it("caps delay at 16 seconds", () => {
      const classified = classifyError(new Error("timeout"));
      const delay = getRetryDelay(classified, 10);
      expect(delay).toBeLessThanOrEqual(16_000 * 1.3); // Max + max jitter
    });
  });

  describe("shouldOpenCircuit", () => {
    it("returns true for transient errors", () => {
      expect(shouldOpenCircuit(classifyError(new Error("timeout")))).toBe(true);
      expect(shouldOpenCircuit(classifyError(new Error("503")))).toBe(true);
      expect(shouldOpenCircuit(classifyError(new Error("ECONNRESET")))).toBe(true);
    });

    it("returns false for auth errors", () => {
      expect(shouldOpenCircuit(classifyError(new Error("401 Unauthorized")))).toBe(false);
    });

    it("returns false for validation errors", () => {
      expect(shouldOpenCircuit(classifyError(new Error("400 Bad Request")))).toBe(false);
    });
  });
});
