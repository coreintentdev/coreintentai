/**
 * CoreIntent AI — Correlation & Concentration Analysis
 *
 * Detects hidden portfolio correlations, concentration risks, and
 * tail-risk clusters. Uses Claude for deep reasoning about cross-asset
 * relationships and crisis-regime behavior.
 */

import { Orchestrator } from "../../orchestrator/index.js";
import {
  CorrelationAnalysisSchema,
  type CorrelationAnalysis,
} from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  CORRELATION_SYSTEM_PROMPT,
  buildCorrelationPrompt,
  buildStressCorrelationPrompt,
  buildConcentrationPrompt,
} from "./prompts.js";

export class CorrelationAnalyzer {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  /**
   * Full correlation and concentration analysis of a portfolio.
   */
  async analyze(params: {
    positions: Array<{
      ticker: string;
      weight: number;
      sector?: string;
      beta?: number;
      marketCap?: string;
    }>;
    totalValue?: number;
    benchmarks?: string[];
  }): Promise<CorrelationAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "correlation",
      systemPrompt: CORRELATION_SYSTEM_PROMPT,
      prompt: buildCorrelationPrompt(params),
    });

    return parseCorrelationResponse(response.content);
  }

  /**
   * Stress-test correlations under a specific scenario.
   */
  async stressTest(params: {
    positions: Array<{
      ticker: string;
      weight: number;
    }>;
    scenario: string;
  }): Promise<CorrelationAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "correlation",
      systemPrompt: CORRELATION_SYSTEM_PROMPT,
      prompt: buildStressCorrelationPrompt(params),
    });

    return parseCorrelationResponse(response.content);
  }

  /**
   * Pure concentration risk analysis without correlation modeling.
   */
  async concentrationCheck(params: {
    positions: Array<{
      ticker: string;
      weight: number;
      sector?: string;
      marketCap?: string;
      region?: string;
    }>;
  }): Promise<CorrelationAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "correlation",
      systemPrompt: CORRELATION_SYSTEM_PROMPT,
      prompt: buildConcentrationPrompt(params),
    });

    return parseCorrelationResponse(response.content);
  }

  /**
   * Multi-model consensus on portfolio correlation risks.
   */
  async consensus(params: {
    positions: Array<{
      ticker: string;
      weight: number;
      sector?: string;
    }>;
    providers?: Array<"claude" | "grok" | "perplexity">;
  }): Promise<{
    analyses: CorrelationAnalysis[];
    avgDiversificationScore: number;
    agreement: number;
    worstCaseDrawdown: number;
  }> {
    const responses = await this.orchestrator.consensus(
      {
        intent: "correlation",
        systemPrompt: CORRELATION_SYSTEM_PROMPT,
        prompt: buildCorrelationPrompt({ positions: params.positions }),
      },
      params.providers ?? ["claude", "grok"]
    );

    const analyses: CorrelationAnalysis[] = [];
    for (const r of responses) {
      try {
        analyses.push(parseCorrelationResponse(r.content));
      } catch {
        // Skip unparseable responses
      }
    }

    if (analyses.length === 0) {
      throw new Error("No valid correlation analyses from any model");
    }

    const scores = analyses.map((a) => a.diversificationScore);
    const avgDiversificationScore =
      scores.reduce((sum, s) => sum + s, 0) / scores.length;

    const drawdowns = analyses.map(
      (a) => a.tailRiskAssessment.expectedDrawdownPct
    );
    const worstCaseDrawdown = Math.max(...drawdowns);

    const variance =
      scores.reduce((sum, s) => sum + (s - avgDiversificationScore) ** 2, 0) /
      scores.length;
    const agreement = Math.max(0, 1 - Math.sqrt(variance) / 100);

    return {
      analyses,
      avgDiversificationScore,
      agreement,
      worstCaseDrawdown,
    };
  }
}

function parseCorrelationResponse(content: string): CorrelationAnalysis {
  return parseJsonResponse(content, CorrelationAnalysisSchema);
}

export { CORRELATION_SYSTEM_PROMPT } from "./prompts.js";
