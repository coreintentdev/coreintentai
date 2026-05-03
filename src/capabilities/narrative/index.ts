import { Orchestrator } from "../../orchestrator/index.js";
import {
  NarrativeReportSchema,
  type NarrativeReport,
} from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  NARRATIVE_SYSTEM_PROMPT,
  buildNarrativeDetectionPrompt,
  buildNarrativeStrengthPrompt,
  buildNarrativeShiftPrompt,
  buildNarrativeMapPrompt,
} from "./prompts.js";

export class NarrativeIntelligence {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  /**
   * Detect active narratives driving a specific ticker or market.
   */
  async detect(params: {
    ticker: string;
    currentPrice?: number;
    recentNews?: string;
    priceAction?: string;
    analystCommentary?: string;
    socialSentiment?: string;
  }): Promise<NarrativeReport> {
    const response = await this.orchestrator.execute({
      intent: "research",
      systemPrompt: NARRATIVE_SYSTEM_PROMPT,
      prompt: buildNarrativeDetectionPrompt(params),
    });

    return parseJsonResponse(response.content, NarrativeReportSchema);
  }

  /**
   * Score the current strength of a specific narrative.
   */
  async scoreStrength(params: {
    narrative: string;
    ticker?: string;
    positioningData?: string;
    flowData?: string;
    mediaAnalysis?: string;
    priceResponse?: string;
  }): Promise<NarrativeReport> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: NARRATIVE_SYSTEM_PROMPT,
      prompt: buildNarrativeStrengthPrompt(params),
    });

    return parseJsonResponse(response.content, NarrativeReportSchema);
  }

  /**
   * Detect if a narrative is shifting, advancing, or dying.
   */
  async detectShifts(params: {
    narrative: string;
    ticker?: string;
    previousStage: string;
    recentDevelopments?: string;
    counterNarratives?: string;
    priceAction?: string;
  }): Promise<NarrativeReport> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: NARRATIVE_SYSTEM_PROMPT,
      prompt: buildNarrativeShiftPrompt(params),
    });

    return parseJsonResponse(response.content, NarrativeReportSchema);
  }

  /**
   * Map all active narratives in a market sector.
   */
  async mapSector(params: {
    sector: string;
    tickers?: string[];
    marketContext?: string;
    timeframe?: string;
  }): Promise<NarrativeReport> {
    const response = await this.orchestrator.execute({
      intent: "research",
      systemPrompt: NARRATIVE_SYSTEM_PROMPT,
      prompt: buildNarrativeMapPrompt(params),
    });

    return parseJsonResponse(response.content, NarrativeReportSchema);
  }

  /**
   * Cross-validate narrative detection using multiple models.
   * Uses Grok for fast pattern recognition and Claude for deep reasoning,
   * then compares results to identify high-conviction narratives.
   */
  async crossValidate(params: {
    ticker: string;
    currentPrice?: number;
    recentNews?: string;
    priceAction?: string;
  }): Promise<{
    grokReport: NarrativeReport;
    claudeReport: NarrativeReport;
    agreement: number;
    highConvictionNarratives: string[];
  }> {
    const prompt = buildNarrativeDetectionPrompt(params);

    const [grokResponse, claudeResponse] = await this.orchestrator.fan([
      {
        intent: "fast_analysis",
        systemPrompt: NARRATIVE_SYSTEM_PROMPT,
        prompt,
        preferredProvider: "grok",
      },
      {
        intent: "reasoning",
        systemPrompt: NARRATIVE_SYSTEM_PROMPT,
        prompt,
        preferredProvider: "claude",
      },
    ]);

    const grokReport = parseJsonResponse(grokResponse.content, NarrativeReportSchema);
    const claudeReport = parseJsonResponse(claudeResponse.content, NarrativeReportSchema);

    // Find narratives identified by both models (by category + similar name matching)
    const grokNarratives = new Set(
      grokReport.narratives
        .filter((n) => n.strength >= 50)
        .map((n) => n.category)
    );
    const claudeNarratives = new Set(
      claudeReport.narratives
        .filter((n) => n.strength >= 50)
        .map((n) => n.category)
    );

    const highConvictionNarratives = [...grokNarratives].filter((c) =>
      claudeNarratives.has(c)
    );

    const allCategories = new Set([...grokNarratives, ...claudeNarratives]);
    const agreement =
      allCategories.size > 0
        ? highConvictionNarratives.length / allCategories.size
        : 1;

    return {
      grokReport,
      claudeReport,
      agreement,
      highConvictionNarratives,
    };
  }
}

export { NARRATIVE_SYSTEM_PROMPT } from "./prompts.js";
