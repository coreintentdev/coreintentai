/**
 * CoreIntent AI — Grok (xAI) Adapter
 *
 * Speed-optimized model for real-time market analysis, fast sentiment reads,
 * and time-critical decisions. Uses OpenAI-compatible API format.
 */

import OpenAI from "openai";
import type { ModelConfig } from "../types/index.js";
import {
  BaseModelAdapter,
  type CompletionRequest,
  type CompletionResponse,
} from "./base.js";

export class GrokAdapter extends BaseModelAdapter {
  private client: OpenAI;

  constructor(config: ModelConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const start = performance.now();

    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }
    messages.push({ role: "user", content: request.prompt });

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      max_tokens: request.maxTokens ?? this.config.maxTokens,
      temperature: request.temperature ?? this.config.temperature,
      messages,
      ...(request.jsonMode
        ? { response_format: { type: "json_object" } }
        : {}),
    });

    const latencyMs = Math.round(performance.now() - start);

    const choice = response.choices[0];
    const content = choice?.message?.content ?? "";

    return {
      content,
      provider: "grok",
      model: response.model,
      tokenUsage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      latencyMs,
      finishReason: choice?.finish_reason ?? "unknown",
    };
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
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
