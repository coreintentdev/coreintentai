export const PORTFOLIO_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign portfolio optimization and construction engine.

ROLE: Analyze portfolio composition, identify inefficiencies, and generate optimal allocation recommendations grounded in Modern Portfolio Theory, enhanced by regime awareness and tail-risk management.

OPTIMIZATION PHILOSOPHY:
- Mean-variance optimization is a starting point, not a destination. Real portfolios need regime awareness.
- Diversification is the only free lunch, but naive diversification (equal weight) often beats optimization with bad inputs.
- Tail risk matters more than variance. A portfolio that survives the 1% scenario is better than one optimized for the 99%.
- Transaction costs, taxes, and liquidity constraints are real. The optimal portfolio you can't execute is worthless.
- Rebalancing is a source of return (buy low, sell high mechanically), but over-rebalancing destroys it in transaction costs.

RISK METRICS:
- Sharpe Ratio: Excess return per unit of total volatility. Above 1.0 is good, above 2.0 is exceptional, above 3.0 is suspicious.
- Sortino Ratio: Like Sharpe but only penalizes downside deviation. Better for asymmetric return distributions.
- Maximum Drawdown: Largest peak-to-trough decline. The statistic that matters most psychologically.
- Value at Risk (VaR): Loss threshold at a given confidence level. Useful but underestimates tail risk.
- Conditional VaR (CVaR/Expected Shortfall): Average loss in the worst X% of scenarios. Better than VaR for tail risk.
- Beta: Sensitivity to market moves. Low beta != low risk if the portfolio has idiosyncratic concentration.

ALLOCATION CONSTRAINTS:
- No single position > 25% (unless explicitly a concentrated strategy)
- Minimum 5 positions for a "diversified" portfolio
- Cash allocation 0-30% (tactical reserve)
- Sector concentration < 40%
- Always consider correlation between positions

OUTPUT FORMAT: Respond ONLY with valid JSON matching this schema:
{
  "portfolioName": "<name or description>",
  "totalValue": <number>,
  "currentAllocations": [
    {
      "ticker": "<symbol>",
      "weight": <0-1>,
      "currentValue": <number>,
      "sector": "<sector name>"
    }
  ],
  "riskMetrics": {
    "sharpeRatio": <number>,
    "sortinoRatio": <number>,
    "maxDrawdown": <number 0-1>,
    "beta": <number>,
    "valueAtRisk95": <number>,
    "expectedShortfall": <number>,
    "annualizedReturn": <number>,
    "annualizedVolatility": <number>
  },
  "optimizedAllocations": [
    {
      "ticker": "<symbol>",
      "currentWeight": <0-1>,
      "targetWeight": <0-1>,
      "action": "increase" | "decrease" | "hold" | "add" | "exit",
      "rationale": "<why this change>"
    }
  ],
  "rebalancingTrades": [
    {
      "ticker": "<symbol>",
      "side": "buy" | "sell",
      "amount": <number>,
      "priority": "immediate" | "next_rebalance" | "opportunistic",
      "reason": "<why this trade>"
    }
  ],
  "concentrationRisks": [
    {
      "type": "single_position" | "sector" | "factor" | "geography" | "correlation",
      "description": "<what the concentration risk is>",
      "severity": "low" | "medium" | "high" | "critical",
      "affectedPositions": ["<ticker1>", "<ticker2>"],
      "mitigation": "<how to reduce this risk>"
    }
  ],
  "scenarioAnalysis": [
    {
      "scenario": "<scenario name>",
      "probability": <0-1>,
      "portfolioImpact": <number>,
      "worstHit": "<ticker most affected>",
      "bestPerformer": "<ticker that benefits>",
      "recommendation": "<what to do if this scenario materializes>"
    }
  ],
  "summary": "<2-3 sentence synthesis of portfolio health and top recommendations>",
  "timestamp": "<ISO datetime>"
}`;

export function buildPortfolioOptimizationPrompt(params: {
  positions: Array<{ ticker: string; shares: number; avgCost: number; currentPrice: number }>;
  totalValue: number;
  riskTolerance: "conservative" | "moderate" | "aggressive";
  constraints?: string;
  marketContext?: string;
}): string {
  const positionList = params.positions
    .map((p) => {
      const value = p.shares * p.currentPrice;
      const weight = ((value / params.totalValue) * 100).toFixed(1);
      const pnl = (((p.currentPrice - p.avgCost) / p.avgCost) * 100).toFixed(1);
      return `  - ${p.ticker}: ${p.shares} shares @ $${p.currentPrice} (avg cost $${p.avgCost}, P&L ${pnl}%, weight ${weight}%)`;
    })
    .join("\n");

  let prompt = `Optimize this portfolio (total value: $${params.totalValue.toLocaleString()}, risk tolerance: ${params.riskTolerance}):

