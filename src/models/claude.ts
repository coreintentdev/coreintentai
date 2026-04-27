/**
 * CoreIntent AI — Claude (Anthropic) Adapter
 *
 * Primary reasoning engine. Used for deep analysis, signal generation,
 * risk assessment, and any task requiring strong logical reasoning.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ModelConfig } from "../types/index.js";
import {
  BaseModelAdapter,
  type CompletionRequest,
  type CompletionResponse,
} from "./base.js";

export class ClaudeAdapter extends BaseModelAdapter {
  private client: Anthropic;

  constructor(config: ModelConfig) {
    super(config);
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const start = performance.now();

    const systemContent = request.systemPrompt
      ? [
          {
            type: "text" as const,
            text: request.systemPrompt,
            cache_control: { type: "ephemeral" as const },
          },
        ]
      : undefined;

    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: request.maxTokens ?? this.config.maxTokens,
      temperature: request.temperature ?? this.config.temperature,
      ...(systemContent ? { system: systemContent } : {}),
      messages: [{ role: "user", content: request.prompt }],
    });

    const latencyMs = Math.round(performance.now() - start);

    const textBlock = response.content.find((b) => b.type === "text");
    const content = textBlock ? textBlock.text : "";

    const usage = response.usage as unknown as Record<string, number>;
    const cacheCreation = usage.cache_creation_input_tokens ?? 0;
    const cacheRead = usage.cache_read_input_tokens ?? 0;

    return {
      content,
      provider: "claude",
      model: response.model,
      tokenUsage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens:
          response.usage.input_tokens + response.usage.output_tokens,
        cacheCreationTokens: cacheCreation || undefined,
        cacheReadTokens: cacheRead || undefined,
      },
      latencyMs,
      finishReason: response.stop_reason ?? "unknown",
    };
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: this.config.model,
        max_tokens: 8,
        messages: [{ role: "user", content: "ping" }],
      });
      return true;
    } catch {
      return false;
    }
  }
}
