export const PORTFOLIO_INTELLIGENCE_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign portfolio intelligence engine that synthesizes multi-dimensional market analysis into a unified portfolio view.

ROLE: Produce a comprehensive portfolio intelligence report by synthesizing regime context, per-position analysis, risk assessment, correlation insights, and scenario analysis into one coherent picture.

ANALYSIS DIMENSIONS:
1. REGIME CONTEXT: Current market regime, confidence, and what it means for portfolio positioning.
2. PER-POSITION INTELLIGENCE: For each holding — sentiment bias, momentum score (0-100), anomaly flag, risk contribution, one key insight, and a clear action recommendation (add/hold/trim/exit/watch).
3. RISK DASHBOARD: Portfolio-level risk score (0-100), diversification score (0-1), concentration risk, tail risk exposure, max drawdown estimate.
4. CORRELATION INSIGHTS: Highly correlated pairs, diversification gaps, hidden risks.
5. ACTION PLAN: Prioritized list of recommended actions with urgency levels (immediate/this_week/this_month/monitor).
6. SCENARIO ANALYSIS: Bull/base/bear cases with probability, portfolio impact %, top movers, and hedging suggestions.
7. REVIEW TRIGGERS: Conditions that should trigger a portfolio re-review.

HEALTH SCORING (0-100):
- 80-100 excellent: Well-diversified, regime-aligned, risk-managed
- 60-79 good: Minor issues, fundamentally sound
- 40-59 fair: Meaningful gaps or regime misalignment
- 20-39 poor: Significant risks requiring action
- 0-19 critical: Portfolio under stress, immediate action needed

PRINCIPLES:
- Regime awareness is paramount. A portfolio optimized for trending markets can bleed in rotation.
- Correlation risk is the silent killer. Same-sector positions are NOT diversification.
- Action recommendations must be specific and prioritized. "Monitor the situation" alone is not actionable.
- Scenario analysis needs concrete triggers, not vague possibilities.
- Capital preservation takes priority over upside capture.
- Identify what you don't know (blind spots) as review triggers.
- Confidence calibration: 0.8+ requires strong multi-source confirmation, 0.5 is a coin flip.

OUTPUT FORMAT: Respond ONLY with valid JSON matching the PortfolioIntelligence schema. Do not wrap in markdown code blocks.`;

export function buildPortfolioAnalysisPrompt(params: {
  positions: Array<{
    ticker: string;
    weight: number;
    currentPrice?: number;
    entryPrice?: number;
    pnlPct?: number;
  }>;
  totalValue?: number;
  cashPct?: number;
  regimeContext?: string;
  sentimentData?: string;
  momentumData?: string;
  correlationData?: string;
  riskData?: string;
  anomalyData?: string;
  marketContext?: string;
}): string {
  const positionList = params.positions
    .map((p) => {
      let line = `  - ${p.ticker}: ${(p.weight * 100).toFixed(1)}% weight`;
      if (p.currentPrice) line += `, price $${p.currentPrice}`;
      if (p.entryPrice) line += `, entry $${p.entryPrice}`;
      if (p.pnlPct !== undefined)
        line += `, P&L ${p.pnlPct > 0 ? "+" : ""}${p.pnlPct.toFixed(1)}%`;
      return line;
    })
    .join("\n");

  let prompt = `Produce a comprehensive portfolio intelligence report for:\n\nPOSITIONS:\n${positionList}`;

  if (params.totalValue)
    prompt += `\n\nTotal Portfolio Value: $${params.totalValue.toLocaleString()}`;
  if (params.cashPct !== undefined)
    prompt += `\nCash Position: ${params.cashPct.toFixed(1)}%`;
  if (params.regimeContext)
    prompt += `\n\nMARKET REGIME ANALYSIS:\n${params.regimeContext}`;
  if (params.sentimentData)
    prompt += `\n\nSENTIMENT DATA:\n${params.sentimentData}`;
  if (params.momentumData)
    prompt += `\n\nMOMENTUM DATA:\n${params.momentumData}`;
  if (params.correlationData)
    prompt += `\n\nCORRELATION DATA:\n${params.correlationData}`;
  if (params.riskData) prompt += `\n\nRISK DATA:\n${params.riskData}`;
  if (params.anomalyData)
    prompt += `\n\nANOMALY SIGNALS:\n${params.anomalyData}`;
  if (params.marketContext)
    prompt += `\n\nMARKET CONTEXT:\n${params.marketContext}`;

  prompt += `\n\nSynthesize ALL available data into a unified portfolio intelligence report. For each position, provide a clear action recommendation. Prioritize the action plan by urgency and impact. Include bull/base/bear scenarios with probability-weighted impact. Set timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildQuickScanPrompt(params: {
  tickers: string[];
  marketContext?: string;
}): string {
  let prompt = `Quick portfolio scan for: ${params.tickers.join(", ")}`;

  if (params.marketContext)
    prompt += `\n\nMarket Context: ${params.marketContext}`;

  prompt += `\n\nFor each ticker provide: sentiment bias, momentum score, anomaly flag, risk contribution estimate, key insight, and action recommendation. Then produce overall portfolio health assessment with scenarios. Set timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildStressTestPrompt(params: {
  positions: Array<{ ticker: string; weight: number }>;
  scenario: string;
  historicalContext?: string;
}): string {
  const positionList = params.positions
    .map((p) => `  - ${p.ticker}: ${(p.weight * 100).toFixed(1)}%`)
    .join("\n");

  let prompt = `Stress test this portfolio under the following scenario:\n\nSCENARIO: ${params.scenario}\n\nPOSITIONS:\n${positionList}`;

  if (params.historicalContext)
    prompt += `\n\nHistorical Precedent:\n${params.historicalContext}`;

  prompt += `\n\nFor each scenario case (bull/base/bear), estimate portfolio impact %, top movers, correlation behavior under stress, hedging suggestions, and liquidity risk. Produce a full portfolio intelligence report with emphasis on the scenario outcomes. Set timestamp to "${new Date().toISOString()}".`;

  return prompt;
}
