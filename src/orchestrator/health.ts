import type { ModelProvider } from "../types/index.js";

export type CircuitState = "closed" | "open" | "half_open";

export interface ProviderHealthSnapshot {
  provider: ModelProvider;
  state: CircuitState;
  successCount: number;
  failureCount: number;
  totalRequests: number;
  successRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  lastFailure: number | null;
  lastSuccess: number | null;
  consecutiveFailures: number;
}

interface ProviderMetrics {
  successes: number;
  failures: number;
  consecutiveFailures: number;
  latencies: number[];
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  circuitState: CircuitState;
  circuitOpenedAt: number | null;
}

export interface HealthMonitorOptions {
  errorThreshold: number;
  circuitOpenDurationMs: number;
  halfOpenMaxProbes: number;
  latencyWindowSize: number;
  minSamplesForStats: number;
}

const DEFAULT_OPTIONS: HealthMonitorOptions = {
  errorThreshold: 0.5,
  circuitOpenDurationMs: 30_000,
  halfOpenMaxProbes: 2,
  latencyWindowSize: 100,
  minSamplesForStats: 5,
};

export class ProviderHealthMonitor {
  private metrics: Map<ModelProvider, ProviderMetrics> = new Map();
  private options: HealthMonitorOptions;
  private halfOpenProbes: Map<ModelProvider, number> = new Map();

  constructor(options: Partial<HealthMonitorOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  recordSuccess(provider: ModelProvider, latencyMs: number): void {
    const m = this.getOrCreate(provider);
    m.successes++;
    m.consecutiveFailures = 0;
    m.lastSuccessAt = Date.now();
    this.pushLatency(m, latencyMs);

    if (m.circuitState === "half_open") {
      m.circuitState = "closed";
      m.circuitOpenedAt = null;
      this.halfOpenProbes.delete(provider);
    }
  }

  recordFailure(provider: ModelProvider): void {
    const m = this.getOrCreate(provider);
    m.failures++;
    m.consecutiveFailures++;
    m.lastFailureAt = Date.now();

    if (m.circuitState === "half_open") {
      const probes = (this.halfOpenProbes.get(provider) ?? 0) + 1;
      this.halfOpenProbes.set(provider, probes);
      if (probes >= this.options.halfOpenMaxProbes) {
        m.circuitState = "open";
        m.circuitOpenedAt = Date.now();
        this.halfOpenProbes.delete(provider);
      }
      return;
    }

    if (m.circuitState === "open") {
      return;
    }

    const total = m.successes + m.failures;
    if (
      total >= this.options.minSamplesForStats &&
      m.failures / total >= this.options.errorThreshold
    ) {
      m.circuitState = "open";
      m.circuitOpenedAt = Date.now();
    }
  }

  isAvailable(provider: ModelProvider): boolean {
    const m = this.metrics.get(provider);
    if (!m) return true;

    if (m.circuitState === "closed") return true;

    if (m.circuitState === "open" && m.circuitOpenedAt) {
      const elapsed = Date.now() - m.circuitOpenedAt;
      if (elapsed >= this.options.circuitOpenDurationMs) {
        m.circuitState = "half_open";
        this.halfOpenProbes.set(provider, 0);
        return true;
      }
      return false;
    }

    return true;
  }

  getSnapshot(provider: ModelProvider): ProviderHealthSnapshot {
    const m = this.getOrCreate(provider);
    const total = m.successes + m.failures;
    return {
      provider,
      state: m.circuitState,
      successCount: m.successes,
      failureCount: m.failures,
      totalRequests: total,
      successRate: total > 0 ? m.successes / total : 1,
      avgLatencyMs: this.avgLatency(m),
      p95LatencyMs: this.p95Latency(m),
      lastFailure: m.lastFailureAt,
      lastSuccess: m.lastSuccessAt,
      consecutiveFailures: m.consecutiveFailures,
    };
  }

  getAllSnapshots(): ProviderHealthSnapshot[] {
    const providers: ModelProvider[] = ["claude", "grok", "perplexity"];
    return providers.map((p) => this.getSnapshot(p));
  }

  filterAvailable(providers: ModelProvider[]): ModelProvider[] {
    return providers.filter((p) => this.isAvailable(p));
  }

  reset(provider?: ModelProvider): void {
    if (provider) {
      this.metrics.delete(provider);
      this.halfOpenProbes.delete(provider);
    } else {
      this.metrics.clear();
      this.halfOpenProbes.clear();
    }
  }

  private getOrCreate(provider: ModelProvider): ProviderMetrics {
    let m = this.metrics.get(provider);
    if (!m) {
      m = {
        successes: 0,
        failures: 0,
        consecutiveFailures: 0,
        latencies: [],
        lastFailureAt: null,
        lastSuccessAt: null,
        circuitState: "closed",
        circuitOpenedAt: null,
      };
      this.metrics.set(provider, m);
    }
    return m;
  }

  private pushLatency(m: ProviderMetrics, latencyMs: number): void {
    m.latencies.push(latencyMs);
    if (m.latencies.length > this.options.latencyWindowSize) {
      m.latencies.shift();
    }
  }

  private avgLatency(m: ProviderMetrics): number {
    if (m.latencies.length === 0) return 0;
    return m.latencies.reduce((a, b) => a + b, 0) / m.latencies.length;
  }

  private p95Latency(m: ProviderMetrics): number {
    if (m.latencies.length === 0) return 0;
    const sorted = [...m.latencies].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.95);
    return sorted[Math.min(idx, sorted.length - 1)];
  }
}
