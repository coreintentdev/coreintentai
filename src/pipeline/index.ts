import { Orchestrator } from "../orchestrator/index.js";
import { parseJsonResponse } from "../utils/json-parser.js";
import {
  IntelligenceBriefSchema,
  type IntelligenceBrief,
  type CapabilitySignal,
  type Divergence,
} from "./types.js";
import {
  INTELLIGENCE_EXTRACTION_PROMPTS,
  type IntelligenceCapability,
  SYNTHESIS_SYSTEM_PROMPT,
  buildSynthesisPrompt,
} from "./prompts.js";
import type { TokenUsage, ModelProvider } from "../types/index.js";
import { z } from "zod";

export interface PipelineOptions {
  orchestrator?: Orchestrator;
  capabilities?: IntelligenceCapability[];
  timeoutMs?: number;
}

interface RawCapabilityResult {
  name: string;
  signal: "bullish" | "bearish" | "neutral" | "mixed";
  confidence: number;
  keyFinding: string;
  rawOutput: string;
  provider: string;
  model: string;
  latencyMs: number;
  tokenUsage: TokenUsage;
}

const ALL_CAPABILITIES: IntelligenceCapability[] = [
  "sentiment",
  "regime",
  "momentum",
  "risk",
  "technicals",
  "catalysts",
];

const CAPABILITY_INTENTS: Record<
  IntelligenceCapability,
  { intent: "fast_analysis" | "reasoning" | "research" | "sentiment" | "risk"; provider?: ModelProvider }
> = {
  sentiment: { intent: "sentiment" },
  regime: { intent: "reasoning" },
  momentum: { intent: "fast_analysis" },
  risk: { intent: "risk" },
  technicals: { intent: "fast_analysis" },
  catalysts: { intent: "research" },
};

const CapabilityResponseSchema = z.object({
  signal: z.enum(["bullish", "bearish", "neutral", "mixed"]),
  confidence: z.number().min(0).max(1),
  keyFinding: z.string(),
});

export class MarketIntelligencePipeline {
  private orchestrator: Orchestrator;
  private enabledCapabilities: IntelligenceCapability[];
  private timeoutMs: number;

  constructor(options: PipelineOptions = {}) {
    this.orchestrator = options.orchestrator ?? new Orchestrator();
    this.enabledCapabilities =
      options.capabilities ?? ALL_CAPABILITIES;
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  async analyze(params: {
    ticker: string;
    context?: string;
    portfolioValue?: number;
    riskTolerancePct?: number;
  }): Promise<IntelligenceBrief> {
    const start = performance.now();
    const totalTokens: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
    const modelsUsed = new Set<string>();

    const capabilityResults = await this.runCapabilities(
      params.ticker,
      params.context
    );

    for (const r of capabilityResults) {
      totalTokens.inputTokens += r.tokenUsage.inputTokens;
      totalTokens.outputTokens += r.tokenUsage.outputTokens;
      totalTokens.totalTokens += r.tokenUsage.totalTokens;
      modelsUsed.add(r.model);
    }

    const signalMatrix: CapabilitySignal[] = capabilityResults.map((r) => ({
      capability: r.name,
      signal: r.signal,
      confidence: r.confidence,
      keyFinding: r.keyFinding,
    }));

    const divergences = this.detectDivergences(capabilityResults);

    const synthesisPrompt = buildSynthesisPrompt({
      ticker: params.ticker,
      signalMatrix,
      divergences,
      capabilityOutputs: capabilityResults.map((r) => ({
        name: r.name,
        output: r.rawOutput.slice(0, 800),
      })),
      context: params.context,
      portfolioValue: params.portfolioValue,
      riskTolerancePct: params.riskTolerancePct,
    });

    const synthesisResponse = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: SYNTHESIS_SYSTEM_PROMPT,
      prompt: synthesisPrompt,
      preferredProvider: "claude",
      timeoutMs: this.timeoutMs,
    });

    totalTokens.inputTokens += synthesisResponse.tokenUsage.inputTokens;
    totalTokens.outputTokens += synthesisResponse.tokenUsage.outputTokens;
    totalTokens.totalTokens += synthesisResponse.tokenUsage.totalTokens;
    modelsUsed.add(synthesisResponse.model);

    const brief = parseJsonResponse(
      synthesisResponse.content,
      IntelligenceBriefSchema
    );

    brief.meta = {
      capabilitiesUsed: capabilityResults.map((r) => r.name),
      totalLatencyMs: Math.round(performance.now() - start),
      modelsUsed: Array.from(modelsUsed),
      tokenUsage: totalTokens,
    };

