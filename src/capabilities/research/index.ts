import { Orchestrator } from "../../orchestrator/index.js";
import {
  ResearchResultSchema,
  type StructuredResearchResult,
} from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  RESEARCH_SYSTEM_PROMPT,
  buildResearchPrompt,
  buildStructuredResearchPrompt,
  buildCompetitorAnalysisPrompt,
  buildCatalystResearchPrompt,
  buildInsightSynthesisPrompt,
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

  async structuredResearch(params: {
    query: string;
    ticker?: string;
    depth?: "quick" | "standard" | "deep";
  }): Promise<StructuredResearchResult> {
    const response = await this.orchestrator.execute({
      intent: "research",
      systemPrompt: RESEARCH_SYSTEM_PROMPT,
      prompt: buildStructuredResearchPrompt(params),
    });

    return parseJsonResponse(response.content, ResearchResultSchema);
  }

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

  async deepDive(params: {
    query: string;
    ticker?: string;
  }): Promise<{
    webResearch: ResearchResult;
    analysis: ResearchResult;
    synthesis: StructuredResearchResult;
  }> {
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

    const synthesisResponse = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: RESEARCH_SYSTEM_PROMPT,
      prompt: buildInsightSynthesisPrompt({
        webResearch: webResponse.content.slice(0, 3000),
        reasoningAnalysis: analysisResponse.content.slice(0, 3000),
        query: params.query,
        ticker: params.ticker,
      }),
      preferredProvider: "claude",
    });

    const synthesis = parseJsonResponse(
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

export { RESEARCH_SYSTEM_PROMPT } from "./prompts.js";
