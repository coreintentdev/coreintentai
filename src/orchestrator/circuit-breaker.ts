/**
 * CoreIntent AI — Circuit Breaker
 *
 * Prevents hammering providers that are known to be down. Tracks failures
 * per provider and temporarily removes them from the fallback chain.
 *
 * States:
 *   CLOSED  → Normal operation. Requests pass through.
 *   OPEN    → Provider is down. Requests are rejected immediately.
 *   HALF_OPEN → Cooldown expired. One probe request allowed to test recovery.
 *
 * When a provider accumulates `failureThreshold` consecutive failures, the
 * breaker trips OPEN and stays there for `resetTimeoutMs`. After that window,
 * it transitions to HALF_OPEN — the next request is a probe. If the probe
 * succeeds the breaker closes; if it fails, it reopens.
 */

import type { ModelProvider } from "../types/index.js";

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreakerOptions {
  /** Consecutive failures before tripping open (default: 5) */
  failureThreshold?: number;
  /** How long to stay open before allowing a probe, in ms (default: 60 000) */
  resetTimeoutMs?: number;
}

interface ProviderCircuit {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  totalFailures: number;
  totalSuccesses: number;
}

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_RESET_TIMEOUT_MS = 60_000;

export class CircuitBreaker {
  private circuits = new Map<ModelProvider, ProviderCircuit>();
  private failureThreshold: number;
  private resetTimeoutMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold =
      options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.resetTimeoutMs = options.resetTimeoutMs ?? DEFAULT_RESET_TIMEOUT_MS;
  }

  /**
   * Check whether a provider is available for requests.
   * Returns true if CLOSED or if HALF_OPEN (probe allowed).
   */
  canRequest(provider: ModelProvider): boolean {
    const circuit = this.getCircuit(provider);

    if (circuit.state === "closed") return true;

    if (circuit.state === "open") {
      // Check if cooldown has expired → transition to half_open
      if (Date.now() - circuit.lastFailureTime >= this.resetTimeoutMs) {
        circuit.state = "half_open";
        return true;
      }
      return false;
    }

    // half_open — allow the probe
    return true;
  }

  /**
   * Record a successful request. Resets the circuit to CLOSED.
   */
  recordSuccess(provider: ModelProvider): void {
    const circuit = this.getCircuit(provider);
    circuit.failures = 0;
    circuit.state = "closed";
    circuit.lastSuccessTime = Date.now();
    circuit.totalSuccesses++;
  }

  /**
   * Record a failed request. May trip the circuit to OPEN.
   */
  recordFailure(provider: ModelProvider): void {
    const circuit = this.getCircuit(provider);
    circuit.failures++;
    circuit.lastFailureTime = Date.now();
    circuit.totalFailures++;

    if (circuit.state === "half_open") {
      // Probe failed — reopen immediately
      circuit.state = "open";
      return;
    }

    if (circuit.failures >= this.failureThreshold) {
      circuit.state = "open";
    }
  }

  /**
   * Get the current state of a provider's circuit.
   */
  getState(provider: ModelProvider): CircuitState {
    // Re-evaluate in case cooldown expired
    this.canRequest(provider);
    return this.getCircuit(provider).state;
  }

  /**
   * Get health stats for all known providers.
   */
  getStats(): Record<
    string,
    {
      state: CircuitState;
      consecutiveFailures: number;
      totalFailures: number;
      totalSuccesses: number;
    }
  > {
    const stats: Record<string, {
      state: CircuitState;
      consecutiveFailures: number;
      totalFailures: number;
      totalSuccesses: number;
    }> = {};

    for (const [provider, circuit] of this.circuits) {
      // Re-evaluate state
      this.canRequest(provider);
      stats[provider] = {
        state: circuit.state,
        consecutiveFailures: circuit.failures,
        totalFailures: circuit.totalFailures,
        totalSuccesses: circuit.totalSuccesses,
      };
    }

    return stats;
  }

  /**
   * Filter a provider chain to only those whose circuit allows requests.
   * Returns at minimum one provider (the first in the chain) to avoid
   * total deadlock — better to try a possibly-down provider than nothing.
   */
  filterAvailable(providers: ModelProvider[]): ModelProvider[] {
    const available = providers.filter((p) => this.canRequest(p));
    return available.length > 0 ? available : providers.slice(0, 1);
  }

  /**
   * Manually reset a provider's circuit to CLOSED.
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
    let circuit = this.circuits.get(provider);
    if (!circuit) {
      circuit = {
        state: "closed",
        failures: 0,
        lastFailureTime: 0,
        lastSuccessTime: 0,
        totalFailures: 0,
        totalSuccesses: 0,
      };
      this.circuits.set(provider, circuit);
    }
    return circuit;
  }
}
