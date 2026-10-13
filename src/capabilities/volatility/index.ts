import { Orchestrator } from "../../orchestrator/index.js";
import {
  VolatilityAnalysisSchema,
  type VolatilityAnalysis,
} from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  VOLATILITY_SYSTEM_PROMPT,
  buildVolatilityPrompt,
  buildVolSurfacePrompt,
  buildVolRegimePrompt,
  buildVolForecastPrompt,
} from "./prompts.js";

export class VolatilityAnalyzer {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  async analyze(params: {
    ticker: string;
    currentPrice?: number;
    optionsData?: string;
    historicalVol?: string;
    vixLevel?: number;
  }): Promise<VolatilityAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: buildVolatilityPrompt(params),
    });

    return parseVolatilityResponse(response.content);
  }

  async surface(params: {
    ticker: string;
    expirations: string[];
    strikes?: string;
    currentPrice?: number;
  }): Promise<VolatilityAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: buildVolSurfacePrompt(params),
    });

    return parseVolatilityResponse(response.content);
  }

  async regimeAssessment(params: {
    tickers: string[];
    marketData?: string;
    vixTermStructure?: string;
  }): Promise<VolatilityAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: buildVolRegimePrompt(params),
    });

    return parseVolatilityResponse(response.content);
  }

  async forecast(params: {
    ticker: string;
    currentIV?: number;
    historicalVol?: string;
    upcomingEvents?: string[];
    regime?: string;
  }): Promise<VolatilityAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: buildVolForecastPrompt(params),
    });

    return parseVolatilityResponse(response.content);
  }

  async consensus(params: {
    ticker: string;
    currentPrice?: number;
    optionsData?: string;
    providers?: Array<"claude" | "grok" | "perplexity">;
  }): Promise<{
    analyses: VolatilityAnalysis[];
    avgIV: number;
    regimeAgreement: boolean;
    agreement: number;
  }> {
    const responses = await this.orchestrator.consensus(
      {
        intent: "reasoning",
        systemPrompt: VOLATILITY_SYSTEM_PROMPT,
        prompt: buildVolatilityPrompt(params),
      },
      params.providers ?? ["claude", "grok"]
    );

    const analyses: VolatilityAnalysis[] = [];
    for (const r of responses) {
      try {
        analyses.push(parseVolatilityResponse(r.content));
      } catch {
        // Skip unparseable responses
      }
    }

    if (analyses.length === 0) {
      throw new Error("No valid volatility analyses from any model");
    }

    const ivValues = analyses.map((a) => a.currentIV);
    const avgIV = ivValues.reduce((sum, v) => sum + v, 0) / ivValues.length;

    const regimes = analyses.map((a) => a.regime);
    const regimeAgreement = regimes.every((r) => r === regimes[0]);

    const mean = avgIV;
    const variance =
      ivValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / ivValues.length;
    const agreement = Math.max(0, 1 - Math.sqrt(variance) / mean);

    return { analyses, avgIV, regimeAgreement, agreement };
  }
}

function parseVolatilityResponse(content: string): VolatilityAnalysis {
  return parseJsonResponse(content, VolatilityAnalysisSchema);
}

export { VOLATILITY_SYSTEM_PROMPT } from "./prompts.js";
