import { Orchestrator } from "../../orchestrator/index.js";
import {
  AnomalyScanResultSchema,
  AnomalySeverity,
  type AnomalyScanResult,
  type Anomaly,
} from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  ANOMALY_SYSTEM_PROMPT,
  buildAnomalyScanPrompt,
  buildMultiAssetAnomalyScanPrompt,
  buildAnomalyContextPrompt,
} from "./prompts.js";

const SEVERITY_RANK: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export class AnomalyDetector {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  async scan(params: {
    ticker: string;
    currentPrice: number;
    volumeData?: string;
    priceData?: string;
    volatilityData?: string;
    optionsData?: string;
    breadthData?: string;
  }): Promise<AnomalyScanResult> {
    const response = await this.orchestrator.execute({
      intent: "fast_analysis",
      systemPrompt: ANOMALY_SYSTEM_PROMPT,
      prompt: buildAnomalyScanPrompt(params),
    });

    return parseJsonResponse(response.content, AnomalyScanResultSchema);
  }

  async scanMultiAsset(params: {
    tickers: Array<{ ticker: string; currentPrice: number }>;
    marketData?: string;
  }): Promise<AnomalyScanResult> {
    const response = await this.orchestrator.execute({
      intent: "fast_analysis",
      systemPrompt: ANOMALY_SYSTEM_PROMPT,
      prompt: buildMultiAssetAnomalyScanPrompt(params),
    });

    return parseJsonResponse(response.content, AnomalyScanResultSchema);
  }

  async deepAnalyze(params: {
    ticker: string;
    currentPrice: number;
    volumeData?: string;
    priceData?: string;
    volatilityData?: string;
    optionsData?: string;
    breadthData?: string;
    historicalData?: string;
  }): Promise<{
    scan: AnomalyScanResult;
    context: AnomalyScanResult | null;
  }> {
    const scan = await this.scan(params);

    if (scan.anomalies.length === 0) {
      return { scan, context: null };
    }

    const topAnomaly = scan.anomalies.reduce((max: Anomaly, a: Anomaly) =>
      SEVERITY_RANK[a.severity] > SEVERITY_RANK[max.severity] ? a : max
    );

    try {
      const contextResponse = await this.orchestrator.execute({
        intent: "reasoning",
        systemPrompt: ANOMALY_SYSTEM_PROMPT,
        prompt: buildAnomalyContextPrompt({
          anomaly: JSON.stringify(topAnomaly, null, 2),
          historicalData: params.historicalData,
        }),
        preferredProvider: "claude",
      });

      const context = parseJsonResponse(
        contextResponse.content,
        AnomalyScanResultSchema
      );
      return { scan, context };
    } catch {
      return { scan, context: null };
    }
  }

  async consensus(params: {
    ticker: string;
    currentPrice: number;
    priceData?: string;
    volumeData?: string;
    providers?: Array<"claude" | "grok" | "perplexity">;
  }): Promise<{
    scans: AnomalyScanResult[];
    mergedAnomalies: AnomalyScanResult;
    agreement: number;
  }> {
    const responses = await this.orchestrator.consensus(
      {
        intent: "fast_analysis",
        systemPrompt: ANOMALY_SYSTEM_PROMPT,
        prompt: buildAnomalyScanPrompt(params),
      },
      params.providers ?? ["claude", "grok"]
    );

    const scans: AnomalyScanResult[] = [];
    for (const r of responses) {
      try {
        scans.push(parseJsonResponse(r.content, AnomalyScanResultSchema));
      } catch {
        // Skip unparseable responses
      }
    }

    if (scans.length === 0) {
      throw new Error("No valid anomaly scans from any model");
    }

    const allAnomalies = scans.flatMap((s) => s.anomalies);

    const typeGroups = new Map<string, typeof allAnomalies>();
    for (const a of allAnomalies) {
      const key = a.anomalyType;
      if (!typeGroups.has(key)) typeGroups.set(key, []);
      typeGroups.get(key)!.push(a);
    }

    // Keep anomalies detected by multiple models (or high-severity single detections)
    const confirmed: Anomaly[] = [];
    for (const [, group] of typeGroups) {
      if (group.length > 1 || SEVERITY_RANK[group[0].severity] >= 2) {
        const best = group.reduce((max: Anomaly, a: Anomaly) =>
          a.confidence > max.confidence ? a : max
        );
        confirmed.push(best);
      }
    }

    const overallSeverity = confirmed.length > 0
      ? confirmed.reduce((max: Anomaly, a: Anomaly) =>
          SEVERITY_RANK[a.severity] > SEVERITY_RANK[max.severity] ? a : max
        ).severity
      : "low";

    const anomalyTypeSets = scans.map(
      (s) => new Set(s.anomalies.map((a) => a.anomalyType))
    );
    let pairwiseAgreement = 0;
    let pairCount = 0;
    for (let i = 0; i < anomalyTypeSets.length; i++) {
      for (let j = i + 1; j < anomalyTypeSets.length; j++) {
        const setA = anomalyTypeSets[i];
        const setB = anomalyTypeSets[j];
        const union = new Set([...setA, ...setB]);
        const intersection = [...setA].filter((x) => setB.has(x));
        pairwiseAgreement += union.size > 0 ? intersection.length / union.size : 1;
        pairCount++;
      }
    }

    const agreement = pairCount > 0 ? pairwiseAgreement / pairCount : 1;

    const mergedAnomalies: AnomalyScanResult = {
      ticker: params.ticker,
      anomalies: confirmed,
      overallAlertLevel: AnomalySeverity.parse(overallSeverity),
      marketCondition: scans[0].marketCondition,
      summary: `Consensus scan: ${confirmed.length} anomalies confirmed across ${scans.length} models (agreement: ${(agreement * 100).toFixed(0)}%).`,
      timestamp: new Date().toISOString(),
    };

    return { scans, mergedAnomalies, agreement };
  }
}

export { ANOMALY_SYSTEM_PROMPT } from "./prompts.js";
