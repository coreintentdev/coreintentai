import type { ModelProvider } from "../types/index.js";

export type CircuitState = "closed" | "open" | "half_open";

interface ProviderCircuit {
  state: CircuitState;
  failures: number;
  lastFailure: number;
  lastSuccess: number;
  consecutiveSuccesses: number;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxAttempts: number;
}

const DEFAULTS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeoutMs: 60_000,
  halfOpenMaxAttempts: 2,
};

export class CircuitBreaker {
  private circuits = new Map<ModelProvider, ProviderCircuit>();
  private options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  private getCircuit(provider: ModelProvider): ProviderCircuit {
    if (!this.circuits.has(provider)) {
      this.circuits.set(provider, {
        state: "closed",
        failures: 0,
        lastFailure: 0,
        lastSuccess: Date.now(),
        consecutiveSuccesses: 0,
      });
    }
    return this.circuits.get(provider)!;
  }

  isAvailable(provider: ModelProvider): boolean {
    const circuit = this.getCircuit(provider);

    if (circuit.state === "closed") return true;

    if (circuit.state === "open") {
      const elapsed = Date.now() - circuit.lastFailure;
      if (elapsed >= this.options.resetTimeoutMs) {
        circuit.state = "half_open";
        circuit.consecutiveSuccesses = 0;
        return true;
      }
      return false;
    }

    // half_open — allow limited attempts
    return true;
  }

  recordSuccess(provider: ModelProvider): void {
    const circuit = this.getCircuit(provider);
    circuit.lastSuccess = Date.now();
    circuit.consecutiveSuccesses++;

    if (circuit.state === "half_open") {
      if (circuit.consecutiveSuccesses >= this.options.halfOpenMaxAttempts) {
        circuit.state = "closed";
        circuit.failures = 0;
      }
    } else {
      circuit.failures = Math.max(0, circuit.failures - 1);
    }
  }

  recordFailure(provider: ModelProvider): void {
    const circuit = this.getCircuit(provider);
    circuit.failures++;
    circuit.lastFailure = Date.now();
    circuit.consecutiveSuccesses = 0;

    if (circuit.state === "half_open") {
      circuit.state = "open";
    } else if (circuit.failures >= this.options.failureThreshold) {
      circuit.state = "open";
    }
  }

  getState(provider: ModelProvider): CircuitState {
    return this.getCircuit(provider).state;
  }

  getHealthReport(): Record<ModelProvider, { state: CircuitState; failures: number; lastSuccess: number }> {
    const report: Record<string, { state: CircuitState; failures: number; lastSuccess: number }> = {};
    for (const [provider, circuit] of this.circuits) {
      report[provider] = {
        state: circuit.state,
        failures: circuit.failures,
        lastSuccess: circuit.lastSuccess,
      };
    }
    return report as Record<ModelProvider, { state: CircuitState; failures: number; lastSuccess: number }>;
  }

  reset(provider?: ModelProvider): void {
    if (provider) {
      this.circuits.delete(provider);
    } else {
      this.circuits.clear();
    }
  }

  filterAvailable(providers: ModelProvider[]): ModelProvider[] {
    return providers.filter((p) => this.isAvailable(p));
  }
}
