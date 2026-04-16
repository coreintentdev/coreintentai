/**
 * CoreIntent AI — Base Agent
 *
 * Foundation class for all trading intelligence agents. Agents are autonomous
 * reasoning loops that can execute multi-step analysis using the orchestrator.
 *
 * Architecture:
 *   Agent receives a goal → breaks it into steps → executes each step via
 *   the orchestrator → synthesizes results → returns structured output.
 */

import { Orchestrator } from "../orchestrator/index.js";
import type {
  AgentConfig,
  AgentMessage,
  AgentResult,
  TaskIntent,
  TokenUsage,
} from "../types/index.js";

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected orchestrator: Orchestrator;
  protected messages: AgentMessage[] = [];
  protected totalTokens: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };

  constructor(config: AgentConfig, orchestrator?: Orchestrator) {
    this.config = config;
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  get name(): string {
    return this.config.name;
  }

  get role(): string {
    return this.config.role;
  }

  /**
   * Execute the agent's primary task. Subclasses implement the specific logic.
   */
  abstract execute(input: string, context?: Record<string, unknown>): Promise<AgentResult>;

  /**
   * Run a single reasoning step through the orchestrator.
   */
  protected async reason(
    prompt: string,
    intent: TaskIntent = "reasoning"
  ): Promise<string> {
    const start = performance.now();

    const response = await this.orchestrator.execute({
      intent,
      systemPrompt: this.config.systemPrompt,
      prompt,
      preferredProvider: this.config.provider,
    });

    this.messages.push({
      role: "user",
      content: prompt,
      timestamp: new Date().toISOString(),
    });

    this.messages.push({
      role: "assistant",
      content: response.content,
      timestamp: new Date().toISOString(),
    });

    this.totalTokens.inputTokens += response.tokenUsage.inputTokens;
    this.totalTokens.outputTokens += response.tokenUsage.outputTokens;
    this.totalTokens.totalTokens += response.tokenUsage.totalTokens;

    return response.content;
  }

  /**
   * Research step — delegates to Perplexity for web-grounded data.
   */
  protected async research(query: string): Promise<string> {
    return this.reason(query, "research");
  }

  /**
   * Fast analysis step — delegates to Grok for speed-critical analysis.
   */
  protected async fastAnalyze(prompt: string): Promise<string> {
    return this.reason(prompt, "fast_analysis");
  }

  /**
   * Build the final AgentResult from accumulated state.
   */
  protected buildResult(output: string, startTime: number): AgentResult {
    return {
      agentName: this.config.name,
      output,
      messages: [...this.messages],
      turnsUsed: Math.floor(this.messages.length / 2),
      totalLatencyMs: Math.round(performance.now() - startTime),
      tokenUsage: { ...this.totalTokens },
    };
  }

  /**
   * Reset agent state for a fresh run.
   */
  protected reset(): void {
    this.messages = [];
    this.totalTokens = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  }
}
