import { Orchestrator } from "../../orchestrator/index.js";
import {
  CorrelationAnalysisSchema,
  type CorrelationAnalysis,
} from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  CORRELATION_SYSTEM_PROMPT,
  buildCorrelationPrompt,
  buildDivergencePrompt,
  buildPortfolioCorrelationPrompt,
} from "./prompts.js";

export class CorrelationEngine {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  async analyze(params: {
    tickers: string[];
    priceData?: string;
    period?: string;
    focusOn?: "divergences" | "clusters" | "all";
  }): Promise<CorrelationAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "correlation",
      systemPrompt: CORRELATION_SYSTEM_PROMPT,
      prompt: buildCorrelationPrompt(params),
    });

    return parseCorrelationResponse(response.content);
  }

  async detectDivergence(params: {
    tickerA: string;
    tickerB: string;
    historicalCorrelation: number;
    currentCorrelation: number;
    priceDataA?: string;
    priceDataB?: string;
    context?: string;
  }): Promise<CorrelationAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "correlation",
      systemPrompt: CORRELATION_SYSTEM_PROMPT,
      prompt: buildDivergencePrompt(params),
    });

    return parseCorrelationResponse(response.content);
  }

  async portfolioCorrelation(params: {
    positions: Array<{ ticker: string; weight: number; sector?: string }>;
    correlationMatrix?: string;
    riskBudget?: number;
  }): Promise<CorrelationAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "correlation",
      systemPrompt: CORRELATION_SYSTEM_PROMPT,
      prompt: buildPortfolioCorrelationPrompt(params),
    });

    return parseCorrelationResponse(response.content);
  }

  async consensus(params: {
    tickers: string[];
    priceData?: string;
    providers?: Array<"claude" | "grok" | "perplexity">;
  }): Promise<{
    results: CorrelationAnalysis[];
    consensusDivergences: number;
    agreement: number;
  }> {
    const responses = await this.orchestrator.consensus(
      {
        intent: "correlation",
        systemPrompt: CORRELATION_SYSTEM_PROMPT,
        prompt: buildCorrelationPrompt(params),
      },
      params.providers ?? ["claude", "grok"]
    );

    const results: CorrelationAnalysis[] = [];
    for (const r of responses) {
      try {
        results.push(parseCorrelationResponse(r.content));
      } catch {
        // Skip unparseable responses in consensus
      }
    }

    if (results.length === 0) {
      throw new Error("No valid correlation results from any model");
    }

    const divergenceCounts = results.map((r) => r.divergences.length);
    const consensusDivergences = Math.round(
      divergenceCounts.reduce((sum, c) => sum + c, 0) / divergenceCounts.length
    );

    const pairCorrelations = new Map<string, number[]>();
    for (const result of results) {
      for (const pair of result.pairs) {
        const key = [pair.tickerA, pair.tickerB].sort().join(":");
        const existing = pairCorrelations.get(key) ?? [];
        existing.push(pair.correlation);
        pairCorrelations.set(key, existing);
      }
    }

    let totalAgreement = 0;
    let pairCount = 0;
    for (const values of pairCorrelations.values()) {
      if (values.length > 1) {
        const mean = values.reduce((s, v) => s + v, 0) / values.length;
        const variance =
          values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
        totalAgreement += Math.max(0, 1 - Math.sqrt(variance));
        pairCount++;
      }
    }

    const agreement = pairCount > 0 ? totalAgreement / pairCount : 0;

    return { results, consensusDivergences, agreement };
  }
}

function parseCorrelationResponse(content: string): CorrelationAnalysis {
  return parseJsonResponse(content, CorrelationAnalysisSchema);
}

export { CORRELATION_SYSTEM_PROMPT } from "./prompts.js";
