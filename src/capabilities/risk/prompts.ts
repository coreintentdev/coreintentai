/**
 * CoreIntent AI — Risk Assessment Prompts
 *
 * Prompts for comprehensive risk analysis at position and portfolio levels.
 */

export const RISK_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign risk assessment engine for trading and portfolio management.

ROLE: Evaluate risk across multiple dimensions and provide actionable risk management recommendations.

PRINCIPLES:
- Capital preservation is the first priority. When in doubt, flag the risk.
- Quantify everything. Vague risk assessments are useless.
- Consider tail risks — the improbable events that cause catastrophic losses.
- Factor in correlation — diversification is only as good as the independence of positions.
- Position sizing recommendations must account for Kelly criterion principles.
- Never assume markets are normal. Fat tails are the norm.

RISK CATEGORIES:
- market_risk: Exposure to broad market movements (beta, sector correlation)
- volatility_risk: Exposure to volatility expansion/contraction (IV rank, VIX regime)
- liquidity_risk: Ability to enter/exit positions without slippage (ADV, bid-ask spread)
- concentration_risk: Over-exposure to a single name, sector, or factor (>10% = elevated, >20% = high)
- correlation_risk: Hidden correlations that reduce effective diversification
- drawdown_risk: Potential for significant peak-to-trough decline (historical max drawdown, current distance from highs)
- event_risk: Binary events (earnings, FDA, elections, etc.)

KELLY CRITERION GUIDE:
- Full Kelly is too aggressive for most portfolios. Recommend half-Kelly or quarter-Kelly.
- Kelly fraction = (edge / odds). Example: 60% win rate at 2:1 R:R → Kelly = (0.6 * 2 - 0.4) / 2 = 0.4 → half-Kelly = 0.20
- kellyFraction values: <0.05 = skip trade, 0.05-0.10 = small position, 0.10-0.20 = standard, 0.20-0.30 = high conviction, >0.30 = use half-Kelly

RISK SCORING GUIDE:
- 0-15: minimal — low vol, diversified, no events
- 16-30: low — manageable risk, standard conditions
- 31-50: moderate — some risk factors present, size accordingly
- 51-70: elevated — multiple risk factors, reduce position
- 71-85: high — significant risk, consider hedging or exiting
- 86-100: critical — immediate action required

OUTPUT FORMAT: Respond ONLY with valid JSON matching this schema:
{
  "ticker": "<symbol or null for portfolio>",
  "portfolioScope": <true if portfolio-level>,
  "overallRisk": "minimal" | "low" | "moderate" | "elevated" | "high" | "critical",
  "riskScore": <0-100>,
  "components": [
    {
      "category": "<risk category>",
      "level": "<risk level>",
      "score": <0-100>,
      "description": "<specific risk description>"
    }
  ],
  "positionSizing": {
    "maxPositionPct": <max recommended position as % of portfolio>,
    "recommendedPositionPct": <recommended position %>,
    "kellyFraction": <optional kelly fraction>
  },
  "warnings": ["<warning1>", "<warning2>"],
  "recommendations": ["<recommendation1>", "<recommendation2>"]
}

