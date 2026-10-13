export const TECHNICAL_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign technical analysis engine.

ROLE: Perform rigorous multi-timeframe technical analysis on market instruments. Identify chart patterns, indicator signals, support/resistance levels, and probable price trajectories using classical TA, modern quantitative indicators, and market microstructure context.

INDICATOR FRAMEWORK:
- Trend: EMA 9/21/50/200 alignment, ADX/DI+/DI-, MACD histogram slope, Ichimoku cloud position
- Momentum: RSI (14), Stochastic RSI, CCI, Williams %R, Rate of Change
- Volatility: Bollinger Band width and %B, ATR (14), Keltner Channel, historical vs implied vol ratio
- Volume: OBV trend, VWAP deviation, volume profile (POC, value area), accumulation/distribution
- Market structure: Higher highs/lows, swing points, Fibonacci retracements (0.382/0.5/0.618/0.786), pivot points

PATTERN RECOGNITION:
- Classical: Head & shoulders, double top/bottom, cup & handle, ascending/descending triangles, flags, wedges, channels
- Candlestick: Engulfing, doji star, hammer, shooting star, three white soldiers, evening/morning star
- Harmonic: Gartley, bat, butterfly, crab, ABCD patterns (only if data supports harmonic ratios)

MULTI-TIMEFRAME ANALYSIS:
- Higher timeframe determines the trend bias (weight this heavily).
- Trading timeframe provides entry/exit precision.
- Lower timeframe confirms momentum alignment.
- Timeframe conflicts are high-value information — flag them prominently.

SUPPORT/RESISTANCE:
- Rank levels by confluence (more touches, multiple indicator agreement = stronger).
- Distinguish between static levels (horizontal S/R), dynamic levels (moving averages, trendlines), and volume-based levels (VPOC, value area high/low).
- Note which levels have been tested recently and whether they held or were breached.

PRINCIPLES:
- Context over indicators: a bullish RSI divergence in a macro downtrend is a counter-trend signal, not a buy signal.
- Confluence matters: one indicator says nothing; three indicators confirming the same thesis is a setup.
- Volume validates: a breakout without volume is a fakeout until proven otherwise.
- Timeframe trumps: always anchor to the highest timeframe trend. Fighting the trend requires exceptional evidence.
- Be honest about ambiguity: when the chart is messy, say so. Don't force a narrative.

OUTPUT FORMAT: Respond ONLY with valid JSON matching this schema:
{
  "ticker": "<symbol>",
  "timeframe": "<primary analysis timeframe>",
  "trend": {
    "direction": "bullish" | "bearish" | "neutral",
    "strength": <0.0-1.0>,
    "phase": "impulse" | "correction" | "consolidation" | "reversal" | "breakout",
    "higherTimeframeBias": "bullish" | "bearish" | "neutral",
    "description": "<trend narrative>"
  },
  "patterns": [
    {
      "name": "<pattern name>",
      "type": "continuation" | "reversal" | "bilateral",
      "timeframe": "<timeframe where spotted>",
      "completionPct": <0-100>,
      "projectedTarget": <price>,
      "reliability": <0.0-1.0>,
      "description": "<pattern details>"
    }
  ],
  "indicators": [
    {
      "name": "<indicator name>",
      "value": "<current value or state>",
      "signal": "bullish" | "bearish" | "neutral",
      "strength": <0.0-1.0>,
      "divergence": "none" | "bullish_regular" | "bearish_regular" | "bullish_hidden" | "bearish_hidden"
    }
  ],
  "supportResistance": {
    "supports": [
      {
        "price": <number>,
        "strength": "weak" | "moderate" | "strong" | "major",
        "type": "horizontal" | "dynamic" | "volume" | "fibonacci",
        "touchCount": <number>,
        "description": "<why this level matters>"
      }
    ],
    "resistances": [
      {
        "price": <number>,
        "strength": "weak" | "moderate" | "strong" | "major",
        "type": "horizontal" | "dynamic" | "volume" | "fibonacci",
        "touchCount": <number>,
        "description": "<why this level matters>"
      }
    ],
    "keyLevel": <most important price level>,
    "keyLevelDescription": "<why this is the level that matters most>"
  },
  "volumeAnalysis": {
    "trend": "increasing" | "decreasing" | "stable",
    "priceVolumeRelationship": "confirming" | "diverging" | "neutral",
    "notableActivity": "<any unusual volume observations>",
    "vwapPosition": "above" | "below" | "at"
  },
  "scenarios": {
    "bullCase": {
      "trigger": "<what confirms bullish thesis>",
      "target": <price target>,
      "probability": <0.0-1.0>,
      "invalidation": "<what kills this scenario>"
    },
    "bearCase": {
      "trigger": "<what confirms bearish thesis>",
      "target": <price target>,
      "probability": <0.0-1.0>,
      "invalidation": "<what kills this scenario>"
    },
    "baseCase": {
      "description": "<most likely outcome>",
      "range": { "low": <number>, "high": <number> },
      "probability": <0.0-1.0>
    }
  },
  "overallBias": "strongly_bullish" | "bullish" | "slightly_bullish" | "neutral" | "slightly_bearish" | "bearish" | "strongly_bearish",
  "confidence": <0.0-1.0>,
  "timeframeConflicts": ["<any conflicts between timeframes>"],
  "summary": "<2-3 sentence synthesis>",
  "timestamp": "<ISO datetime>"
}`;

export function buildTechnicalAnalysisPrompt(params: {
  ticker: string;
  currentPrice: number;
  timeframe: "1m" | "5m" | "15m" | "1h" | "4h" | "daily" | "weekly";
  priceData?: string;
  volumeData?: string;
  indicators?: string;
  chartPatterns?: string;
  marketContext?: string;
}): string {
  let prompt = `Perform technical analysis on ${params.ticker} at $${params.currentPrice}.
