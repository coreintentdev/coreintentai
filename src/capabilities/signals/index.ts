/**
 * CoreIntent AI — Trading Signal Generation
 *
 * Generates structured, risk-aware trading signals using deep reasoning models.
 * Claude primary for complex analysis, with multi-model consensus for high-stakes signals.
 */

import { Orchestrator } from "../../orchestrator/index.js";
import { TradingSignalSchema, type TradingSignal } from "../../types/index.js";
import {
  SIGNAL_SYSTEM_PROMPT,
  buildSignalPrompt,
  buildMultiSignalPrompt,
  buildSignalReviewPrompt,
} from "./prompts.js";

export class SignalGenerator {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  /**
   * Generate a trading signal for a single ticker.
   */
  async generate(params: {
    ticker: string;
    currentPrice: number;
    timeframe: "scalp" | "day" | "swing" | "position";
    technicalData?: string;
    fundamentalData?: string;
    marketContext?: string;
  }): Promise<TradingSignal> {
    const response = await this.orchestrator.execute({
      intent: "signal",
      systemPrompt: SIGNAL_SYSTEM_PROMPT,
      prompt: buildSignalPrompt(params),
    });

    return parseSignalResponse(response.content);
  }

  /**
   * Generate signals for multiple tickers in a single request.
   */
  async generateBatch(params: {
    tickers: Array<{ ticker: string; currentPrice: number }>;
    timeframe: "scalp" | "day" | "swing" | "position";
    marketContext?: string;
  }): Promise<TradingSignal[]> {
    const response = await this.orchestrator.execute({
      intent: "signal",
      systemPrompt: SIGNAL_SYSTEM_PROMPT,
      prompt: buildMultiSignalPrompt(params),
    });

    return parseMultiSignalResponse(response.content);
  }

  /**
   * Generate a signal and then review it with a second model for validation.
   * Two-pass approach: generate with Claude, review with Grok (or vice versa).
   */
  async generateWithReview(params: {
    ticker: string;
    currentPrice: number;
    timeframe: "scalp" | "day" | "swing" | "position";
    technicalData?: string;
    fundamentalData?: string;
    marketContext?: string;
  }): Promise<{ signal: TradingSignal; reviewed: boolean; adjustments: string }> {
    // Pass 1: Generate signal
    const signal = await this.generate(params);

    // Pass 2: Review with a different provider
    const reviewResponse = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: SIGNAL_SYSTEM_PROMPT,
      prompt: buildSignalReviewPrompt({
        signal: JSON.stringify(signal, null, 2),
        additionalContext: params.marketContext,
      }),
      preferredProvider: "grok",
    });

    try {
      const reviewedSignal = parseSignalResponse(reviewResponse.content);
      const adjustments =
        JSON.stringify(signal) === JSON.stringify(reviewedSignal)
          ? "No adjustments — signal confirmed."
          : "Signal was adjusted during review.";

      return { signal: reviewedSignal, reviewed: true, adjustments };
    } catch {
      // Review didn't produce valid JSON — keep original signal
      return {
        signal,
        reviewed: true,
        adjustments: `Review comments: ${reviewResponse.content.slice(0, 500)}`,
      };
    }
  }

  /**
   * Get consensus signal from multiple models.
   */
  async consensus(params: {
    ticker: string;
    currentPrice: number;
    timeframe: "scalp" | "day" | "swing" | "position";
    technicalData?: string;
  }): Promise<{
    signals: TradingSignal[];
    consensusAction: string;
    averageConfidence: number;
    agreement: number;
  }> {
    const responses = await this.orchestrator.consensus(
      {
        intent: "signal",
        systemPrompt: SIGNAL_SYSTEM_PROMPT,
        prompt: buildSignalPrompt(params),
      },
      ["claude", "grok"]
    );

    const signals: TradingSignal[] = [];
    for (const r of responses) {
      try {
        signals.push(parseSignalResponse(r.content));
      } catch {
        // Skip unparseable responses
      }
    }

    if (signals.length === 0) {
      throw new Error("No valid signals produced by any model");
    }

    // If not all models produced valid results, consensus is degraded
    if (signals.length < responses.length) {
      const actionScores: Record<string, number> = {
        strong_buy: 2, buy: 1, hold: 0, sell: -1, strong_sell: -2,
      };
      const avgScore =
        signals.reduce((sum, s) => sum + actionScores[s.action], 0) /
        signals.length;
      let consensusAction: string;
      if (avgScore >= 1.5) consensusAction = "strong_buy";
      else if (avgScore >= 0.5) consensusAction = "buy";
      else if (avgScore > -0.5) consensusAction = "hold";
      else if (avgScore > -1.5) consensusAction = "sell";
      else consensusAction = "strong_sell";

      return {
        signals,
        consensusAction,
        averageConfidence:
          signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length,
        agreement: 0,
      };
    }

    const actionScores: Record<string, number> = {
      strong_buy: 2,
      buy: 1,
      hold: 0,
      sell: -1,
      strong_sell: -2,
    };

    const avgScore =
      signals.reduce((sum, s) => sum + actionScores[s.action], 0) /
      signals.length;
    const avgConfidence =
      signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;

    // Agreement: do they agree on direction?
    const directions = signals.map((s) => Math.sign(actionScores[s.action]));
    const allSameDirection = directions.every((d) => d === directions[0]);

    let consensusAction: string;
    if (avgScore >= 1.5) consensusAction = "strong_buy";
    else if (avgScore >= 0.5) consensusAction = "buy";
    else if (avgScore > -0.5) consensusAction = "hold";
    else if (avgScore > -1.5) consensusAction = "sell";
    else consensusAction = "strong_sell";

    return {
      signals,
      consensusAction,
      averageConfidence: avgConfidence,
      agreement: allSameDirection ? 1 : 0.5,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSignalResponse(content: string): TradingSignal {
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = jsonMatch ? jsonMatch[1].trim() : content.trim();
  const parsed = JSON.parse(raw);
  return TradingSignalSchema.parse(parsed);
}

function parseMultiSignalResponse(content: string): TradingSignal[] {
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = jsonMatch ? jsonMatch[1].trim() : content.trim();
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected an array of signals");
  }

  return parsed.map((item: unknown) => TradingSignalSchema.parse(item));
}

export { SIGNAL_SYSTEM_PROMPT } from "./prompts.js";
