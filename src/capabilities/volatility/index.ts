import { z } from "zod";
import { Orchestrator } from "../../orchestrator/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  VOLATILITY_SYSTEM_PROMPT,
  buildVolatilityAnalysisPrompt,
  buildVolTermStructurePrompt,
  buildVolRegimePrompt,
  buildEventVolPrompt,
} from "./prompts.js";

const VolSnapshotSchema = z.object({
  atmIv: z.number().min(0),
  ivRank: z.number().min(0).max(100),
  ivPercentile: z.number().min(0).max(100),
  realizedVol20d: z.number().min(0),
  realizedVol60d: z.number().min(0),
  ivRvSpread: z.number(),
  regime: z.enum(["low", "normal", "elevated", "extreme"]),
});

const VolSurfaceSchema = z.object({
  skew25Delta: z.number(),
  skewInterpretation: z.string(),
  termStructure: z.enum(["contango", "flat", "backwardation"]),
  termStructureSlope: z.number(),
  termInterpretation: z.string(),
  wingDemand: z.enum(["low", "normal", "elevated", "extreme"]),
  wingInterpretation: z.string(),
});

const VolEventSchema = z.object({
  event: z.string(),
  date: z.string(),
  expectedMove: z.number(),
  impliedMove: z.number(),
  mispriced: z.enum(["overpriced", "fairly_priced", "underpriced"]),
  opportunity: z.string(),
});

const VolStrategySchema = z.object({
  name: z.string(),
  type: z.enum([
    "long_vol",
    "short_vol",
    "skew_trade",
    "calendar_spread",
    "event_trade",
  ]),
  rationale: z.string(),
  riskLevel: z.enum(["low", "moderate", "high"]),
  expectedEdge: z.string(),
});

const VolAlertSchema = z.object({
  condition: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  implication: z.string(),
});

const VolatilityAnalysisSchema = z.object({
  ticker: z.string(),
  snapshot: VolSnapshotSchema,
  surface: VolSurfaceSchema,
  events: z.array(VolEventSchema),
  strategies: z.array(VolStrategySchema),
  alerts: z.array(VolAlertSchema),
  summary: z.string(),
  timestamp: z.string().datetime(),
});

export type VolatilityAnalysis = z.infer<typeof VolatilityAnalysisSchema>;

export {
  VolatilityAnalysisSchema,
  VolSnapshotSchema,
  VolSurfaceSchema,
  VolEventSchema,
  VolStrategySchema,
  VolAlertSchema,
};

