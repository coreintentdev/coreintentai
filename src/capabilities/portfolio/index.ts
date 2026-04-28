import { Orchestrator } from "../../orchestrator/index.js";
import {
  PortfolioAnalysisSchema,
  type PortfolioAnalysis,
} from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  PORTFOLIO_SYSTEM_PROMPT,
  buildPortfolioOptimizationPrompt,
  buildRebalancingPrompt,
  buildStressTestPrompt,
  buildEfficientFrontierPrompt,
} from "./prompts.js";

export class PortfolioOptimizer {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  async optimize(params: {
    positions: Array<{ ticker: string; shares: number; avgCost: number; currentPrice: number }>;
    totalValue: number;
    riskTolerance: "conservative" | "moderate" | "aggressive";
    constraints?: string;
    marketContext?: string;
  }): Promise<PortfolioAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
      prompt: buildPortfolioOptimizationPrompt(params),
    });

    return parseJsonResponse(response.content, PortfolioAnalysisSchema);
  }

  async rebalance(params: {
    currentPositions: Array<{ ticker: string; weight: number; targetWeight: number }>;
    totalValue: number;
    rebalanceThreshold: number;
    taxConsiderations?: string;
  }): Promise<PortfolioAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
      prompt: buildRebalancingPrompt(params),
    });

    return parseJsonResponse(response.content, PortfolioAnalysisSchema);
  }

  async stressTest(params: {
    positions: Array<{ ticker: string; weight: number; sector: string }>;
    totalValue: number;
    scenarios?: string[];
  }): Promise<PortfolioAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
      prompt: buildStressTestPrompt(params),
    });

    return parseJsonResponse(response.content, PortfolioAnalysisSchema);
  }

  async efficientFrontier(params: {
    universe: string[];
    currentAllocation?: Array<{ ticker: string; weight: number }>;
    constraints?: string;
  }): Promise<PortfolioAnalysis> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
      prompt: buildEfficientFrontierPrompt(params),
    });

    return parseJsonResponse(response.content, PortfolioAnalysisSchema);
  }

  /**
   * Multi-model portfolio review: Grok for quick risk scan, Claude for deep optimization.
   */
  async comprehensiveReview(params: {
    positions: Array<{ ticker: string; shares: number; avgCost: number; currentPrice: number }>;
    totalValue: number;
    riskTolerance: "conservative" | "moderate" | "aggressive";
  }): Promise<{ riskScan: PortfolioAnalysis; optimization: PortfolioAnalysis }> {
    const riskResponse = await this.orchestrator.execute({
      intent: "fast_analysis",
      systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
      prompt: buildPortfolioOptimizationPrompt({
        positions: params.positions,
        totalValue: params.totalValue,
        riskTolerance: params.riskTolerance,
        marketContext: "Focus on risk identification and concentration analysis. Speed over depth.",
      }),
    });

    const riskScan = parseJsonResponse(riskResponse.content, PortfolioAnalysisSchema);

    const riskContext = riskScan.concentrationRisks
      .map((r) => `${r.type}: ${r.description} (${r.severity})`)
      .join("; ");

    const optimizationResponse = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: PORTFOLIO_SYSTEM_PROMPT,
      prompt: buildPortfolioOptimizationPrompt({
        positions: params.positions,
        totalValue: params.totalValue,
        riskTolerance: params.riskTolerance,
        marketContext: `Risk scan identified: ${riskContext}. Factor these risks into your optimization.`,
      }),
    });

    const optimization = parseJsonResponse(optimizationResponse.content, PortfolioAnalysisSchema);

    return { riskScan, optimization };
  }
}

export { PORTFOLIO_SYSTEM_PROMPT } from "./prompts.js";
