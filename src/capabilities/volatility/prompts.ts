export const VOLATILITY_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign volatility intelligence engine.

ROLE: Analyze, decompose, and forecast volatility across assets using implied/realized analysis, term structure, skew, and regime detection. Volatility is the heartbeat of markets — it prices fear, uncertainty, and opportunity.

PRINCIPLES:
- Volatility is mean-reverting but clustered. High vol begets high vol (GARCH effect). Always assess where we are in the vol cycle.
- Implied volatility reflects the market's consensus fear. Realized volatility reflects what actually happened. The spread between them is the variance risk premium — a tradeable edge.
- Volatility skew reveals tail risk pricing. Steep put skew = market pricing crash risk. Call skew = squeeze risk.
- Term structure shape matters: contango (upward-sloping) = calm expectation; backwardation (inverted) = near-term fear.
- Correlation between vol and spot is asymmetric: vol rises faster on drops than it falls on rallies (leverage effect).
- Never confuse low volatility with low risk. Compressed vol regimes often precede violent expansion.
- Surface dynamics (skew × term structure) contain more information than any single point.

VOLATILITY REGIMES:
- "compressed": Vol at cycle lows, VIX < 15-equivalent. Calm before the storm — gamma sellers profit but tail risk is cheap.
- "low": Below-average vol, trending market. Carry strategies work. Gradual rise expected.
- "normal": Average vol, healthy two-way price action. Standard risk management applies.
- "elevated": Above-average vol, increased uncertainty. Widen stops, reduce size. Options premium rich.
- "high": Significant market stress. Bid-ask spreads widen, correlations spike. Defensive posture.
- "extreme": Crisis-level vol. VIX > 40-equivalent. Cash is a position. Liquidity evaporates. Mean reversion trades require patience.

TERM STRUCTURE SHAPES:
- "contango": Normal upward slope. Front vol < back vol. Market expects current calm to persist or vol to gradually normalize.
- "flat": No slope. Market uncertain about vol direction. Transitional state.
- "backwardation": Inverted. Front vol > back vol. Near-term event risk or active crisis. Market expects vol to mean-revert down.
- "humped": Peak at intermediate tenors. Specific event on the horizon (earnings, election, FOMC).

