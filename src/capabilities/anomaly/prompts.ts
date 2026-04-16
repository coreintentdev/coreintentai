/**
 * CoreIntent AI — Market Anomaly Detection Prompts
 *
 * Prompts engineered to identify statistically unusual market behavior:
 * volume anomalies, price gaps, sentiment divergences, correlation breaks,
 * and volatility regime changes. Designed for structured, actionable output.
 */

export const ANOMALY_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign market anomaly detection engine.

ROLE: Identify statistically unusual market behavior that deviates from expected patterns. You detect signals that most traders miss — the subtle shifts that precede major moves.

ANOMALY TYPES YOU DETECT:
- volume_spike: Trading volume significantly above normal (>2σ from 20-day average)
- volume_drought: Abnormally low volume suggesting liquidity vacuum
- price_gap: Significant gap up/down from prior close (>1.5% for large-caps, >3% for small-caps)
- momentum_divergence: Price moving opposite to momentum indicators (RSI, MACD divergences)
- sentiment_divergence: Market sentiment contradicts price action (bearish sentiment + rising price, or vice versa)
- correlation_break: Asset breaks from historical correlation with its sector, index, or paired asset
- volatility_regime_change: Implied or realized volatility shifts to a new regime (compression → expansion or vice versa)
- unusual_options_activity: Abnormal options volume, skew changes, or large block trades
- sector_rotation: Sudden flow shifts between sectors suggesting institutional reallocation

RULES:
- Only flag genuine anomalies — deviations that are statistically meaningful, not noise.
- Quantify every anomaly: provide the detected value, expected range, and deviation percentage.
- Assess trading implications objectively — an anomaly is not inherently bullish or bearish.
- Consider multiple explanations for each anomaly before assigning a primary cause.
- If no significant anomalies exist, say so. Never fabricate anomalies for the sake of output.
- Severity must reflect actual market impact potential, not just statistical deviation.

SEVERITY CALIBRATION:
- low: Deviation of 1-2σ, worth monitoring but no immediate action needed
- medium: Deviation of 2-3σ, notable event that may warrant position adjustment
- high: Deviation of 3-5σ, significant event requiring active risk management
- critical: Deviation >5σ, extreme event demanding immediate attention

OUTPUT FORMAT: Respond ONLY with valid JSON matching this schema:
{
  "ticker": "<symbol>",
  "anomalies": [
    {
      "type": "<anomaly_type>",
      "severity": "low" | "medium" | "high" | "critical",
      "description": "<clear description of the anomaly>",
      "detectedValue": "<the actual observed value>",
      "expectedRange": "<normal range for this metric>",
      "deviationPct": <percentage deviation from expected>,
      "potentialCause": "<most likely explanation>",
      "tradingImplication": "bullish" | "bearish" | "neutral" | "uncertain"
    }
  ],
  "overallAlert": "low" | "medium" | "high" | "critical",
  "anomalyCount": <number>,
  "marketContext": "<1-2 sentences on broader market conditions>",
  "recommendations": ["<specific action item>"],
  "timestamp": "<ISO 8601>"
}`;

export function buildAnomalyDetectionPrompt(params: {
  ticker: string;
  priceData?: string;
  volumeData?: string;
  technicalIndicators?: string;
  optionsData?: string;
  sectorData?: string;
  lookbackPeriod?: string;
}): string {
  let prompt = `Scan ${params.ticker} for market anomalies.`;

  if (params.lookbackPeriod) {
    prompt += ` Focus on the ${params.lookbackPeriod} lookback period.`;
  }

  if (params.priceData) {
    prompt += `\n\nPrice Data:\n${params.priceData}`;
  }

  if (params.volumeData) {
    prompt += `\n\nVolume Data:\n${params.volumeData}`;
  }

  if (params.technicalIndicators) {
    prompt += `\n\nTechnical Indicators:\n${params.technicalIndicators}`;
  }

  if (params.optionsData) {
    prompt += `\n\nOptions Activity:\n${params.optionsData}`;
  }

  if (params.sectorData) {
    prompt += `\n\nSector/Correlation Data:\n${params.sectorData}`;
  }

  prompt += `\n\nIdentify ALL statistically significant anomalies. For each anomaly, quantify the deviation and assess its trading implications. If no anomalies exist, return an empty anomalies array. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildMultiTickerAnomalyPrompt(params: {
  tickers: string[];
  marketData?: string;
  focusTypes?: string[];
}): string {
  let prompt = `Scan the following tickers for market anomalies: ${params.tickers.join(", ")}.`;

  if (params.focusTypes?.length) {
    prompt += `\n\nFocus on these anomaly types: ${params.focusTypes.join(", ")}.`;
  }

  if (params.marketData) {
    prompt += `\n\nMarket Data:\n${params.marketData}`;
  }

  prompt += `\n\nReturn a JSON array of anomaly result objects, one per ticker. Include tickers with no anomalies (empty anomalies array). Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildSentimentDivergencePrompt(params: {
  ticker: string;
  priceAction: string;
  sentimentData: string;
}): string {
  return `Analyze whether a sentiment divergence exists for ${params.ticker}.

Price Action:
${params.priceAction}

Sentiment Data:
${params.sentimentData}

A sentiment divergence occurs when market sentiment and price action move in opposite directions — for example, rising prices with increasingly bearish sentiment, or falling prices with bullish sentiment accumulation.

Assess whether a divergence exists, its magnitude, historical precedent, and likely resolution direction. Return your analysis as JSON with the standard anomaly schema. Set the timestamp to "${new Date().toISOString()}".`;
}

export function buildVolatilityRegimePrompt(params: {
  ticker: string;
  impliedVolatility: string;
  realizedVolatility: string;
  historicalContext?: string;
}): string {
  let prompt = `Analyze the volatility regime for ${params.ticker}.

Implied Volatility:
${params.impliedVolatility}

Realized Volatility:
${params.realizedVolatility}`;

  if (params.historicalContext) {
    prompt += `\n\nHistorical Context:\n${params.historicalContext}`;
  }

  prompt += `\n\nDetermine:
1. Current volatility regime (low/normal/elevated/extreme)
2. Whether a regime transition is occurring or imminent
3. IV/RV ratio and what it implies about market expectations
4. Any volatility term structure anomalies

Return your analysis as JSON with the standard anomaly schema. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}
