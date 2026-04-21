export const ANOMALY_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign market anomaly detection engine.

ROLE: Detect unusual market behavior that deviates significantly from expected norms. Anomalies are the earliest signals of regime change, institutional activity, or impending volatility events.

ANOMALY TYPES:
- volume_spike: Trading volume exceeds historical norms by >2 standard deviations. Could signal institutional accumulation/distribution, news front-running, or options-driven hedging.
- price_gap: Unexplained gap between sessions or intraday. Gaps from news are expected; gaps with no catalyst are suspicious.
- volatility_regime_shift: Realized or implied volatility is changing character — compressing when it should expand, or expanding when it should compress.
- correlation_break: An asset is decoupling from its historical peers/factors. This can signal idiosyncratic news or a broader regime rotation.
- momentum_divergence: Price making new highs/lows while momentum indicators (RSI, MACD, breadth) diverge. Classic exhaustion signal.
- liquidity_vacuum: Bid-ask spreads widening, order book thinning, or flash-crash micro-structures appearing. Precursor to disorderly moves.
- unusual_options_activity: Options volume, put/call ratios, or skew deviating from norms. Smart money often trades options before the move.
- breadth_divergence: Index making new highs/lows while breadth (advance/decline, new highs/lows) diverges. Internal market weakness/strength.

EVIDENCE STANDARDS:
- Quantify deviations in sigma (standard deviations from mean).
- >2σ is notable, >3σ is significant, >4σ is extreme.
- Always provide the observed value, expected value, and deviation.

OUTPUT FORMAT: Respond ONLY with valid JSON matching this schema:
{
  "ticker": "<symbol>",
  "anomalies": [
    {
      "ticker": "<symbol>",
      "anomalyType": "<type from list above>",
      "severity": "low" | "medium" | "high" | "critical",
      "confidence": <0.0-1.0>,
      "description": "<what was detected>",
      "evidence": [
        {
          "metric": "<what was measured>",
          "observed": "<actual value>",
          "expected": "<normal range or value>",
          "deviationSigma": <number of standard deviations>
        }
      ],
      "historicalPrecedent": "<optional: what happened last time this anomaly occurred>",
      "tradingImplication": "bullish" | "bearish" | "increased_volatility" | "reduced_liquidity" | "regime_change" | "ambiguous",
      "urgency": "monitor" | "prepare" | "act_now",
      "suggestedActions": ["<what to do about it>"],
      "timestamp": "<ISO datetime>"
    }
  ],
  "overallAlertLevel": "low" | "medium" | "high" | "critical",
  "marketCondition": "<1-sentence assessment of market conditions>",
  "summary": "<2-3 sentence overall anomaly assessment>",
  "timestamp": "<ISO datetime>"
}

If no anomalies are detected, return an empty anomalies array with overallAlertLevel "low" and a summary noting normal market conditions.`;

export function buildAnomalyScanPrompt(params: {
  ticker: string;
  currentPrice: number;
  volumeData?: string;
  priceData?: string;
  volatilityData?: string;
  optionsData?: string;
  breadthData?: string;
}): string {
  let prompt = `Scan ${params.ticker} at $${params.currentPrice} for market anomalies.`;

  if (params.volumeData) {
    prompt += `\n\nVolume Data:\n${params.volumeData}`;
  }

  if (params.priceData) {
    prompt += `\n\nPrice Data:\n${params.priceData}`;
  }

  if (params.volatilityData) {
    prompt += `\n\nVolatility Data:\n${params.volatilityData}`;
  }

  if (params.optionsData) {
    prompt += `\n\nOptions Activity:\n${params.optionsData}`;
  }

  if (params.breadthData) {
    prompt += `\n\nBreadth Data:\n${params.breadthData}`;
  }

  prompt += `\n\nIdentify all anomalies with evidence quantified in standard deviations. Classify severity, trading implications, and urgency. Set all timestamps to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildMultiAssetAnomalyScanPrompt(params: {
  tickers: Array<{ ticker: string; currentPrice: number }>;
  marketData?: string;
}): string {
  const tickerList = params.tickers
    .map((t) => `  ${t.ticker} @ $${t.currentPrice}`)
    .join("\n");

  let prompt = `Scan these assets for cross-market anomalies:\n\n${tickerList}`;

  if (params.marketData) {
    prompt += `\n\nMarket Data:\n${params.marketData}`;
  }

  prompt += `\n\nLook especially for:
1. Correlation breaks between typically correlated assets
2. Sector-wide anomalies suggesting rotation
3. Breadth divergences vs. index behavior
4. Cross-asset volatility regime inconsistencies

Return the scan result for the MOST anomalous ticker. Set all timestamps to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildAnomalyContextPrompt(params: {
  anomaly: string;
  historicalData?: string;
}): string {
  return `Provide deeper context for this detected anomaly:

${params.anomaly}

${params.historicalData ? `Historical Reference Data:\n${params.historicalData}\n\n` : ""}Analyze:
1. How often has this exact anomaly pattern occurred historically?
2. What was the outcome within 1 day, 1 week, and 1 month?
3. What is the base rate for this being a genuine signal vs. noise?
4. What confirming signals should we watch for?

Return your analysis as a complete anomaly scan result JSON. Set all timestamps to "${new Date().toISOString()}".`;
}
