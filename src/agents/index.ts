import { Orchestrator } from "../orchestrator/index.js";
import { MarketAnalystAgent } from "./market-analyst.js";
import { RiskManagerAgent } from "./risk-manager.js";
import { TradeExecutorAgent } from "./trade-executor.js";
import { StrategySynthesizerAgent } from "./strategy-synthesizer.js";
import { RegimeDetector } from "../capabilities/regime/index.js";

export type AgentName = "MarketAnalyst" | "RiskManager" | "TradeExecutor" | "StrategySynthesizer";

export function createAgentTeam(orchestrator?: Orchestrator) {
  const orch = orchestrator ?? new Orchestrator();

  return {
    analyst: new MarketAnalystAgent(orch),
    riskManager: new RiskManagerAgent(orch),
    executor: new TradeExecutorAgent(orch),
    synthesizer: new StrategySynthesizerAgent(orch),
  };
}

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

  const analysisResult = await team.analyst.execute(params.input);

  const riskResult = await team.riskManager.execute(
    `Evaluate risk for this trade opportunity:\n\n${analysisResult.output}`,
    { originalInput: params.input }
  );

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

export async function runFullPipeline(params: {
  input: string;
  portfolioValue?: number;
  riskTolerancePct?: number;
  regimeContext?: string;
  orchestrator?: Orchestrator;
}): Promise<{
  analysis: string;
  riskAssessment: string;
  executionPlan: string;
  regime: string;
  synthesis: string;
  totalLatencyMs: number;
}> {
  const orch = params.orchestrator ?? new Orchestrator();
  const team = createAgentTeam(orch);
  const regimeDetector = new RegimeDetector(orch);
  const start = performance.now();

  const [analysisResult, regimeResult] = await Promise.all([
    team.analyst.execute(params.input),
    regimeDetector
      .detect({
        context: `${params.input}\n${params.regimeContext ?? ""}`,
      })
      .catch(() => null),
  ]);

  const regimeStr = regimeResult
    ? `${regimeResult.regime} (confidence: ${regimeResult.confidence}, volatility: ${regimeResult.characteristics.volatilityLevel})`
    : "unknown";

  const riskResult = await team.riskManager.execute(
    `Evaluate risk for this trade opportunity:\n\nMarket Regime: ${regimeStr}\n\n${analysisResult.output}`,
    { originalInput: params.input, regime: regimeStr }
  );

  const execResult = await team.executor.execute(
    `Generate execution plan based on:\n\nMarket Regime: ${regimeStr}\n\nAnalysis:\n${analysisResult.output.slice(0, 1500)}\n\nRisk Assessment:\n${riskResult.output.slice(0, 1500)}`,
    {
      portfolioValue: params.portfolioValue ?? 100_000,
      riskTolerancePct: params.riskTolerancePct ?? 1,
    }
  );

  const synthesisResult = await team.synthesizer.execute(params.input, {
    analysis: analysisResult.output,
    riskAssessment: riskResult.output,
    executionPlan: execResult.output,
    regime: regimeStr,
  });

  return {
    analysis: analysisResult.output,
    riskAssessment: riskResult.output,
    executionPlan: execResult.output,
    regime: regimeStr,
    synthesis: synthesisResult.output,
    totalLatencyMs: Math.round(performance.now() - start),
  };
}

export { BaseAgent } from "./base.js";
export { MarketAnalystAgent } from "./market-analyst.js";
export { RiskManagerAgent } from "./risk-manager.js";
export { TradeExecutorAgent } from "./trade-executor.js";
export { StrategySynthesizerAgent } from "./strategy-synthesizer.js";
