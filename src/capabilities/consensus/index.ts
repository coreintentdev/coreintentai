import { Orchestrator } from "../../orchestrator/index.js";
import {
  ConsensusResultSchema,
  type ConsensusResult,
  type ModelProvider,
} from "../../types/index.js";
import {
  CONSENSUS_SYSTEM_PROMPT,
  buildConsensusArbitrationPrompt,
  buildMarketConsensusPrompt,
} from "./prompts.js";

export class ConsensusEngine {
  private orchestrator: Orchestrator;
  private defaultProviders: ModelProvider[];

  constructor(
    orchestrator?: Orchestrator,
    providers?: ModelProvider[]
  ) {
    this.orchestrator = orchestrator ?? new Orchestrator();
    this.defaultProviders = providers ?? ["claude", "grok"];
  }

  async arbitrate(params: {
    question: string;
    systemPrompt?: string;
    providers?: ModelProvider[];
  }): Promise<ConsensusResult & { providerOutputs: Array<{ provider: string; raw: string }> }> {
    const providers = params.providers ?? this.defaultProviders;

    const responses = await this.orchestrator.consensus(
      {
        intent: "reasoning",
        systemPrompt: params.systemPrompt ?? "You are a market analyst. Provide detailed, specific analysis.",
        prompt: params.question,
      },
      providers
    );

    const modelOutputs = responses.map((r, i) => ({
      provider: providers[i],
      output: r.content,
    }));

    const arbitrationResponse = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: CONSENSUS_SYSTEM_PROMPT,
      prompt: buildConsensusArbitrationPrompt({
        question: params.question,
        modelOutputs,
      }),
      preferredProvider: "claude",
    });

    const result = parseConsensusResponse(arbitrationResponse.content);

    return {
      ...result,
      providerOutputs: modelOutputs.map((m) => ({
        provider: m.provider,
        raw: m.output,
      })),
    };
  }

  async marketConsensus(params: {
    ticker: string;
    question: string;
    timeframe?: string;
    providers?: ModelProvider[];
  }): Promise<ConsensusResult & { providerOutputs: Array<{ provider: string; raw: string }> }> {
    return this.arbitrate({
      question: buildMarketConsensusPrompt(params),
      providers: params.providers,
    });
  }

  async directionalConsensus(params: {
    ticker: string;
    timeframe?: string;
    providers?: ModelProvider[];
  }): Promise<{
    consensus: ConsensusResult;
    direction: "bullish" | "bearish" | "neutral";
    conviction: "strong" | "moderate" | "weak";
  }> {
    const result = await this.marketConsensus({
      ticker: params.ticker,
      question: `What is the directional outlook for ${params.ticker}? Should traders be bullish, bearish, or neutral? Provide specific price levels and catalysts.`,
      timeframe: params.timeframe,
      providers: params.providers,
    });

    const direction = inferDirection(result.verdict, result.synthesizedView);
    const conviction = inferConviction(result.agreementScore, result.confidence);

    return {
      consensus: result,
      direction,
      conviction,
    };
  }

  async multiAssetConsensus(params: {
    tickers: string[];
    question: string;
    providers?: ModelProvider[];
  }): Promise<Array<{ ticker: string; consensus: ConsensusResult }>> {
    const results = await Promise.all(
      params.tickers.map(async (ticker) => {
        const consensus = await this.marketConsensus({
          ticker,
          question: params.question,
          providers: params.providers,
        });
        return { ticker, consensus };
      })
    );

    return results;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseConsensusResponse(content: string): ConsensusResult {
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = jsonMatch ? jsonMatch[1].trim() : content.trim();
  const parsed = JSON.parse(raw);
  return ConsensusResultSchema.parse(parsed);
}

function inferDirection(
  verdict: string,
  synthesis: string
): "bullish" | "bearish" | "neutral" {
  const text = `${verdict} ${synthesis}`.toLowerCase();
  const bullishSignals = ["bullish", "upside", "buy", "long", "positive", "rally", "breakout"];
  const bearishSignals = ["bearish", "downside", "sell", "short", "negative", "decline", "breakdown"];

  const bullScore = bullishSignals.filter((s) => text.includes(s)).length;
  const bearScore = bearishSignals.filter((s) => text.includes(s)).length;

  if (bullScore > bearScore) return "bullish";
  if (bearScore > bullScore) return "bearish";
  return "neutral";
}

function inferConviction(
  agreement: number,
  confidence: number
): "strong" | "moderate" | "weak" {
  const combined = (agreement + confidence) / 2;
  if (combined >= 0.75) return "strong";
  if (combined >= 0.5) return "moderate";
  return "weak";
}

export { CONSENSUS_SYSTEM_PROMPT } from "./prompts.js";
