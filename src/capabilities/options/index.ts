import { Orchestrator } from "../../orchestrator/index.js";
import {
  OptionsFlowSchema,
  VolatilitySurfaceSchema,
  OptionsStrategySchema,
  GreeksAnalysisSchema,
  GexAnalysisSchema,
  type OptionsFlow,
  type VolatilitySurface,
  type OptionsStrategy,
  type GreeksAnalysis,
  type GexAnalysis,
} from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  OPTIONS_SYSTEM_PROMPT,
  buildOptionsFlowPrompt,
  buildVolatilitySurfacePrompt,
  buildOptionsStrategyPrompt,
  buildGreeksAnalysisPrompt,
  buildGexAnalysisPrompt,
} from "./prompts.js";

export class OptionsIntelligence {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  async analyzeFlow(params: {
    ticker: string;
    flowData: string;
    currentPrice: number;
    historicalIV?: string;
    openInterest?: string;
  }): Promise<OptionsFlow> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: OPTIONS_SYSTEM_PROMPT,
      prompt: buildOptionsFlowPrompt(params),
    });

    return parseJsonResponse(response.content, OptionsFlowSchema);
  }

  async analyzeVolatilitySurface(params: {
    ticker: string;
    currentPrice: number;
    ivData: string;
    historicalVolatility?: number;
    earningsDate?: string;
    vixLevel?: number;
  }): Promise<VolatilitySurface> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: OPTIONS_SYSTEM_PROMPT,
      prompt: buildVolatilitySurfacePrompt(params),
    });

    return parseJsonResponse(response.content, VolatilitySurfaceSchema);
  }

  async recommendStrategy(params: {
    ticker: string;
    currentPrice: number;
    outlook: "bullish" | "bearish" | "neutral" | "volatile";
    timeHorizon: "weekly" | "monthly" | "quarterly";
    riskTolerance: "conservative" | "moderate" | "aggressive";
    accountSize: number;
    ivEnvironment?: string;
    constraints?: string[];
  }): Promise<OptionsStrategy> {
    const response = await this.orchestrator.execute({
      intent: "signal",
      systemPrompt: OPTIONS_SYSTEM_PROMPT,
      prompt: buildOptionsStrategyPrompt(params),
    });

    return parseJsonResponse(response.content, OptionsStrategySchema);
  }

  async analyzeGreeks(params: {
    ticker: string;
    positions: string;
    currentPrice: number;
    daysToExpiry: number;
    impliedVolatility: number;
  }): Promise<GreeksAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "risk",
      systemPrompt: OPTIONS_SYSTEM_PROMPT,
      prompt: buildGreeksAnalysisPrompt(params),
    });

    return parseJsonResponse(response.content, GreeksAnalysisSchema);
  }

  async analyzeGex(params: {
    ticker: string;
    currentPrice: number;
    optionsOIData: string;
    dealerPositioning?: string;
  }): Promise<GexAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: OPTIONS_SYSTEM_PROMPT,
      prompt: buildGexAnalysisPrompt(params),
    });

    return parseJsonResponse(response.content, GexAnalysisSchema);
  }

  async consensus(params: {
    ticker: string;
    flowData: string;
    currentPrice: number;
    providers?: Array<"claude" | "grok" | "perplexity">;
  }): Promise<{
    results: OptionsFlow[];
    aggregateBias: string;
    agreement: number;
  }> {
    const responses = await this.orchestrator.consensus(
      {
        intent: "reasoning",
        systemPrompt: OPTIONS_SYSTEM_PROMPT,
        prompt: buildOptionsFlowPrompt(params),
      },
      params.providers ?? ["claude", "grok"]
    );

    const results: OptionsFlow[] = [];
    for (const r of responses) {
      try {
        results.push(parseJsonResponse(r.content, OptionsFlowSchema));
      } catch {
        // Skip unparseable responses
      }
    }

    if (results.length === 0) {
      throw new Error("No valid options flow results from any model");
    }

    const biasScores = results.map((r) => biasToScore(r.flowBias));
    const avgScore =
      biasScores.reduce((sum, s) => sum + s, 0) / biasScores.length;

    const mean = avgScore;
    const variance =
      biasScores.reduce((sum, s) => sum + (s - mean) ** 2, 0) /
      biasScores.length;
    const agreement = Math.max(0, 1 - Math.sqrt(variance));

    return {
      results,
      aggregateBias: scoreToBias(avgScore),
      agreement,
    };
  }
}

function biasToScore(bias: string): number {
  const map: Record<string, number> = {
    strongly_bullish: 1.0,
    bullish: 0.5,
    neutral: 0.0,
    bearish: -0.5,
    strongly_bearish: -1.0,
  };
  return map[bias] ?? 0;
}

function scoreToBias(score: number): string {
  if (score >= 0.6) return "strongly_bullish";
  if (score >= 0.2) return "bullish";
  if (score >= -0.2) return "neutral";
  if (score >= -0.6) return "bearish";
  return "strongly_bearish";
}

export { OPTIONS_SYSTEM_PROMPT } from "./prompts.js";
