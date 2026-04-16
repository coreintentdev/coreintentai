/**
 * CoreIntent AI — Circuit Breaker
 *
 * Prevents hammering providers that are down. Tracks failure rates per provider
 * and temporarily disables providers that exceed the failure threshold.
 *
 * States:
 *   CLOSED   — Normal operation, requests flow through
 *   OPEN     — Provider is down, requests are rejected immediately
 *   HALF_OPEN — Testing if provider has recovered (allows one probe request)
 *
 * This is a core resilience pattern for production trading systems where
 * latency from retrying dead providers can cost real money.
 */

import type { ModelProvider } from "../types/index.js";

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit (default: 3) */
  failureThreshold: number;
  /** Time in ms before an open circuit transitions to half-open (default: 60s) */
  resetTimeoutMs: number;
  /** Number of successes in half-open state before closing (default: 1) */
  halfOpenSuccessThreshold: number;
}

interface ProviderCircuit {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number;
  lastStateChange: number;
  totalFailures: number;
  totalSuccesses: number;
  totalRequests: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  resetTimeoutMs: 60_000,
  halfOpenSuccessThreshold: 1,
};

export class CircuitBreaker {
  private circuits: Map<ModelProvider, ProviderCircuit> = new Map();
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if a provider is available for requests.
   * Transitions OPEN -> HALF_OPEN if the reset timeout has elapsed.
   */
  canRequest(provider: ModelProvider): boolean {
    const circuit = this.getCircuit(provider);

    if (circuit.state === "closed") return true;

    if (circuit.state === "open") {
      const elapsed = Date.now() - circuit.lastFailureTime;
      if (elapsed >= this.config.resetTimeoutMs) {
        // Transition to half-open — allow a probe request
        circuit.state = "half_open";
        circuit.successes = 0;
        circuit.lastStateChange = Date.now();
        return true;
      }
      return false;
    }

    // half_open — allow probe requests
    return true;
  }

  /**
   * Record a successful request. Closes the circuit if enough
   * successes occur in half-open state.
   */
  recordSuccess(provider: ModelProvider): void {
    const circuit = this.getCircuit(provider);
    circuit.totalSuccesses++;
    circuit.totalRequests++;

    if (circuit.state === "half_open") {
      circuit.successes++;
      if (circuit.successes >= this.config.halfOpenSuccessThreshold) {
        circuit.state = "closed";
        circuit.failures = 0;
        circuit.successes = 0;
        circuit.lastStateChange = Date.now();
      }
    } else if (circuit.state === "closed") {
      // Reset consecutive failure counter on success
      circuit.failures = 0;
    }
  }

  /**
   * Record a failed request. Opens the circuit if the failure threshold
   * is exceeded.
   */
  recordFailure(provider: ModelProvider): void {
    const circuit = this.getCircuit(provider);
    circuit.totalFailures++;
    circuit.totalRequests++;
    circuit.lastFailureTime = Date.now();

    if (circuit.state === "half_open") {
      // Failed during probe — back to open
      circuit.state = "open";
      circuit.failures = 0;
      circuit.successes = 0;
      circuit.lastStateChange = Date.now();
    } else if (circuit.state === "closed") {
      circuit.failures++;
      if (circuit.failures >= this.config.failureThreshold) {
        circuit.state = "open";
        circuit.lastStateChange = Date.now();
      }
    }
  }

  /**
   * Get current state for a provider.
   */
  getState(provider: ModelProvider): CircuitState {
    // Trigger any pending state transitions
    this.canRequest(provider);
    return this.getCircuit(provider).state;
  }

  /**
   * Get comprehensive stats for a provider.
   */
  getStats(provider: ModelProvider): {
    state: CircuitState;
    consecutiveFailures: number;
    totalRequests: number;
    totalFailures: number;
    totalSuccesses: number;
    failureRate: number;
  } {
    const circuit = this.getCircuit(provider);
    return {
      state: this.getState(provider),
      consecutiveFailures: circuit.failures,
      totalRequests: circuit.totalRequests,
      totalFailures: circuit.totalFailures,
      totalSuccesses: circuit.totalSuccesses,
      failureRate:
        circuit.totalRequests > 0
          ? circuit.totalFailures / circuit.totalRequests
          : 0,
    };
  }

  /**
   * Filter a provider chain to only include available providers.
   */
  filterAvailable(providers: ModelProvider[]): ModelProvider[] {
    return providers.filter((p) => this.canRequest(p));
  }

  /**
   * Reset a specific provider's circuit to closed state.
   */
  reset(provider: ModelProvider): void {
    this.circuits.delete(provider);
  }

  /**
   * Reset all circuits.
   */
  resetAll(): void {
    this.circuits.clear();
  }

  private getCircuit(provider: ModelProvider): ProviderCircuit {
    if (!this.circuits.has(provider)) {
      this.circuits.set(provider, {
        state: "closed",
        failures: 0,
        successes: 0,
        lastFailureTime: 0,
        lastStateChange: Date.now(),
        totalFailures: 0,
        totalSuccesses: 0,
        totalRequests: 0,
      });
    }
    return this.circuits.get(provider)!;
  }
}
