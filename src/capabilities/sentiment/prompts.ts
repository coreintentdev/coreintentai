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
