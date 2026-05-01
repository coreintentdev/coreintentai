export const PORTFOLIO_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign portfolio intelligence engine for institutional-grade portfolio analysis.

ROLE: Analyze entire portfolios, not just individual positions. You assess aggregate exposure, concentration risk, correlation risk, and provide actionable rebalancing recommendations.

PRINCIPLES:
- Think in terms of PORTFOLIO CONSTRUCTION, not individual trades
- Every recommendation must consider impact on the whole portfolio
- Risk is measured at portfolio level — individual position risk is secondary
- Diversification is a feature, not a bug — quantify it
- Always consider tail risk and correlation breakdown scenarios
- Position sizing follows Kelly-inspired math, adjusted for uncertainty

OUTPUT FORMAT: Respond ONLY with valid JSON matching the requested schema. No markdown, no explanations outside the JSON.`;

export function buildPortfolioAnalysisPrompt(params: {
  positions: Array<{
    ticker: string;
    shares: number;
    avgCost: number;
    currentPrice: number;
  }>;
  totalValue: number;
  cashBalance?: number;
  riskTolerance?: string;
  investmentHorizon?: string;
  benchmarks?: string[];
  marketContext?: string;
}): string {
  const positionLines = params.positions
    .map((p) => {
      const mv = p.shares * p.currentPrice;
      const pnl = (p.currentPrice - p.avgCost) * p.shares;
      const pnlPct = ((p.currentPrice - p.avgCost) / p.avgCost) * 100;
      const weight = mv / params.totalValue;
      return `  ${p.ticker}: ${p.shares} shares @ $${p.avgCost} avg → $${p.currentPrice} now | MV: $${mv.toLocaleString()} | Weight: ${(weight * 100).toFixed(1)}% | PnL: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(0)} (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%)`;
    })
    .join("\n");

  let prompt = `Analyze this portfolio and provide a comprehensive assessment:

PORTFOLIO ($${params.totalValue.toLocaleString()} total):
${positionLines}`;

  if (params.cashBalance !== undefined) {
    prompt += `\n  CASH: $${params.cashBalance.toLocaleString()} (${((params.cashBalance / params.totalValue) * 100).toFixed(1)}%)`;
  }

  if (params.riskTolerance) {
    prompt += `\n\nRisk Tolerance: ${params.riskTolerance}`;
  }

  if (params.investmentHorizon) {
    prompt += `\nInvestment Horizon: ${params.investmentHorizon}`;
  }

  if (params.benchmarks?.length) {
    prompt += `\nBenchmarks: ${params.benchmarks.join(", ")}`;
  }

  if (params.marketContext) {
    prompt += `\n\nMarket Context:\n${params.marketContext}`;
  }

  prompt += `

Return JSON matching the PortfolioAnalysis schema with:
- Overall health assessment and risk score
- Diversification score (0-100)
- Concentration risk analysis (Herfindahl index, top holdings)
- Exposure breakdown by sector, geography, asset class
- Specific rebalance actions with priority levels
- Hedging recommendations
- Scenario analysis (bull/base/bear cases with portfolio impact)
- Set timestamp to "${new Date().toISOString()}"`;

  return prompt;
}

export function buildRebalancePrompt(params: {
  positions: Array<{
    ticker: string;
    currentWeight: number;
    targetWeight: number;
    currentPrice: number;
  }>;
  totalValue: number;
  constraints?: string[];
  taxConsiderations?: string;
}): string {
  const positionLines = params.positions
    .map(
      (p) =>
        `  ${p.ticker}: current ${(p.currentWeight * 100).toFixed(1)}% → target ${(p.targetWeight * 100).toFixed(1)}% (${p.currentWeight > p.targetWeight ? "trim" : "add"} ${Math.abs(p.currentWeight - p.targetWeight) * 100 > 0.1 ? `${(Math.abs(p.currentWeight - p.targetWeight) * 100).toFixed(1)}%` : "hold"}) @ $${p.currentPrice}`
    )
    .join("\n");

  let prompt = `Generate a detailed rebalancing plan for this portfolio ($${params.totalValue.toLocaleString()}):

POSITIONS & TARGETS:
${positionLines}`;

  if (params.constraints?.length) {
    prompt += `\n\nConstraints:\n${params.constraints.map((c) => `- ${c}`).join("\n")}`;
  }

  if (params.taxConsiderations) {
    prompt += `\n\nTax Considerations: ${params.taxConsiderations}`;
  }

  prompt += `

For each position, provide:
- Action (buy/sell/hold/trim/add)
- Shares to trade
- Estimated cost
- Priority (immediate/soon/opportunistic)
- Rationale

Return as a JSON array of rebalance actions. Set timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildStressTestPrompt(params: {
  positions: Array<{ ticker: string; weight: number }>;
  scenarios: string[];
  totalValue: number;
}): string {
  const positionLines = params.positions
    .map((p) => `  ${p.ticker}: ${(p.weight * 100).toFixed(1)}%`)
    .join("\n");

  return `Stress test this portfolio ($${params.totalValue.toLocaleString()}) against the following scenarios:

PORTFOLIO:
${positionLines}

SCENARIOS TO TEST:
${params.scenarios.map((s, i) => `${i + 1}. ${s}`).join("\n")}

For each scenario, estimate:
- Probability (0-1)
- Portfolio impact (% change)
- Worst-case drawdown
- Which positions are most affected
- Recommended defensive actions

Return as a JSON array of scenario analysis objects. Set timestamp to "${new Date().toISOString()}".`;
}