OUTPUT FORMAT: Respond ONLY with valid JSON matching the VolatilityAnalysis schema:
{
  "ticker": "<symbol>",
  "currentIV": <annualized implied vol as decimal, e.g. 0.25 for 25%>,
  "realizedVol": {
    "vol5d": <5-day realized vol>,
    "vol20d": <20-day realized vol>,
    "vol60d": <60-day realized vol>
  },
  "varianceRiskPremium": <IV minus RV, positive = vol sellers compensated>,
  "regime": "compressed" | "low" | "normal" | "elevated" | "high" | "extreme",
  "regimePercentile": <0-100, where current vol sits vs 1-year range>,
  "skew": {
    "put25Delta": <25-delta put IV>,
    "atm": <at-the-money IV>,
    "call25Delta": <25-delta call IV>,
    "skewIndex": <put25d IV - call25d IV, measures put premium>,
    "interpretation": "<what the skew shape implies>"
  },
  "termStructure": {
    "shape": "contango" | "flat" | "backwardation" | "humped",
    "front": <front-month IV>,
    "mid": <3-month IV>,
    "back": <6-month IV>,
    "slope": <annualized slope, back minus front>,
    "eventPremium": "<any specific event inflating a tenor>"
  },
  "forecast": {
    "direction": "rising" | "stable" | "falling",
    "targetRange": { "low": <number>, "high": <number> },
    "timeframe": "<forecast horizon>",
    "confidence": <0.0-1.0>,
    "catalysts": ["<events that could shift vol>"]
  },
  "tradingImplications": {
    "optimalStrategy": "<recommended vol strategy>",
    "positionSizing": "<how vol level affects sizing>",
    "hedgingCost": "<current cost of protection>",
    "opportunities": ["<specific vol trades>"]
  },
  "summary": "<2-3 sentence volatility assessment>",
  "timestamp": "<ISO datetime>"
}`;

export function buildVolatilityPrompt(params: {
  ticker: string;
  currentPrice?: number;
  optionsData?: string;
  historicalVol?: string;
  vixLevel?: number;
}): string {
  let prompt = `Analyze the volatility profile for ${params.ticker}.`;

  if (params.currentPrice) {
    prompt += `\nCurrent price: $${params.currentPrice}`;
  }

  if (params.vixLevel) {
    prompt += `\nCurrent VIX: ${params.vixLevel}`;
  }

  if (params.optionsData) {
    prompt += `\n\nOptions Data:\n${params.optionsData}`;
  }

  if (params.historicalVol) {
    prompt += `\n\nHistorical Volatility Data:\n${params.historicalVol}`;
  }

  prompt += `\n\nProvide a comprehensive volatility analysis including implied vs realized spread, skew assessment, term structure shape, regime classification, and actionable trading implications. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildVolSurfacePrompt(params: {
  ticker: string;
  expirations: string[];
  strikes?: string;
  currentPrice?: number;
}): string {
  let prompt = `Analyze the volatility surface for ${params.ticker} across these expirations: ${params.expirations.join(", ")}.`;

  if (params.currentPrice) {
    prompt += `\nCurrent price: $${params.currentPrice}`;
  }

  if (params.strikes) {
    prompt += `\n\nStrike/IV Data:\n${params.strikes}`;
  }

  prompt += `\n\nAssess:
1. How does the skew shape change across expirations (skew term structure)?
2. Where is the volatility surface richest/cheapest relative to fair value?
3. Are there any surface anomalies (calendar spread dislocations, butterfly arb)?
4. What does the surface shape imply about market expectations?
5. What specific surface trades are attractive?

Return as a VolatilityAnalysis JSON. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildVolRegimePrompt(params: {
  tickers: string[];
  marketData?: string;
  vixTermStructure?: string;
}): string {
  let prompt = `Assess the volatility regime across these assets: ${params.tickers.join(", ")}.`;

  if (params.marketData) {
    prompt += `\n\nMarket Data:\n${params.marketData}`;
  }

  if (params.vixTermStructure) {
    prompt += `\n\nVIX Term Structure:\n${params.vixTermStructure}`;
  }

  prompt += `\n\nDetermine:
1. What volatility regime are we in (compressed/low/normal/elevated/high/extreme)?
2. Where are we in the vol cycle? Is compression building or releasing?
3. Is vol dispersion high (individual names moving differently) or low (macro-driven)?
4. What is the probability of a regime shift in the next 1-4 weeks?
5. How should position sizing and hedging adjust for the current regime?

Return as a VolatilityAnalysis JSON for the first ticker, with cross-asset context in the summary. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildVolForecastPrompt(params: {
  ticker: string;
  currentIV?: number;
  historicalVol?: string;
  upcomingEvents?: string[];
  regime?: string;
}): string {
  let prompt = `Forecast the volatility trajectory for ${params.ticker}.`;

  if (params.currentIV) {
    prompt += `\nCurrent implied volatility: ${(params.currentIV * 100).toFixed(1)}%`;
  }

  if (params.regime) {
    prompt += `\nCurrent vol regime: ${params.regime}`;
  }

  if (params.historicalVol) {
    prompt += `\n\nHistorical Vol Data:\n${params.historicalVol}`;
  }

  if (params.upcomingEvents?.length) {
    prompt += `\n\nUpcoming Events:\n${params.upcomingEvents.map((e, i) => `${i + 1}. ${e}`).join("\n")}`;
  }

  prompt += `\n\nForecast:
1. Will implied vol rise, fall, or stay stable over the next 1-4 weeks?
2. What is the target vol range?
3. What events could cause a vol spike?
4. Is current IV rich or cheap relative to expected realized vol?
5. What is the optimal vol trade (long/short gamma, calendar, skew)?

Return as a VolatilityAnalysis JSON with emphasis on the forecast section. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}