    return brief;
  }

  async quickSignalCheck(
    ticker: string,
    context?: string
  ): Promise<{
    signals: CapabilitySignal[];
    divergences: Divergence[];
    overallDirection: "bullish" | "bearish" | "neutral" | "mixed";
    overallConfidence: number;
  }> {
    const results = await this.runCapabilities(ticker, context);

    const signals: CapabilitySignal[] = results.map((r) => ({
      capability: r.name,
      signal: r.signal,
      confidence: r.confidence,
      keyFinding: r.keyFinding,
    }));

    const divergences = this.detectDivergences(results);

    const directionScores: Record<string, number> = {
      bullish: 1,
      neutral: 0,
      bearish: -1,
      mixed: 0,
    };
    const weightedScore =
      results.reduce(
        (sum, r) => sum + directionScores[r.signal] * r.confidence,
        0
      ) / Math.max(results.length, 1);

    const avgConfidence =
      results.reduce((sum, r) => sum + r.confidence, 0) /
      Math.max(results.length, 1);

    let overallDirection: "bullish" | "bearish" | "neutral" | "mixed";
    if (divergences.some((d) => d.severity === "high")) {
      overallDirection = "mixed";
    } else if (weightedScore > 0.3) {
      overallDirection = "bullish";
    } else if (weightedScore < -0.3) {
      overallDirection = "bearish";
    } else {
      overallDirection = "neutral";
    }

    return { signals, divergences, overallDirection, overallConfidence: avgConfidence };
  }

  private async runCapabilities(
    ticker: string,
    context?: string
  ): Promise<RawCapabilityResult[]> {
    const tasks = this.enabledCapabilities.map(async (cap) => {
      const prompt = INTELLIGENCE_EXTRACTION_PROMPTS[cap](ticker, context);
      const { intent } = CAPABILITY_INTENTS[cap];

      try {
        const response = await this.orchestrator.execute({
          intent,
          systemPrompt: `You are a trading intelligence AI. Respond ONLY with the requested JSON. No commentary.`,
          prompt,
          timeoutMs: this.timeoutMs,
        });

        const parsed = parseJsonResponse(
          response.content,
          CapabilityResponseSchema
        );

        return {
          name: cap,
          signal: parsed.signal,
          confidence: parsed.confidence,
          keyFinding: parsed.keyFinding,
          rawOutput: response.content,
          provider: response.provider,
          model: response.model,
          latencyMs: response.latencyMs,
          tokenUsage: response.tokenUsage,
        } satisfies RawCapabilityResult;
      } catch {
        return null;
      }
    });

    const settled = await Promise.allSettled(tasks);
    const results: RawCapabilityResult[] = [];

    for (const outcome of settled) {
      if (outcome.status === "fulfilled" && outcome.value) {
        results.push(outcome.value);
      }
    }

    if (results.length === 0) {
      throw new Error(
        `Intelligence pipeline failed: no capabilities returned valid results for ${ticker}`
      );
    }

    return results;
  }

  detectDivergences(results: RawCapabilityResult[]): Divergence[] {
    const divergences: Divergence[] = [];

    const bullish = results.filter(
      (r) => r.signal === "bullish" && r.confidence > 0.5
    );
    const bearish = results.filter(
      (r) => r.signal === "bearish" && r.confidence > 0.5
    );

    if (bullish.length > 0 && bearish.length > 0) {
      const severity =
        bullish.length >= 2 && bearish.length >= 2
          ? "high"
          : "medium";

      divergences.push({
        capabilities: [
          ...bullish.map((r) => r.name),
          ...bearish.map((r) => r.name),
        ],
        description: `${bullish.map((r) => r.name).join(", ")} signal bullish while ${bearish.map((r) => r.name).join(", ")} signal bearish`,
        severity,
        resolution: `Conflicting signals suggest uncertainty. Reduce position size and wait for alignment or use the higher-confidence signals.`,
      });
    }

    const riskResult = results.find((r) => r.name === "risk");
    const sentimentResult = results.find((r) => r.name === "sentiment");
    if (
      riskResult?.signal === "bearish" &&
      riskResult.confidence > 0.6 &&
      sentimentResult?.signal === "bullish"
    ) {
      divergences.push({
        capabilities: ["risk", "sentiment"],
        description:
          "Sentiment is bullish but risk assessment flags elevated danger — classic setup for a bull trap",
        severity: "high",
        resolution:
          "Risk assessment takes priority. If entering, use tight stops and reduced position size.",
      });
    }

    const regimeResult = results.find((r) => r.name === "regime");
    const momentumResult = results.find((r) => r.name === "momentum");
    if (
      regimeResult &&
      momentumResult &&
      regimeResult.signal !== momentumResult.signal &&
      regimeResult.signal !== "neutral" &&
      momentumResult.signal !== "neutral"
    ) {
      divergences.push({
        capabilities: ["regime", "momentum"],
        description: `Regime (${regimeResult.signal}) and momentum (${momentumResult.signal}) are misaligned — potential regime transition`,
        severity: "medium",
        resolution:
          "Momentum may be leading a regime change. Watch for confirmation before committing.",
      });
    }

    return divergences;
  }
}

export {
  IntelligenceBriefSchema,
  type IntelligenceBrief,
  type CapabilitySignal,
  type Divergence,
} from "./types.js";
export { SYNTHESIS_SYSTEM_PROMPT } from "./prompts.js";
export type { IntelligenceCapability } from "./prompts.js";