export class VolatilityAnalyzer {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  async analyze(params: {
    ticker: string;
    currentPrice: number;
    ivData?: string;
    historicalVolData?: string;
    optionChainData?: string;
    vixData?: string;
    upcomingEvents?: string[];
  }): Promise<VolatilityAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: buildVolatilityAnalysisPrompt(params),
    });

    return parseJsonResponse(response.content, VolatilityAnalysisSchema);
  }

  async analyzeTermStructure(params: {
    ticker: string;
    expirations: Array<{
      expiration: string;
      daysToExpiry: number;
      atmIv: number;
    }>;
    eventCalendar?: string[];
  }): Promise<VolatilityAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: buildVolTermStructurePrompt(params),
    });

    return parseJsonResponse(response.content, VolatilityAnalysisSchema);
  }

  async classifyRegime(params: {
    ticker: string;
    currentIv: number;
    ivHistory: string;
    rvHistory: string;
  }): Promise<VolatilityAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: buildVolRegimePrompt(params),
    });

    return parseJsonResponse(response.content, VolatilityAnalysisSchema);
  }

  async analyzeEvent(params: {
    ticker: string;
    event: string;
    eventDate: string;
    currentIv: number;
    historicalMoves: string;
    optionPricing?: string;
  }): Promise<VolatilityAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: buildEventVolPrompt(params),
    });

    return parseJsonResponse(response.content, VolatilityAnalysisSchema);
  }

  /**
   * Tiered analysis: Grok for quick vol snapshot, Claude for deep surface analysis
   * on anything with elevated vol or unusual skew.
   */
  async tieredAnalysis(params: {
    ticker: string;
    currentPrice: number;
    ivData?: string;
    historicalVolData?: string;
    elevatedThreshold?: number;
  }): Promise<{
    quickScan: VolatilityAnalysis;
    deepDive: VolatilityAnalysis | null;
    elevated: boolean;
  }> {
    const quickResponse = await this.orchestrator.execute({
      intent: "fast_analysis",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: buildVolatilityAnalysisPrompt({
        ticker: params.ticker,
        currentPrice: params.currentPrice,
        ivData: params.ivData,
        historicalVolData: params.historicalVolData,
      }),
    });

    const quickScan = parseJsonResponse(
      quickResponse.content,
      VolatilityAnalysisSchema
    );

    const threshold = params.elevatedThreshold ?? 50;
    const elevated = quickScan.snapshot.ivRank >= threshold;

    if (!elevated) {
      return { quickScan, deepDive: null, elevated };
    }

    const deepResponse = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: VOLATILITY_SYSTEM_PROMPT,
      prompt: `Deep volatility analysis needed. Quick scan found elevated vol:

IV Rank: ${quickScan.snapshot.ivRank}
ATM IV: ${(quickScan.snapshot.atmIv * 100).toFixed(1)}%
IV-RV Spread: ${(quickScan.snapshot.ivRvSpread * 100).toFixed(1)}%
Regime: ${quickScan.snapshot.regime}
Skew: ${quickScan.surface.skew25Delta}
Term Structure: ${quickScan.surface.termStructure}

${quickScan.alerts.length > 0 ? `Alerts:\n${quickScan.alerts.map((a) => `- [${a.severity}] ${a.condition}`).join("\n")}` : ""}

Provide deep analysis: What's driving the elevated vol? Is it event-driven or structural? What are the optimal vol strategies? Set the timestamp to "${new Date().toISOString()}".`,
      preferredProvider: "claude",
    });

    const deepDive = parseJsonResponse(
      deepResponse.content,
      VolatilityAnalysisSchema
    );

    return { quickScan, deepDive, elevated };
  }

  /**
   * Multi-model vol consensus: different models may disagree on vol regime.
   */
  async consensus(params: {
    ticker: string;
    currentPrice: number;
    ivData?: string;
    providers?: Array<"claude" | "grok" | "perplexity">;
  }): Promise<{
    analyses: VolatilityAnalysis[];
    consensusRegime: string;
    agreement: number;
  }> {
    const providers = params.providers ?? ["claude", "grok"];
    const prompt = buildVolatilityAnalysisPrompt({
      ticker: params.ticker,
      currentPrice: params.currentPrice,
      ivData: params.ivData,
    });

    const responses = await this.orchestrator.consensus(
      {
        intent: "reasoning",
        systemPrompt: VOLATILITY_SYSTEM_PROMPT,
        prompt,
      },
      providers
    );

    const analyses: VolatilityAnalysis[] = [];
    for (const r of responses) {
      try {
        analyses.push(
          parseJsonResponse(r.content, VolatilityAnalysisSchema)
        );
      } catch {
        // Skip unparseable responses
      }
    }

    if (analyses.length === 0) {
      throw new Error("No valid volatility analyses from any model");
    }

    const regimeCounts = new Map<string, number>();
    for (const a of analyses) {
      const regime = a.snapshot.regime;
      regimeCounts.set(regime, (regimeCounts.get(regime) ?? 0) + 1);
    }

    let consensusRegime: string = analyses[0].snapshot.regime;
    let maxCount = 0;
    for (const [regime, count] of regimeCounts) {
      if (count > maxCount) {
        maxCount = count;
        consensusRegime = regime;
      }
    }

    const agreement = analyses.length > 0 ? maxCount / analyses.length : 1;

    return { analyses, consensusRegime, agreement };
  }
}

export { VOLATILITY_SYSTEM_PROMPT } from "./prompts.js";
