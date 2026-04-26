import { Orchestrator } from "../../orchestrator/index.js";
import {
  ConsensusResultSchema,
  type ConsensusResult,
} from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  CONSENSUS_SYSTEM_PROMPT,
  buildConsensusSynthesisPrompt,
  buildConsensusTradingPrompt,
} from "./prompts.js";
import type { ModelProvider } from "../../types/index.js";

export class ConsensusEngine {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  /**
   * Query multiple models with the same question, then synthesize
   * their responses into a single high-confidence verdict.
   */
  async synthesize(params: {
    query: string;
    systemPrompt?: string;
    intent?: "reasoning" | "fast_analysis" | "research" | "sentiment" | "signal" | "risk" | "general";
    providers?: ModelProvider[];
  }): Promise<ConsensusResult> {
    const providers = params.providers ?? ["claude", "grok", "perplexity"];

    const responses = await this.orchestrator.consensus(
      {
        intent: params.intent ?? "reasoning",
        systemPrompt: params.systemPrompt,
        prompt: params.query,
      },
      providers
    );

    const modelResponses = responses.map((r, i) => ({
      provider: providers[i],
      content: r.content,
    }));

    const synthesis = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: CONSENSUS_SYSTEM_PROMPT,
      prompt: buildConsensusSynthesisPrompt({
        query: params.query,
        responses: modelResponses,
      }),
      preferredProvider: "claude",
    });

    return parseJsonResponse(synthesis.content, ConsensusResultSchema);
  }

  /**
   * Trading-specific consensus: query models about a ticker, then
   * synthesize into an actionable trading verdict.
   */
  async tradingConsensus(params: {
    ticker: string;
    question: string;
    providers?: ModelProvider[];
    marketContext?: string;
  }): Promise<ConsensusResult> {
    const providers = params.providers ?? ["claude", "grok", "perplexity"];

    const responses = await this.orchestrator.consensus(
      {
        intent: "signal",
        prompt: `Analyze ${params.ticker}: ${params.question}`,
      },
      providers
    );

    const modelResponses = responses.map((r, i) => ({
      provider: providers[i],
      content: r.content,
    }));

    const synthesis = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: CONSENSUS_SYSTEM_PROMPT,
      prompt: buildConsensusTradingPrompt({
        ticker: params.ticker,
        question: params.question,
        responses: modelResponses,
        marketContext: params.marketContext,
      }),
      preferredProvider: "claude",
    });

    return parseJsonResponse(synthesis.content, ConsensusResultSchema);
  }

  /**
   * Rapid 2-model consensus: skip the slowest provider for speed.
   * Uses Grok + Claude, synthesized by Claude.
   */
  async quickConsensus(params: {
    query: string;
    systemPrompt?: string;
  }): Promise<ConsensusResult> {
    return this.synthesize({
      ...params,
      providers: ["claude", "grok"],
      intent: "fast_analysis",
    });
  }
}

export { CONSENSUS_SYSTEM_PROMPT } from "./prompts.js";
