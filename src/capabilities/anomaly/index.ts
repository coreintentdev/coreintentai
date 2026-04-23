import { Orchestrator } from "../../orchestrator/index.js";
import {
  AnomalyDetectionSchema,
  type AnomalyDetection,
} from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  ANOMALY_SYSTEM_PROMPT,
  buildAnomalyDetectionPrompt,
  buildStressTestPrompt,
  buildBlackSwanScanPrompt,
} from "./prompts.js";

export class AnomalyDetector {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  async detect(params: {
    ticker?: string;
    priceData?: string;
    volumeData?: string;
    volatilityData?: string;
    optionsFlow?: string;
    breadthData?: string;
    recentNews?: string;
  }): Promise<AnomalyDetection> {
    const response = await this.orchestrator.execute({
      intent: "anomaly",
      systemPrompt: ANOMALY_SYSTEM_PROMPT,
      prompt: buildAnomalyDetectionPrompt(params),
    });

    return parseAnomalyResponse(response.content);
  }

  async stressTest(params: {
    portfolio: Array<{ ticker: string; weight: number }>;
    scenario: string;
    currentConditions?: string;
  }): Promise<AnomalyDetection> {
    const response = await this.orchestrator.execute({
      intent: "anomaly",
      systemPrompt: ANOMALY_SYSTEM_PROMPT,
      prompt: buildStressTestPrompt(params),
    });

    return parseAnomalyResponse(response.content);
  }

  async blackSwanScan(params: {
    marketData?: string;
    geopoliticalContext?: string;
    macroIndicators?: string;
  }): Promise<AnomalyDetection> {
    const response = await this.orchestrator.execute({
      intent: "anomaly",
      systemPrompt: ANOMALY_SYSTEM_PROMPT,
      prompt: buildBlackSwanScanPrompt(params),
    });

    return parseAnomalyResponse(response.content);
  }

  async multiAssetScan(params: {
    tickers: string[];
    priceData?: string;
    volumeData?: string;
  }): Promise<AnomalyDetection[]> {
    const requests = params.tickers.map((ticker) => ({
      intent: "anomaly" as const,
      systemPrompt: ANOMALY_SYSTEM_PROMPT,
      prompt: buildAnomalyDetectionPrompt({
        ticker,
        priceData: params.priceData,
        volumeData: params.volumeData,
      }),
    }));

    const responses = await this.orchestrator.fan(requests);
    const results: AnomalyDetection[] = [];

    for (const r of responses) {
      try {
        results.push(parseAnomalyResponse(r.content));
      } catch {
        // Skip unparseable responses
      }
    }

    return results;
  }

  async consensus(params: {
    ticker?: string;
    priceData?: string;
    volumeData?: string;
    providers?: Array<"claude" | "grok" | "perplexity">;
  }): Promise<{
    results: AnomalyDetection[];
    maxAnomalyScore: number;
    maxBlackSwanProbability: number;
    agreement: number;
  }> {
    const responses = await this.orchestrator.consensus(
      {
        intent: "anomaly",
        systemPrompt: ANOMALY_SYSTEM_PROMPT,
        prompt: buildAnomalyDetectionPrompt(params),
      },
      params.providers ?? ["claude", "grok"]
    );

    const results: AnomalyDetection[] = [];
    for (const r of responses) {
      try {
        results.push(parseAnomalyResponse(r.content));
      } catch {
        // Skip unparseable responses
      }
    }

    if (results.length === 0) {
      throw new Error("No valid anomaly detections from any model");
    }

    const maxAnomalyScore = Math.max(
      ...results.map((r) => r.overallAnomalyScore)
    );
    const maxBlackSwanProbability = Math.max(
      ...results.map((r) => r.blackSwanProbability)
    );

    const anomalyCounts = results.map((r) => r.anomalies.length);
    const mean =
      anomalyCounts.reduce((s, c) => s + c, 0) / anomalyCounts.length;
    const variance =
      anomalyCounts.reduce((s, c) => s + (c - mean) ** 2, 0) /
      anomalyCounts.length;
    const normalizedStdDev =
      mean > 0 ? Math.sqrt(variance) / mean : 0;
    const agreement = Math.max(0, 1 - normalizedStdDev);

    return { results, maxAnomalyScore, maxBlackSwanProbability, agreement };
  }
}

function parseAnomalyResponse(content: string): AnomalyDetection {
  return parseJsonResponse(content, AnomalyDetectionSchema);
}

export { ANOMALY_SYSTEM_PROMPT } from "./prompts.js";
