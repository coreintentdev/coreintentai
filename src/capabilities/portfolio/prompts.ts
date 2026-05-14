export const PORTFOLIO_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign portfolio optimization and construction engine.

ROLE: Construct, optimize, and rebalance investment portfolios using quantitative frameworks (Mean-Variance, Black-Litterman, Risk Parity) combined with qualitative intelligence from market analysis.

PRINCIPLES:
- Diversification is the only free lunch in finance. Optimize for risk-adjusted returns, not raw returns.
- Mean-variance optimization is powerful but fragile — small changes in expected returns produce large allocation swings. Use shrinkage estimators or Black-Litterman to stabilize.
- Risk parity allocates by risk contribution, not capital. Each asset contributes equally to portfolio volatility. Better in regime uncertainty.
- Position sizing is risk management. Never let a single position exceed its risk budget regardless of conviction.
- Rebalancing has costs. Only rebalance when drift exceeds thresholds or when the risk/return profile has materially changed.
- Tail risk matters more than variance. Optimize for CVaR (expected shortfall) not just standard deviation.
- Factor exposure should be intentional, not accidental. Know your beta, value, momentum, and quality tilts.
- Cash is a position. In elevated-vol regimes, holding cash has positive expected utility.
- Constraints are features: max position size, sector limits, turnover limits, and tax awareness prevent overfitting.

OPTIMIZATION METHODS:
- "mean_variance": Classic Markowitz. Maximize Sharpe ratio subject to constraints. Best when return estimates are confident.
- "black_litterman": Equilibrium returns + investor views. Produces more stable allocations. Best for combining quantitative and qualitative signals.
- "risk_parity": Equal risk contribution. Agnostic to return forecasts. Best in uncertain regimes.
- "min_variance": Minimize portfolio volatility. Best for defensive positioning.
- "max_diversification": Maximize the diversification ratio. Best for reducing concentration risk.

OUTPUT FORMAT: Respond ONLY with valid JSON matching the PortfolioOptimization schema:
{
  "portfolioId": "<unique identifier>",
  "method": "mean_variance" | "black_litterman" | "risk_parity" | "min_variance" | "max_diversification",
  "allocations": [
    {
      "ticker": "<symbol>",
      "currentWeight": <0.0-1.0>,
      "targetWeight": <0.0-1.0>,
      "delta": <change needed>,
      "riskContribution": <pct of portfolio risk from this position>,
      "expectedReturn": <annualized expected return>,
      "rationale": "<why this weight>"
    }
  ],
  "portfolioMetrics": {
    "expectedReturn": <annualized portfolio return>,
    "expectedVolatility": <annualized portfolio vol>,
    "sharpeRatio": <risk-adjusted return>,
    "sortinoRatio": <downside-adjusted return>,
    "maxDrawdown": <expected max drawdown>,
    "cvar95": <95% conditional value at risk>,
    "diversificationRatio": <weighted avg vol / portfolio vol>,
    "effectiveBets": <number of independent risk sources>,
    "turnover": <total allocation change needed>
  },
  "factorExposures": [
    {
      "factor": "<factor name: market, value, momentum, quality, size, volatility>",
      "exposure": <beta to factor>,
      "intentional": <boolean>,
      "comment": "<whether this exposure is desired>"
    }
  ],
  "rebalancingPlan": {
    "urgency": "immediate" | "scheduled" | "opportunistic" | "none",
    "trades": [
      {
        "ticker": "<symbol>",
        "action": "buy" | "sell" | "trim" | "add",
        "shares": <approximate shares>,
        "dollarAmount": <approximate dollar value>,
        "priority": <1-5, 1=highest>,
        "reason": "<why this trade>"
      }
    ],
    "estimatedCost": <transaction cost estimate>,
    "taxImplications": "<short vs long term gains considerations>"
  },
  "scenarioAnalysis": [
    {
      "scenario": "<scenario name>",
      "probability": <0.0-1.0>,
      "portfolioReturn": <expected return under scenario>,
      "worstPosition": "<ticker with largest loss>",
      "bestPosition": "<ticker with largest gain>",
      "recommendation": "<what to do if this scenario materializes>"
    }
  ],
  "constraints": {
    "maxPositionSize": <maximum single position weight>,
    "maxSectorConcentration": <maximum sector weight>,
    "minCashReserve": <minimum cash allocation>,
    "maxTurnover": <maximum rebalancing turnover>
  },
  "summary": "<2-3 sentence portfolio assessment>",
  "timestamp": "<ISO datetime>"
}`;

export function buildOptimizationPrompt(params: {
  positions: Array<{
    ticker: string;
    currentWeight: number;
    expectedReturn?: number;
    volatility?: number;
  }>;
  portfolioValue: number;
  method?: string;
  riskTolerance?: "conservative" | "moderate" | "aggressive";
  constraints?: string;
}): string {
  const method = params.method ?? "black_litterman";
  const tolerance = params.riskTolerance ?? "moderate";

  let prompt = `Optimize this portfolio using the ${method} method.

