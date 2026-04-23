/**
 * CoreIntent AI — Circuit Breaker
 *
 * Prevents hammering failing providers. Implements the standard three-state
 * circuit breaker pattern:
 *
 *   CLOSED  → Normal operation. Failures increment a counter.
 *   OPEN    → Provider is down. All requests fail-fast without attempting.
 *   HALF_OPEN → After a cooldown, allow one probe request through.
 *              If it succeeds → CLOSED. If it fails → back to OPEN.
 *
 * Each provider gets its own independent breaker. The orchestrator checks
 * the breaker before attempting a provider, skipping it if the circuit is open.
 *
 * Why this matters for trading:
 *   - During market hours, latency is critical. Waiting 30s for a timeout
 *     on a dead provider is unacceptable.
 *   - Circuit breakers let the system instantly fall through to the next
 *     provider, keeping total latency under control.
 */

import type { ModelProvider } from "../types/index.js";

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before the circuit opens. Default: 3 */
  failureThreshold: number;
  /** How long (ms) the circuit stays open before probing. Default: 60_000 */
  resetTimeoutMs: number;
  /** Sliding window (ms) for counting failures. Failures outside this window don't count. Default: 120_000 */
  failureWindowMs: number;
}

interface BreakerState {
  state: CircuitState;
  failures: number[];
  lastFailure: number;
  openedAt: number;
  successCount: number;
  totalRequests: number;
  totalFailures: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  resetTimeoutMs: 60_000,
  failureWindowMs: 120_000,
};

export class CircuitBreakerRegistry {
  private breakers = new Map<ModelProvider, BreakerState>();
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private getBreaker(provider: ModelProvider): BreakerState {
    let breaker = this.breakers.get(provider);
    if (!breaker) {
      breaker = {
        state: "closed",
        failures: [],
        lastFailure: 0,
        openedAt: 0,
        successCount: 0,
        totalRequests: 0,
        totalFailures: 0,
      };
      this.breakers.set(provider, breaker);
    }
    return breaker;
  }

  /**
   * Check if a provider is available for requests.
   * Returns true if the circuit is closed or half-open (probe allowed).
   */
  canAttempt(provider: ModelProvider): boolean {
    const breaker = this.getBreaker(provider);

    switch (breaker.state) {
      case "closed":
        return true;

      case "open": {
        const elapsed = Date.now() - breaker.openedAt;
        if (elapsed >= this.config.resetTimeoutMs) {
          breaker.state = "half_open";
          return true;
        }
        return false;
      }

      case "half_open":
        return true;
    }
  }

  /**
   * Record a successful request. Resets the breaker to closed.
   */
  recordSuccess(provider: ModelProvider): void {
    const breaker = this.getBreaker(provider);
    breaker.successCount++;
    breaker.totalRequests++;
    breaker.state = "closed";
    breaker.failures = [];
  }

  /**
   * Record a failed request. May trip the breaker open.
   */
  recordFailure(provider: ModelProvider): void {
    const breaker = this.getBreaker(provider);
    const now = Date.now();

    breaker.totalRequests++;
    breaker.totalFailures++;
    breaker.lastFailure = now;

    // Prune failures outside the sliding window
    const windowStart = now - this.config.failureWindowMs;
    breaker.failures = breaker.failures.filter((t) => t >= windowStart);
    breaker.failures.push(now);

    if (breaker.state === "half_open") {
      // Probe failed — reopen the circuit
      breaker.state = "open";
      breaker.openedAt = now;
      return;
    }

    if (breaker.failures.length >= this.config.failureThreshold) {
      breaker.state = "open";
      breaker.openedAt = now;
    }
  }

  /**
   * Get the current state of a provider's circuit.
   */
  getState(provider: ModelProvider): CircuitState {
    // Trigger the open→half_open transition check
    this.canAttempt(provider);
    return this.getBreaker(provider).state;
  }

  /**
   * Get full stats for a provider.
   */
  getStats(provider: ModelProvider): {
    state: CircuitState;
    recentFailures: number;
    successCount: number;
    totalRequests: number;
    totalFailures: number;
    failureRate: number;
  } {
    const breaker = this.getBreaker(provider);
    const now = Date.now();
    const windowStart = now - this.config.failureWindowMs;
    const recentFailures = breaker.failures.filter((t) => t >= windowStart).length;

    return {
      state: this.getState(provider),
      recentFailures,
      successCount: breaker.successCount,
      totalRequests: breaker.totalRequests,
      totalFailures: breaker.totalFailures,
      failureRate:
        breaker.totalRequests > 0
          ? breaker.totalFailures / breaker.totalRequests
          : 0,
    };
  }

  /**
   * Force-reset a provider's circuit to closed.
   */
  reset(provider: ModelProvider): void {
    this.breakers.delete(provider);
  }

  /**
   * Reset all breakers.
   */
  resetAll(): void {
    this.breakers.clear();
  }

  /**
   * Get a snapshot of all provider states (useful for dashboards).
   */
  snapshot(): Record<ModelProvider, { state: CircuitState; failureRate: number }> {
    const providers: ModelProvider[] = ["claude", "grok", "perplexity"];
    const result = {} as Record<ModelProvider, { state: CircuitState; failureRate: number }>;

    for (const p of providers) {
      const stats = this.getStats(p);
      result[p] = { state: stats.state, failureRate: stats.failureRate };
    }

    return result;
  }
}
