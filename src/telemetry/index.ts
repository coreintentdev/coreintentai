import type { Orchestrator } from "../orchestrator/index.js";
import type { ModelProvider } from "../types/index.js";
import { AIEventBus, type AIEvent } from "./event-bus.js";
import { MetricsCollector } from "./metrics.js";
import { CostTracker, type ModelPricing } from "./cost-tracker.js";

export interface TelemetryOptions {
  maxHistory?: number;
  metricsWindowSize?: number;
  pricing?: Record<string, ModelPricing>;
  budgetUsd?: number;
}

export class Telemetry {
  readonly events: AIEventBus;
  readonly metrics: MetricsCollector;
  readonly costs: CostTracker;

  constructor(options?: TelemetryOptions) {
    this.events = new AIEventBus({ maxHistory: options?.maxHistory });
    this.metrics = new MetricsCollector({
      windowSize: options?.metricsWindowSize,
    });
    this.costs = new CostTracker({
      pricing: options?.pricing,
      budgetUsd: options?.budgetUsd,
    });

    this.wireInternalMetrics();
  }

  instrument(orchestrator: Orchestrator): void {
    const originalExecute = orchestrator.execute.bind(orchestrator);
    const telemetry = this;

    orchestrator.execute = async function (request) {
      const providers = (await import("../orchestrator/router.js")).getProviderChain(
        request.intent,
        request.preferredProvider
      );

      telemetry.events.emit({
        type: "request.start",
        timestamp: new Date().toISOString(),
        intent: request.intent,
        providers,
        jsonMode: request.jsonMode ?? false,
      });

      try {
        const response = await originalExecute(request);

        telemetry.events.emit({
          type: "request.complete",
          timestamp: new Date().toISOString(),
          provider: response.provider,
          model: response.model,
          latencyMs: response.latencyMs,
          tokens: response.tokenUsage,
          fallbackUsed: response.fallbackUsed,
          cached: false,
        });

        const costEntry = telemetry.costs.record({
          model: response.model,
          provider: response.provider,
          inputTokens: response.tokenUsage.inputTokens,
          outputTokens: response.tokenUsage.outputTokens,
          cacheReadTokens: response.tokenUsage.cacheReadTokens,
          cacheCreationTokens: response.tokenUsage.cacheCreationTokens,
        });

        telemetry.events.emit({
          type: "cost.incurred",
          timestamp: new Date().toISOString(),
          provider: response.provider,
          model: response.model,
          inputTokens: response.tokenUsage.inputTokens,
          outputTokens: response.tokenUsage.outputTokens,
          costUsd: costEntry.costUsd,
        });

        return response;
      } catch (error) {
        const err =
          error instanceof Error ? error : new Error(String(error));
        telemetry.events.emit({
          type: "request.error",
          timestamp: new Date().toISOString(),
          provider: (request.preferredProvider ?? "unknown") as ModelProvider,
          error: err.message,
          retryable: false,
          attemptNumber: 0,
        });
        throw error;
      }
    };
  }

  private wireInternalMetrics(): void {
    this.events.on("request.complete", (event) => {
      if (event.type !== "request.complete") return;
      this.metrics.recordLatency(event.provider, event.latencyMs);
      this.metrics.recordTokens(
        event.provider,
        event.tokens.inputTokens,
        event.tokens.outputTokens
      );
      this.metrics.recordRequest(event.provider, true);
    });

    this.events.on("request.error", (event) => {
      if (event.type !== "request.error") return;
      this.metrics.recordRequest(event.provider, false);
    });
  }

  getSnapshot(): {
    metrics: ReturnType<MetricsCollector["getSnapshot"]>;
    costs: ReturnType<CostTracker["getSnapshot"]>;
    eventCount: number;
  } {
    return {
      metrics: this.metrics.getSnapshot(),
      costs: this.costs.getSnapshot(),
      eventCount: this.events.getHistory().length,
    };
  }

  reset(): void {
    this.events.clear();
    this.metrics.reset();
    this.costs.reset();
  }
}

export { AIEventBus } from "./event-bus.js";
export type {
  AIEvent,
  AIEventType,
  RequestStartEvent,
  RequestCompleteEvent,
  RequestErrorEvent,
  FallbackTriggeredEvent,
  CircuitStateChangeEvent,
  CapabilityExecuteEvent,
  CapabilityCompleteEvent,
  AgentStepEvent,
  CostIncurredEvent,
} from "./event-bus.js";
export { MetricsCollector } from "./metrics.js";
export type { LatencyStats, ProviderStats, MetricsSnapshot } from "./metrics.js";
export { CostTracker } from "./cost-tracker.js";
export type { ModelPricing, CostEntry, CostSnapshot } from "./cost-tracker.js";
