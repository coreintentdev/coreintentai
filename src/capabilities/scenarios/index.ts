/**
 * CoreIntent AI — Scenario Analysis & Stress Testing
 *
 * Stress-tests portfolios against hypothetical market scenarios using
 * Claude's deep reasoning. Models cascading effects across asset classes,
 * quantifies position-level impact, and recommends hedges.
 */

import { Orchestrator } from "../../orchestrator/index.js";
import {
  ScenarioAnalysisSchema,
  type ScenarioAnalysis,
} from "../../types/index.js";
import { parseJsonResponse, parseJsonArrayResponse } from "../../utils/json-parser.js";
import { validatePortfolioPositions, sanitizePromptInput } from "../../utils/input-validator.js";
import {
  SCENARIO_SYSTEM_PROMPT,
  buildScenarioPrompt,
  buildMultiScenarioPrompt,
  buildTailRiskPrompt,
} from "./prompts.js";

export interface PortfolioPosition {
  ticker: string;
  value: number;
  pctOfPortfolio: number;
  sector?: string;
  beta?: number;
}

export class ScenarioAnalyzer {
  private orchestrator: Orchestrator;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
  }

  async analyze(params: {
    scenario: string;
    portfolio: PortfolioPosition[];
    totalValue: number;
    cashPct: number;
  }): Promise<ScenarioAnalysis> {
    validatePortfolioPositions(params.portfolio);

    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: SCENARIO_SYSTEM_PROMPT,
      prompt: buildScenarioPrompt({
        scenario: sanitizePromptInput(params.scenario),
        portfolio: params.portfolio,
        totalValue: params.totalValue,
        cashPct: params.cashPct,
      }),
    });

    return parseScenarioResponse(response.content);
  }

  async stressTestMultiple(params: {
    scenarios: string[];
    portfolio: PortfolioPosition[];
    totalValue: number;
  }): Promise<ScenarioAnalysis[]> {
    validatePortfolioPositions(params.portfolio);

    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: SCENARIO_SYSTEM_PROMPT,
      prompt: buildMultiScenarioPrompt({
        scenarios: params.scenarios.map(sanitizePromptInput),
        portfolio: params.portfolio,
        totalValue: params.totalValue,
      }),
    });

    return parseJsonArrayResponse(response.content, ScenarioAnalysisSchema);
  }

  async identifyTailRisks(params: {
    portfolio: PortfolioPosition[];
    totalValue: number;
  }): Promise<ScenarioAnalysis[]> {
    validatePortfolioPositions(params.portfolio);

    const response = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: SCENARIO_SYSTEM_PROMPT,
      prompt: buildTailRiskPrompt({
        portfolio: params.portfolio,
        totalValue: params.totalValue,
      }),
    });

    return parseJsonArrayResponse(response.content, ScenarioAnalysisSchema);
  }

  async consensusStressTest(params: {
    scenario: string;
    portfolio: PortfolioPosition[];
    totalValue: number;
    cashPct: number;
    providers?: Array<"claude" | "grok">;
  }): Promise<{
    analyses: ScenarioAnalysis[];
    avgSeverity: number;
    worstCaseDrawdown: number;
    consensusActionPlan: string[];
  }> {
    validatePortfolioPositions(params.portfolio);

    const responses = await this.orchestrator.consensus(
      {
        intent: "reasoning",
        systemPrompt: SCENARIO_SYSTEM_PROMPT,
        prompt: buildScenarioPrompt({
          scenario: sanitizePromptInput(params.scenario),
          portfolio: params.portfolio,
          totalValue: params.totalValue,
          cashPct: params.cashPct,
        }),
      },
      params.providers ?? ["claude", "grok"]
    );

    const analyses: ScenarioAnalysis[] = [];
    for (const r of responses) {
      try {
        analyses.push(parseScenarioResponse(r.content));
      } catch {
        // Skip unparseable responses
      }
    }

    if (analyses.length === 0) {
      throw new Error("No valid scenario analyses from any model");
    }

    const avgSeverity =
      analyses.reduce((sum, a) => sum + a.severity, 0) / analyses.length;
    const worstCaseDrawdown = Math.min(
      ...analyses.map((a) => a.portfolioVaR.maxDrawdown)
    );

    const allImmediate = analyses.flatMap((a) => a.actionPlan.immediate);
    const actionCounts = new Map<string, number>();
    for (const action of allImmediate) {
      actionCounts.set(action, (actionCounts.get(action) ?? 0) + 1);
    }
    const majorityThreshold = analyses.length / 2;
    const consensusActionPlan = [...actionCounts.entries()]
      .filter(([, count]) => count > majorityThreshold)
      .map(([action]) => action);

    return {
      analyses,
      avgSeverity,
      worstCaseDrawdown,
      consensusActionPlan:
        consensusActionPlan.length > 0
          ? consensusActionPlan
          : allImmediate.slice(0, 3),
    };
  }
}

function parseScenarioResponse(content: string): ScenarioAnalysis {
  return parseJsonResponse(content, ScenarioAnalysisSchema);
}

export { SCENARIO_SYSTEM_PROMPT } from "./prompts.js";
