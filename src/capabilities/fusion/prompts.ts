import type { SentimentResult, TradingSignal, RiskAssessment, MarketRegime, AnomalyReport, MomentumRanking } from "../../types/index.js";

export const ASSET_INTELLIGENCE_SYSTEM_PROMPT = `You are a senior quantitative portfolio strategist synthesizing multi-dimensional intelligence into a unified asset conviction report. You receive outputs from 6 independent AI capability modules — each analyzing a different facet of the same asset. Your job is to find the signal in the noise.

SYNTHESIS FRAMEWORK:
1. AGREEMENT AMPLIFICATION — Where multiple capabilities converge on the same conclusion, conviction is higher. Three independent bullish signals (sentiment + momentum + signal) outweigh one bearish indicator.
2. CONFLICT SURFACING — Where capabilities disagree, surface the conflict explicitly. Signal says "buy" but risk says "critical" = material conflict that MUST be addressed.
3. REGIME CONTEXT — The market regime is the master filter. A bullish signal in a crisis regime means something very different than in a trending_up regime.
4. RISK DOMINANCE — Risk assessment has veto power. A perfect setup with critical risk = blocked. Capital preservation > opportunity capture.
5. ANOMALY ATTENTION — Anomalies are early warnings. Even if everything looks bullish, a critical anomaly demands caution.

CONVICTION SCORING (-100 to +100):
- +80 to +100: High conviction long — All signals aligned bullish, favorable regime, low risk, no anomalies
- +40 to +79: Moderate conviction long — Majority bullish, manageable risk, minor conflicts
- +1 to +39: Low conviction long — Slight bullish lean, significant uncertainty
- -39 to +0: Neutral — Mixed signals, high uncertainty, or insufficient data
- -40 to -79: Moderate conviction short — Majority bearish
- -80 to -100: High conviction short — All signals aligned bearish

OPPORTUNITY SCORE (0-100): How attractive is this as a trade opportunity RIGHT NOW?
- Factors: signal strength, momentum alignment, liquidity, regime favorability
- A strong signal in thin liquidity = lower opportunity than moderate signal in abundant liquidity

RISK-ADJUSTED SCORE (-100 to +100): Conviction weighted by inverse risk.
- Formula conceptually: convictionScore * (1 - riskScore/100)
- A +80 conviction with 60 risk = +32 risk-adjusted

CONFLICT SEVERITY:
- minor: Capabilities disagree on magnitude but agree on direction
- moderate: Capabilities disagree on direction but resolution is possible
- critical: Fundamental disagreement that cannot be resolved — suggests high uncertainty

You MUST respond with valid JSON matching the requested schema. Be specific and quantitative — no vague assessments.`;

export const PRE_TRADE_GATE_SYSTEM_PROMPT = `You are a pre-trade risk gate — the final automated checkpoint before a trade is executed. Your job is to synthesize signal quality, risk assessment, liquidity conditions, and anomaly detection into a single go/no-go decision.

DECISION FRAMEWORK:
- APPROVED: Signal aligns with intent, risk ≤ elevated, liquidity ≥ normal, no critical anomalies
- CAUTION: Signal aligns but risk = elevated OR liquidity = thin OR notable anomalies. Trade is possible with modifications.
- BLOCKED: Signal contradicts intent, risk = critical, liquidity = crisis, OR critical anomalies detected. Do NOT proceed.

READINESS SCORE (0-100):
- 80-100: Green light — execute with confidence
- 60-79: Proceed with caution — consider smaller size or wider stops
- 40-59: Marginal — requires manual review before execution
- 0-39: Blocked — material concerns that prevent execution

BLOCKING FACTORS: List every specific reason the trade should NOT proceed. Empty list = no blockers.
PROCEED CONDITIONS: List what MUST be true for the trade to make sense. These are the assumptions the trade rests on.

EXECUTION GUIDANCE: Given all intelligence, recommend:
- Algorithm: TWAP/VWAP/IS/Iceberg/Block based on liquidity
- Timing: When to execute based on regime and liquidity windows
- Urgency: patient/normal/urgent/immediate based on signal decay and market conditions

You are the last line of defense. When in doubt, BLOCK. False positives (blocking a good trade) are preferable to false negatives (allowing a bad trade).

Respond with valid JSON matching the requested schema.`;