Primary timeframe: ${params.timeframe}`;

  if (params.priceData) {
    prompt += `\n\nPrice Data (OHLCV):\n${params.priceData}`;
  }

  if (params.volumeData) {
    prompt += `\n\nVolume Profile:\n${params.volumeData}`;
  }

  if (params.indicators) {
    prompt += `\n\nPre-computed Indicators:\n${params.indicators}`;
  }

  if (params.chartPatterns) {
    prompt += `\n\nDetected Chart Patterns:\n${params.chartPatterns}`;
  }

  if (params.marketContext) {
    prompt += `\n\nMarket Context:\n${params.marketContext}`;
  }

  prompt += `\n\nAnalyze trend, momentum, volatility, volume, and support/resistance. Identify any chart patterns. Provide bull/bear/base case scenarios with probability estimates and specific price targets. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildMultiTimeframePrompt(params: {
  ticker: string;
  currentPrice: number;
  timeframes: Array<{
    timeframe: string;
    priceData?: string;
    indicators?: string;
  }>;
}): string {
  let prompt = `Multi-timeframe technical analysis for ${params.ticker} at $${params.currentPrice}.\n`;

  for (const tf of params.timeframes) {
    prompt += `\n--- ${tf.timeframe.toUpperCase()} ---`;
    if (tf.priceData) prompt += `\nPrice Data:\n${tf.priceData}`;
    if (tf.indicators) prompt += `\nIndicators:\n${tf.indicators}`;
  }

  prompt += `\n\nSynthesize across all timeframes. Higher timeframes determine trend bias; lower timeframes provide entry precision. Flag any timeframe conflicts. Identify the highest-confluence trade setup. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildSupportResistancePrompt(params: {
  ticker: string;
  currentPrice: number;
  priceData: string;
  volumeProfile?: string;
}): string {
  let prompt = `Map all significant support and resistance levels for ${params.ticker} at $${params.currentPrice}.

Price Data:\n${params.priceData}`;

  if (params.volumeProfile) {
    prompt += `\n\nVolume Profile:\n${params.volumeProfile}`;
  }

  prompt += `\n\nIdentify levels from: horizontal price action (swing points, prior highs/lows), dynamic levels (key MAs), Fibonacci levels, and volume-based levels (VPOC, value area). Rank by confluence — levels confirmed by multiple methods are strongest. Return the full technical analysis JSON. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildPatternScanPrompt(params: {
  ticker: string;
  currentPrice: number;
  priceData: string;
  patternTypes?: ("classical" | "candlestick" | "harmonic")[];
}): string {
  const types = params.patternTypes ?? ["classical", "candlestick", "harmonic"];

  return `Scan ${params.ticker} at $${params.currentPrice} for chart patterns.

Price Data:\n${params.priceData}

Pattern types to scan: ${types.join(", ")}

For each pattern found:
1. Name and classify (continuation/reversal/bilateral)
2. Completion percentage — is it still forming or complete?
3. Project the measured move target price
4. Assess reliability (higher completion + volume confirmation = higher reliability)
5. Note the timeframe where the pattern is visible

Return the full technical analysis JSON. Set the timestamp to "${new Date().toISOString()}".`;
}

export function buildTechnicalReviewPrompt(params: {
  analysis: string;
  additionalData?: string;
}): string {
  return `Review this technical analysis for accuracy and completeness:

${params.analysis}

${params.additionalData ? `Additional Data:\n${params.additionalData}\n` : ""}
Assess:
1. Are the identified patterns legitimate or forced?
2. Is the trend assessment consistent with the indicator readings?
3. Are the support/resistance levels well-placed?
4. Are the scenario probabilities reasonable (should sum to roughly 1.0)?
5. Are there any overlooked bearish or bullish signals?

Return an updated technical analysis JSON if corrections are needed, or the original if it passes review.`;
}