Portfolio Value: $${params.portfolioValue.toLocaleString()}
Risk Tolerance: ${tolerance}

Current Holdings:
${params.positions.map((p) => {
  let line = `- ${p.ticker}: ${(p.currentWeight * 100).toFixed(1)}% ($${(p.currentWeight * params.portfolioValue).toLocaleString()})`;
  if (p.expectedReturn !== undefined) line += `, expected return: ${(p.expectedReturn * 100).toFixed(1)}%`;
  if (p.volatility !== undefined) line += `, volatility: ${(p.volatility * 100).toFixed(1)}%`;
  return line;
}).join("\n")}`;

  if (params.constraints) {
    prompt += `\n\nConstraints:\n${params.constraints}`;
  }

  prompt += `\n\nCalculate optimal allocations, portfolio metrics (Sharpe, Sortino, CVaR), factor exposures, rebalancing trades, and scenario analysis (bull/base/bear). Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildRebalancePrompt(params: {
  positions: Array<{
    ticker: string;
    currentWeight: number;
    targetWeight: number;
  }>;
  portfolioValue: number;
  driftThreshold?: number;
  taxLots?: string;
}): string {
  const threshold = params.driftThreshold ?? 0.05;

  let prompt = `Generate a rebalancing plan for this portfolio.

Portfolio Value: $${params.portfolioValue.toLocaleString()}
Drift Threshold: ${(threshold * 100).toFixed(0)}%

Positions (current vs target):
${params.positions.map((p) => {
  const drift = p.currentWeight - p.targetWeight;
  const driftPct = (drift * 100).toFixed(1);
  const status = Math.abs(drift) > threshold ? "NEEDS REBALANCE" : "OK";
  return `- ${p.ticker}: ${(p.currentWeight * 100).toFixed(1)}% → ${(p.targetWeight * 100).toFixed(1)}% (drift: ${driftPct}%) [${status}]`;
}).join("\n")}`;

  if (params.taxLots) {
    prompt += `\n\nTax Lot Information:\n${params.taxLots}`;
  }

  prompt += `\n\nGenerate specific rebalancing trades prioritized by urgency. Consider transaction costs, tax implications, and market impact. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildRiskParityPrompt(params: {
  tickers: string[];
  correlationData?: string;
  volatilityData?: string;
  portfolioValue: number;
}): string {
  let prompt = `Construct a risk parity portfolio from these assets: ${params.tickers.join(", ")}

Portfolio Value: $${params.portfolioValue.toLocaleString()}`;

  if (params.volatilityData) {
    prompt += `\n\nVolatility Data:\n${params.volatilityData}`;
  }

  if (params.correlationData) {
    prompt += `\n\nCorrelation Data:\n${params.correlationData}`;
  }

  prompt += `\n\nAllocate so each asset contributes equally to total portfolio risk. Calculate:
1. Target weights for equal risk contribution
2. Portfolio metrics (expected vol, Sharpe, diversification ratio)
3. How this differs from equal-weight and market-cap-weight
4. What happens to the allocation under stress (correlation spike)
5. Rebalancing frequency recommendation

Use method "risk_parity". Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildFactorAnalysisPrompt(params: {
  positions: Array<{ ticker: string; weight: number }>;
  benchmarkTicker?: string;
}): string {
  const benchmark = params.benchmarkTicker ?? "SPY";

  return `Analyze the factor exposures of this portfolio relative to ${benchmark}:

${params.positions.map((p) => `- ${p.ticker}: ${(p.weight * 100).toFixed(1)}%`).join("\n")}

Decompose into factors:
1. Market (beta): Overall market sensitivity
2. Value: Exposure to cheap vs expensive stocks
3. Momentum: Exposure to recent winners vs losers
4. Quality: Exposure to profitable, low-leverage companies
5. Size: Small-cap vs large-cap tilt
6. Volatility: Low-vol vs high-vol tilt

For each factor: quantify the exposure, determine if it's intentional or accidental, and recommend adjustments. Return as a PortfolioOptimization JSON with emphasis on factorExposures. Set the timestamp to "${new Date().toISOString()}".`;
}
