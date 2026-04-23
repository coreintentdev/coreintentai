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
  buildSynthesisPrompt,
} from "./prompts.js";

export interface ResearchResult {
  content: string;
  provider: string;
  latencyMs: number;
  citations: string[];
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
      citations: extractCitations(response.content),
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
      citations: extractCitations(response.content),
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
      citations: extractCitations(response.content),
    };
  }

  /**
   * Multi-source research: query Perplexity (web) and Claude (reasoning)
   * in parallel, then synthesize into a unified analysis.
   */
  async deepDive(params: {
    query: string;
    ticker?: string;
  }): Promise<{
    webResearch: ResearchResult;
    analysis: ResearchResult;
    synthesis: ResearchResult;
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
      prompt: buildSynthesisPrompt({
        webResearch: webResponse.content.slice(0, 3000),
        analysis: analysisResponse.content.slice(0, 3000),
        query: params.query,
        ticker: params.ticker,
      }),
      preferredProvider: "claude",
    });

    return {
      webResearch: {
        content: webResponse.content,
        provider: webResponse.provider,
        latencyMs: webResponse.latencyMs,
        citations: extractCitations(webResponse.content),
      },
      analysis: {
        content: analysisResponse.content,
        provider: analysisResponse.provider,
        latencyMs: analysisResponse.latencyMs,
        citations: extractCitations(analysisResponse.content),
      },
      synthesis: {
        content: synthesisResponse.content,
        provider: synthesisResponse.provider,
        latencyMs: synthesisResponse.latencyMs,
        citations: extractCitations(synthesisResponse.content),
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract citations/URLs from research content.
 * Handles common patterns: markdown links, bare URLs, numbered references.
 */
function extractCitations(content: string): string[] {
  const citations = new Set<string>();

  // Markdown links: [text](url)
  const markdownLinks = content.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g);
  for (const match of markdownLinks) {
    citations.add(match[2]);
  }

  // Bare URLs not inside markdown
  const bareUrls = content.matchAll(
    /(?<!\()(https?:\/\/[^\s)<>\]]+)/g
  );
  for (const match of bareUrls) {
    citations.add(match[1]);
  }

  // Numbered references like [1] Source Name
  const numberedRefs = content.matchAll(/^\[(\d+)\]\s+([^\n]+)/gm);
  for (const match of numberedRefs) {
    const ref = match[2].trim();
    if (ref && !ref.startsWith("(")) {
      citations.add(ref);
    }
  }

  return [...citations];
}

export { extractCitations as _extractCitations };

export { RESEARCH_SYSTEM_PROMPT } from "./prompts.js";
