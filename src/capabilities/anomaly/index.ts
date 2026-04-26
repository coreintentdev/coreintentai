import { Orchestrator } from "../../orchestrator/index.js";
import {
  AnomalyReportSchema,
  type AnomalyReport,
} from "../../types/index.js";
import { parseJsonResponse, parseJsonArrayResponse } from "../../utils/json-parser.js";
import {
  ANOMALY_SYSTEM_PROMPT,
  buildAnomalyDetectionPrompt,
  buildMultiAssetAnomalyScanPrompt,
  buildAnomalyContextPrompt,
} from "./prompts.js";

export class AnomalyDetector {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  async scan(params: {
    ticker: string;
    currentPrice: number;
    priceData?: string;
    volumeData?: string;
    optionsData?: string;
    technicalData?: string;
    newsContext?: string;
  }): Promise<AnomalyReport> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: ANOMALY_SYSTEM_PROMPT,
      prompt: buildAnomalyDetectionPrompt(params),
    });

    return parseJsonResponse(response.content, AnomalyReportSchema);
  }

  async multiAssetScan(params: {
    tickers: Array<{ ticker: string; currentPrice: number }>;
    marketData?: string;
    crossAssetData?: string;
  }): Promise<AnomalyReport[]> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: ANOMALY_SYSTEM_PROMPT,
      prompt: buildMultiAssetAnomalyScanPrompt(params),
    });

    return parseJsonArrayResponse(response.content, AnomalyReportSchema);
  }

  async deepDive(params: {
    ticker: string;
    anomalyType: string;
    anomalyDescription: string;
    historicalData?: string;
  }): Promise<AnomalyReport> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: ANOMALY_SYSTEM_PROMPT,
      prompt: buildAnomalyContextPrompt(params),
    });

    return parseJsonResponse(response.content, AnomalyReportSchema);
  }

  /**
   * Fast anomaly pre-screen using Grok for speed, then deep-dive with Claude
   * on anything scored >= the threshold.
   */
  async tieredScan(params: {
    ticker: string;
    currentPrice: number;
    priceData?: string;
    volumeData?: string;
    severityThreshold?: number;
  }): Promise<{ quickScan: AnomalyReport; deepDives: AnomalyReport[] }> {
    const quickScan = await this.orchestrator.execute({
      intent: "fast_analysis",
      systemPrompt: ANOMALY_SYSTEM_PROMPT,
      prompt: buildAnomalyDetectionPrompt({
        ticker: params.ticker,
        currentPrice: params.currentPrice,
        priceData: params.priceData,
        volumeData: params.volumeData,
      }),
    });

    const report = parseJsonResponse(quickScan.content, AnomalyReportSchema);
    const threshold = params.severityThreshold ?? 60;

    const significant = report.anomalies.filter(
      (a) => a.severity >= threshold
    );

    const deepDives: AnomalyReport[] = [];
    for (const anomaly of significant) {
      const deep = await this.deepDive({
        ticker: params.ticker,
        anomalyType: anomaly.type,
        anomalyDescription: anomaly.description,
      });
      deepDives.push(deep);
    }

    return { quickScan: report, deepDives };
  }
}

export { ANOMALY_SYSTEM_PROMPT } from "./prompts.js";
