/**
 * CoreIntent AI — Correlation & Concentration Analysis Prompts
 *
 * Prompts for detecting hidden portfolio correlations, concentration risks,
 * and tail-risk clusters that reduce effective diversification.
 */

export const CORRELATION_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign portfolio correlation and concentration analysis engine.

ROLE: Detect hidden correlations, concentration risks, and tail-risk clusters in portfolios. Quantify diversification quality and provide actionable rebalancing recommendations.

PRINCIPLES:
- Correlation is not static. Normal-regime correlations mask crisis-regime convergence.
- Effective diversification ≠ number of positions. 20 tech stocks is one bet.
- Factor exposure matters more than sector labels. A "diversified" portfolio can be a pure momentum bet.
- Tail risk is where portfolios die. Assets that are uncorrelated in calm markets become correlated in crashes.
- The Herfindahl-Hirschman index and effective number of positions reveal true concentration.
- Consider cross-asset correlations (equity-bond, equity-commodity, FX exposure).

CORRELATION REGIMES:
- normal: Typical market conditions, correlations behave as expected
- stress: Elevated volatility, correlations begin to shift
- crisis: Extreme stress, correlations converge toward 1.0 (except true hedges)

CONCENTRATION RISK TYPES:
- sector: Over-exposure to a single industry/sector
- factor: Hidden exposure to a common factor (momentum, value, growth, quality)
- geographic: Over-concentration in a single country/region
- thematic: Multiple positions riding the same macro theme (e.g., "AI", "EV")
- liquidity: Concentration in illiquid positions that can't be exited under stress

OUTPUT FORMAT: Respond ONLY with valid JSON matching this schema:
{
  "assets": ["<ticker1>", "<ticker2>", ...],
  "correlationPairs": [
    {
      "assetA": "<ticker>",
      "assetB": "<ticker>",
      "correlation": <-1.0 to 1.0>,
      "regime": "normal" | "stress" | "crisis"
    }
  ],
  "clusters": [
    {
      "name": "<cluster name>",
      "assets": ["<ticker1>", ...],
      "avgCorrelation": <-1.0 to 1.0>,
      "riskContribution": <0.0 to 1.0>,
      "description": "<why these are clustered>"
    }
  ],
  "concentrationRisks": [
    {
      "type": "sector" | "factor" | "geographic" | "thematic" | "liquidity",
      "exposure": <0.0 to 1.0>,
      "assets": ["<ticker1>", ...],
      "severity": "low" | "moderate" | "high" | "critical",
      "description": "<what the concentration risk is>"
    }
  ],
  "diversificationScore": <0-100>,
  "effectivePositions": <number>,
  "tailRiskAssessment": {
    "crisisCorrelation": <expected average correlation in crisis>,
    "expectedDrawdownPct": <estimated max drawdown %>,
    "vulnerabilities": ["<vulnerability1>", ...]
  },
  "recommendations": [
    {
      "action": "add" | "reduce" | "hedge" | "replace" | "maintain",
      "asset": "<ticker or asset class>",
      "rationale": "<why>",
      "priority": "low" | "medium" | "high" | "urgent"
    }
  ],
  "summary": "<2-3 sentence executive summary>",
  "timestamp": "<ISO 8601>"
}`;

export function buildCorrelationPrompt(params: {
  positions: Array<{
    ticker: string;
    weight: number;
    sector?: string;
    beta?: number;
    marketCap?: string;
  }>;
  totalValue?: number;
  benchmarks?: string[];
}): string {
  const positionList = params.positions
    .map(
      (p) =>
        `  - ${p.ticker}: ${(p.weight * 100).toFixed(1)}% weight${p.sector ? ` [${p.sector}]` : ""}${p.beta ? ` β=${p.beta}` : ""}${p.marketCap ? ` (${p.marketCap})` : ""}`
    )
    .join("\n");

  let prompt = `Analyze the correlation structure and concentration risks of this portfolio:

Positions:
${positionList}`;

  if (params.totalValue) {
    prompt += `\nTotal Value: $${params.totalValue.toLocaleString()}`;
  }

  if (params.benchmarks?.length) {
    prompt += `\nBenchmarks: ${params.benchmarks.join(", ")}`;
  }

  prompt += `

Analyze:
1. Pairwise correlations under normal, stress, and crisis regimes
2. Natural clusters of correlated assets
3. All types of concentration risk (sector, factor, geographic, thematic, liquidity)
4. Diversification score (100 = perfectly diversified, 0 = single bet)
5. Effective number of independent positions (Herfindahl-based)
6. Tail risk: what happens to this portfolio in a crisis?
7. Actionable recommendations to improve the portfolio

Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildStressCorrelationPrompt(params: {
  positions: Array<{
    ticker: string;
    weight: number;
  }>;
  scenario: string;
}): string {
  const positionList = params.positions
    .map((p) => `  - ${p.ticker}: ${(p.weight * 100).toFixed(1)}%`)
    .join("\n");

  return `Analyze how correlations in this portfolio would shift under the following stress scenario:

Scenario: ${params.scenario}

Positions:
${positionList}

Focus on:
1. Which correlations would increase (converge) under this scenario?
2. Which positions provide genuine hedging?
3. Expected portfolio drawdown under this scenario
4. Which clusters would emerge under stress?
5. Immediate actions to reduce vulnerability

Set the timestamp to "${new Date().toISOString()}".`;
}

export function buildConcentrationPrompt(params: {
  positions: Array<{
    ticker: string;
    weight: number;
    sector?: string;
    marketCap?: string;
    region?: string;
  }>;
}): string {
  const positionList = params.positions
    .map(
      (p) =>
        `  - ${p.ticker}: ${(p.weight * 100).toFixed(1)}%${p.sector ? ` [${p.sector}]` : ""}${p.region ? ` (${p.region})` : ""}${p.marketCap ? ` ${p.marketCap}` : ""}`
    )
    .join("\n");

  return `Identify ALL concentration risks in this portfolio:

Positions:
${positionList}

Check for concentration across ALL dimensions:
- Sector/industry concentration
- Factor exposure (momentum, value, growth, quality, low-vol)
- Geographic concentration
- Thematic concentration (e.g., AI, clean energy, crypto-adjacent)
- Liquidity concentration
- Market cap concentration
- Single-name concentration

For each risk found, rate severity and recommend mitigations.

Set the timestamp to "${new Date().toISOString()}".`;
}
