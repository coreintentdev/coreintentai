import { Orchestrator } from "../../orchestrator/index.js";
import {
  CorrelationResultSchema,
  type CorrelationResult,
} from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  CORRELATION_SYSTEM_PROMPT,
  buildCorrelationPrompt,
  buildRegimeCorrelationPrompt,
  buildDiversificationPrompt,
  buildContagionPrompt,
} from "./prompts.js";

export class CorrelationAnalyzer {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  async analyze(params: {
    assets: string[];
    marketContext?: string;
    timeHorizon?: "short_term" | "medium_term" | "long_term";
    priceData?: string;
  }): Promise<CorrelationResult> {
    const response = await this.orchestrator.execute({
      intent: "correlation",
      systemPrompt: CORRELATION_SYSTEM_PROMPT,
      prompt: buildCorrelationPrompt(params),
    });

    return parseCorrelationResponse(response.content);
  }

  async regimeConditional(params: {
    assets: string[];
    currentRegime: string;
    historicalRegimes?: string;
    stressScenarios?: string[];
  }): Promise<CorrelationResult> {
    const response = await this.orchestrator.execute({
      intent: "correlation",
      systemPrompt: CORRELATION_SYSTEM_PROMPT,
      prompt: buildRegimeCorrelationPrompt(params),
    });

    return parseCorrelationResponse(response.content);
  }

  async diversificationScore(params: {
    portfolio: Array<{ ticker: string; weight: number }>;
    marketContext?: string;
  }): Promise<CorrelationResult> {
    const response = await this.orchestrator.execute({
      intent: "correlation",
      systemPrompt: CORRELATION_SYSTEM_PROMPT,
      prompt: buildDiversificationPrompt(params),
    });

    return parseCorrelationResponse(response.content);
  }

  async contagionRisk(params: {
    sourceAsset: string;
    targetAssets: string[];
    scenario: string;
  }): Promise<CorrelationResult> {
    const response = await this.orchestrator.execute({
      intent: "correlation",
      systemPrompt: CORRELATION_SYSTEM_PROMPT,
      prompt: buildContagionPrompt(params),
    });

    return parseCorrelationResponse(response.content);
  }

  async consensus(params: {
    assets: string[];
    marketContext?: string;
    providers?: Array<"claude" | "grok" | "perplexity">;
  }): Promise<{
    results: CorrelationResult[];
    averageDiversification: number | null;
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

    const results: CorrelationResult[] = [];
    for (const r of responses) {
      try {
        results.push(parseCorrelationResponse(r.content));
      } catch {
        // Skip unparseable
      }
    }

    if (results.length === 0) {
      throw new Error("No valid correlation results from any model");
    }

    const divScores = results
      .map((r) => r.diversificationScore)
      .filter((s): s is number => s != null);

    const averageDiversification =
      divScores.length > 0
        ? divScores.reduce((sum, s) => sum + s, 0) / divScores.length
        : null;

    const allPairCorrelations = results.map((r) =>
      r.pairs.map((p) => p.correlation)
    );
    const agreement = computeCorrelationAgreement(allPairCorrelations);

    return { results, averageDiversification, agreement };
  }
}

function parseCorrelationResponse(content: string): CorrelationResult {
  return parseJsonResponse(content, CorrelationResultSchema);
}

function computeCorrelationAgreement(
  allPairCorrelations: number[][]
): number {
  if (allPairCorrelations.length < 2) return 1;

  const pairCount = Math.min(
    ...allPairCorrelations.map((a) => a.length)
  );
  if (pairCount === 0) return 0;

  let totalDifference = 0;
  let comparisons = 0;

  for (let i = 0; i < pairCount; i++) {
    const values = allPairCorrelations.map((a) => a[i]).filter((v) => v != null);
    if (values.length < 2) continue;

    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const maxDiff = Math.max(...values.map((v) => Math.abs(v - mean)));
    totalDifference += maxDiff;
    comparisons++;
  }

  if (comparisons === 0) return 0;
  return Math.max(0, 1 - totalDifference / comparisons);
}

export { CORRELATION_SYSTEM_PROMPT } from "./prompts.js";
