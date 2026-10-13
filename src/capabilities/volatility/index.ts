import { Orchestrator } from "../../orchestrator/index.js";
import { VolatilityAssessmentSchema, type VolatilityAssessment } from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  VOLATILITY_SYSTEM_PROMPT,
  buildVolatilityPrompt,
  buildVolSurfacePrompt,
  buildVolRegimePrompt,
  buildIvRvSpreadPrompt,
} from "./prompts.js";

export class VolatilityAnalyzer {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  async analyze(params: {
    ticker: string;
    currentPrice?: number;
    ivData?: string;
    rvData?: string;
    optionsChain?: string;
    timeframe?: string;
  }): Promise<VolatilityAssessment> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: buildVolatilityPrompt(params),
      preferredProvider: "claude",
    });

    return parseVolatilityResponse(response.content);
  }

  async analyzeSurface(params: {
    ticker: string;
    strikeRange: string;
    expirations: string[];
    surfaceData?: string;
  }): Promise<VolatilityAssessment> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: buildVolSurfacePrompt(params),
      preferredProvider: "claude",
    });

    return parseVolatilityResponse(response.content);
  }

  async classifyRegime(params: {
    ticker: string;
    historicalVol: string;
    currentConditions?: string;
  }): Promise<VolatilityAssessment> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: buildVolRegimePrompt(params),
      preferredProvider: "claude",
    });

    return parseVolatilityResponse(response.content);
  }

  async analyzeSpread(params: {
    ticker: string;
    ivHistory: string;
    rvHistory: string;
  }): Promise<VolatilityAssessment> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: buildIvRvSpreadPrompt(params),
      preferredProvider: "claude",
    });

    return parseVolatilityResponse(response.content);
  }

  async consensus(params: {
    ticker: string;
    currentPrice?: number;
    ivData?: string;
    rvData?: string;
    providers?: Array<"claude" | "grok" | "perplexity">;
  }): Promise<{
    results: VolatilityAssessment[];
    aggregateIvRank: number;
    regimeConsensus: string;
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

    const results: VolatilityAssessment[] = [];
    for (const r of responses) {
      try {
        results.push(parseVolatilityResponse(r.content));
      } catch {
        // Skip unparseable responses in consensus
      }
    }

    if (results.length === 0) {
      throw new Error("No valid volatility results from any model");
    }

    const ivRanks = results.map((r) => r.ivRank);
    const aggregateIvRank =
      ivRanks.reduce((sum, r) => sum + r, 0) / ivRanks.length;

    const regimeCounts = new Map<string, number>();
    for (const r of results) {
      regimeCounts.set(r.regime, (regimeCounts.get(r.regime) ?? 0) + 1);
    }
    let regimeConsensus = "normal";
    let maxCount = 0;
    for (const [regime, count] of regimeCounts) {
      if (count > maxCount) {
        maxCount = count;
        regimeConsensus = regime;
      }
    }

    const agreement = maxCount / results.length;

    return { results, aggregateIvRank, regimeConsensus, agreement };
  }
}

function parseVolatilityResponse(content: string): VolatilityAssessment {
  return parseJsonResponse(content, VolatilityAssessmentSchema);
}

export { VOLATILITY_SYSTEM_PROMPT } from "./prompts.js";