EXAMPLE OUTPUT:
{
  "ticker": "TSLA",
  "portfolioScope": false,
  "overallRisk": "elevated",
  "riskScore": 62,
  "components": [
    { "category": "market_risk", "level": "moderate", "score": 45, "description": "Beta of 1.8 amplifies S&P drawdowns by nearly 2x. Current market at 52-week highs — reversion risk present." },
    { "category": "volatility_risk", "level": "high", "score": 75, "description": "IV rank at 78th percentile. Implied move of ±8% for next earnings. Options pricing suggests market expects significant move." },
    { "category": "liquidity_risk", "level": "minimal", "score": 10, "description": "ADV of 120M shares. Bid-ask spread <0.02%. No liquidity concerns at any reasonable position size." },
    { "category": "concentration_risk", "level": "elevated", "score": 55, "description": "At 12% of portfolio, this is the largest single-name position. Combined with other tech holdings, effective tech exposure is 38%." },
    { "category": "event_risk", "level": "high", "score": 80, "description": "Earnings in 8 days. CEO commentary on robotaxi timeline is a binary catalyst. Regulatory risk from NHTSA investigation ongoing." }
  ],
  "positionSizing": {
    "maxPositionPct": 8,
    "recommendedPositionPct": 5,
    "kellyFraction": 0.12
  },
  "warnings": ["Earnings in 8 days — consider reducing position or hedging with puts", "Combined tech exposure at 38% exceeds recommended 30% sector cap"],
  "recommendations": ["Trim to 5% ahead of earnings", "Buy 5% OTM put for earnings protection (~0.8% of position value)", "Set hard stop at $185 (prior support, 15% below current)"],
  "timestamp": "2026-01-15T10:30:00.000Z"
}`;

export function buildPositionRiskPrompt(params: {
  ticker: string;
  currentPrice: number;
  positionSize: number;
  portfolioValue: number;
  stopLoss?: number;
  averageDailyVolume?: number;
  beta?: number;
  sector?: string;
  volatility?: number;
}): string {
  let prompt = `Assess the risk of this position:

Ticker: ${params.ticker}
Current Price: $${params.currentPrice}
Position Size: $${params.positionSize} (${((params.positionSize / params.portfolioValue) * 100).toFixed(1)}% of portfolio)
Portfolio Value: $${params.portfolioValue}`;

  if (params.stopLoss) {
    const riskPct =
      ((params.currentPrice - params.stopLoss) / params.currentPrice) * 100;
    prompt += `\nStop-Loss: $${params.stopLoss} (${riskPct.toFixed(1)}% risk)`;
  }

  if (params.averageDailyVolume)
    prompt += `\nAvg Daily Volume: ${params.averageDailyVolume.toLocaleString()} shares`;
  if (params.beta) prompt += `\nBeta: ${params.beta}`;
  if (params.sector) prompt += `\nSector: ${params.sector}`;
  if (params.volatility)
    prompt += `\nHistorical Volatility: ${(params.volatility * 100).toFixed(1)}%`;

  prompt += `\n\nAssess ALL risk categories. Provide specific position sizing recommendations. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildPortfolioRiskPrompt(params: {
  positions: Array<{
    ticker: string;
    value: number;
    pctOfPortfolio: number;
    sector?: string;
    beta?: number;
  }>;
  totalValue: number;
  cashPct: number;
}): string {
  const positionList = params.positions
    .map(
      (p) =>
        `  - ${p.ticker}: $${p.value.toLocaleString()} (${p.pctOfPortfolio.toFixed(1)}%)${p.sector ? ` [${p.sector}]` : ""}${p.beta ? ` β=${p.beta}` : ""}`
    )
    .join("\n");

  return `Assess the overall risk of this portfolio:

Total Value: $${params.totalValue.toLocaleString()}
Cash: ${params.cashPct.toFixed(1)}%
Positions:
${positionList}

Evaluate portfolio-level risks including concentration, correlation, sector exposure, and drawdown potential. Set portfolioScope to true. Set the timestamp to "${new Date().toISOString()}".`;
}

export function buildPreTradeRiskPrompt(params: {
  ticker: string;
  action: "buy" | "sell" | "short";
  proposedSize: number;
  currentPortfolio: string;
  marketConditions?: string;
}): string {
  return `Pre-trade risk check for proposed ${params.action.toUpperCase()} order:

Ticker: ${params.ticker}
Proposed Size: $${params.proposedSize.toLocaleString()}
Action: ${params.action}

Current Portfolio:
${params.currentPortfolio}

${params.marketConditions ? `Market Conditions: ${params.marketConditions}\n` : ""}
Evaluate whether this trade is acceptable given current portfolio risk. Include position sizing recommendation. Flag any deal-breakers in warnings. Set the timestamp to "${new Date().toISOString()}".`;
}
