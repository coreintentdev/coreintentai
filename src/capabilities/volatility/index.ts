import { Orchestrator } from "../../orchestrator/index.js";
import {
  VolatilityAnalysisSchema,
  VolSurfaceSnapshotSchema,
  type VolatilityAnalysis,
  type VolSurfaceSnapshot,
} from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  VOLATILITY_SYSTEM_PROMPT,
  buildVolatilityAnalysisPrompt,
  buildVolSurfacePrompt,
  buildSkewAnalysisPrompt,
} from "./prompts.js";

export class VolatilityIntelligence {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  async analyze(params: {
    ticker: string;
    currentPrice: number;
    optionsData?: string;
    ivData?: string;
    historicalVolData?: string;
    vixLevel?: number;
    earningsDate?: string;
  }): Promise<VolatilityAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: buildVolatilityAnalysisPrompt(params),
    });

    return parseJsonResponse(response.content, VolatilityAnalysisSchema);
  }

  async surface(params: {
    ticker: string;
    currentPrice: number;
    fullChainData?: string;
    surfaceData?: string;
    upcomingEvents?: string;
  }): Promise<VolSurfaceSnapshot> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: buildVolSurfacePrompt(params),
    });

    return parseJsonResponse(response.content, VolSurfaceSnapshotSchema);
  }

  async analyzeSkew(params: {
    ticker: string;
    currentPrice: number;
    skewData?: string;
    historicalSkew?: string;
    marketContext?: string;
  }): Promise<VolatilityAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: buildSkewAnalysisPrompt(params),
    });

    return parseJsonResponse(response.content, VolatilityAnalysisSchema);
  }

  /**
   * Multi-model vol consensus: Claude for structural analysis, Grok for speed
   * read, then synthesize for higher confidence.
   */
  async consensus(params: {
    ticker: string;
    currentPrice: number;
    optionsData?: string;
    ivData?: string;
    historicalVolData?: string;
  }): Promise<{
    analyses: VolatilityAnalysis[];
    agreement: number;
  }> {
    const prompt = buildVolatilityAnalysisPrompt(params);

    const responses = await this.orchestrator.consensus(
      {
        intent: "reasoning",
        systemPrompt: VOLATILITY_SYSTEM_PROMPT,
        prompt,
      },
      ["claude", "grok"]
    );

    const analyses = responses.map((r) =>
      parseJsonResponse(r.content, VolatilityAnalysisSchema)
    );

    const agreement = this.calculateAgreement(analyses);

    return { analyses, agreement };
  }

  /**
   * Tiered analysis: fast Grok pre-screen, deep Claude dive if IV rank is
   * extreme (>70 or <30) — where vol trades have the highest edge.
   */
  async tieredAnalysis(params: {
    ticker: string;
    currentPrice: number;
    ivData?: string;
    optionsData?: string;
    ivRankThresholdHigh?: number;
    ivRankThresholdLow?: number;
  }): Promise<{
    quickRead: VolatilityAnalysis;
    deepDive: VolatilityAnalysis | null;
    actionable: boolean;
  }> {
    const quickRead = await this.orchestrator.execute({
      intent: "fast_analysis",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: buildVolatilityAnalysisPrompt({
        ticker: params.ticker,
        currentPrice: params.currentPrice,
        ivData: params.ivData,
      }),
    });

    const analysis = parseJsonResponse(
      quickRead.content,
      VolatilityAnalysisSchema
    );

    const highThreshold = params.ivRankThresholdHigh ?? 70;
    const lowThreshold = params.ivRankThresholdLow ?? 30;
    const isExtreme =
      analysis.ivRank >= highThreshold || analysis.ivRank <= lowThreshold;

    if (!isExtreme) {
      return { quickRead: analysis, deepDive: null, actionable: false };
    }

    const deepResponse = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: buildVolatilityAnalysisPrompt({
        ticker: params.ticker,
        currentPrice: params.currentPrice,
        ivData: params.ivData,
        optionsData: params.optionsData,
      }),
    });

    const deepAnalysis = parseJsonResponse(
      deepResponse.content,
      VolatilityAnalysisSchema
    );

    return { quickRead: analysis, deepDive: deepAnalysis, actionable: true };
  }

  private calculateAgreement(analyses: VolatilityAnalysis[]): number {
    if (analyses.length < 2) return 1;

    const signals = analyses.map((a) => a.signal);
    const signalMatch = signals.every((s) => s === signals[0]) ? 1 : 0;

    const ivRanks = analyses.map((a) => a.ivRank);
    const ivRankRange = Math.max(...ivRanks) - Math.min(...ivRanks);
    const ivRankAgreement = Math.max(0, 1 - ivRankRange / 50);

    const skewTypes = analyses.map((a) => a.skew.type);
    const skewMatch = skewTypes.every((s) => s === skewTypes[0]) ? 1 : 0;

    return signalMatch * 0.4 + ivRankAgreement * 0.3 + skewMatch * 0.3;
  }
}

export { VOLATILITY_SYSTEM_PROMPT } from "./prompts.js";
