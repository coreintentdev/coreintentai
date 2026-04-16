/**
 * CoreIntent AI — Sentiment Analysis Capability
 *
 * Analyzes market sentiment from multiple data sources using multi-model
 * orchestration. Grok for speed, Claude for depth, Perplexity for research.
 */

import { Orchestrator } from "../../orchestrator/index.js";
import { SentimentResultSchema, type SentimentResult } from "../../types/index.js";
import {
  SENTIMENT_SYSTEM_PROMPT,
  buildSentimentPrompt,
  buildNewsSentimentPrompt,
  buildEarningsSentimentPrompt,
} from "./prompts.js";

export class SentimentAnalyzer {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  /**
   * Analyze general market sentiment for a ticker.
   */
  async analyze(params: {
    ticker: string;
    context?: string;
    timeHorizon?: "intraday" | "short_term" | "medium_term" | "long_term";
    dataPoints?: string[];
  }): Promise<SentimentResult> {
    const response = await this.orchestrator.execute({
      intent: "sentiment",
      systemPrompt: SENTIMENT_SYSTEM_PROMPT,
      prompt: buildSentimentPrompt(params),
    });

    return parseSentimentResponse(response.content);
  }

  /**
   * Analyze sentiment from news headlines.
   */
  async analyzeNews(params: {
    ticker: string;
    headlines: string[];
  }): Promise<SentimentResult> {
    const response = await this.orchestrator.execute({
      intent: "sentiment",
      systemPrompt: SENTIMENT_SYSTEM_PROMPT,
      prompt: buildNewsSentimentPrompt(params),
    });

    return parseSentimentResponse(response.content);
  }

  /**
   * Analyze post-earnings sentiment.
   */
  async analyzeEarnings(params: {
    ticker: string;
    epsActual?: number;
    epsEstimate?: number;
    revenueActual?: number;
    revenueEstimate?: number;
    guidance?: string;
  }): Promise<SentimentResult> {
    const response = await this.orchestrator.execute({
      intent: "sentiment",
      systemPrompt: SENTIMENT_SYSTEM_PROMPT,
      prompt: buildEarningsSentimentPrompt(params),
    });

    return parseSentimentResponse(response.content);
  }

  /**
   * Get consensus sentiment by querying multiple models.
   * Returns individual results and an aggregate score.
   */
  async consensus(params: {
    ticker: string;
    context?: string;
  }): Promise<{
    results: SentimentResult[];
    aggregateScore: number;
    aggregateSentiment: string;
    agreement: number;
  }> {
    const responses = await this.orchestrator.consensus(
      {
        intent: "sentiment",
        systemPrompt: SENTIMENT_SYSTEM_PROMPT,
        prompt: buildSentimentPrompt(params),
      },
      ["claude", "grok"]
    );

    const results = await Promise.all(
      responses.map((r) => parseSentimentResponse(r.content))
    );

    const scores = results.map((r) => r.score);
    const aggregateScore =
      scores.reduce((sum, s) => sum + s, 0) / scores.length;

    // Agreement = 1 - normalized standard deviation
    const mean = aggregateScore;
    const variance =
      scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    const agreement = Math.max(0, 1 - stdDev);

    return {
      results,
      aggregateScore,
      aggregateSentiment: scoreToSentiment(aggregateScore),
      agreement,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSentimentResponse(content: string): SentimentResult {
  // Extract JSON from possible markdown code fences
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = jsonMatch ? jsonMatch[1].trim() : content.trim();

  const parsed = JSON.parse(raw);
  return SentimentResultSchema.parse(parsed);
}

function scoreToSentiment(score: number): string {
  if (score >= 0.6) return "strongly_bullish";
  if (score >= 0.3) return "bullish";
  if (score >= 0.1) return "slightly_bullish";
  if (score >= -0.1) return "neutral";
  if (score >= -0.3) return "slightly_bearish";
  if (score >= -0.6) return "bearish";
  return "strongly_bearish";
}

export { SENTIMENT_SYSTEM_PROMPT } from "./prompts.js";
