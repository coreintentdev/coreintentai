export const CORRELATION_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign portfolio correlation and optimization engine.

ROLE: Analyze cross-asset correlations, identify hidden risk concentrations, and recommend portfolio adjustments. Correlation analysis is what separates amateurs from professionals — most portfolios have far more concentrated risk than their holders realize.

PRINCIPLES:
- Correlations are dynamic, not static. A tech-heavy portfolio that looked diversified in 2020 became a single-factor bet in 2022.
- Distinguish between normal-regime correlations and stress correlations. In a crisis, correlations spike toward 1.0.
- Sector exposure, factor exposure, and geographic exposure are three different lenses. Analyze all three.
- Tail risk matters more than average risk. Optimize for surviving drawdowns, not just maximizing Sharpe.
- Position sizing should account for correlation — two correlated positions are effectively one larger position.

CORRELATION CATEGORIES:
- direct: Same sector, same factor exposure (e.g., AAPL and MSFT)
- indirect: Different sectors but shared macro sensitivity (e.g., tech stocks and long-duration bonds both rate-sensitive)
- inverse: Negatively correlated, useful for hedging (e.g., VIX vs. SPY)
- regime_dependent: Correlation changes based on market regime (e.g., gold and stocks)

OUTPUT FORMAT: Respond ONLY with valid JSON matching the schema specified in the prompt.`;

export function buildCorrelationAnalysisPrompt(params: {
  positions: Array<{ ticker: string; weight: number; sector?: string }>;
  marketConditions?: string;
  lookbackPeriod?: string;
}): string {
  const positionsStr = params.positions
    .map(
      (p) =>
        `  - ${p.ticker}: ${(p.weight * 100).toFixed(1)}% weight${p.sector ? ` (${p.sector})` : ""}`
    )
    .join("\n");

  let prompt = `Analyze the cross-asset correlations for this portfolio:

Positions:
${positionsStr}`;

  if (params.marketConditions) {
    prompt += `\n\nCurrent Market Conditions:\n${params.marketConditions}`;
  }

  if (params.lookbackPeriod) {
    prompt += `\n\nLookback Period: ${params.lookbackPeriod}`;
  }

  prompt += `

