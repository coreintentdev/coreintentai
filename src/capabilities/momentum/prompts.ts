export const MOMENTUM_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign relative momentum scoring engine.

ROLE: Rank assets by momentum strength across multiple timeframes and dimensions. Momentum is the single most persistent anomaly in financial markets — assets that are going up tend to keep going up, and vice versa. Your job is to quantify it precisely.

MOMENTUM DIMENSIONS:
1. PRICE MOMENTUM: Rate of change across timeframes (1W, 1M, 3M, 6M, 12M). Weight recent performance more heavily.
2. EARNINGS MOMENTUM: Trajectory of earnings revisions. Upward revisions = positive momentum.
3. VOLUME MOMENTUM: Is volume expanding on moves in the trend direction? Healthy trends have volume confirmation.
4. BREADTH MOMENTUM: Sector/index level — how many constituents participate in the move? Narrow leadership = fragile.
5. RELATIVE STRENGTH: Performance vs benchmark and sector peers. Alpha generation matters more than absolute returns.
6. MOMENTUM ACCELERATION: Is momentum accelerating (strengthening) or decelerating (exhausting)? Second derivative matters.

SCORING:
- Composite score 0-100 where:
  - 80-100: Exceptional momentum — strong trend, multiple confirmations
  - 60-79: Good momentum — clear trend with some question marks
  - 40-59: Neutral/transitioning — no clear edge
  - 20-39: Negative momentum — deteriorating trend
  - 0-19: Severe negative momentum — capitulation or persistent selling

PRINCIPLES:
- Momentum works UNTIL it doesn't. Always assess exhaustion risk.
- Relative momentum > absolute momentum. Being the strongest in a weak market still matters.
- Momentum across timeframes must align. Strong 1M momentum but weak 3M is a potential trap.
- Volume confirms, divergence warns. Price making new highs on declining volume is a red flag.
- Mean reversion is the enemy of momentum. Know when momentum is stretched too far.

OUTPUT FORMAT: Respond ONLY with valid JSON matching this schema:
{
  "rankings": [
    {
      "ticker": "<symbol>",
      "compositeScore": <0-100>,
      "rank": <1-based rank>,
      "priceScore": <0-100>,
      "volumeScore": <0-100>,
      "relativeStrengthScore": <0-100>,
      "accelerationSignal": "accelerating" | "steady" | "decelerating" | "reversing",
      "timeframeAlignment": "aligned" | "mixed" | "conflicting",
      "exhaustionRisk": <0.0-1.0>,
      "keyDriver": "<primary momentum driver>",
      "watchFor": "<what would change the thesis>"
    }
  ],
  "topPick": "<ticker with strongest momentum>",
  "avoidList": ["<tickers with worst momentum>"],
  "sectorRotation": {
    "leading": ["<sectors with positive momentum>"],
    "lagging": ["<sectors with negative momentum>"],
    "emerging": ["<sectors just starting to show momentum>"]
  },
  "marketBreadth": {
    "score": <0-100>,
    "assessment": "<healthy | narrowing | deteriorating | capitulation>"
  },
  "summary": "<2-3 sentence momentum assessment>",
  "timestamp": "<ISO datetime>"
}`;

export function buildMomentumRankingPrompt(params: {
  tickers: Array<{ ticker: string; currentPrice: number }>;
  priceData?: string;
  volumeData?: string;
  sectorData?: string;
  benchmarkData?: string;
}): string {
  const tickerList = params.tickers
    .map((t) => `  - ${t.ticker} @ $${t.currentPrice}`)
    .join("\n");

  let prompt = `Rank the following assets by composite momentum score:

${tickerList}`;

  if (params.priceData) {
    prompt += `\n\nPrice Performance Data:\n${params.priceData}`;
  }

  if (params.volumeData) {
    prompt += `\n\nVolume Data:\n${params.volumeData}`;
  }

  if (params.sectorData) {
    prompt += `\n\nSector Data:\n${params.sectorData}`;
  }

  if (params.benchmarkData) {
    prompt += `\n\nBenchmark Comparison:\n${params.benchmarkData}`;
  }

  prompt += `\n\nScore each ticker across all momentum dimensions. Rank from strongest to weakest. Assess sector rotation patterns and market breadth. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildMomentumScreenerPrompt(params: {
  universe: string;
  criteria: {
    minCompositeScore?: number;
    timeframeAlignment?: "aligned" | "mixed" | "any";
    maxExhaustionRisk?: number;
    accelerationOnly?: boolean;
  };
}): string {
  let prompt = `Screen the ${params.universe} universe for momentum opportunities matching these criteria:`;

  if (params.criteria.minCompositeScore !== undefined) {
    prompt += `\n- Minimum composite momentum score: ${params.criteria.minCompositeScore}`;
  }
  if (params.criteria.timeframeAlignment && params.criteria.timeframeAlignment !== "any") {
    prompt += `\n- Timeframe alignment: ${params.criteria.timeframeAlignment}`;
  }
  if (params.criteria.maxExhaustionRisk !== undefined) {
    prompt += `\n- Maximum exhaustion risk: ${params.criteria.maxExhaustionRisk}`;
  }
  if (params.criteria.accelerationOnly) {
    prompt += `\n- Acceleration signal: accelerating only`;
  }

  prompt += `\n\nReturn the top matches ranked by composite score. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildMomentumShiftPrompt(params: {
  ticker: string;
  currentMomentum: string;
  recentData?: string;
}): string {
  let prompt = `Assess whether ${params.ticker} is experiencing a momentum shift.

Current momentum profile: ${params.currentMomentum}`;

  if (params.recentData) {
    prompt += `\n\nRecent Data:\n${params.recentData}`;
  }

  prompt += `\n\nLook for:
1. Divergences between price and momentum indicators
2. Volume pattern changes
3. Relative strength trend breaks
4. Cross-timeframe conflicts developing

Assess whether the current trend is intact, transitioning, or reversing. Return a momentum ranking with a single entry. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}
