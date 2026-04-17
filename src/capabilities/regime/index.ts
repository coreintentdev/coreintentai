import { Orchestrator } from "../../orchestrator/index.js";
import {
  RegimeDetectionSchema,
  RegimeTransitionSchema,
  type RegimeDetection,
  type RegimeTransition,
} from "../../types/index.js";
import {
  REGIME_SYSTEM_PROMPT,
  buildRegimeDetectionPrompt,
  buildRegimeTransitionPrompt,
  buildSectorRegimePrompt,
} from "./prompts.js";

export class RegimeDetector {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  async detect(params: {
    market?: string;
    context?: string;
    indicators?: string[];
    priceData?: string;
  }): Promise<RegimeDetection> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: REGIME_SYSTEM_PROMPT,
      prompt: buildRegimeDetectionPrompt(params),
    });

    return parseRegimeResponse(response.content);
  }

  async consensus(params: {
    market?: string;
    context?: string;
    indicators?: string[];
    priceData?: string;
  }): Promise<{
    results: RegimeDetection[];
    consensusRegime: string;
    averageConfidence: number;
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

    const results: RegimeDetection[] = [];
    for (const r of responses) {
      try {
        results.push(parseRegimeResponse(r.content));
      } catch {
        // skip unparseable
      }
    }

    if (results.length === 0) {
      throw new Error("No valid regime detections from any provider");
    }

    type RegimeLabel = RegimeDetection["regime"];
    const regimeCounts = new Map<RegimeLabel, number>();
    for (const r of results) {
      regimeCounts.set(r.regime, (regimeCounts.get(r.regime) ?? 0) + 1);
    }

    let consensusRegime: RegimeLabel = results[0].regime;
    let maxCount = 0;
    for (const [regime, count] of regimeCounts) {
      if (count > maxCount) {
        maxCount = count;
        consensusRegime = regime;
      }
    }

    const avgConfidence =
      results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    const agreement = maxCount / results.length;

    return { results, consensusRegime, averageConfidence: avgConfidence, agreement };
  }

  async analyzeTransition(params: {
    currentRegime: string;
    market?: string;
    context?: string;
  }): Promise<RegimeTransition> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: REGIME_SYSTEM_PROMPT,
      prompt: buildRegimeTransitionPrompt(params),
    });

    return parseTransitionResponse(response.content);
  }

  async sectorRegimes(params: {
    sectors: string[];
    context?: string;
  }): Promise<RegimeDetection[]> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: REGIME_SYSTEM_PROMPT,
      prompt: buildSectorRegimePrompt(params),
    });

    const raw = extractJson(response.content);
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return arr.map((item: unknown) => RegimeDetectionSchema.parse(item));
  }
}

function extractJson(content: string): string {
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenceMatch ? fenceMatch[1].trim() : content.trim();
}

function parseRegimeResponse(content: string): RegimeDetection {
  const raw = extractJson(content);
  return RegimeDetectionSchema.parse(JSON.parse(raw));
}

function parseTransitionResponse(content: string): RegimeTransition {
  const raw = extractJson(content);
  return RegimeTransitionSchema.parse(JSON.parse(raw));
}

export { REGIME_SYSTEM_PROMPT } from "./prompts.js";
