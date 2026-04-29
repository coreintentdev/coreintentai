export const PORTFOLIO_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign portfolio optimization engine.

ROLE: Construct and rebalance portfolios by synthesizing quantitative frameworks (Modern Portfolio Theory, Black-Litterman, Risk Parity) with qualitative AI judgment from regime detection, sentiment, and correlation analysis.

PRINCIPLES:
- Diversification is the only free lunch. Maximize risk-adjusted return, not raw return.
- Regime-aware allocation: a portfolio that's optimal in trending markets will blow up in a crisis.
- Correlation is not static — use forward-looking correlation estimates, not just trailing.
- Position sizing is the primary risk control. Get this wrong and nothing else matters.
- Liquidity constraints are real. A position you can't exit is a liability, not an asset.
- Transaction costs and tax implications affect real returns. Include them.
- Conviction must be evidence-based. High conviction without evidence is gambling.

OPTIMIZATION APPROACHES:
1. Mean-Variance (Markowitz): Maximize Sharpe ratio given expected returns and covariance.
2. Risk Parity: Allocate so each position contributes equally to portfolio risk.
3. Black-Litterman: Start from market equilibrium, adjust with views (AI-generated).
4. Maximum Diversification: Maximize the ratio of weighted average vol to portfolio vol.
5. Minimum Variance: Minimize portfolio variance regardless of expected return.

OUTPUT FORMAT: Respond ONLY with valid JSON matching this schema:
{
  "portfolioName": "<descriptive name>",
  "strategy": "mean_variance" | "risk_parity" | "black_litterman" | "max_diversification" | "min_variance" | "custom",
  "allocations": [
    {
      "ticker": "<symbol>",
      "weight": <0.0-1.0>,
      "currentWeight": <0.0-1.0 or null if new>,
      "targetWeight": <0.0-1.0>,
      "conviction": <0.0-1.0>,
      "rationale": "<why this allocation>"
    }
  ],
  "metrics": {
    "expectedReturn": <annualized %>,
    "expectedVolatility": <annualized %>,
    "sharpeRatio": <number>,
    "maxDrawdown": <estimated % based on regime>,
    "diversificationRatio": <number>,
    "concentrationRisk": <0.0-1.0 where 1 = fully concentrated>
  },
  "rebalanceActions": [
    {
      "ticker": "<symbol>",
      "action": "buy" | "sell" | "hold" | "trim" | "add",
      "currentWeight": <number>,
      "targetWeight": <number>,
      "urgency": "immediate" | "next_session" | "this_week" | "optional"
    }
  ],
  "regimeAdaptation": {
    "currentRegime": "<detected regime>",
    "adaptations": ["<what changed vs neutral allocation>"],
    "triggerToRebalance": "<what event would force rebalancing>"
  },
  "riskBudget": {
    "totalRiskBudget": <number>,
    "riskPerPosition": [
      {
        "ticker": "<symbol>",
        "riskContribution": <0.0-1.0>,
        "marginalRisk": <number>
      }
    ]
  },
  "constraints": {
    "maxPositionSize": <number>,
    "minPositionSize": <number>,
    "maxSectorExposure": <number>,
    "cashReserve": <number>
  },
  "summary": "<2-3 sentence portfolio strategy summary>",
  "timestamp": "<ISO datetime>"
}`;

export function buildPortfolioOptimizationPrompt(params: {
  holdings: Array<{
    ticker: string;
    weight: number;
    currentPrice: number;
  }>;
  strategy?: string;
  riskTolerance?: "conservative" | "moderate" | "aggressive";
  investmentHorizon?: string;
  constraints?: {
    maxPositionSize?: number;
    minPositionSize?: number;
    sectorLimits?: Record<string, number>;
    excludeTickers?: string[];
    cashReserve?: number;
  };
  marketContext?: string;
  regimeData?: string;
  correlationData?: string;
}): string {
  const holdingsList = params.holdings
    .map(
      (h) => `  - ${h.ticker}: ${(h.weight * 100).toFixed(1)}% @ $${h.currentPrice}`
    )
    .join("\n");

  let prompt = `Optimize this portfolio:

