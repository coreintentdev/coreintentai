/**
 * CoreIntent AI — Market Research Capability
 *
 * Web-grounded market research powered by Perplexity for real-time data
 * with Claude fallback for deeper analysis. All outputs are Zod-validated
 * with structured citation tracking.
 */

import { Orchestrator } from "../../orchestrator/index.js";
import {
  ResearchResultSchema,
  type ResearchResult,
} from "../../types/index.js";
import {
  RESEARCH_SYSTEM_PROMPT,
  RESEARCH_SYNTHESIS_PROMPT,
  buildResearchPrompt,
  buildCompetitorAnalysisPrompt,
  buildCatalystResearchPrompt,
  buildSynthesisPrompt,
} from "./prompts.js";

export class MarketResearcher {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  /**
   * General market research query with structured output.
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

    return parseResearchResponse(response.content);
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

    return parseResearchResponse(response.content);
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

    return parseResearchResponse(response.content);
  }

  /**
   * Multi-source deep dive: query Perplexity (web) and Claude (reasoning)
   * in parallel, then synthesize into a unified report.
   */
  async deepDive(params: {
    query: string;
    ticker?: string;
  }): Promise<{
    synthesized: ResearchResult;
    webResearch: ResearchResult;
    analysis: ResearchResult;
  }> {
    // Stage 1: Fan out to both providers
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

    const webResearch = parseResearchResponse(webResponse.content);
    const analysis = parseResearchResponse(analysisResponse.content);

    // Stage 2: Synthesize both into a unified report
    const synthesisResponse = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: RESEARCH_SYNTHESIS_PROMPT,
      prompt: buildSynthesisPrompt({
        webResearch: webResponse.content,
        analysis: analysisResponse.content,
        query: params.query,
        ticker: params.ticker,
      }),
      preferredProvider: "claude",
    });

    const synthesized = parseResearchResponse(synthesisResponse.content);

    return { synthesized, webResearch, analysis };
  }

  /**
   * Consensus research: query multiple providers and compare results.
   * Returns individual results plus an agreement assessment.
   */
  async consensus(params: {
    query: string;
    ticker?: string;
  }): Promise<{
    results: ResearchResult[];
    agreement: number;
    mergedSources: ResearchResult["sources"];
  }> {
    const responses = await this.orchestrator.consensus(
      {
        intent: "research",
        systemPrompt: RESEARCH_SYSTEM_PROMPT,
        prompt: buildResearchPrompt({ ...params, depth: "standard" }),
      },
      ["perplexity", "claude"]
    );

    const results = responses.map((r) => parseResearchResponse(r.content));

    // Merge sources from all results, deduplicating by title
    const sourceMap = new Map<string, ResearchResult["sources"][number]>();
    for (const result of results) {
      for (const source of result.sources) {
        if (!sourceMap.has(source.title)) {
          sourceMap.set(source.title, source);
        }
      }
    }

    // Agreement = average of confidence scores (higher when both are confident)
    const confidences = results.map((r) => r.overallConfidence);
    const agreement =
      confidences.length > 0
        ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
        : 0;

    return {
      results,
      agreement: Math.round(agreement * 1000) / 1000,
      mergedSources: [...sourceMap.values()],
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseResearchResponse(content: string): ResearchResult {
  // Extract JSON from possible markdown code fences
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = jsonMatch ? jsonMatch[1].trim() : content.trim();

  const parsed = JSON.parse(raw);
  return ResearchResultSchema.parse(parsed);
}

export {
  RESEARCH_SYSTEM_PROMPT,
  RESEARCH_SYNTHESIS_PROMPT,
} from "./prompts.js";
