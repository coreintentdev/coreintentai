/**
 * CoreIntent AI — Market Research Capability
 *
 * Web-grounded market research powered by Perplexity for real-time data
 * with Claude fallback for deeper analysis.
 */

import { Orchestrator } from "../../orchestrator/index.js";
import {
  RESEARCH_SYSTEM_PROMPT,
  buildResearchPrompt,
  buildCompetitorAnalysisPrompt,
  buildCatalystResearchPrompt,
} from "./prompts.js";

export interface ResearchResult {
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
   * General market research query.
   */
  async research(params: {
    query: string;
    ticker?: string;
    depth?: "quick" | "standard" | "deep";
  }): Promise<ResearchResult> {
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
   * Competitive analysis for a ticker.
   */
  async competitorAnalysis(params: {
    ticker: string;
    competitors?: string[];
  }): Promise<ResearchResult> {
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
  }): Promise<ResearchResult> {
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
   * Multi-source research: query both Perplexity (web) and Claude (reasoning)
   * and combine insights.
   */
  async deepDive(params: {
    query: string;
    ticker?: string;
  }): Promise<{ webResearch: ResearchResult; analysis: ResearchResult }> {
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
    };
  }
}

export { RESEARCH_SYSTEM_PROMPT } from "./prompts.js";
