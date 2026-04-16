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
- market_risk: Exposure to broad market movements
- volatility_risk: Exposure to volatility expansion/contraction
- liquidity_risk: Ability to enter/exit positions without slippage
- concentration_risk: Over-exposure to a single name, sector, or factor
- correlation_risk: Hidden correlations that reduce effective diversification
- drawdown_risk: Potential for significant peak-to-trough decline
- event_risk: Binary events (earnings, FDA, elections, etc.)

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