Current Positions:
${positionList}`;

  if (params.constraints) {
    prompt += `\n\nConstraints:\n${params.constraints}`;
  }

  if (params.marketContext) {
    prompt += `\n\nMarket Context:\n${params.marketContext}`;
  }

  prompt += `\n\nAnalyze current allocation efficiency, identify concentration risks, estimate risk metrics, and recommend optimal rebalancing trades. Consider correlations between positions and current market regime. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildRebalancingPrompt(params: {
  currentPositions: Array<{ ticker: string; weight: number; targetWeight: number }>;
  totalValue: number;
  rebalanceThreshold: number;
  taxConsiderations?: string;
}): string {
  const positionList = params.currentPositions
    .map((p) => {
      const drift = ((p.weight - p.targetWeight) * 100).toFixed(1);
      return `  - ${p.ticker}: current ${(p.weight * 100).toFixed(1)}% / target ${(p.targetWeight * 100).toFixed(1)}% (drift: ${drift}%)`;
    })
    .join("\n");

  let prompt = `Generate a rebalancing plan for this portfolio ($${params.totalValue.toLocaleString()}, rebalance threshold: ${params.rebalanceThreshold}%):

Position Drift:
${positionList}`;

  if (params.taxConsiderations) {
    prompt += `\n\nTax Considerations:\n${params.taxConsiderations}`;
  }

  prompt += `\n\nDetermine which positions need rebalancing, prioritize trades by drift magnitude, and account for transaction costs. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildStressTestPrompt(params: {
  positions: Array<{ ticker: string; weight: number; sector: string }>;
  totalValue: number;
  scenarios?: string[];
}): string {
  const positionList = params.positions
    .map((p) => `  - ${p.ticker}: ${(p.weight * 100).toFixed(1)}% (${p.sector})`)
    .join("\n");

  const defaultScenarios = [
    "Market crash (-20% broad market decline)",
    "Interest rate shock (+200bp)",
    "Sector rotation (tech selloff, value rally)",
    "Liquidity crisis (credit spreads widen 300bp)",
    "Black swan (VIX spikes to 80+)",
  ];

  const scenarios = params.scenarios ?? defaultScenarios;

  let prompt = `Stress test this portfolio ($${params.totalValue.toLocaleString()}) against the following scenarios:

Portfolio:
${positionList}

Scenarios to test:
${scenarios.map((s) => `  - ${s}`).join("\n")}`;

  prompt += `\n\nFor each scenario, estimate portfolio impact, identify which positions are most vulnerable, and recommend protective measures. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildEfficientFrontierPrompt(params: {
  universe: string[];
  currentAllocation?: Array<{ ticker: string; weight: number }>;
  constraints?: string;
}): string {
  const tickers = params.universe.join(", ");

  let prompt = `Construct efficient frontier allocations for this investment universe: ${tickers}`;

  if (params.currentAllocation) {
    const current = params.currentAllocation
      .map((a) => `  - ${a.ticker}: ${(a.weight * 100).toFixed(1)}%`)
      .join("\n");
    prompt += `\n\nCurrent Allocation:\n${current}`;
  }

  if (params.constraints) {
    prompt += `\n\nConstraints:\n${params.constraints}`;
  }

  prompt += `\n\nProvide three portfolios on the efficient frontier: minimum variance, maximum Sharpe, and maximum return. Show where the current allocation sits relative to the frontier. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}
