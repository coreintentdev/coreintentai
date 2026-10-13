import { Orchestrator } from "../../orchestrator/index.js";
import {
  TechnicalAnalysisSchema,
  type TechnicalAnalysis,
} from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  TECHNICAL_SYSTEM_PROMPT,
  buildTechnicalAnalysisPrompt,
  buildMultiTimeframePrompt,
  buildSupportResistancePrompt,
  buildPatternScanPrompt,
  buildTechnicalReviewPrompt,
} from "./prompts.js";

type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "daily" | "weekly";

export class TechnicalAnalyzer {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  async analyze(params: {
    ticker: string;
    currentPrice: number;
    timeframe: Timeframe;
    priceData?: string;
    volumeData?: string;
    indicators?: string;
    chartPatterns?: string;
    marketContext?: string;
  }): Promise<TechnicalAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: TECHNICAL_SYSTEM_PROMPT,
      prompt: buildTechnicalAnalysisPrompt(params),
    });

    return parseJsonResponse(response.content, TechnicalAnalysisSchema);
  }

  async multiTimeframe(params: {
    ticker: string;
    currentPrice: number;
    timeframes: Array<{
      timeframe: string;
      priceData?: string;
      indicators?: string;
    }>;
  }): Promise<TechnicalAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: TECHNICAL_SYSTEM_PROMPT,
      prompt: buildMultiTimeframePrompt(params),
    });

    return parseJsonResponse(response.content, TechnicalAnalysisSchema);
  }

  async supportResistance(params: {
    ticker: string;
    currentPrice: number;
    priceData: string;
    volumeProfile?: string;
  }): Promise<TechnicalAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: TECHNICAL_SYSTEM_PROMPT,
      prompt: buildSupportResistancePrompt(params),
    });

    return parseJsonResponse(response.content, TechnicalAnalysisSchema);
  }

  async patternScan(params: {
    ticker: string;
    currentPrice: number;
    priceData: string;
    patternTypes?: ("classical" | "candlestick" | "harmonic")[];
  }): Promise<TechnicalAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: TECHNICAL_SYSTEM_PROMPT,
      prompt: buildPatternScanPrompt(params),
    });

    return parseJsonResponse(response.content, TechnicalAnalysisSchema);
  }

  /**
   * Two-pass analysis: deep analysis with Claude, then review with Grok.
   * Catches forced patterns, miscounted levels, and probability errors.
   */
  async analyzeWithReview(params: {
    ticker: string;
    currentPrice: number;
    timeframe: Timeframe;
    priceData?: string;
    volumeData?: string;
    indicators?: string;
    marketContext?: string;
  }): Promise<{ analysis: TechnicalAnalysis; reviewed: boolean; adjustments: string }> {
    const analysis = await this.analyze(params);

    const reviewResponse = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: TECHNICAL_SYSTEM_PROMPT,
      prompt: buildTechnicalReviewPrompt({
        analysis: JSON.stringify(analysis, null, 2),
        additionalData: params.marketContext,
      }),
      preferredProvider: "grok",
    });

    try {
      const reviewed = parseJsonResponse(reviewResponse.content, TechnicalAnalysisSchema);
      const adjustments =
        JSON.stringify(analysis) === JSON.stringify(reviewed)
          ? "No adjustments — analysis confirmed."
          : "Analysis was adjusted during review.";
      return { analysis: reviewed, reviewed: true, adjustments };
    } catch {
      return {
        analysis,
        reviewed: true,
        adjustments: `Review comments: ${reviewResponse.content.slice(0, 500)}`,
      };
    }
  }

  /**
   * Consensus technical analysis from multiple models.
   */
  async consensus(params: {
    ticker: string;
    currentPrice: number;
    timeframe: Timeframe;
    priceData?: string;
    indicators?: string;
    providers?: Array<"claude" | "grok" | "perplexity">;
  }): Promise<{
    analyses: TechnicalAnalysis[];
    consensusBias: string;
    averageConfidence: number;
    agreement: number;
  }> {
    const responses = await this.orchestrator.consensus(
      {
        intent: "reasoning",
        systemPrompt: TECHNICAL_SYSTEM_PROMPT,
        prompt: buildTechnicalAnalysisPrompt(params),
      },
      params.providers ?? ["claude", "grok"]
    );

    const analyses: TechnicalAnalysis[] = [];
    for (const r of responses) {
      try {
        analyses.push(parseJsonResponse(r.content, TechnicalAnalysisSchema));
      } catch {
        // Skip unparseable
      }
    }

    if (analyses.length === 0) {
      throw new Error("No valid technical analyses produced by any model");
    }

    const biasScores: Record<string, number> = {
      strongly_bullish: 3,
      bullish: 2,
      slightly_bullish: 1,
      neutral: 0,
      slightly_bearish: -1,
      bearish: -2,
      strongly_bearish: -3,
    };

    const avgScore =
      analyses.reduce((sum, a) => sum + biasScores[a.overallBias], 0) /
      analyses.length;
    const avgConfidence =
      analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length;

    const directions = analyses.map((a) => Math.sign(biasScores[a.overallBias]));
    const allSameDirection = directions.every((d) => d === directions[0]);

    let consensusBias: string;
    if (avgScore >= 2.5) consensusBias = "strongly_bullish";
    else if (avgScore >= 1.5) consensusBias = "bullish";
    else if (avgScore >= 0.5) consensusBias = "slightly_bullish";
    else if (avgScore > -0.5) consensusBias = "neutral";
    else if (avgScore > -1.5) consensusBias = "slightly_bearish";
    else if (avgScore > -2.5) consensusBias = "bearish";
    else consensusBias = "strongly_bearish";

    return {
      analyses,
      consensusBias,
      averageConfidence: avgConfidence,
      agreement: allSameDirection ? 1 : 0.5,
    };
  }
}

export { TECHNICAL_SYSTEM_PROMPT } from "./prompts.js";