Current Holdings:
${holdingsList}

Strategy: ${params.strategy ?? "mean_variance"}
Risk Tolerance: ${params.riskTolerance ?? "moderate"}
Investment Horizon: ${params.investmentHorizon ?? "medium_term (3-12 months)"}`;

  if (params.constraints) {
    prompt += "\n\nConstraints:";
    if (params.constraints.maxPositionSize != null)
      prompt += `\n- Max position size: ${(params.constraints.maxPositionSize * 100).toFixed(0)}%`;
    if (params.constraints.minPositionSize != null)
      prompt += `\n- Min position size: ${(params.constraints.minPositionSize * 100).toFixed(0)}%`;
    if (params.constraints.cashReserve != null)
      prompt += `\n- Cash reserve: ${(params.constraints.cashReserve * 100).toFixed(0)}%`;
    if (params.constraints.excludeTickers?.length)
      prompt += `\n- Exclude: ${params.constraints.excludeTickers.join(", ")}`;
    if (params.constraints.sectorLimits) {
      for (const [sector, limit] of Object.entries(params.constraints.sectorLimits)) {
        prompt += `\n- Max ${sector} exposure: ${(limit * 100).toFixed(0)}%`;
      }
    }
  }

  if (params.regimeData)
    prompt += `\n\nRegime Context:\n${params.regimeData}`;
  if (params.correlationData)
    prompt += `\n\nCorrelation Data:\n${params.correlationData}`;
  if (params.marketContext)
    prompt += `\n\nMarket Context:\n${params.marketContext}`;

  prompt += `\n\nOptimize the portfolio. Weight allocations must sum to 1.0 (including cash). Provide specific rebalance actions. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildRebalancePrompt(params: {
  currentPortfolio: Array<{
    ticker: string;
    weight: number;
    gainLossPct: number;
  }>;
  targetPortfolio: Array<{
    ticker: string;
    weight: number;
  }>;
  portfolioValue: number;
  taxContext?: string;
  transactionCosts?: string;
}): string {
  const current = params.currentPortfolio
    .map(
      (h) =>
        `  - ${h.ticker}: ${(h.weight * 100).toFixed(1)}% (${h.gainLossPct >= 0 ? "+" : ""}${h.gainLossPct.toFixed(1)}% P&L)`
    )
    .join("\n");

  const target = params.targetPortfolio
    .map((h) => `  - ${h.ticker}: ${(h.weight * 100).toFixed(1)}%`)
    .join("\n");

  let prompt = `Generate a rebalance plan.

Portfolio Value: $${params.portfolioValue.toLocaleString()}

Current Portfolio:
${current}

Target Portfolio:
${target}`;

  if (params.taxContext) prompt += `\n\nTax Context:\n${params.taxContext}`;
  if (params.transactionCosts)
    prompt += `\n\nTransaction Costs:\n${params.transactionCosts}`;

  prompt += `\n\nGenerate optimal rebalance actions. Consider tax-loss harvesting opportunities. Prioritize actions by urgency. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildRiskParityPrompt(params: {
  tickers: string[];
  volatilities: Record<string, number>;
  correlationSummary?: string;
  targetRisk?: number;
}): string {
  const volList = params.tickers
    .map(
      (t) =>
        `  - ${t}: ${((params.volatilities[t] ?? 0) * 100).toFixed(1)}% annualized vol`
    )
    .join("\n");

  let prompt = `Construct a risk parity portfolio.

Assets and Volatilities:
${volList}`;

  if (params.correlationSummary)
    prompt += `\n\nCorrelation Summary:\n${params.correlationSummary}`;
  if (params.targetRisk != null)
    prompt += `\n\nTarget Portfolio Volatility: ${(params.targetRisk * 100).toFixed(1)}%`;

  prompt += `\n\nAllocate so each position contributes equal marginal risk. Higher-vol assets get smaller weights. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}
