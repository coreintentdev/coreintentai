import { Orchestrator } from "../../orchestrator/index.js";
import {
  PortfolioIntelligenceSchema,
  type PortfolioIntelligence,
} from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  PORTFOLIO_INTELLIGENCE_SYSTEM_PROMPT,
  buildPortfolioAnalysisPrompt,
  buildQuickScanPrompt,
  buildStressTestPrompt,
} from "./prompts.js";

export class PortfolioIntelligenceEngine {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  async analyze(params: {
    positions: Array<{
      ticker: string;
      weight: number;
      currentPrice?: number;
      entryPrice?: number;
      pnlPct?: number;
    }>;
    totalValue?: number;
    cashPct?: number;
    regimeContext?: string;
    sentimentData?: string;
    momentumData?: string;
    correlationData?: string;
    riskData?: string;
    anomalyData?: string;
    marketContext?: string;
  }): Promise<PortfolioIntelligence> {
    const supplementary: Record<string, string> = {};

    const gatherPromises: Promise<{ type: string; content: string }>[] = [];

    if (!params.regimeContext) {
      gatherPromises.push(
        this.orchestrator
          .execute({
            intent: "reasoning",
            prompt: `Analyze the current market regime for a portfolio containing: ${params.positions.map((p) => p.ticker).join(", ")}. ${params.marketContext ? `Context: ${params.marketContext}` : ""} Provide: regime type, confidence, and strategic implications. Keep response under 200 words.`,
          })
          .then((r) => ({ type: "regime", content: r.content }))
      );
    }

    if (!params.sentimentData) {
      gatherPromises.push(
        this.orchestrator
          .execute({
            intent: "fast_analysis",
            prompt: `Quick sentiment read for: ${params.positions.map((p) => p.ticker).join(", ")}. For each ticker, provide: bullish/bearish/neutral, confidence (0-1), one-sentence driver. Keep it concise.`,
          })
          .then((r) => ({ type: "sentiment", content: r.content }))
      );
    }

    if (gatherPromises.length > 0) {
      const gathered = await Promise.all(gatherPromises);
      for (const g of gathered) {
        supplementary[g.type] = g.content;
      }
    }

    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: PORTFOLIO_INTELLIGENCE_SYSTEM_PROMPT,
      prompt: buildPortfolioAnalysisPrompt({
        ...params,
        regimeContext: params.regimeContext ?? supplementary.regime,
        sentimentData: params.sentimentData ?? supplementary.sentiment,
      }),
    });

    return parseJsonResponse(response.content, PortfolioIntelligenceSchema);
  }

  async quickScan(params: {
    tickers: string[];
    marketContext?: string;
  }): Promise<PortfolioIntelligence> {
    const response = await this.orchestrator.execute({
      intent: "fast_analysis",
      systemPrompt: PORTFOLIO_INTELLIGENCE_SYSTEM_PROMPT,
      prompt: buildQuickScanPrompt(params),
    });

    return parseJsonResponse(response.content, PortfolioIntelligenceSchema);
  }

  async stressTest(params: {
    positions: Array<{ ticker: string; weight: number }>;
    scenario: string;
    historicalContext?: string;
  }): Promise<PortfolioIntelligence> {
    const responses = await this.orchestrator.consensus(
      {
        intent: "reasoning",
        systemPrompt: PORTFOLIO_INTELLIGENCE_SYSTEM_PROMPT,
        prompt: buildStressTestPrompt(params),
      },
      ["claude", "grok"]
    );

    for (const r of responses) {
      try {
        return parseJsonResponse(r.content, PortfolioIntelligenceSchema);
      } catch {
        continue;
      }
    }
    throw new Error(
      "No valid portfolio intelligence from any model in stress test"
    );
  }
}

export { PORTFOLIO_INTELLIGENCE_SYSTEM_PROMPT } from "./prompts.js";
