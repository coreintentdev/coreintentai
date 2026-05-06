import type { ModelProvider, TaskIntent, TokenUsage } from "../types/index.js";
import type { CircuitState } from "../orchestrator/circuit-breaker.js";

export type AIEventType =
  | "request.start"
  | "request.complete"
  | "request.error"
  | "fallback.triggered"
  | "circuit.state_change"
  | "capability.execute"
  | "capability.complete"
  | "agent.step"
  | "cost.incurred";

export interface BaseAIEvent {
  type: AIEventType;
  timestamp: string;
}

export interface RequestStartEvent extends BaseAIEvent {
  type: "request.start";
  intent: TaskIntent;
  providers: ModelProvider[];
  jsonMode: boolean;
}

export interface RequestCompleteEvent extends BaseAIEvent {
  type: "request.complete";
  provider: ModelProvider;
  model: string;
  latencyMs: number;
  tokens: TokenUsage;
  fallbackUsed: boolean;
  cached: boolean;
}

export interface RequestErrorEvent extends BaseAIEvent {
  type: "request.error";
  provider: ModelProvider;
  error: string;
  retryable: boolean;
  attemptNumber: number;
}

export interface FallbackTriggeredEvent extends BaseAIEvent {
  type: "fallback.triggered";
  fromProvider: ModelProvider;
  toProvider: ModelProvider;
  reason: string;
}

export interface CircuitStateChangeEvent extends BaseAIEvent {
  type: "circuit.state_change";
  provider: ModelProvider;
  from: CircuitState;
  to: CircuitState;
}

export interface CapabilityExecuteEvent extends BaseAIEvent {
  type: "capability.execute";
  capability: string;
  method: string;
  ticker?: string;
}

export interface CapabilityCompleteEvent extends BaseAIEvent {
  type: "capability.complete";
  capability: string;
  method: string;
  latencyMs: number;
  success: boolean;
}

export interface AgentStepEvent extends BaseAIEvent {
  type: "agent.step";
  agent: string;
  step: number;
  intent: TaskIntent;
  latencyMs: number;
}

export interface CostIncurredEvent extends BaseAIEvent {
  type: "cost.incurred";
  provider: ModelProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export type AIEvent =
  | RequestStartEvent
  | RequestCompleteEvent
  | RequestErrorEvent
  | FallbackTriggeredEvent
  | CircuitStateChangeEvent
  | CapabilityExecuteEvent
  | CapabilityCompleteEvent
  | AgentStepEvent
  | CostIncurredEvent;

type AIEventListener = (event: AIEvent) => void;

export class AIEventBus {
  private listeners = new Map<string, Set<AIEventListener>>();
  private history: AIEvent[] = [];
  private maxHistory: number;

  constructor(options?: { maxHistory?: number }) {
    this.maxHistory = options?.maxHistory ?? 1000;
  }

  on(type: AIEventType | "*", listener: AIEventListener): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);

    return () => {
      set!.delete(listener);
    };
  }

  emit(event: AIEvent): void {
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    const typed = this.listeners.get(event.type);
    if (typed) {
      for (const listener of typed) {
        listener(event);
      }
    }

    const wildcard = this.listeners.get("*");
    if (wildcard) {
      for (const listener of wildcard) {
        listener(event);
      }
    }
  }

  getHistory(type?: AIEventType): AIEvent[] {
    if (!type) return [...this.history];
    return this.history.filter((e) => e.type === type);
  }

  clear(): void {
    this.history = [];
  }

  listenerCount(type?: AIEventType | "*"): number {
    if (!type) {
      let total = 0;
      for (const set of this.listeners.values()) {
        total += set.size;
      }
      return total;
    }
    return this.listeners.get(type)?.size ?? 0;
  }

  removeAllListeners(type?: AIEventType | "*"): void {
    if (type) {
      this.listeners.delete(type);
    } else {
      this.listeners.clear();
    }
  }
}
