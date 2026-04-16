import { Orchestrator } from "../../orchestrator/index.js";
import {
  RegimeDetectionResultSchema,
  type RegimeDetectionResult,
} from "../../types/index.js";
import {
  REGIME_SYSTEM_PROMPT,
  buildRegimeDetectionPrompt,
  buildRegimeTransitionPrompt,
  buildMultiTimeframeRegimePrompt,
} from "./prompts.js";

export class RegimeDetector {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  async detect(params: {
    marketData?: string;
    indices?: string[];
    vix?: number;
    breadthData?: string;
    sectorRotation?: string;
    timeframe?: "intraday" | "daily" | "weekly" | "monthly";
  }): Promise<RegimeDetectionResult> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: REGIME_SYSTEM_PROMPT,
      prompt: buildRegimeDetectionPrompt(params),
    });

    return parseRegimeResponse(response.content);
  }

  async detectTransition(params: {
    currentRegime: string;
    marketData: string;
    recentChanges: string;
  }): Promise<RegimeDetectionResult> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: REGIME_SYSTEM_PROMPT,
      prompt: buildRegimeTransitionPrompt(params),
    });

    return parseRegimeResponse(response.content);
  }

  async multiTimeframe(params: {
    dailyData: string;
    weeklyData: string;
    monthlyData?: string;
  }): Promise<RegimeDetectionResult[]> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: REGIME_SYSTEM_PROMPT,
      prompt: buildMultiTimeframeRegimePrompt(params),
    });

    return parseMultiRegimeResponse(response.content);
  }

  async consensus(params: {
    marketData?: string;
    indices?: string[];
    vix?: number;
  }): Promise<{
    results: RegimeDetectionResult[];
    consensusRegime: string;
    agreement: number;
  }> {
    const responses = await this.orchestrator.consensus(
      {
        intent: "reasoning",
        systemPrompt: REGIME_SYSTEM_PROMPT,
        prompt: buildRegimeDetectionPrompt(params),
      },
      ["claude", "grok"]
    );

    const results: RegimeDetectionResult[] = [];
    for (const r of responses) {
      try {
        results.push(parseRegimeResponse(r.content));
      } catch {
        // Skip unparseable responses
      }
    }

    if (results.length === 0) {
      throw new Error("No valid regime detections from any model");
    }

    const regimeCounts = new Map<string, number>();
    for (const r of results) {
      regimeCounts.set(r.regime, (regimeCounts.get(r.regime) ?? 0) + 1);
    }

    let consensusRegime: string = results[0].regime;
    let maxCount = 0;
    for (const [regime, count] of regimeCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        consensusRegime = regime;
      }
    }

    const agreement = maxCount / results.length;

    return { results, consensusRegime, agreement };
  }

  async adaptStrategy(params: {
    regime: RegimeDetectionResult;
    currentPositions?: string;
    tradingStyle?: string;
  }): Promise<{
    regime: string;
    recommendations: string[];
    adjustments: string[];
  }> {
    const { strategyImplications, regime } = params.regime;

    const recommendations = [
      ...strategyImplications.favoredStrategies.map(
        (s) => `FAVOR: ${s}`
      ),
      ...strategyImplications.avoidStrategies.map(
        (s) => `AVOID: ${s}`
      ),
      `POSITION SIZING: ${strategyImplications.positionSizing}`,
      `HEDGING: ${strategyImplications.hedgingAdvice}`,
    ];

    const adjustments: string[] = [];

    if (regime === "crisis" || regime === "volatile") {
      adjustments.push("Reduce position sizes by 50%");
      adjustments.push("Increase cash allocation");
      adjustments.push("Tighten stop-losses");
    }

    if (regime === "trending_bull") {
      adjustments.push("Trail stops wider to capture trend");
      adjustments.push("Add to winning positions on pullbacks");
    }

    if (regime === "trending_bear") {
      adjustments.push("Favor short-side or inverse positions");
      adjustments.push("Reduce long exposure");
    }

    if (regime === "ranging") {
      adjustments.push("Use mean-reversion entries at range extremes");
      adjustments.push("Reduce position holding time");
    }

    return { regime, recommendations, adjustments };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseRegimeResponse(content: string): RegimeDetectionResult {
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = jsonMatch ? jsonMatch[1].trim() : content.trim();
  const parsed = JSON.parse(raw);
  return RegimeDetectionResultSchema.parse(parsed);
}

function parseMultiRegimeResponse(content: string): RegimeDetectionResult[] {
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = jsonMatch ? jsonMatch[1].trim() : content.trim();
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected an array of regime detections");
  }

  return parsed.map((item: unknown) => RegimeDetectionResultSchema.parse(item));
}

export { REGIME_SYSTEM_PROMPT } from "./prompts.js";
