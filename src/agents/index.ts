import { Orchestrator } from "../orchestrator/index.js";
import { MarketAnalystAgent } from "./market-analyst.js";
import { RiskManagerAgent } from "./risk-manager.js";
import { TradeExecutorAgent } from "./trade-executor.js";

export type AgentName = "MarketAnalyst" | "RiskManager" | "TradeExecutor";

export function createAgentTeam(orchestrator?: Orchestrator) {
  const orch = orchestrator ?? new Orchestrator();

  return {
    analyst: new MarketAnalystAgent(orch),
    riskManager: new RiskManagerAgent(orch),
    executor: new TradeExecutorAgent(orch),
  };
}

export interface PipelineResult {
  analysis: string;
  riskAssessment: string;
  executionPlan: string;
  totalLatencyMs: number;
  stageResults: Array<{
    stage: string;
    success: boolean;
    latencyMs: number;
    error?: string;
  }>;
}

export async function runTradingPipeline(params: {
  input: string;
  portfolioValue?: number;
  riskTolerancePct?: number;
  orchestrator?: Orchestrator;
  abortOnRiskFailure?: boolean;
}): Promise<PipelineResult> {
  const team = createAgentTeam(params.orchestrator);
  const start = performance.now();
  const stageResults: PipelineResult["stageResults"] = [];

  let analysis = "";
  let riskAssessment = "";
  let executionPlan = "";

  const stageStart1 = performance.now();
  try {
    const analysisResult = await team.analyst.execute(params.input);
    analysis = analysisResult.output;
    stageResults.push({
      stage: "analysis",
      success: true,
      latencyMs: Math.round(performance.now() - stageStart1),
    });
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : String(err);
    analysis = `[Analysis unavailable: ${errorMsg}] Original request: ${params.input}`;
    stageResults.push({
      stage: "analysis",
      success: false,
      latencyMs: Math.round(performance.now() - stageStart1),
      error: errorMsg,
    });
  }

  const stageStart2 = performance.now();
  try {
    const riskInput = analysis.startsWith("[Analysis unavailable")
      ? `Evaluate risk for this trade opportunity based on the original request:\n\n${params.input}`
      : `Evaluate risk for this trade opportunity:\n\n${analysis}`;

    const riskResult = await team.riskManager.execute(riskInput, {
      originalInput: params.input,
    });
    riskAssessment = riskResult.output;
    stageResults.push({
      stage: "risk",
      success: true,
      latencyMs: Math.round(performance.now() - stageStart2),
    });
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : String(err);
    riskAssessment = `[Risk assessment unavailable: ${errorMsg}]`;
    stageResults.push({
      stage: "risk",
      success: false,
      latencyMs: Math.round(performance.now() - stageStart2),
      error: errorMsg,
    });

    if (params.abortOnRiskFailure) {
      executionPlan =
        "[Execution skipped: risk assessment failed and abortOnRiskFailure is enabled]";
      stageResults.push({
        stage: "execution",
        success: false,
        latencyMs: 0,
        error: "Skipped due to risk assessment failure",
      });

      return {
        analysis,
        riskAssessment,
        executionPlan,
        totalLatencyMs: Math.round(performance.now() - start),
        stageResults,
      };
    }
  }

  const stageStart3 = performance.now();
  try {
    const analysisContext = analysis.startsWith("[Analysis unavailable")
      ? params.input
      : analysis;

    const execResult = await team.executor.execute(
      `Generate execution plan based on:\n\nAnalysis:\n${analysisContext}\n\nRisk Assessment:\n${riskAssessment}`,
      {
        portfolioValue: params.portfolioValue ?? 100_000,
        riskTolerancePct: params.riskTolerancePct ?? 1,
      }
    );
    executionPlan = execResult.output;
    stageResults.push({
      stage: "execution",
      success: true,
      latencyMs: Math.round(performance.now() - stageStart3),
    });
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : String(err);
    executionPlan = `[Execution plan unavailable: ${errorMsg}]`;
    stageResults.push({
      stage: "execution",
      success: false,
      latencyMs: Math.round(performance.now() - stageStart3),
      error: errorMsg,
    });
  }

  return {
    analysis,
    riskAssessment,
    executionPlan,
    totalLatencyMs: Math.round(performance.now() - start),
    stageResults,
  };
}

export { BaseAgent } from "./base.js";
export { MarketAnalystAgent } from "./market-analyst.js";
export { RiskManagerAgent } from "./risk-manager.js";
export { TradeExecutorAgent } from "./trade-executor.js";
