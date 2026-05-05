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

    const systemParam =
      request.enableCaching && request.systemPrompt
        ? [
            {
              type: "text" as const,
              text: request.systemPrompt,
              cache_control: { type: "ephemeral" as const },
            },
          ]
        : (request.systemPrompt ?? "");

    const baseMaxTokens = request.maxTokens ?? this.config.maxTokens;

    const params: Record<string, unknown> = {
      model: this.config.model,
      system: systemParam,
      messages: [{ role: "user", content: request.prompt }],
    };

    if (request.enableThinking) {
      const thinkingBudget = request.thinkingBudget ?? 8000;
      params.thinking = { type: "enabled", budget_tokens: thinkingBudget };
      params.max_tokens = baseMaxTokens + thinkingBudget;
    } else {
      params.max_tokens = baseMaxTokens;
      params.temperature = request.temperature ?? this.config.temperature;
    }

    const response = await this.client.messages.create(
      params as unknown as Anthropic.MessageCreateParamsNonStreaming
    );

    const latencyMs = Math.round(performance.now() - start);

    let content = "";
    let thinking = "";
    for (const block of response.content) {
      if (block.type === "text") {
        content += block.text;
      } else if (block.type === "thinking") {
        thinking += (block as unknown as { thinking: string }).thinking;
      }
    }

    const usage = response.usage as unknown as Record<string, unknown>;
    const hasCacheData =
      usage.cache_read_input_tokens !== undefined ||
      usage.cache_creation_input_tokens !== undefined;

    const cacheMetrics = hasCacheData
      ? {
          cacheReadInputTokens:
            (usage.cache_read_input_tokens as number) ?? 0,
          cacheCreationInputTokens:
            (usage.cache_creation_input_tokens as number) ?? 0,
        }
      : undefined;

    return {
      content,
      provider: "claude",
      model: response.model,
      tokenUsage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens:
          response.usage.input_tokens + response.usage.output_tokens,
      },
      latencyMs,
      finishReason: response.stop_reason ?? "unknown",
      ...(thinking ? { thinking } : {}),
      ...(cacheMetrics ? { cacheMetrics } : {}),
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
