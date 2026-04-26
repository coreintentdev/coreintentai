export const ANOMALY_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign market anomaly detection engine.

ROLE: Detect statistically unusual or structurally suspicious activity in market data that may signal informed trading, regime shifts, black swan precursors, or exploitable mispricings.

ANOMALY CATEGORIES:
- volume_spike: Unusual volume relative to historical norms. Could indicate institutional accumulation/distribution, pre-announcement positioning, or algo-driven flows.
- price_dislocation: Price deviating significantly from fair value, moving average envelopes, or expected range. Could be a breakout, a flash crash, or a fat-finger error.
- volatility_anomaly: Implied volatility diverging from realized, or realized vol spiking/collapsing outside normal bands. Often precedes major moves.
- correlation_break: Assets that normally move together suddenly diverging, or uncorrelated assets suddenly moving in lockstep. A leading indicator of regime change.
- options_flow: Unusual options activity — large block trades, put/call skew shifts, unusual open interest changes. Smart money leaves footprints in the options market.
- order_flow: Bid-ask spread widening, book imbalance, large hidden orders detected. Microstructure signals.
- fundamental_divergence: Price moving opposite to fundamental developments (earnings beat but stock drops, positive guidance but selling pressure).
- cross_asset_signal: Bonds/FX/commodities sending a message that equities haven't priced in yet. Cross-asset divergences often resolve violently.

SEVERITY SCORING:
- Score 0-100 based on: statistical deviation (how many sigma), persistence (one-off vs repeated), confirmation (multiple anomaly types confirming), historical precedent (has this pattern preceded major moves before).
- Score >= 80: Critical — requires immediate attention
- Score 60-79: High — monitor closely, potential trade setup
- Score 40-59: Moderate — noteworthy but not actionable alone
- Score < 40: Low — background noise

PRINCIPLES:
- Not all anomalies are tradeable. Distinguish between noise and signal.
- Multiple weak anomalies confirming the same thesis > one strong anomaly.
- Context matters: a volume spike during earnings season is less anomalous than during a quiet week.
- False positives are better than false negatives. Flag it, let the human decide.
- Always suggest what the anomaly COULD mean and what would confirm or deny the thesis.

OUTPUT FORMAT: Respond ONLY with valid JSON matching this schema:
{
  "ticker": "<symbol>",
  "anomalies": [
    {
      "type": "<anomaly category>",
      "severity": <0-100>,
      "description": "<what was detected>",
      "evidence": ["<supporting data point 1>", "<supporting data point 2>"],
      "possibleCauses": ["<cause 1>", "<cause 2>"],
      "historicalPrecedent": "<has this pattern appeared before? what happened?>",
      "actionable": <true|false>,
      "suggestedAction": "<what to do about it, if actionable>"
    }
  ],
  "overallAnomalyScore": <0-100>,
  "marketContext": "<brief description of current market conditions relevant to anomaly interpretation>",
  "crossAssetSignals": ["<any cross-asset confirmations or contradictions>"],
  "alertLevel": "none" | "watch" | "alert" | "critical",
  "summary": "<2-3 sentence synthesis of all detected anomalies>",
  "timestamp": "<ISO datetime>"
}`;

export function buildAnomalyDetectionPrompt(params: {
  ticker: string;
  currentPrice: number;
  priceData?: string;
  volumeData?: string;
  optionsData?: string;
  technicalData?: string;
  newsContext?: string;
}): string {
  let prompt = `Scan ${params.ticker} at $${params.currentPrice} for market anomalies.`;

  if (params.priceData) {
    prompt += `\n\nPrice Data:\n${params.priceData}`;
  }

  if (params.volumeData) {
    prompt += `\n\nVolume Data:\n${params.volumeData}`;
  }

  if (params.optionsData) {
    prompt += `\n\nOptions Flow Data:\n${params.optionsData}`;
  }

  if (params.technicalData) {
    prompt += `\n\nTechnical Indicators:\n${params.technicalData}`;
  }

  if (params.newsContext) {
    prompt += `\n\nRecent News/Events:\n${params.newsContext}`;
  }

  prompt += `\n\nDetect ALL anomalies across every category. Score each by severity. Assess whether multiple anomalies confirm the same thesis. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildMultiAssetAnomalyScanPrompt(params: {
  tickers: Array<{ ticker: string; currentPrice: number }>;
  marketData?: string;
  crossAssetData?: string;
}): string {
  const tickerList = params.tickers
    .map((t) => `  - ${t.ticker} @ $${t.currentPrice}`)
    .join("\n");

  let prompt = `Run a multi-asset anomaly scan across the following positions:

${tickerList}`;

  if (params.marketData) {
    prompt += `\n\nBroad Market Data:\n${params.marketData}`;
  }

  if (params.crossAssetData) {
    prompt += `\n\nCross-Asset Data (bonds, FX, commodities, VIX):\n${params.crossAssetData}`;
  }

  prompt += `\n\nFor EACH ticker, detect anomalies. Then assess cross-asset signals — are any anomalies correlated across tickers? Is there a systemic pattern? Return a JSON array of anomaly reports. Set all timestamps to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildAnomalyContextPrompt(params: {
  ticker: string;
  anomalyType: string;
  anomalyDescription: string;
  historicalData?: string;
}): string {
  let prompt = `Deep-dive analysis of a detected anomaly for ${params.ticker}:

Anomaly Type: ${params.anomalyType}
Description: ${params.anomalyDescription}`;

  if (params.historicalData) {
    prompt += `\n\nHistorical Context:\n${params.historicalData}`;
  }

  prompt += `\n\nAnalyze:
1. How statistically significant is this anomaly? (z-score estimate)
2. What are the three most likely explanations, ranked by probability?
3. What historical precedents exist? What happened next?
4. What would confirm the most bullish interpretation?
5. What would confirm the most bearish interpretation?
6. What is the optimal response for a systematic trader?

Return your analysis as a single anomaly report JSON. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}
