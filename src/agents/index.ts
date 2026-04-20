/**
 * CoreIntent AI — Agent Registry
 *
 * Central access point for all trading intelligence agents.
 */

import { Orchestrator } from "../orchestrator/index.js";
import { MarketAnalystAgent } from "./market-analyst.js";
import { RiskManagerAgent } from "./risk-manager.js";
import { TradeExecutorAgent } from "./trade-executor.js";
import { StrategySynthesizerAgent } from "./strategy-synthesizer.js";

export type AgentName =
  | "MarketAnalyst"
  | "RiskManager"
  | "TradeExecutor"
  | "StrategySynthesizer";

/**
 * Create all agents with a shared orchestrator instance.
 */
export function createAgentTeam(orchestrator?: Orchestrator) {
  const orch = orchestrator ?? new Orchestrator();

  return {
    analyst: new MarketAnalystAgent(orch),
    riskManager: new RiskManagerAgent(orch),
    executor: new TradeExecutorAgent(orch),
    strategist: new StrategySynthesizerAgent(orch),
  };
}

/**
 * Full pipeline: Analyze → Risk Check → Plan Execution
 *
 * Runs the complete trading intelligence pipeline:
 * 1. Market Analyst evaluates the opportunity
 * 2. Risk Manager assesses the risk
 * 3. Trade Executor generates the execution plan
 */
export async function runTradingPipeline(params: {
  input: string;
  portfolioValue?: number;
  riskTolerancePct?: number;
  orchestrator?: Orchestrator;
}): Promise<{
  analysis: string;
  riskAssessment: string;
  executionPlan: string;
  totalLatencyMs: number;
}> {
  const team = createAgentTeam(params.orchestrator);
  const start = performance.now();

  // Step 1: Market analysis
  const analysisResult = await team.analyst.execute(params.input);

  // Step 2: Risk assessment (uses analysis as input)
  const riskResult = await team.riskManager.execute(
    `Evaluate risk for this trade opportunity:\n\n${analysisResult.output}`,
    { originalInput: params.input }
  );

  // Step 3: Execution planning (uses both analysis and risk)
  const execResult = await team.executor.execute(
    `Generate execution plan based on:\n\nAnalysis:\n${analysisResult.output.slice(0, 1500)}\n\nRisk Assessment:\n${riskResult.output.slice(0, 1500)}`,
    {
      portfolioValue: params.portfolioValue ?? 100_000,
      riskTolerancePct: params.riskTolerancePct ?? 1,
    }
  );

  return {
    analysis: analysisResult.output,
    riskAssessment: riskResult.output,
    executionPlan: execResult.output,
    totalLatencyMs: Math.round(performance.now() - start),
  };
}

/**
 * Full pipeline with strategy synthesis:
 * Analyze → Risk Check → Strategy Synthesis → Execution Plan
 *
 * The strategy synthesizer acts as the decision layer, resolving conflicts
 * between analysis and risk before handing off to execution.
 */
export async function runStrategyPipeline(params: {
  input: string;
  portfolioValue?: number;
  riskTolerancePct?: number;
  orchestrator?: Orchestrator;
}): Promise<{
  analysis: string;
  riskAssessment: string;
  strategy: string;
  executionPlan: string;
  totalLatencyMs: number;
}> {
  const team = createAgentTeam(params.orchestrator);
  const start = performance.now();

  // Step 1: Market analysis
  const analysisResult = await team.analyst.execute(params.input);

  // Step 2: Risk assessment
  const riskResult = await team.riskManager.execute(
    `Evaluate risk for this trade opportunity:\n\n${analysisResult.output}`,
    { originalInput: params.input }
  );

  // Step 3: Strategy synthesis (resolves conflicts, scores conviction)
  const strategyResult = await team.strategist.execute(params.input, {
    sentiment: analysisResult.output.slice(0, 2000),
    risk: riskResult.output.slice(0, 2000),
  });

  // Step 4: Execution planning (informed by strategy)
  const execResult = await team.executor.execute(
    `Generate execution plan based on:\n\nStrategy:\n${strategyResult.output.slice(0, 2000)}\n\nRisk Assessment:\n${riskResult.output.slice(0, 1500)}`,
    {
      portfolioValue: params.portfolioValue ?? 100_000,
      riskTolerancePct: params.riskTolerancePct ?? 1,
    }
  );

  return {
    analysis: analysisResult.output,
    riskAssessment: riskResult.output,
    strategy: strategyResult.output,
    executionPlan: execResult.output,
    totalLatencyMs: Math.round(performance.now() - start),
  };
}

export { BaseAgent } from "./base.js";
export { MarketAnalystAgent } from "./market-analyst.js";
export { RiskManagerAgent } from "./risk-manager.js";
export { TradeExecutorAgent } from "./trade-executor.js";
export { StrategySynthesizerAgent } from "./strategy-synthesizer.js";
