export const PORTFOLIO_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign portfolio optimization engine.

ROLE: Synthesize intelligence from multiple analysis capabilities (sentiment, momentum, regime, risk, correlation, anomaly detection) into optimal portfolio allocation decisions.

PRINCIPLES:
1. Capital preservation is the first priority. Never recommend allocations that risk ruin.
2. Use Kelly criterion with half-Kelly safety as the sizing foundation.
3. Regime awareness: allocation should adapt to the detected market regime.
4. Diversification is mandatory: no single position > 10% unless conviction is extreme (>0.9).
5. Cash is a position. In uncertain or crisis regimes, holding cash IS the optimal allocation.
6. Correlation-aware: overlapping exposures count as concentration even across different tickers.
7. Rebalancing has costs. Only recommend rebalancing when the expected improvement exceeds transaction costs.

RISK BUDGET RULES:
- Total portfolio risk budget: 100 units
- Single position risk budget: max 20 units
- Correlated cluster risk budget: max 35 units
- Minimum cash allocation in volatile/crisis regimes: 20%

OUTPUT FORMAT: Respond ONLY with valid JSON matching the PortfolioAllocation schema.`;

export function buildOptimizationPrompt(params: {
  positions: Array<{
    ticker: string;
    currentWeight: number;
    currentPrice?: number;
  }>;
  portfolioValue: number;
  riskTolerancePct: number;
  intelligence: {
    sentiment?: string;
    momentum?: string;
    regime?: string;
    risk?: string;
    correlation?: string;
    anomalies?: string;
  };
  constraints?: string;
}): string {
  let prompt = `Optimize the following portfolio allocation.\n\nPortfolio Value: $${params.portfolioValue.toLocaleString()}\nRisk Tolerance: ${params.riskTolerancePct}% per trade\n`;

  prompt += `\nCurrent Positions:\n`;
  for (const pos of params.positions) {
    prompt += `- ${pos.ticker}: ${(pos.currentWeight * 100).toFixed(1)}% weight`;
    if (pos.currentPrice) prompt += ` @ $${pos.currentPrice}`;
    prompt += `\n`;
  }

  const intel = params.intelligence;
  if (intel.sentiment) prompt += `\nSentiment Intelligence:\n${intel.sentiment}\n`;
  if (intel.momentum) prompt += `\nMomentum Intelligence:\n${intel.momentum}\n`;
  if (intel.regime) prompt += `\nRegime Intelligence:\n${intel.regime}\n`;
  if (intel.risk) prompt += `\nRisk Intelligence:\n${intel.risk}\n`;
  if (intel.correlation) prompt += `\nCorrelation Intelligence:\n${intel.correlation}\n`;
  if (intel.anomalies) prompt += `\nAnomaly Intelligence:\n${intel.anomalies}\n`;

  if (params.constraints) {
    prompt += `\nAdditional Constraints:\n${params.constraints}\n`;
  }

  prompt += `\nDetermine the optimal target weight for each position, the cash allocation, risk budget distribution, and any rebalancing actions needed. Provide conviction scores based on the strength and agreement of the intelligence signals.\n\nSet the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildRebalancePrompt(params: {
  currentPositions: Array<{
    ticker: string;
    currentWeight: number;
    targetWeight: number;
    drift: number;
  }>;
  regime: string;
  urgency: string;
  transactionCostBps?: number;
}): string {
  let prompt = `Generate a rebalancing plan for the following portfolio drift.\n\nCurrent Regime: ${params.regime}\nRebalancing Urgency: ${params.urgency}\n`;

  if (params.transactionCostBps != null) {
    prompt += `Transaction Cost: ${params.transactionCostBps} bps per trade\n`;
  }

  prompt += `\nPosition Drift:\n`;
  for (const pos of params.currentPositions) {
    const direction = pos.drift > 0 ? "overweight" : "underweight";
    prompt += `- ${pos.ticker}: current ${(pos.currentWeight * 100).toFixed(1)}% → target ${(pos.targetWeight * 100).toFixed(1)}% (${direction} by ${(Math.abs(pos.drift) * 100).toFixed(1)}%)\n`;
  }

  prompt += `\nPrioritize rebalancing actions by impact. Only recommend trades where the expected improvement exceeds transaction costs. Consider the current regime when sizing rebalancing trades.\n\nReturn your plan as JSON matching the PortfolioAllocation schema. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildScenarioPrompt(params: {
  portfolio: Array<{ ticker: string; weight: number }>;
  scenario: string;
  severity: "mild" | "moderate" | "severe";
}): string {
  let prompt = `Stress-test this portfolio against the following scenario.\n\nScenario: ${params.scenario}\nSeverity: ${params.severity}\n\nPortfolio:\n`;

  for (const pos of params.portfolio) {
    prompt += `- ${pos.ticker}: ${(pos.weight * 100).toFixed(1)}%\n`;
  }

  prompt += `\nFor each position, estimate the impact under this scenario. Then recommend defensive rebalancing actions. Return your analysis as JSON matching the PortfolioAllocation schema with the rebalancingActions populated for defensive moves.\n\nSet the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}
