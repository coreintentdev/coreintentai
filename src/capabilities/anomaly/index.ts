/**
 * CoreIntent AI — Market Anomaly Detection Capability
 *
 * Identifies statistically unusual market behavior across multiple dimensions:
 * volume, price action, sentiment divergences, correlation breaks, volatility
 * regime changes, and unusual options activity.
 *
 * Uses Claude for deep pattern analysis with Grok fallback for speed.
 * Multi-model consensus available for high-stakes anomaly validation.
 */

import { Orchestrator } from "../../orchestrator/index.js";
import {
  AnomalyResultSchema,
  type AnomalyResult,
} from "../../types/index.js";
import {
  ANOMALY_SYSTEM_PROMPT,
  buildAnomalyDetectionPrompt,
  buildMultiTickerAnomalyPrompt,
  buildSentimentDivergencePrompt,
  buildVolatilityRegimePrompt,
} from "./prompts.js";

export class AnomalyDetector {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  /**
   * Scan a single ticker for all types of market anomalies.
   */
  async scan(params: {
    ticker: string;
    priceData?: string;
    volumeData?: string;
    technicalIndicators?: string;
    optionsData?: string;
    sectorData?: string;
    lookbackPeriod?: string;
  }): Promise<AnomalyResult> {
    const response = await this.orchestrator.execute({
      intent: "anomaly",
      systemPrompt: ANOMALY_SYSTEM_PROMPT,
      prompt: buildAnomalyDetectionPrompt(params),
    });

    return parseAnomalyResponse(response.content);
  }

  /**
   * Scan multiple tickers in a single request.
   */
  async scanBatch(params: {
    tickers: string[];
    marketData?: string;
    focusTypes?: string[];
  }): Promise<AnomalyResult[]> {
    const response = await this.orchestrator.execute({
      intent: "anomaly",
      systemPrompt: ANOMALY_SYSTEM_PROMPT,
      prompt: buildMultiTickerAnomalyPrompt(params),
    });

    return parseMultiAnomalyResponse(response.content);
  }

  /**
   * Detect sentiment divergences — when price action contradicts market sentiment.
   * These often precede major reversals.
   */
  async detectSentimentDivergence(params: {
    ticker: string;
    priceAction: string;
    sentimentData: string;
  }): Promise<AnomalyResult> {
    const response = await this.orchestrator.execute({
      intent: "anomaly",
      systemPrompt: ANOMALY_SYSTEM_PROMPT,
      prompt: buildSentimentDivergencePrompt(params),
    });

    return parseAnomalyResponse(response.content);
  }

  /**
   * Analyze volatility regime — detect transitions between compression and expansion.
   * Volatility regime changes often signal upcoming directional moves.
   */
  async analyzeVolatilityRegime(params: {
    ticker: string;
    impliedVolatility: string;
    realizedVolatility: string;
    historicalContext?: string;
  }): Promise<AnomalyResult> {
    const response = await this.orchestrator.execute({
      intent: "anomaly",
      systemPrompt: ANOMALY_SYSTEM_PROMPT,
      prompt: buildVolatilityRegimePrompt(params),
    });

    return parseAnomalyResponse(response.content);
  }

