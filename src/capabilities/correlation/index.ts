import { Orchestrator } from "../../orchestrator/index.js";
import {
  CorrelationMatrixSchema,
  type CorrelationMatrix,
} from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  CORRELATION_SYSTEM_PROMPT,
  buildCorrelationPrompt,
  buildCorrelationBreakdownPrompt,
  buildStressCorrelationPrompt,
} from "./prompts.js";

export class CorrelationAnalyzer {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  async analyze(params: {
    tickers: string[];
    timeframe?: string;
    priceData?: string;
    sectorData?: string;
  }): Promise<CorrelationMatrix> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: CORRELATION_SYSTEM_PROMPT,
      prompt: buildCorrelationPrompt(params),
    });

    return parseCorrelationResponse(response.content);
  }

  async deepDivePair(params: {
    tickerA: string;
    tickerB: string;
    historicalCorrelation?: number;
    recentEvents?: string;
  }): Promise<CorrelationMatrix> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: CORRELATION_SYSTEM_PROMPT,
      prompt: buildCorrelationBreakdownPrompt(params),
    });

    return parseCorrelationResponse(response.content);
  }

  async stressTest(params: {
    tickers: string[];
    stressScenario: string;
  }): Promise<CorrelationMatrix> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: CORRELATION_SYSTEM_PROMPT,
      prompt: buildStressCorrelationPrompt(params),
    });

    return parseCorrelationResponse(response.content);
  }

  async consensus(params: {
    tickers: string[];
    timeframe?: string;
    providers?: Array<"claude" | "grok" | "perplexity">;
  }): Promise<{
    matrices: CorrelationMatrix[];
    avgDiversificationScore: number;
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

    const matrices: CorrelationMatrix[] = [];
    for (const r of responses) {
      try {
        matrices.push(parseCorrelationResponse(r.content));
      } catch {
        // Skip unparseable responses
      }
    }

    if (matrices.length === 0) {
      throw new Error("No valid correlation analyses from any model");
    }

    const scores = matrices.map((m) => m.diversificationScore);
    const avgDiversificationScore =
      scores.reduce((a, b) => a + b, 0) / scores.length;

    const mean = avgDiversificationScore;
    const variance =
      scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
    const agreement = Math.max(0, 1 - Math.sqrt(variance));

    return { matrices, avgDiversificationScore, agreement };
  }
}

function parseCorrelationResponse(content: string): CorrelationMatrix {
  return parseJsonResponse(content, CorrelationMatrixSchema);
}

export { CORRELATION_SYSTEM_PROMPT } from "./prompts.js";