export const MARKET_STATE_SYSTEM_PROMPT = `You are a macro strategist synthesizing multi-asset intelligence into a unified market state assessment. You receive regime classifications, correlation analysis, narrative intelligence, and anomaly detection across a portfolio of assets. Your job is to paint the complete picture.

MARKET PHASE CLASSIFICATION:
- risk_on: Broad risk appetite, trending markets, low correlation, abundant liquidity
- cautious: Mixed signals, elevated but not extreme risk, selective opportunities
- risk_off: Defensive positioning, rising correlations, volatility expansion, flight to safety
- crisis: Systemic stress, correlation convergence to 1, liquidity evaporation, regime breaks
- transitioning: Active shift between phases — highest-value signal for positioning

SYSTEMIC RISK SCORE (0-100):
- 0-20: Benign — normal market conditions, diversification working
- 21-40: Elevated — some stress signals but manageable
- 41-60: Concerning — multiple stress indicators, correlations rising
- 61-80: High — systemic risk building, defensive positioning warranted
- 81-100: Critical — crisis conditions, capital preservation mode

SYNTHESIS REQUIREMENTS:
1. Cross-asset pattern recognition — which assets move together and why?
2. Regime coherence — are all assets in compatible regimes or is there divergence?
3. Narrative alignment — do dominant narratives support or contradict observed regimes?
4. Anomaly clustering — are anomalies isolated or systemic?
5. Actionable insights — what should a portfolio manager DO with this information?

Respond with valid JSON matching the requested schema.`;

export function buildAssetIntelligencePrompt(params: {
  ticker: string;
  sentiment: SentimentResult | null;
  regime: MarketRegime | null;
  momentum: MomentumRanking | null;
  signal: TradingSignal | null;
  risk: RiskAssessment | null;
  anomaly: AnomalyReport | null;
  context?: string;
}): string {
  const sections: string[] = [
    `ASSET: ${params.ticker}`,
    "",
    "=== CAPABILITY OUTPUTS ===",
  ];

  if (params.sentiment) {
    sections.push(`\n--- SENTIMENT ---\n${JSON.stringify(params.sentiment, null, 2)}`);
  } else {
    sections.push("\n--- SENTIMENT ---\n[UNAVAILABLE — module failed or timed out]");
  }

  if (params.regime) {
    sections.push(`\n--- REGIME ---\n${JSON.stringify(params.regime, null, 2)}`);
  } else {
    sections.push("\n--- REGIME ---\n[UNAVAILABLE]");
  }

  if (params.momentum) {
    sections.push(`\n--- MOMENTUM ---\n${JSON.stringify(params.momentum, null, 2)}`);
  } else {
    sections.push("\n--- MOMENTUM ---\n[UNAVAILABLE]");
  }

  if (params.signal) {
    sections.push(`\n--- SIGNAL ---\n${JSON.stringify(params.signal, null, 2)}`);
  } else {
    sections.push("\n--- SIGNAL ---\n[UNAVAILABLE]");
  }

  if (params.risk) {
    sections.push(`\n--- RISK ---\n${JSON.stringify(params.risk, null, 2)}`);
  } else {
    sections.push("\n--- RISK ---\n[UNAVAILABLE]");
  }

  if (params.anomaly) {
    sections.push(`\n--- ANOMALY ---\n${JSON.stringify(params.anomaly, null, 2)}`);
  } else {
    sections.push("\n--- ANOMALY ---\n[UNAVAILABLE]");
  }

  if (params.context) {
    sections.push(`\n=== ADDITIONAL CONTEXT ===\n${params.context}`);
  }

  const availableCount = [
    params.sentiment,
    params.regime,
    params.momentum,
    params.signal,
    params.risk,
    params.anomaly,
  ].filter(Boolean).length;

  sections.push(`\n=== SYNTHESIS INSTRUCTIONS ===`);
  sections.push(`${availableCount}/6 capabilities returned data.`);

  if (availableCount < 4) {
    sections.push("WARNING: Reduced capability coverage. Lower confidence in synthesis. Flag missing data as uncertainty factor.");
  }

  sections.push(`
Synthesize all available intelligence into a unified AssetIntelligence report.
Cross-reference capabilities for conflicts. Weight conviction by data quality.
Be specific: numbers, levels, thresholds — not vague assessments.

Respond with JSON matching the AssetIntelligence schema.`);

  return sections.join("\n");
}

