import { Orchestrator } from "../../orchestrator/index.js";
import {
  LiquidityAssessmentSchema,
  ExecutionPlanSchema,
  type LiquidityAssessment,
  type ExecutionPlan,
} from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  LIQUIDITY_SYSTEM_PROMPT,
  buildLiquidityAssessmentPrompt,
  buildExecutionRiskPrompt,
  buildLiquidityTrapPrompt,
  buildMarketMicrostructurePrompt,
} from "./prompts.js";

export class LiquidityAnalyzer {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  /**
   * Assess current liquidity conditions for a ticker.
   */
  async assess(params: {
    ticker: string;
    currentPrice?: number;
    volumeData?: string;
    spreadData?: string;
    orderBookData?: string;
    marketConditions?: string;
  }): Promise<LiquidityAssessment> {
    const response = await this.orchestrator.execute({
      intent: "fast_analysis",
      systemPrompt: LIQUIDITY_SYSTEM_PROMPT,
      prompt: buildLiquidityAssessmentPrompt(params),
    });

    return parseJsonResponse(response.content, LiquidityAssessmentSchema);
  }

  /**
   * Evaluate execution risk for a specific trade.
   */
  async executionRisk(params: {
    ticker: string;
    action: "buy" | "sell";
    quantity: number;
    urgency: string;
    currentPrice?: number;
    volumeData?: string;
    orderBookData?: string;
    marketConditions?: string;
  }): Promise<ExecutionPlan> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: LIQUIDITY_SYSTEM_PROMPT,
      prompt: buildExecutionRiskPrompt(params),
    });

    return parseJsonResponse(response.content, ExecutionPlanSchema);
  }

  /**
   * Detect potential liquidity traps — markets that appear liquid but are fragile.
   */
  async detectTraps(params: {
    ticker: string;
    currentPrice?: number;
    orderBookData?: string;
    volumeData?: string;
    positioningData?: string;
    optionsData?: string;
  }): Promise<LiquidityAssessment> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: LIQUIDITY_SYSTEM_PROMPT,
      prompt: buildLiquidityTrapPrompt(params),
    });

    return parseJsonResponse(response.content, LiquidityAssessmentSchema);
  }

  /**
   * Deep microstructure analysis for a ticker.
   */
  async microstructure(params: {
    ticker: string;
    currentPrice?: number;
    orderBookData?: string;
    tradeData?: string;
    spreadHistory?: string;
    darkPoolData?: string;
  }): Promise<LiquidityAssessment> {
    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: LIQUIDITY_SYSTEM_PROMPT,
      prompt: buildMarketMicrostructurePrompt(params),
    });

    return parseJsonResponse(response.content, LiquidityAssessmentSchema);
  }

  /**
   * Multi-model optimal execution strategy: fan out to both Grok (speed/market read)
   * and Claude (depth/risk analysis) then synthesize into a high-confidence plan.
   */
  async optimalExecution(params: {
    ticker: string;
    action: "buy" | "sell";
    quantity: number;
    urgency: string;
    currentPrice?: number;
    volumeData?: string;
    orderBookData?: string;
    marketConditions?: string;
  }): Promise<{
    grokPlan: ExecutionPlan;
    claudePlan: ExecutionPlan;
    agreement: number;
    recommendedAlgorithm: string;
  }> {
    const prompt = buildExecutionRiskPrompt(params);

    const [grokResponse, claudeResponse] = await this.orchestrator.fan([
      {
        intent: "fast_analysis",
        systemPrompt: LIQUIDITY_SYSTEM_PROMPT,
        prompt,
        preferredProvider: "grok",
      },
      {
        intent: "reasoning",
        systemPrompt: LIQUIDITY_SYSTEM_PROMPT,
        prompt,
        preferredProvider: "claude",
      },
    ]);

    const grokPlan = parseJsonResponse(grokResponse.content, ExecutionPlanSchema);
    const claudePlan = parseJsonResponse(claudeResponse.content, ExecutionPlanSchema);

    // Calculate agreement based on algorithm match and slippage estimate proximity
    let agreement = 0;
    if (grokPlan.algorithm === claudePlan.algorithm) {
      agreement += 0.5;
    }
    const slippageDiff = Math.abs(
      grokPlan.expectedSlippageBps - claudePlan.expectedSlippageBps
    );
    if (slippageDiff <= 2) {
      agreement += 0.5;
    } else if (slippageDiff <= 5) {
      agreement += 0.25;
    }

    // Prefer the more conservative recommendation when models disagree
    const recommendedAlgorithm =
      agreement >= 0.5
        ? claudePlan.algorithm
        : grokPlan.expectedSlippageBps > claudePlan.expectedSlippageBps
          ? grokPlan.algorithm
          : claudePlan.algorithm;

    return {
      grokPlan,
      claudePlan,
      agreement,
      recommendedAlgorithm,
    };
  }
}

export { LIQUIDITY_SYSTEM_PROMPT } from "./prompts.js";
