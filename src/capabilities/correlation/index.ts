import { Orchestrator } from "../../orchestrator/index.js";
import { CorrelationMatrixSchema, type CorrelationMatrix } from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  CORRELATION_SYSTEM_PROMPT,
  buildCorrelationPrompt,
  buildPortfolioCorrelationPrompt,
  buildCorrelationShiftPrompt,
} from "./prompts.js";

export class CorrelationAnalyzer {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  async analyze(params: {
    tickers: string[];
    priceData?: string;
    timeframe?: string;
    marketContext?: string;
  }): Promise<CorrelationMatrix> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: CORRELATION_SYSTEM_PROMPT,
      prompt: buildCorrelationPrompt(params),
    });

    return parseJsonResponse(response.content, CorrelationMatrixSchema);
  }

  async analyzePortfolio(params: {
    positions: Array<{ ticker: string; weight: number }>;
    priceData?: string;
    regime?: string;
  }): Promise<CorrelationMatrix> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: CORRELATION_SYSTEM_PROMPT,
      prompt: buildPortfolioCorrelationPrompt(params),
    });

    return parseJsonResponse(response.content, CorrelationMatrixSchema);
  }

  async detectShifts(params: {
    tickers: string[];
    historicalCorrelation: string;
    recentEvents?: string;
  }): Promise<CorrelationMatrix> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: CORRELATION_SYSTEM_PROMPT,
      prompt: buildCorrelationShiftPrompt(params),
    });

    return parseJsonResponse(response.content, CorrelationMatrixSchema);
  }

  async consensus(params: {
    tickers: string[];
    priceData?: string;
    providers?: Array<"claude" | "grok" | "perplexity">;
  }): Promise<{
    results: CorrelationMatrix[];
    consensusDiversification: number;
    agreement: number;
  }> {
    const responses = await this.orchestrator.consensus(
      {
        intent: "reasoning",
        systemPrompt: CORRELATION_SYSTEM_PROMPT,
        prompt: buildCorrelationPrompt(params),
      },
      params.providers ?? ["claude", "grok"]
    );

    const results: CorrelationMatrix[] = [];
    for (const r of responses) {
      try {
        results.push(parseJsonResponse(r.content, CorrelationMatrixSchema));
      } catch {
        // Skip unparseable responses
      }
    }

    if (results.length === 0) {
      throw new Error("No valid correlation results from any model");
    }

    const scores = results.map((r) => r.diversificationScore);
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    const mean = avgScore;
    const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
    const agreement = Math.max(0, 1 - Math.sqrt(variance));

    return { results, consensusDiversification: avgScore, agreement };
  }
}

export { CORRELATION_SYSTEM_PROMPT } from "./prompts.js";