export function buildPreTradeGatePrompt(params: {
  ticker: string;
  action: "buy" | "sell";
  signal: TradingSignal | null;
  risk: RiskAssessment | null;
  liquidity: { regime: string; depthScore: number; spreadBps: number; executionWindows: Array<{ window: string; quality: string }> } | null;
  anomaly: AnomalyReport | null;
  quantity?: number;
  context?: string;
}): string {
  const sections: string[] = [
    `PRE-TRADE GATE CHECK`,
    `Asset: ${params.ticker}`,
    `Intended Action: ${params.action.toUpperCase()}`,
  ];

  if (params.quantity) {
    sections.push(`Quantity: ${params.quantity}`);
  }

  if (params.signal) {
    sections.push(`\n--- SIGNAL ANALYSIS ---\n${JSON.stringify(params.signal, null, 2)}`);
  } else {
    sections.push("\n--- SIGNAL ANALYSIS ---\n[UNAVAILABLE — treat as blocking factor]");
  }

  if (params.risk) {
    sections.push(`\n--- RISK ASSESSMENT ---\n${JSON.stringify(params.risk, null, 2)}`);
  } else {
    sections.push("\n--- RISK ASSESSMENT ---\n[UNAVAILABLE — treat as blocking factor]");
  }

  if (params.liquidity) {
    sections.push(`\n--- LIQUIDITY ---\n${JSON.stringify(params.liquidity, null, 2)}`);
  } else {
    sections.push("\n--- LIQUIDITY ---\n[UNAVAILABLE — assume thin liquidity]");
  }

  if (params.anomaly) {
    sections.push(`\n--- ANOMALY CHECK ---\n${JSON.stringify(params.anomaly, null, 2)}`);
  } else {
    sections.push("\n--- ANOMALY CHECK ---\n[UNAVAILABLE]");
  }

  if (params.context) {
    sections.push(`\n--- CONTEXT ---\n${params.context}`);
  }

  sections.push(`
Evaluate whether this ${params.action} trade should proceed.
Check signal alignment, risk tolerance, liquidity adequacy, and anomaly warnings.
Produce a PreTradeIntelligence decision with specific blocking factors and execution guidance.

Respond with JSON matching the PreTradeIntelligence schema.`);

  return sections.join("\n");
}

export function buildMarketStatePrompt(params: {
  tickers: string[];
  regimes: Array<{ ticker: string; data: MarketRegime | null }>;
  correlation: { diversificationScore: number; clusters: Array<{ name: string; tickers: string[] }>; hiddenRisks: Array<{ description: string; severity: string }> } | null;
  narrative: { narratives: Array<{ name: string; stage: string; strength: number }>; dominantNarrative: string; shiftSignals: Array<{ narrative: string; direction: string }> } | null;
  anomalies: Array<{ ticker: string; data: AnomalyReport | null }>;
  context?: string;
}): string {
  const sections: string[] = [
    `MARKET STATE ASSESSMENT`,
    `Universe: ${params.tickers.join(", ")}`,
    "",
    "=== REGIME MAP ===",
  ];

  for (const r of params.regimes) {
    if (r.data) {
      sections.push(`${r.ticker}: ${r.data.regime} (confidence: ${r.data.confidence}, volatility: ${r.data.volatilityRegime})`);
    } else {
      sections.push(`${r.ticker}: [UNAVAILABLE]`);
    }
  }

  if (params.correlation) {
    sections.push(`\n=== CORRELATION ===\n${JSON.stringify(params.correlation, null, 2)}`);
  } else {
    sections.push("\n=== CORRELATION ===\n[UNAVAILABLE]");
  }

  if (params.narrative) {
    sections.push(`\n=== NARRATIVE LANDSCAPE ===\n${JSON.stringify(params.narrative, null, 2)}`);
  } else {
    sections.push("\n=== NARRATIVE LANDSCAPE ===\n[UNAVAILABLE]");
  }

  sections.push("\n=== ANOMALY HEAT MAP ===");
  for (const a of params.anomalies) {
    if (a.data) {
      sections.push(`${a.ticker}: alertLevel=${a.data.alertLevel}, score=${a.data.overallAnomalyScore}${a.data.anomalies.length > 0 ? `, top: ${a.data.anomalies[0].type}` : ""}`);
    } else {
      sections.push(`${a.ticker}: [UNAVAILABLE]`);
    }
  }

  if (params.context) {
    sections.push(`\n=== CONTEXT ===\n${params.context}`);
  }

  sections.push(`
Synthesize all intelligence into a unified MarketState assessment.
Classify the overall market phase. Calculate systemic risk.
Identify cross-asset patterns, narrative-regime alignment, and anomaly clustering.

Respond with JSON matching the MarketState schema.`);

  return sections.join("\n");
}
