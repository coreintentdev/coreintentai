/**
 * CoreIntent AI — Base Model Adapter
 *
 * Abstract interface that all model adapters must implement.
 * Ensures uniform interaction regardless of the underlying provider.
 */

import type { ModelConfig, ModelProvider, TokenUsage } from "../types/index.js";

export interface CompletionRequest {
  systemPrompt?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
}

export interface CompletionResponse {
  content: string;
  provider: ModelProvider;
  model: string;
  tokenUsage: TokenUsage;
  latencyMs: number;
  finishReason: string;
}

export abstract class BaseModelAdapter {
  protected config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  get provider(): ModelProvider {
    return this.config.provider;
  }

  get model(): string {
    return this.config.model;
  }

  abstract complete(request: CompletionRequest): Promise<CompletionResponse>;

  /**
   * Health-check: can we reach this provider right now?
   */
  abstract ping(): Promise<boolean>;
}
