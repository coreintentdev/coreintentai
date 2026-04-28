import { Orchestrator } from "../../orchestrator/index.js";
import {
  VolatilityAnalysisSchema,
  type VolatilityAnalysis,
} from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  VOLATILITY_SYSTEM_PROMPT,
  buildVolatilitySurfacePrompt,
  buildTermStructurePrompt,
  buildSkewAnalysisPrompt,
  buildRealizedVsImpliedPrompt,
} from "./prompts.js";

export class VolatilityAnalyzer {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  async analyzeSurface(params: {
    ticker: string;
    currentPrice: number;
    optionsData?: string;
    historicalVolData?: string;
    ivData?: string;
    marketContext?: string;
  }): Promise<VolatilityAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: buildVolatilitySurfacePrompt(params),
    });

    return parseJsonResponse(response.content, VolatilityAnalysisSchema);
  }

  async termStructure(params: {
    ticker: string;
    expirations: Array<{ date: string; iv: number }>;
    historicalContext?: string;
  }): Promise<VolatilityAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: buildTermStructurePrompt(params),
    });

    return parseJsonResponse(response.content, VolatilityAnalysisSchema);
  }

  async skewAnalysis(params: {
    ticker: string;
    currentPrice: number;
    putIVs?: string;
    callIVs?: string;
    historicalSkew?: string;
  }): Promise<VolatilityAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: buildSkewAnalysisPrompt(params),
    });

    return parseJsonResponse(response.content, VolatilityAnalysisSchema);
  }

  async realizedVsImplied(params: {
    ticker: string;
    currentIV: number;
    windows: Array<{ period: string; realizedVol: number }>;
    ivHistory?: string;
  }): Promise<VolatilityAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: buildRealizedVsImpliedPrompt(params),
    });

    return parseJsonResponse(response.content, VolatilityAnalysisSchema);
  }

  /**
   * Two-pass volatility analysis: fast pre-screen with Grok, deep dive with Claude.
   * Returns both the quick read and the deep analysis.
   */
  async tieredAnalysis(params: {
    ticker: string;
    currentPrice: number;
    optionsData?: string;
    historicalVolData?: string;
  }): Promise<{ quickRead: VolatilityAnalysis; deepAnalysis: VolatilityAnalysis }> {
    const quickResponse = await this.orchestrator.execute({
      intent: "fast_analysis",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: buildVolatilitySurfacePrompt({
        ticker: params.ticker,
        currentPrice: params.currentPrice,
        optionsData: params.optionsData,
        historicalVolData: params.historicalVolData,
      }),
    });

    const quickRead = parseJsonResponse(quickResponse.content, VolatilityAnalysisSchema);

    const deepResponse = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: buildVolatilitySurfacePrompt({
        ticker: params.ticker,
        currentPrice: params.currentPrice,
        optionsData: params.optionsData,
        historicalVolData: params.historicalVolData,
        marketContext: `Quick analysis found: IV ${quickRead.currentIV}%, RV ${quickRead.currentRV}%, regime ${quickRead.volatilityRegime}, term structure ${quickRead.termStructure.shape}, skew ${quickRead.skew.pattern}. Confirm or challenge these findings with deeper analysis.`,
      }),
    });

    const deepAnalysis = parseJsonResponse(deepResponse.content, VolatilityAnalysisSchema);

    return { quickRead, deepAnalysis };
  }
}

export { VOLATILITY_SYSTEM_PROMPT } from "./prompts.js";
