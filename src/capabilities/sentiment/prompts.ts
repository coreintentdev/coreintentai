/**
 * CoreIntent AI — Sentiment Analysis Prompts
 *
 * Battle-tested prompts for extracting market sentiment from various data sources.
 * Each prompt is engineered to produce structured, parseable output.
 */

export const SENTIMENT_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign market sentiment analysis engine.

ROLE: Extract precise, actionable sentiment from market data, news, social signals, and financial reports.

RULES:
- Be objective. Do not amplify or dampen sentiment — report what the data says.
- Always cite specific data points or events driving your assessment.
- Distinguish between noise (social media hype) and signal (material developments).
- Consider the time horizon — intraday sentiment can differ from long-term outlook.
- If data is insufficient, say so. Never fabricate confidence.
- Weight drivers by materiality: earnings/guidance > institutional flows > analyst ratings > social media chatter.
- Watch for sentiment crowding: extreme bullish consensus often signals mean-reversion risk.
- A confidence of 0.5 means coin-flip — if you're that unsure, set sentiment to "neutral".

DRIVER WEIGHTING GUIDE:
- Earnings beat/miss: weight 0.25-0.40 (most material near-term catalyst)
- Guidance change: weight 0.20-0.35 (forward-looking, high impact)
- Institutional flow: weight 0.15-0.25 (smart money signal)
- Analyst upgrade/downgrade: weight 0.10-0.20 (lagging indicator, still relevant)
- Macro backdrop: weight 0.10-0.20 (sector-wide sentiment floor)
- Social/retail sentiment: weight 0.05-0.10 (noisy but can drive short-term volatility)

OUTPUT FORMAT: Respond ONLY with valid JSON matching this schema:
{
  "ticker": "<symbol>",
  "sentiment": "strongly_bullish" | "bullish" | "slightly_bullish" | "neutral" | "slightly_bearish" | "bearish" | "strongly_bearish",
  "confidence": <0.0-1.0>,
  "score": <-1.0 to 1.0>,
  "drivers": [
    {
      "factor": "<description of the sentiment driver>",
      "impact": "positive" | "negative" | "neutral",
      "weight": <0.0-1.0>
    }
  ],
  "summary": "<2-3 sentence summary>",
  "timeHorizon": "intraday" | "short_term" | "medium_term" | "long_term",
  "sources": ["<source1>", "<source2>"]
}

EXAMPLE OUTPUT:
{
  "ticker": "NVDA",
  "sentiment": "bullish",
  "confidence": 0.78,
  "score": 0.55,
  "drivers": [
    { "factor": "Q3 earnings beat: EPS $4.02 vs $3.65 expected (+10.1%)", "impact": "positive", "weight": 0.35 },
    { "factor": "Data center revenue guidance raised 15% above consensus", "impact": "positive", "weight": 0.30 },
    { "factor": "Insider selling: CFO sold $8M in shares post-earnings", "impact": "negative", "weight": 0.15 },
    { "factor": "Sector peer AMD down 5% on weak guidance — contagion risk", "impact": "negative", "weight": 0.10 },
    { "factor": "Retail call volume 3x normal — crowding risk", "impact": "neutral", "weight": 0.10 }
  ],
  "summary": "NVDA sentiment is bullish driven by a strong earnings beat and raised data center guidance. However, insider selling and elevated retail call volume suggest some caution — the positive case is well-known and crowded.",
  "timeHorizon": "short_term",
  "sources": ["Q3 2026 earnings report", "SEC Form 4 filings", "options flow data"],
  "timestamp": "2026-01-15T10:30:00.000Z"
}`;

export function buildSentimentPrompt(params: {
  ticker: string;
  context?: string;
  timeHorizon?: string;
  dataPoints?: string[];
}): string {
  let prompt = `Analyze the current market sentiment for ${params.ticker}.`;

  if (params.timeHorizon) {
    prompt += `\nFocus on the ${params.timeHorizon} time horizon.`;
  }

  if (params.context) {
    prompt += `\n\nAdditional context:\n${params.context}`;
  }

  if (params.dataPoints?.length) {
    prompt += `\n\nRelevant data points:\n${params.dataPoints.map((d, i) => `${i + 1}. ${d}`).join("\n")}`;
  }

  prompt += `\n\nProvide your analysis as JSON. Include at least 3 sentiment drivers with weights that sum to approximately 1.0. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export const MULTI_TICKER_SENTIMENT_PROMPT = `Analyze the market sentiment for each of the following tickers. Return a JSON array of sentiment objects, one per ticker. Each object must follow the standard sentiment schema.`;

export function buildNewsSentimentPrompt(params: {
  ticker: string;
  headlines: string[];
}): string {
  return `Analyze the sentiment impact of these recent headlines on ${params.ticker}:

${params.headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}

Assess each headline's individual impact and the aggregate sentiment. Return your analysis as JSON with the standard sentiment schema. Set the timestamp to "${new Date().toISOString()}".`;
}

export function buildEarningsSentimentPrompt(params: {
  ticker: string;
  epsActual?: number;
  epsEstimate?: number;
  revenueActual?: number;
  revenueEstimate?: number;
  guidance?: string;
}): string {
  let prompt = `Analyze the post-earnings sentiment for ${params.ticker} based on the following:`;

  if (params.epsActual !== undefined && params.epsEstimate !== undefined) {
    const beat = params.epsActual >= params.epsEstimate ? "beat" : "missed";
    prompt += `\n- EPS: $${params.epsActual} actual vs $${params.epsEstimate} estimate (${beat})`;
  }

  if (
    params.revenueActual !== undefined &&
    params.revenueEstimate !== undefined
  ) {
    const beat =
      params.revenueActual >= params.revenueEstimate ? "beat" : "missed";
    prompt += `\n- Revenue: $${params.revenueActual}B actual vs $${params.revenueEstimate}B estimate (${beat})`;
  }

  if (params.guidance) {
    prompt += `\n- Forward Guidance: ${params.guidance}`;
  }

  prompt += `\n\nReturn your analysis as JSON with the standard sentiment schema. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}
