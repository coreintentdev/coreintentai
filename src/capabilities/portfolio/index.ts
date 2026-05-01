import { Orchestrator } from "../../orchestrator/index.js";
import {
  PortfolioAnalysisSchema,
  type PortfolioAnalysis,
  type PortfolioPosition,
  ScenarioAnalysisSchema,
  type ScenarioAnalysis,
  RebalanceActionSchema,
  type RebalanceAction,
} from "../../types/index.js";
import { parseJsonResponse, parseJsonArrayResponse } from "../../utils/json-parser.js";
import {
  PORTFOLIO_SYSTEM_PROMPT,
  buildPortfolioAnalysisPrompt,
  buildRebalancePrompt,
  buildStressTestPrompt,
} from "./prompts.js";

export class PortfolioIntelligence {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  async analyze(params: {
    positions: Array<{
      ticker: string;
      shares: number;
      avgCost: number;
      currentPrice: number;
    }>;
    cashBalance?: number;
    riskTolerance?: "conservative" | "moderate" | "aggressive" | "very_aggressive";
    investmentHorizon?: string;
    benchmarks?: string[];
    marketContext?: string;
  }): Promise<PortfolioAnalysis> {
    const totalValue =
      params.positions.reduce(
        (sum, p) => sum + p.shares * p.currentPrice,
        0
      ) + (params.cashBalance ?? 0);

    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
      prompt: buildPortfolioAnalysisPrompt({
        ...params,
        totalValue,
      }),
      preferredProvider: "claude",
    });

    return parseJsonResponse(response.content, PortfolioAnalysisSchema);
  }

  async rebalance(params: {
    positions: Array<{
      ticker: string;
      currentWeight: number;
      targetWeight: number;
      currentPrice: number;
    }>;
    totalValue: number;
    constraints?: string[];
    taxConsiderations?: string;
  }): Promise<RebalanceAction[]> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
      prompt: buildRebalancePrompt(params),
      preferredProvider: "claude",
    });

    return parseJsonArrayResponse(response.content, RebalanceActionSchema);
  }

  async stressTest(params: {
    positions: Array<{ ticker: string; weight: number }>;
    totalValue: number;
    scenarios?: string[];
  }): Promise<ScenarioAnalysis[]> {
    const scenarios = params.scenarios ?? [
      "Fed raises rates 100bps unexpectedly",
      "Major geopolitical conflict escalation",
      "Tech sector earnings miss across the board (-20% sector)",
      "Recession confirmed — GDP contracts 2 consecutive quarters",
      "Bull case: AI productivity boom drives 30% earnings growth",
    ];

    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
      prompt: buildStressTestPrompt({
        ...params,
        scenarios,
      }),
      preferredProvider: "claude",
    });

    return parseJsonArrayResponse(response.content, ScenarioAnalysisSchema);
  }

  async multiModelAnalysis(params: {
    positions: Array<{
      ticker: string;
      shares: number;
      avgCost: number;
      currentPrice: number;
    }>;
    cashBalance?: number;
  }): Promise<{
    analyses: PortfolioAnalysis[];
    providers: string[];
  }> {
    const totalValue =
      params.positions.reduce(
        (sum, p) => sum + p.shares * p.currentPrice,
        0
      ) + (params.cashBalance ?? 0);

    const prompt = buildPortfolioAnalysisPrompt({
      ...params,
      totalValue,
    });

    const responses = await this.orchestrator.consensus(
      {
        intent: "reasoning",
        systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
        prompt,
      },
      ["claude", "grok"]
    );

    const analyses: PortfolioAnalysis[] = [];
    const providers: string[] = [];

    for (const r of responses) {
      try {
        analyses.push(parseJsonResponse(r.content, PortfolioAnalysisSchema));
        providers.push(r.provider);
      } catch {
        // skip unparseable
      }
    }

    if (analyses.length === 0) {
      throw new Error("No valid portfolio analyses from any model");
    }

    return { analyses, providers };
  }
}

export { PORTFOLIO_SYSTEM_PROMPT } from "./prompts.js";
