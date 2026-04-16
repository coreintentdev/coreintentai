/**
 * CoreIntent AI — Circuit Breaker
 *
 * Prevents cascading failures by tracking provider health and temporarily
 * disabling providers that are consistently failing. Based on the classic
 * circuit breaker pattern:
 *
 *   CLOSED (normal) → failures exceed threshold → OPEN (blocking)
 *   OPEN → cooldown expires → HALF_OPEN (test one request)
 *   HALF_OPEN → success → CLOSED | failure → OPEN
 *
 * Why this matters for trading AI:
 * - API providers go down. When xAI rate-limits you, don't waste 30s per
 *   request timing out — skip it and fall through to Claude immediately.
 * - Each failed attempt burns latency. In trading, latency = money.
 * - Circuit breakers make the fallback engine faster under degraded conditions.
 */

import type { ModelProvider } from "../types/index.js";

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit. Default: 3 */
  failureThreshold: number;
  /** How long to keep the circuit open before testing again (ms). Default: 60s */
  cooldownMs: number;
  /** Number of successes in half-open state before fully closing. Default: 2 */
  successThreshold: number;
  /** Time window for counting failures (ms). Old failures expire. Default: 120s */
  failureWindowMs: number;
}

interface ProviderCircuit {
  state: CircuitState;
  failures: number[];        // timestamps of recent failures
  consecutiveSuccesses: number;
  lastStateChange: number;
  totalFailures: number;
  totalSuccesses: number;
  totalRequests: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  cooldownMs: 60_000,
  successThreshold: 2,
  failureWindowMs: 120_000,
};

export class CircuitBreaker {
  private circuits = new Map<ModelProvider, ProviderCircuit>();
  private config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if a provider is available (circuit not open).
   */
  isAvailable(provider: ModelProvider): boolean {
    const circuit = this.getCircuit(provider);

    if (circuit.state === "closed") return true;

    if (circuit.state === "open") {
      // Check if cooldown has elapsed — transition to half-open
      if (Date.now() - circuit.lastStateChange >= this.config.cooldownMs) {
        this.transition(provider, "half_open");
        return true; // allow one test request
      }
      return false;
    }

    // half_open — allow requests (we're testing)
    return true;
  }

  /**
   * Record a successful request to a provider.
   */
  recordSuccess(provider: ModelProvider): void {
    const circuit = this.getCircuit(provider);
    circuit.totalSuccesses++;
    circuit.totalRequests++;

    if (circuit.state === "half_open") {
      circuit.consecutiveSuccesses++;
      if (circuit.consecutiveSuccesses >= this.config.successThreshold) {
        this.transition(provider, "closed");
      }
    } else if (circuit.state === "closed") {
      // Reset failure tracking on success in closed state
      circuit.consecutiveSuccesses++;
    }
  }

  /**
   * Record a failed request to a provider.
   */
  recordFailure(provider: ModelProvider): void {
    const circuit = this.getCircuit(provider);
    const now = Date.now();

    circuit.totalFailures++;
    circuit.totalRequests++;
    circuit.consecutiveSuccesses = 0;

    if (circuit.state === "half_open") {
      // Any failure in half-open state reopens the circuit
      this.transition(provider, "open");
      return;
    }

    // Add failure timestamp and prune old ones
    circuit.failures.push(now);
    circuit.failures = circuit.failures.filter(
      (t) => now - t < this.config.failureWindowMs
    );

    if (
      circuit.state === "closed" &&
      circuit.failures.length >= this.config.failureThreshold
    ) {
      this.transition(provider, "open");
    }
  }

  /**
   * Get the current state of all circuits.
   */
  getStatus(): Record<
    string,
    {
      state: CircuitState;
      recentFailures: number;
      totalRequests: number;
      successRate: number;
    }
  > {
    const status: Record<string, {
      state: CircuitState;
      recentFailures: number;
      totalRequests: number;
      successRate: number;
    }> = {};

    for (const [provider, circuit] of this.circuits) {
      status[provider] = {
        state: circuit.state,
        recentFailures: circuit.failures.length,
        totalRequests: circuit.totalRequests,
        successRate:
          circuit.totalRequests > 0
            ? circuit.totalSuccesses / circuit.totalRequests
            : 1,
      };
    }

    return status;
  }

  /**
   * Get circuit state for a specific provider.
   */
  getState(provider: ModelProvider): CircuitState {
    return this.getCircuit(provider).state;
  }

  /**
   * Manually reset a provider's circuit to closed.
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

  /**
   * Filter a provider chain to only available providers.
   * Returns at least the last provider even if all circuits are open
   * (better to try something than nothing).
   */
  filterAvailable(providers: ModelProvider[]): ModelProvider[] {
    const available = providers.filter((p) => this.isAvailable(p));
    // Always keep at least one provider as a last resort
    return available.length > 0 ? available : providers.slice(-1);
  }

  private getCircuit(provider: ModelProvider): ProviderCircuit {
    let circuit = this.circuits.get(provider);
    if (!circuit) {
      circuit = {
        state: "closed",
        failures: [],
        consecutiveSuccesses: 0,
        lastStateChange: Date.now(),
        totalFailures: 0,
        totalSuccesses: 0,
        totalRequests: 0,
      };
      this.circuits.set(provider, circuit);
    }
    return circuit;
  }

  private transition(provider: ModelProvider, newState: CircuitState): void {
    const circuit = this.getCircuit(provider);
    circuit.state = newState;
    circuit.lastStateChange = Date.now();

    if (newState === "closed") {
      circuit.failures = [];
      circuit.consecutiveSuccesses = 0;
    } else if (newState === "half_open") {
      circuit.consecutiveSuccesses = 0;
    }
  }
}
