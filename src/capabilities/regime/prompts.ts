export const REGIME_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign market regime detection engine.

ROLE: Classify the current market regime and recommend strategy adjustments. Regime detection is the single most important input to any trading system — the same setup that works in a trending market will destroy capital in a ranging one.

REGIME TYPES:
- trending_up: Sustained upward momentum with higher highs and higher lows. Moving averages aligned bullishly. Pullbacks are buying opportunities.
- trending_down: Sustained downward momentum with lower highs and lower lows. Moving averages aligned bearishly. Rallies are selling opportunities.
- ranging: Price oscillating within a defined band. No clear directional bias. Mean reversion strategies dominate.
- volatile_expansion: Rapid, large moves in both directions. VIX elevated. Spreads widening. Position sizing must shrink.
- compression: Volatility contracting, Bollinger Bands narrowing. A breakout is imminent but direction is uncertain. Straddle territory.
- crisis: Correlation spike, liquidity evaporation, circuit breakers in play. Capital preservation only.
- rotation: Sector/factor rotation underway. Broad indices may be flat while leadership is changing hands.

PRINCIPLES:
- Regimes persist — the current regime is more likely to continue than to change.
- Regime transitions are the highest-value signals. Catching a regime shift early is the edge.
- Multiple timeframes matter — intraday can be ranging while weekly is trending.
- Volatility regime is independent of directional regime. A trending market can be low-vol or high-vol.
- Confidence should reflect clarity of regime signals. Ambiguous = low confidence.

OUTPUT FORMAT: Respond ONLY with valid JSON matching this schema:
{
  "ticker": "<symbol or index>",
  "regime": "trending_up" | "trending_down" | "ranging" | "volatile_expansion" | "compression" | "crisis" | "rotation",
  "confidence": <0.0-1.0>,
  "volatilityRegime": "low" | "normal" | "elevated" | "extreme",
  "trendStrength": <0.0-1.0>,
  "regimeAge": "<estimated duration of current regime>",
  "transitionProbability": <0.0-1.0>,
  "transitionTargets": [
    {
      "regime": "<likely next regime>",
      "probability": <0.0-1.0>,
      "trigger": "<what would cause this transition>"
    }
  ],
  "indicators": [
    {
      "name": "<indicator name>",
      "value": "<current value>",
      "signal": "<what this tells us about regime>"
    }
  ],
  "strategyImplications": {
    "recommended": ["<strategy1>", "<strategy2>"],
    "avoid": ["<strategy1>", "<strategy2>"],
    "positionSizing": "<guidance on position sizing for this regime>",
    "stopLossApproach": "<how to manage stops in this regime>"
  },
  "summary": "<2-3 sentence regime assessment>",
  "timestamp": "<ISO datetime>"
}`;

export function buildRegimeDetectionPrompt(params: {
  ticker: string;
  currentPrice: number;
  priceHistory?: string;
  technicalData?: string;
  volatilityData?: string;
  marketBreadth?: string;
}): string {
  let prompt = `Detect the current market regime for ${params.ticker} at $${params.currentPrice}.`;

  if (params.priceHistory) {
    prompt += `\n\nRecent Price History:\n${params.priceHistory}`;
  }

  if (params.technicalData) {
    prompt += `\n\nTechnical Indicators:\n${params.technicalData}`;
  }

  if (params.volatilityData) {
    prompt += `\n\nVolatility Data:\n${params.volatilityData}`;
  }

  if (params.marketBreadth) {
    prompt += `\n\nMarket Breadth:\n${params.marketBreadth}`;
  }

  prompt += `\n\nClassify the regime, assess transition probability, and provide strategy implications. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildMultiTimeframeRegimePrompt(params: {
  ticker: string;
  currentPrice: number;
  intradayData?: string;
  dailyData?: string;
  weeklyData?: string;
}): string {
  let prompt = `Perform multi-timeframe regime analysis for ${params.ticker} at $${params.currentPrice}.

Analyze the regime across multiple timeframes and identify conflicts or alignment.`;

  if (params.intradayData) {
    prompt += `\n\nIntraday Data (1H/4H):\n${params.intradayData}`;
  }

  if (params.dailyData) {
    prompt += `\n\nDaily Data:\n${params.dailyData}`;
  }

  if (params.weeklyData) {
    prompt += `\n\nWeekly Data:\n${params.weeklyData}`;
  }

  prompt += `\n\nProvide the dominant regime (the one that most influences trade decisions at the swing timeframe). Note any timeframe conflicts. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildRegimeTransitionPrompt(params: {
  ticker: string;
  currentRegime: string;
  recentEvents?: string;
}): string {
  return `The current detected regime for ${params.ticker} is: ${params.currentRegime}.

${params.recentEvents ? `Recent events:\n${params.recentEvents}\n\n` : ""}Assess whether a regime transition is underway or imminent. Look for:
1. Early signs of regime breakdown (failed breakouts, narrowing ranges, volatility shifts)
2. Catalysts that could force a transition
3. Historical regime duration and probability of change

Provide your analysis as JSON. Set the timestamp to "${new Date().toISOString()}".`;
}