  /**
   * Multi-model consensus anomaly scan.
   * Both Claude and Grok independently scan for anomalies, then results
   * are merged and cross-validated — anomalies flagged by both models
   * receive elevated severity.
   */
  async consensus(params: {
    ticker: string;
    priceData?: string;
    volumeData?: string;
    technicalIndicators?: string;
  }): Promise<{
    results: AnomalyResult[];
    mergedAnomalies: AnomalyResult;
    agreement: number;
  }> {
    const responses = await this.orchestrator.consensus(
      {
        intent: "anomaly",
        systemPrompt: ANOMALY_SYSTEM_PROMPT,
        prompt: buildAnomalyDetectionPrompt(params),
      },
      ["claude", "grok"]
    );

    const results: AnomalyResult[] = [];
    for (const r of responses) {
      try {
        results.push(parseAnomalyResponse(r.content));
      } catch {
        // Skip unparseable responses
      }
    }

    if (results.length === 0) {
      throw new Error("No valid anomaly results produced by any model");
    }

    const merged = mergeAnomalyResults(params.ticker, results);

    // Agreement = proportion of anomaly types that both models identified
    const allTypes = new Set(
      results.flatMap((r) => r.anomalies.map((a) => a.type))
    );
    if (allTypes.size === 0) {
      return { results, mergedAnomalies: merged, agreement: 1.0 };
    }

    const sharedTypes = [...allTypes].filter((type) =>
      results.every((r) => r.anomalies.some((a) => a.type === type))
    );
    const agreement = sharedTypes.length / allTypes.size;

    return { results, mergedAnomalies: merged, agreement };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseAnomalyResponse(content: string): AnomalyResult {
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = jsonMatch ? jsonMatch[1].trim() : content.trim();
  const parsed = JSON.parse(raw);
  return AnomalyResultSchema.parse(parsed);
}

function parseMultiAnomalyResponse(content: string): AnomalyResult[] {
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = jsonMatch ? jsonMatch[1].trim() : content.trim();
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected an array of anomaly results");
  }

  return parsed.map((item: unknown) => AnomalyResultSchema.parse(item));
}

const SEVERITY_RANK: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const SEVERITY_FROM_RANK: Record<number, AnomalyResult["overallAlert"]> = {
  0: "low",
  1: "medium",
  2: "high",
  3: "critical",
};

/**
 * Merge anomaly results from multiple models.
 * Anomalies found by multiple models get their severity elevated by one level.
 * Unique anomalies are kept at their original severity.
 */
function mergeAnomalyResults(
  ticker: string,
  results: AnomalyResult[]
): AnomalyResult {
  const anomalyMap = new Map<
    string,
    { count: number; maxSeverity: number; anomaly: AnomalyResult["anomalies"][0] }
  >();

  for (const result of results) {
    for (const anomaly of result.anomalies) {
      const key = anomaly.type;
      const existing = anomalyMap.get(key);
      const severity = SEVERITY_RANK[anomaly.severity] ?? 0;

      if (existing) {
        existing.count += 1;
        existing.maxSeverity = Math.max(existing.maxSeverity, severity);
        // Keep the more detailed description
        if (anomaly.description.length > existing.anomaly.description.length) {
          existing.anomaly = anomaly;
        }
      } else {
        anomalyMap.set(key, { count: 1, maxSeverity: severity, anomaly });
      }
    }
  }

  // Build merged anomaly list — elevate severity for cross-validated anomalies
  const mergedAnomalies = [...anomalyMap.values()].map(
    ({ count, maxSeverity, anomaly }) => {
      const elevatedSeverity =
        count > 1
          ? Math.min(maxSeverity + 1, 3)
          : maxSeverity;

      return {
        ...anomaly,
        severity: SEVERITY_FROM_RANK[elevatedSeverity] ?? "medium",
      };
    }
  );

  // Overall alert = highest severity across merged anomalies
  const maxOverall = mergedAnomalies.reduce(
    (max, a) => Math.max(max, SEVERITY_RANK[a.severity] ?? 0),
    0
  );

  // Merge recommendations from all results
  const allRecommendations = [
    ...new Set(results.flatMap((r) => r.recommendations)),
  ];

  return {
    ticker,
    anomalies: mergedAnomalies,
    overallAlert: SEVERITY_FROM_RANK[maxOverall] ?? "low",
    anomalyCount: mergedAnomalies.length,
    marketContext: results[0].marketContext,
    recommendations: allRecommendations,
    timestamp: new Date().toISOString(),
  };
}

export { ANOMALY_SYSTEM_PROMPT } from "./prompts.js";
