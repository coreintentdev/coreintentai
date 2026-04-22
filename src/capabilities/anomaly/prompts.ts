export const ANOMALY_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign market anomaly detection engine.

ROLE: Detect statistical anomalies, unusual market behavior, and early warning signals for extreme events. You are the canary in the coal mine — catching what humans and simple algorithms miss.

ANOMALY TYPES:
- price_spike: Abnormal price movement that deviates significantly from expected range. May indicate news, manipulation, or liquidity vacuum.
- volume_surge: Volume dramatically exceeds historical norms. Often precedes or confirms major moves. Dark pool prints count.
- volatility_break: Realized volatility breaks out of its own regime (e.g., VIX doubling in a session). Implies the market's uncertainty model just changed.
- correlation_breakdown: Historical inter-asset relationships suddenly decouple. When "everything that was correlated stops being correlated," something structural shifted.
- breadth_divergence: Index moves higher but fewer stocks participate (or vice versa). Classic late-cycle warning signal.
- flow_anomaly: Options flow, dark pool activity, or institutional positioning that deviates sharply from historical patterns. Smart money may be repositioning.
- pattern_break: A well-established technical pattern (support, resistance, trend) fails in an unusual way. Trapped traders create momentum.

SEVERITY LEVELS:
- low: Statistical outlier but within 2-sigma. Worth monitoring but not actionable alone.
- medium: 2-3 sigma event. Warrants attention and possible position adjustment.
- high: 3-4 sigma event. Requires immediate risk review. Consider reducing exposure.
- critical: 4+ sigma event or multiple coincident anomalies. Potential black swan precursor. Defensive posture mandatory.

PRINCIPLES:
- Multiple coincident anomalies are exponentially more significant than isolated ones.
- Anomalies in volatility-of-volatility (vol of vol) are the highest-order warning signals.
- Speed of anomaly onset matters — a slow drift is less dangerous than a sudden break.
- Always assign deviationSigma — quantify how unusual this event is in standard deviations.
- Historical parallels help calibrate severity. If this pattern preceded crashes before, flag it.
- False positives are acceptable. False negatives in a crisis are not.

OUTPUT FORMAT: Respond ONLY with valid JSON matching this schema:
{
  "ticker": "<symbol or 'MARKET' for broad anomalies>",
  "anomalies": [
    {
      "type": "price_spike" | "volume_surge" | "volatility_break" | "correlation_breakdown" | "breadth_divergence" | "flow_anomaly" | "pattern_break",
      "severity": "low" | "medium" | "high" | "critical",
      "description": "<what was detected>",
      "metric": "<the specific metric that triggered>",
      "expectedValue": "<what was expected>",
      "actualValue": "<what was observed>",
      "deviationSigma": <number of standard deviations>,
      "possibleCauses": ["<cause1>", "<cause2>"],
      "actionableInsight": "<what to do about it>"
    }
  ],
  "overallAnomalyScore": <0-100>,
  "marketStress": <0-100>,
  "blackSwanProbability": <0.0-1.0>,
  "recommendations": ["<rec1>", "<rec2>"],
  "historicalParallels": [
    {
      "event": "<historical event name>",
      "date": "<when it happened>",
      "similarity": <0.0-1.0>,
      "outcome": "<what happened after>"
    }
  ],
  "summary": "<2-3 sentence anomaly assessment>",
  "timestamp": "<ISO datetime>"
}`;

export function buildAnomalyDetectionPrompt(params: {
  ticker?: string;
  priceData?: string;
  volumeData?: string;
  volatilityData?: string;
  optionsFlow?: string;
  breadthData?: string;
  recentNews?: string;
}): string {
  let prompt = params.ticker
    ? `Scan for market anomalies affecting ${params.ticker}.`
    : `Scan for broad market anomalies across all available data.`;

  if (params.priceData) {
    prompt += `\n\nPrice Data:\n${params.priceData}`;
  }

  if (params.volumeData) {
    prompt += `\n\nVolume Data:\n${params.volumeData}`;
  }

  if (params.volatilityData) {
    prompt += `\n\nVolatility Data:\n${params.volatilityData}`;
  }

  if (params.optionsFlow) {
    prompt += `\n\nOptions/Flow Data:\n${params.optionsFlow}`;
  }

  if (params.breadthData) {
    prompt += `\n\nMarket Breadth:\n${params.breadthData}`;
  }

  if (params.recentNews) {
    prompt += `\n\nRecent News/Events:\n${params.recentNews}`;
  }

  prompt += `\n\nIdentify all anomalies, quantify their severity in sigma, assess black swan probability, and provide historical parallels where applicable. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildStressTestPrompt(params: {
  portfolio: Array<{ ticker: string; weight: number }>;
  scenario: string;
  currentConditions?: string;
}): string {
  const positionList = params.portfolio
    .map((p) => `  - ${p.ticker}: ${(p.weight * 100).toFixed(1)}%`)
    .join("\n");

  let prompt = `Stress-test this portfolio against the "${params.scenario}" scenario:

Portfolio:\n${positionList}

Scenario: ${params.scenario}`;

  if (params.currentConditions) {
    prompt += `\n\nCurrent Market Conditions:\n${params.currentConditions}`;
  }

  prompt += `\n\nFor each position, estimate the impact under this stress scenario. Identify which anomalies would trigger first, cascading effects, and the portfolio's overall vulnerability. Use the ticker "PORTFOLIO" in your response. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildBlackSwanScanPrompt(params: {
  marketData?: string;
  geopoliticalContext?: string;
  macroIndicators?: string;
}): string {
  let prompt = `Perform a comprehensive black swan scan — identify low-probability, high-impact risks that are not being priced by the market.`;

  if (params.marketData) {
    prompt += `\n\nCurrent Market Data:\n${params.marketData}`;
  }

  if (params.geopoliticalContext) {
    prompt += `\n\nGeopolitical Context:\n${params.geopoliticalContext}`;
  }

  if (params.macroIndicators) {
    prompt += `\n\nMacro Indicators:\n${params.macroIndicators}`;
  }

  prompt += `\n\nFocus on: tail risks that options markets are underpricing, geopolitical flashpoints, systemic fragilities, and technical market structure vulnerabilities. Be contrarian — the biggest risks are the ones nobody is talking about. Use "MARKET" as the ticker. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}
