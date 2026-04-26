import { Orchestrator } from "../../orchestrator/index.js";
import {
  MomentumReportSchema,
  type MomentumReport,
} from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  MOMENTUM_SYSTEM_PROMPT,
  buildMomentumRankingPrompt,
  buildMomentumScreenerPrompt,
  buildMomentumShiftPrompt,
} from "./prompts.js";

export class MomentumScorer {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  /**
   * Rank a set of tickers by composite momentum score.
   */
  async rank(params: {
    tickers: Array<{ ticker: string; currentPrice: number }>;
    priceData?: string;
    volumeData?: string;
    sectorData?: string;
    benchmarkData?: string;
  }): Promise<MomentumReport> {
    const response = await this.orchestrator.execute({
      intent: "fast_analysis",
      systemPrompt: MOMENTUM_SYSTEM_PROMPT,
      prompt: buildMomentumRankingPrompt(params),
    });

    return parseJsonResponse(response.content, MomentumReportSchema);
  }

  /**
   * Screen a universe of assets for momentum setups matching criteria.
   */
  async screen(params: {
    universe: string;
    criteria: {
      minCompositeScore?: number;
      timeframeAlignment?: "aligned" | "mixed" | "any";
      maxExhaustionRisk?: number;
      accelerationOnly?: boolean;
    };
  }): Promise<MomentumReport> {
    const response = await this.orchestrator.execute({
      intent: "research",
      systemPrompt: MOMENTUM_SYSTEM_PROMPT,
      prompt: buildMomentumScreenerPrompt(params),
    });

    return parseJsonResponse(response.content, MomentumReportSchema);
  }

  /**
   * Assess whether a specific ticker is experiencing a momentum shift.
   */
  async detectShift(params: {
    ticker: string;
    currentMomentum: string;
    recentData?: string;
  }): Promise<MomentumReport> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: MOMENTUM_SYSTEM_PROMPT,
      prompt: buildMomentumShiftPrompt(params),
    });

    return parseJsonResponse(response.content, MomentumReportSchema);
  }

  /**
   * Multi-model momentum ranking: get rankings from both Grok (speed) and
   * Claude (depth) and use the cross-check to increase confidence.
   */
  async crossValidatedRank(params: {
    tickers: Array<{ ticker: string; currentPrice: number }>;
    priceData?: string;
  }): Promise<{
    grokRanking: MomentumReport;
    claudeRanking: MomentumReport;
    agreement: number;
    highConvictionPicks: string[];
  }> {
    const prompt = buildMomentumRankingPrompt(params);

    const [grokResponse, claudeResponse] = await this.orchestrator.fan([
      {
        intent: "fast_analysis",
        systemPrompt: MOMENTUM_SYSTEM_PROMPT,
        prompt,
        preferredProvider: "grok",
      },
      {
        intent: "reasoning",
        systemPrompt: MOMENTUM_SYSTEM_PROMPT,
        prompt,
        preferredProvider: "claude",
      },
    ]);

    const grokRanking = parseJsonResponse(grokResponse.content, MomentumReportSchema);
    const claudeRanking = parseJsonResponse(claudeResponse.content, MomentumReportSchema);

    const grokTop = new Set(
      grokRanking.rankings
        .filter((r) => r.compositeScore >= 60)
        .map((r) => r.ticker)
    );
    const claudeTop = new Set(
      claudeRanking.rankings
        .filter((r) => r.compositeScore >= 60)
        .map((r) => r.ticker)
    );

    const highConvictionPicks = [...grokTop].filter((t) => claudeTop.has(t));

    const allTickers = new Set([...grokTop, ...claudeTop]);
    const agreement =
      allTickers.size > 0 ? highConvictionPicks.length / allTickers.size : 1;

    return {
      grokRanking,
      claudeRanking,
      agreement,
      highConvictionPicks,
    };
  }
}

export { MOMENTUM_SYSTEM_PROMPT } from "./prompts.js";