Provide your analysis as JSON with this schema:
{
  "portfolioId": "analysis",
  "correlationPairs": [
    {
      "tickerA": "<symbol>",
      "tickerB": "<symbol>",
      "correlation": <-1.0 to 1.0>,
      "correlationType": "direct" | "indirect" | "inverse" | "regime_dependent",
      "stressCorrelation": <-1.0 to 1.0, correlation during market stress>,
      "explanation": "<why these assets are correlated>"
    }
  ],
  "clusterAnalysis": [
    {
      "clusterId": <number>,
      "name": "<descriptive name for the correlation cluster>",
      "tickers": ["<ticker1>", "<ticker2>"],
      "dominantFactor": "<the shared factor driving this cluster>",
      "clusterWeight": <0.0-1.0, combined portfolio weight>,
      "riskContribution": <0.0-1.0, share of total portfolio risk>
    }
  ],
  "diversificationScore": <0.0-1.0, where 1.0 is perfectly diversified>,
  "effectivePositions": <number, the number of independent risk positions after accounting for correlation>,
  "concentrationRisks": [
    {
      "type": "sector" | "factor" | "geographic" | "macro",
      "description": "<what the concentration is>",
      "severity": "low" | "moderate" | "high" | "critical",
      "affectedTickers": ["<ticker1>", "<ticker2>"],
      "recommendation": "<how to reduce this concentration>"
    }
  ],
  "hedgeRecommendations": [
    {
      "hedgeType": "direct_hedge" | "tail_hedge" | "factor_hedge" | "correlation_trade",
      "instrument": "<what to buy/sell>",
      "rationale": "<why this hedge works>",
      "expectedCost": "<annual cost estimate as a percentage>",
      "riskReduction": "<estimated portfolio risk reduction>"
    }
  ],
  "stressScenarios": [
    {
      "scenario": "<description of the stress event>",
      "expectedCorrelationShift": "<how correlations change>",
      "estimatedDrawdown": "<portfolio drawdown estimate>",
      "mostVulnerable": ["<ticker1>", "<ticker2>"]
    }
  ],
  "summary": "<3-4 sentence executive summary>",
  "timestamp": "<ISO datetime>"
}

Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildPairCorrelationPrompt(params: {
  tickerA: string;
  tickerB: string;
  priceDataA?: string;
  priceDataB?: string;
  context?: string;
}): string {
  let prompt = `Analyze the correlation between ${params.tickerA} and ${params.tickerB}.`;

  if (params.priceDataA) {
    prompt += `\n\n${params.tickerA} Price Data:\n${params.priceDataA}`;
  }

  if (params.priceDataB) {
    prompt += `\n\n${params.tickerB} Price Data:\n${params.priceDataB}`;
  }

  if (params.context) {
    prompt += `\n\nAdditional Context:\n${params.context}`;
  }

  prompt += `

Provide your analysis as JSON with this schema:
{
  "tickerA": "${params.tickerA}",
  "tickerB": "${params.tickerB}",
  "correlation": <-1.0 to 1.0>,
  "correlationType": "direct" | "indirect" | "inverse" | "regime_dependent",
  "stressCorrelation": <-1.0 to 1.0>,
  "rollingCorrelation": {
    "30d": <-1.0 to 1.0>,
    "90d": <-1.0 to 1.0>,
    "1y": <-1.0 to 1.0>
  },
  "sharedFactors": ["<factor1>", "<factor2>"],
  "divergenceRisk": <0.0-1.0, probability that correlation breaks down>,
  "tradingImplications": "<how to use this correlation in trading>",
  "explanation": "<detailed explanation of the relationship>",
  "timestamp": "<ISO datetime>"
}

Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildPortfolioOptimizationPrompt(params: {
  positions: Array<{ ticker: string; weight: number; expectedReturn?: number }>;
  constraints?: {
    maxPositionWeight?: number;
    minPositionWeight?: number;
    maxSectorWeight?: number;
    targetVolatility?: number;
  };
  objective?: "max_sharpe" | "min_variance" | "risk_parity" | "max_diversification";
}): string {
  const positionsStr = params.positions
    .map(
      (p) =>
        `  - ${p.ticker}: ${(p.weight * 100).toFixed(1)}%${p.expectedReturn !== undefined ? ` (expected return: ${(p.expectedReturn * 100).toFixed(1)}%)` : ""}`
    )
    .join("\n");

  const objective = params.objective ?? "max_sharpe";
  const objectiveLabels: Record<string, string> = {
    max_sharpe: "Maximum Sharpe Ratio (best risk-adjusted return)",
    min_variance: "Minimum Variance (lowest portfolio volatility)",
    risk_parity: "Risk Parity (equal risk contribution from each position)",
    max_diversification: "Maximum Diversification (highest diversification ratio)",
  };

  let prompt = `Optimize this portfolio for: ${objectiveLabels[objective]}

Current Positions:
${positionsStr}`;

  if (params.constraints) {
    prompt += "\n\nConstraints:";
    if (params.constraints.maxPositionWeight !== undefined) {
      prompt += `\n  - Max single position: ${(params.constraints.maxPositionWeight * 100).toFixed(0)}%`;
    }
    if (params.constraints.minPositionWeight !== undefined) {
      prompt += `\n  - Min position size: ${(params.constraints.minPositionWeight * 100).toFixed(0)}%`;
    }
    if (params.constraints.maxSectorWeight !== undefined) {
      prompt += `\n  - Max sector weight: ${(params.constraints.maxSectorWeight * 100).toFixed(0)}%`;
    }
    if (params.constraints.targetVolatility !== undefined) {
      prompt += `\n  - Target annualized volatility: ${(params.constraints.targetVolatility * 100).toFixed(0)}%`;
    }
  }

  prompt += `

Provide optimized weights as JSON with this schema:
{
  "objective": "${objective}",
  "currentPortfolio": {
    "expectedReturn": <annualized>,
    "expectedVolatility": <annualized>,
    "sharpeRatio": <number>,
    "maxDrawdown": "<estimated max drawdown>"
  },
  "optimizedPortfolio": {
    "positions": [
      {
        "ticker": "<symbol>",
        "currentWeight": <0.0-1.0>,
        "optimizedWeight": <0.0-1.0>,
        "change": <delta>,
        "rationale": "<why this weight changed>"
      }
    ],
    "expectedReturn": <annualized>,
    "expectedVolatility": <annualized>,
    "sharpeRatio": <number>,
    "maxDrawdown": "<estimated max drawdown>",
    "diversificationRatio": <number>
  },
  "rebalancingActions": [
    {
      "action": "increase" | "decrease" | "add" | "remove",
      "ticker": "<symbol>",
      "fromWeight": <0.0-1.0>,
      "toWeight": <0.0-1.0>,
      "priority": "high" | "medium" | "low"
    }
  ],
  "summary": "<3-4 sentence summary of changes and expected impact>",
  "timestamp": "<ISO datetime>"
}

Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}
