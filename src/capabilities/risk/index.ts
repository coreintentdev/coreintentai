/**
 * CoreIntent AI — Risk Assessment Capability
 *
 * Multi-dimensional risk analysis for positions and portfolios.
 * Uses Claude's reasoning for thorough risk evaluation.
 */

import { Orchestrator } from "../../orchestrator/index.js";
import {
  RiskAssessmentSchema,
  type RiskAssessment,
} from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import {
  RISK_SYSTEM_PROMPT,
  buildPositionRiskPrompt,
  buildPortfolioRiskPrompt,
  buildPreTradeRiskPrompt,
} from "./prompts.js";

export class RiskAssessor {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  /**
   * Assess risk for an individual position.
   */
  async assessPosition(params: {
    ticker: string;
    currentPrice: number;
    positionSize: number;
    portfolioValue: number;
    stopLoss?: number;
    averageDailyVolume?: number;
    beta?: number;
    sector?: string;
    volatility?: number;
  }): Promise<RiskAssessment> {
    const response = await this.orchestrator.execute({
      intent: "risk",
      systemPrompt: RISK_SYSTEM_PROMPT,
      prompt: buildPositionRiskPrompt(params),
    });

    return parseRiskResponse(response.content);
  }

  /**
   * Assess risk for an entire portfolio.
   */
  async assessPortfolio(params: {
    positions: Array<{
      ticker: string;
      value: number;
      pctOfPortfolio: number;
      sector?: string;
      beta?: number;
    }>;
    totalValue: number;
    cashPct: number;
  }): Promise<RiskAssessment> {
    const response = await this.orchestrator.execute({
      intent: "risk",
      systemPrompt: RISK_SYSTEM_PROMPT,
      prompt: buildPortfolioRiskPrompt(params),
    });

    return parseRiskResponse(response.content);
  }

  /**
   * Pre-trade risk check — evaluate a proposed trade before execution.
   */
  async preTradeCheck(params: {
    ticker: string;
    action: "buy" | "sell" | "short";
    proposedSize: number;
    currentPortfolio: string;
    marketConditions?: string;
  }): Promise<{ assessment: RiskAssessment; approved: boolean; reason: string }> {
    const response = await this.orchestrator.execute({
      intent: "risk",
      systemPrompt: RISK_SYSTEM_PROMPT,
      prompt: buildPreTradeRiskPrompt(params),
    });

    const assessment = parseRiskResponse(response.content);

    // Auto-approve if risk is moderate or below with no critical warnings
    const criticalWarnings = assessment.warnings.filter(
      (w) =>
        w.toLowerCase().includes("critical") ||
        w.toLowerCase().includes("deal-breaker") ||
        w.toLowerCase().includes("do not")
    );

    const riskLevelScore: Record<string, number> = {
      minimal: 0,
      low: 1,
      moderate: 2,
      elevated: 3,
      high: 4,
      critical: 5,
    };

    const approved =
      riskLevelScore[assessment.overallRisk] <= 2 &&
      criticalWarnings.length === 0;

    const reason = approved
      ? `Trade approved — risk level: ${assessment.overallRisk}`
      : `Trade flagged — risk level: ${assessment.overallRisk}${criticalWarnings.length > 0 ? `. Warnings: ${criticalWarnings.join("; ")}` : ""}`;

    return { assessment, approved, reason };
  }

  /**
   * Quick risk score — returns just the numeric risk score (0-100) for fast decisions.
   */
  async quickScore(params: {
    ticker: string;
    currentPrice: number;
    positionSize: number;
    portfolioValue: number;
  }): Promise<number> {
    const assessment = await this.assessPosition(params);
    return assessment.riskScore;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseRiskResponse(content: string): RiskAssessment {
  return parseJsonResponse(content, RiskAssessmentSchema);
}

export { RISK_SYSTEM_PROMPT } from "./prompts.js";
