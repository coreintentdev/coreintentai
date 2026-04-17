export const REGIME_SYSTEM_PROMPT = `You are a quantitative market regime classifier. Your job is to determine the current market regime based on provided data and context.

You MUST respond with a single JSON object matching this schema:
{
  "regime": "trending_bull" | "trending_bear" | "ranging" | "high_volatility" | "crisis" | "recovery",
  "confidence": 0.0-1.0,
  "characteristics": {
    "trendStrength": -1.0 to 1.0 (negative = bearish, positive = bullish),
    "volatilityLevel": "low" | "normal" | "elevated" | "extreme",
    "momentumBias": "bullish" | "bearish" | "neutral",
    "breadth": "strong" | "moderate" | "weak" | "divergent",
    "riskAppetite": "risk_on" | "neutral" | "risk_off" | "panic"
  },
  "indicators": [
    { "name": "string", "value": "string", "signal": "bullish" | "bearish" | "neutral" }
  ],
  "strategyAdjustments": {
    "positionSizing": "increase" | "maintain" | "reduce" | "minimize",
    "stopLossWidth": "tight" | "normal" | "wide",
    "takeProfitStrategy": "aggressive" | "standard" | "conservative" | "trail_tight",
    "preferredTimeframes": ["scalp" | "day" | "swing" | "position"],
    "avoidPatterns": ["string"],
    "favorPatterns": ["string"]
  },
  "summary": "string",
  "transitionRisk": "low" | "moderate" | "high",
  "timestamp": "ISO-8601"
}

Regime definitions:
- trending_bull: Sustained upward price movement, bullish momentum, expanding breadth
- trending_bear: Sustained downward movement, bearish momentum, deteriorating breadth
- ranging: Sideways consolidation, mean-reverting, low directional conviction
- high_volatility: Elevated realized and implied vol, choppy price action, whipsaws
- crisis: Extreme fear, rapid sell-off, correlation spike, liquidity withdrawal
- recovery: Early reversal from bear/crisis, improving breadth, tentative buying

Be precise. Do not hedge excessively. Commit to the most likely regime.`;

export function buildRegimeDetectionPrompt(params: {
  market?: string;
  context?: string;
  indicators?: string[];
  priceData?: string;
}): string {
  const parts = [
    `Classify the current market regime for ${params.market ?? "broad market (S&P 500 / US equities)"}.`,
  ];

  if (params.priceData) {
    parts.push(`\nRecent price data:\n${params.priceData}`);
  }

  if (params.indicators && params.indicators.length > 0) {
    parts.push(`\nAvailable indicators:\n${params.indicators.map((i, idx) => `${idx + 1}. ${i}`).join("\n")}`);
  }

  if (params.context) {
    parts.push(`\nAdditional context:\n${params.context}`);
  }

  parts.push(`\nProvide your regime classification as JSON. Timestamp: ${new Date().toISOString()}`);

  return parts.join("\n");
}

export function buildRegimeTransitionPrompt(params: {
  currentRegime: string;
  market?: string;
  context?: string;
}): string {
  return `The current detected market regime is: ${params.currentRegime}

Market: ${params.market ?? "broad US equities"}
${params.context ? `Context: ${params.context}` : ""}

Analyze the probability of regime transition. Is this regime likely to persist, or are there signals of an imminent shift?

Respond as JSON with:
{
  "currentRegime": "${params.currentRegime}",
  "persistProbability": 0.0-1.0,
  "transitions": [
    {
      "toRegime": "string",
      "probability": 0.0-1.0,
      "triggers": ["string"],
      "timeHorizon": "days" | "weeks" | "months"
    }
  ],
  "earlyWarningSignals": ["string"],
  "timestamp": "${new Date().toISOString()}"
}`;
}

export function buildSectorRegimePrompt(params: {
  sectors: string[];
  context?: string;
}): string {
  return `Classify the market regime for each of the following sectors:
${params.sectors.map((s, i) => `${i + 1}. ${s}`).join("\n")}

${params.context ? `Context: ${params.context}` : ""}

Respond as a JSON array where each element matches the regime schema. Include sector-specific strategy adjustments.
Timestamp: ${new Date().toISOString()}`;
}
