import { Orchestrator } from "../../orchestrator/index.js";
import { MarketRegimeSchema, type MarketRegime } from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  REGIME_SYSTEM_PROMPT,
  buildRegimeDetectionPrompt,
  buildMultiTimeframeRegimePrompt,
  buildRegimeTransitionPrompt,
} from "./prompts.js";

export class RegimeDetector {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  async detect(params: {
    ticker: string;
    currentPrice: number;
    priceHistory?: string;
    technicalData?: string;
    volatilityData?: string;
    marketBreadth?: string;
  }): Promise<MarketRegime> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: REGIME_SYSTEM_PROMPT,
      prompt: buildRegimeDetectionPrompt(params),
    });

    return parseRegimeResponse(response.content);
  }

  async detectMultiTimeframe(params: {
    ticker: string;
    currentPrice: number;
    intradayData?: string;
    dailyData?: string;
    weeklyData?: string;
  }): Promise<MarketRegime> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: REGIME_SYSTEM_PROMPT,
      prompt: buildMultiTimeframeRegimePrompt(params),
    });

    return parseRegimeResponse(response.content);
  }

  async assessTransition(params: {
    ticker: string;
    currentRegime: string;
    recentEvents?: string;
  }): Promise<MarketRegime> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: REGIME_SYSTEM_PROMPT,
      prompt: buildRegimeTransitionPrompt(params),
    });

    return parseRegimeResponse(response.content);
  }

  async consensus(params: {
    ticker: string;
    currentPrice: number;
    technicalData?: string;
    providers?: Array<"claude" | "grok" | "perplexity">;
  }): Promise<{
    regimes: MarketRegime[];
    consensusRegime: string;
    agreement: number;
  }> {
    const responses = await this.orchestrator.consensus(
      {
        intent: "reasoning",
        systemPrompt: REGIME_SYSTEM_PROMPT,
        prompt: buildRegimeDetectionPrompt(params),
      },
      params.providers ?? ["claude", "grok"]
    );

    const regimes: MarketRegime[] = [];
    for (const r of responses) {
      try {
        regimes.push(parseRegimeResponse(r.content));
      } catch {
        // Skip unparseable responses
      }
    }

    if (regimes.length === 0) {
      throw new Error("No valid regime detections from any model");
    }

    const regimeCounts = new Map<string, number>();
    for (const r of regimes) {
      regimeCounts.set(r.regime, (regimeCounts.get(r.regime) ?? 0) + 1);
    }

    let consensusRegime: string = regimes[0].regime;
    let maxCount = 0;
    for (const [regime, count] of regimeCounts) {
      if (count > maxCount) {
        maxCount = count;
        consensusRegime = regime;
      }
    }

    const agreement = maxCount / regimes.length;

    return { regimes, consensusRegime, agreement };
  }
}

function parseRegimeResponse(content: string): MarketRegime {
  return parseJsonResponse(content, MarketRegimeSchema);
}

export { REGIME_SYSTEM_PROMPT } from "./prompts.js";
