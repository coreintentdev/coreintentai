/**
 * CoreIntent AI — Market Research Capability
 *
 * Web-grounded market research powered by Perplexity for real-time data
 * with Claude fallback for deeper analysis. Now supports structured
 * output via Zod schemas alongside raw text mode.
 */

import { Orchestrator } from "../../orchestrator/index.js";
import {
  ResearchResultSchema,
  type ResearchResult,
} from "../../types/index.js";
import { extractAndValidate } from "../../utils/json-extract.js";
import {
  RESEARCH_SYSTEM_PROMPT,
  STRUCTURED_RESEARCH_SYSTEM_PROMPT,
  buildResearchPrompt,
  buildStructuredResearchPrompt,
  buildCompetitorAnalysisPrompt,
  buildCatalystResearchPrompt,
} from "./prompts.js";

export interface RawResearchResult {
  content: string;
  provider: string;
  latencyMs: number;
}

export class MarketResearcher {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  /**
   * General market research query (raw text output).
   */
  async research(params: {
    query: string;
    ticker?: string;
    depth?: "quick" | "standard" | "deep";
  }): Promise<RawResearchResult> {
    const response = await this.orchestrator.execute({
      intent: "research",
      systemPrompt: RESEARCH_SYSTEM_PROMPT,
      prompt: buildResearchPrompt(params),
    });

    return {
      content: response.content,
      provider: response.provider,
      latencyMs: response.latencyMs,
    };
  }

  /**
   * Structured market research — returns validated, typed output.
   * Uses a specialized prompt that instructs the model to return JSON.
   */
  async researchStructured(params: {
    query: string;
    ticker?: string;
    depth?: "quick" | "standard" | "deep";
  }): Promise<ResearchResult> {
    const response = await this.orchestrator.execute({
      intent: "research",
      systemPrompt: STRUCTURED_RESEARCH_SYSTEM_PROMPT,
      prompt: buildStructuredResearchPrompt(params),
    });

    return extractAndValidate(response.content, ResearchResultSchema);
  }

  /**
   * Competitive analysis for a ticker.
   */
  async competitorAnalysis(params: {
    ticker: string;
    competitors?: string[];
  }): Promise<RawResearchResult> {
    const response = await this.orchestrator.execute({
      intent: "research",
      systemPrompt: RESEARCH_SYSTEM_PROMPT,
      prompt: buildCompetitorAnalysisPrompt(params),
    });

    return {
      content: response.content,
      provider: response.provider,
      latencyMs: response.latencyMs,
    };
  }

  /**
   * Research upcoming catalysts for a ticker.
   */
  async catalysts(params: {
    ticker: string;
    timeHorizon: "near_term" | "medium_term" | "long_term";
  }): Promise<RawResearchResult> {
    const response = await this.orchestrator.execute({
      intent: "research",
      systemPrompt: RESEARCH_SYSTEM_PROMPT,
      prompt: buildCatalystResearchPrompt(params),
    });

    return {
      content: response.content,
      provider: response.provider,
      latencyMs: response.latencyMs,
    };
  }

  /**
   * Multi-source deep dive: Perplexity (web) + Claude (reasoning)
   * with structured synthesis that merges both perspectives.
   */
  async deepDive(params: {
    query: string;
    ticker?: string;
  }): Promise<{
    webResearch: RawResearchResult;
    analysis: RawResearchResult;
    synthesis: ResearchResult;
  }> {
    // Phase 1: Parallel web research + reasoning
    const [webResponse, analysisResponse] = await this.orchestrator.fan([
      {
        intent: "research",
        systemPrompt: RESEARCH_SYSTEM_PROMPT,
        prompt: buildResearchPrompt({ ...params, depth: "deep" }),
        preferredProvider: "perplexity",
      },
      {
        intent: "reasoning",
        systemPrompt: RESEARCH_SYSTEM_PROMPT,
        prompt: buildResearchPrompt({ ...params, depth: "deep" }),
        preferredProvider: "claude",
      },
    ]);

    // Phase 2: Synthesize both into structured output
    const synthesisResponse = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: STRUCTURED_RESEARCH_SYSTEM_PROMPT,
      prompt: buildStructuredResearchPrompt({
        ...params,
        depth: "deep",
        additionalContext: [
          "--- WEB RESEARCH ---",
          webResponse.content,
          "--- ANALYTICAL ASSESSMENT ---",
          analysisResponse.content,
        ].join("\n\n"),
      }),
      preferredProvider: "claude",
    });

    const synthesis = extractAndValidate(
      synthesisResponse.content,
      ResearchResultSchema
    );

    return {
      webResearch: {
        content: webResponse.content,
        provider: webResponse.provider,
        latencyMs: webResponse.latencyMs,
      },
      analysis: {
        content: analysisResponse.content,
        provider: analysisResponse.provider,
        latencyMs: analysisResponse.latencyMs,
      },
      synthesis,
    };
  }
}

export { RESEARCH_SYSTEM_PROMPT, STRUCTURED_RESEARCH_SYSTEM_PROMPT } from "./prompts.js";
