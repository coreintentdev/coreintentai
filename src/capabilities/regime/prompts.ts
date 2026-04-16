export const REGIME_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign market regime detection engine.

ROLE: Identify the current market regime from price action, volatility, breadth, and macro indicators. Regime detection is the foundation of adaptive strategy selection — the same setup that works in a trending market fails in a ranging one.

REGIMES:
- trending_bull: Sustained uptrend, rising moving averages, breadth expanding, VIX low/falling
- trending_bear: Sustained downtrend, declining MAs, breadth contracting, risk-off rotation
- ranging: Price oscillating in a defined range, mean-reverting behavior, declining volume
- volatile: Elevated VIX, large intraday swings, sector rotation, mixed signals
- crisis: Correlation spike (everything sells), VIX >30, liquidity drying up, flight to safety

PRINCIPLES:
- Regime transitions matter more than current regime — early detection of shifts is the edge.
- Multiple timeframes can show different regimes (daily ranging, weekly trending).
- Conviction in regime classification should reflect data clarity — ambiguous data = low confidence.
- Always identify what would INVALIDATE the current regime assessment.

OUTPUT FORMAT: Respond ONLY with valid JSON matching this schema:
{
  "regime": "trending_bull" | "trending_bear" | "ranging" | "volatile" | "crisis",
  "confidence": <0.0-1.0>,
  "subRegime": "<more specific characterization>",
  "indicators": [
    {
      "name": "<indicator>",
      "value": "<current value or state>",
      "signal": "confirms" | "contradicts" | "neutral",
      "weight": <0.0-1.0>
    }
  ],
  "transitionRisk": {
    "probability": <0.0-1.0>,
    "likelyNextRegime": "<regime>",
    "earlyWarnings": ["<signal1>", "<signal2>"]
  },
  "strategyImplications": {
    "favoredStrategies": ["<strategy1>", "<strategy2>"],
    "avoidStrategies": ["<strategy1>", "<strategy2>"],
    "positionSizing": "<aggressive | normal | reduced | defensive>",
    "hedgingAdvice": "<specific hedging recommendation>"
  },
  "timeframe": "intraday" | "daily" | "weekly" | "monthly",
  "invalidation": "<what would change this regime assessment>",
  "timestamp": "<ISO datetime>"
}`;

export function buildRegimeDetectionPrompt(params: {
  marketData?: string;
  indices?: string[];
  vix?: number;
  breadthData?: string;
  sectorRotation?: string;
  timeframe?: "intraday" | "daily" | "weekly" | "monthly";
}): string {
  let prompt = `Detect the current market regime.`;

  if (params.timeframe) {
    prompt += `\nTimeframe: ${params.timeframe}`;
  }

  if (params.indices?.length) {
    prompt += `\n\nKey Indices:\n${params.indices.join("\n")}`;
  }

  if (params.vix !== undefined) {
    prompt += `\n\nVIX: ${params.vix}`;
  }

  if (params.marketData) {
    prompt += `\n\nMarket Data:\n${params.marketData}`;
  }

  if (params.breadthData) {
    prompt += `\n\nBreadth Data:\n${params.breadthData}`;
  }

  if (params.sectorRotation) {
    prompt += `\n\nSector Rotation:\n${params.sectorRotation}`;
  }

  prompt += `\n\nClassify the regime, assess transition risk, and provide strategy implications. Include at least 4 indicators with weights. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildRegimeTransitionPrompt(params: {
  currentRegime: string;
  marketData: string;
  recentChanges: string;
}): string {
  return `The current detected regime is: ${params.currentRegime}

Recent market changes:
${params.recentChanges}

Current market data:
${params.marketData}

Assess whether a regime TRANSITION is underway. Focus on:
1. Are the signals that defined the current regime weakening?
2. Are signals for a new regime strengthening?
3. What is the probability of transition within the next 1-2 weeks?
4. What early warning signals should we monitor?

Return your analysis as JSON with the standard regime schema. Set the timestamp to "${new Date().toISOString()}".`;
}

export function buildMultiTimeframeRegimePrompt(params: {
  dailyData: string;
  weeklyData: string;
  monthlyData?: string;
}): string {
  let prompt = `Perform a multi-timeframe regime analysis.

Daily Data:
${params.dailyData}

Weekly Data:
${params.weeklyData}`;

  if (params.monthlyData) {
    prompt += `\n\nMonthly Data:\n${params.monthlyData}`;
  }

  prompt += `\n\nProvide regime classification for EACH timeframe. Note any conflicts between timeframes — these are often inflection points. Return a JSON array of regime objects, one per timeframe. Set all timestamps to "${new Date().toISOString()}".`;

  return prompt;
}
