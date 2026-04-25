import type { ModelProvider } from "../types/index.js";

export type CircuitState = "closed" | "open" | "half_open";

interface ProviderHealth {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: number;
  lastSuccess: number;
  latencyMs: number[];
  openedAt: number;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxAttempts: number;
  latencyWindowSize: number;
}

const DEFAULTS: CircuitBreakerOptions = {
  failureThreshold: 3,
  resetTimeoutMs: 30_000,
  halfOpenMaxAttempts: 1,
  latencyWindowSize: 20,
};

export class CircuitBreaker {
  private health = new Map<ModelProvider, ProviderHealth>();
  private options: CircuitBreakerOptions;

  constructor(options?: Partial<CircuitBreakerOptions>) {
    this.options = { ...DEFAULTS, ...options };
  }

  private getHealth(provider: ModelProvider): ProviderHealth {
    let h = this.health.get(provider);
    if (!h) {
      h = {
        state: "closed",
        failures: 0,
        successes: 0,
        lastFailure: 0,
        lastSuccess: 0,
        latencyMs: [],
        openedAt: 0,
      };
      this.health.set(provider, h);
    }
    return h;
  }

  canAttempt(provider: ModelProvider): boolean {
    const h = this.getHealth(provider);

    if (h.state === "closed") return true;

    if (h.state === "open") {
      if (Date.now() - h.openedAt >= this.options.resetTimeoutMs) {
        h.state = "half_open";
        h.successes = 0;
        return true;
      }
      return false;
    }

    // half_open — allow limited attempts
    return h.successes < this.options.halfOpenMaxAttempts;
  }

  recordSuccess(provider: ModelProvider, latencyMs: number): void {
    const h = this.getHealth(provider);
    h.successes++;
    h.lastSuccess = Date.now();
    h.latencyMs.push(latencyMs);
    if (h.latencyMs.length > this.options.latencyWindowSize) {
      h.latencyMs.shift();
    }

    if (h.state === "half_open") {
      h.state = "closed";
      h.failures = 0;
    }
  }

  recordFailure(provider: ModelProvider): void {
    const h = this.getHealth(provider);
    h.failures++;
    h.lastFailure = Date.now();

    if (h.state === "half_open") {
      h.state = "open";
      h.openedAt = Date.now();
      return;
    }

    if (h.failures >= this.options.failureThreshold) {
      h.state = "open";
      h.openedAt = Date.now();
    }
  }

  getState(provider: ModelProvider): CircuitState {
    const h = this.getHealth(provider);
    // Check for auto-transition to half_open on read
    if (
      h.state === "open" &&
      Date.now() - h.openedAt >= this.options.resetTimeoutMs
    ) {
      h.state = "half_open";
      h.successes = 0;
    }
    return h.state;
  }

  getAverageLatency(provider: ModelProvider): number | null {
    const h = this.getHealth(provider);
    if (h.latencyMs.length === 0) return null;
    return h.latencyMs.reduce((a, b) => a + b, 0) / h.latencyMs.length;
  }

  getSnapshot(): Map<ModelProvider, { state: CircuitState; failures: number; avgLatencyMs: number | null }> {
    const snap = new Map<ModelProvider, { state: CircuitState; failures: number; avgLatencyMs: number | null }>();
    for (const [provider] of this.health) {
      snap.set(provider, {
        state: this.getState(provider),
        failures: this.getHealth(provider).failures,
        avgLatencyMs: this.getAverageLatency(provider),
      });
    }
    return snap;
  }

  /**
   * Reorder a provider chain so that open-circuit providers sort to the end
   * and providers are secondarily sorted by average latency (faster first).
   */
  rankProviders(providers: ModelProvider[]): ModelProvider[] {
    return [...providers].sort((a, b) => {
      const stateA = this.getState(a);
      const stateB = this.getState(b);

      const statePriority: Record<CircuitState, number> = {
        closed: 0,
        half_open: 1,
        open: 2,
      };

      const pDiff = statePriority[stateA] - statePriority[stateB];
      if (pDiff !== 0) return pDiff;

      const latA = this.getAverageLatency(a) ?? Infinity;
      const latB = this.getAverageLatency(b) ?? Infinity;
      return latA - latB;
    });
  }

  reset(provider?: ModelProvider): void {
    if (provider) {
      this.health.delete(provider);
    } else {
      this.health.clear();
    }
  }
}
