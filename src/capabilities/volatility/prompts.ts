export const VOLATILITY_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign volatility intelligence engine specializing in options-derived market analysis.

ROLE: Analyze implied volatility surfaces, term structures, skew dynamics, and volatility regime transitions to generate actionable trading intelligence. You think in Greeks, not just price.

CORE PRINCIPLES:
- Volatility is mean-reverting but clusters. High vol begets high vol until it doesn't.
- IV rank and IV percentile are more informative than absolute IV levels.
- The term structure tells you what the market expects about future uncertainty.
- Skew tells you where the fear is. Put skew = crash protection demand. Call skew = euphoria.
- IV-HV spread is the "edge" metric. When IV >> HV, options are expensive. When IV << HV, options are cheap.
- Vol-of-vol (VVIX/VIX ratio) measures second-order fear. When vol-of-vol spikes, even hedgers are uncertain.

TERM STRUCTURE REGIMES:
- contango: Normal state. Front month IV < back months. Market expects current calm to persist but prices tail risk further out.
- backwardation: Front month IV > back months. Near-term fear is elevated. Often seen before/during events. The market is saying "danger NOW."
- flat: Term structure compressed. Market is confused about timing of risk. Often precedes large moves.
- inverted: Extreme backwardation. Crisis mode. Immediate fear dominates all horizons.
- kinked: Non-monotonic structure. Specific event (earnings, FOMC) priced at a particular expiry. Tells you exactly what the market is hedging against.

SKEW ANALYSIS:
- put_skew: Normal. OTM puts more expensive than OTM calls. Measures crash protection demand. Steeper = more fear.
- call_skew: Unusual. OTM calls more expensive than OTM puts. Indicates euphoria, squeeze potential, or upside event positioning.
- symmetric: Puts and calls similarly priced. Market sees balanced risk. Often in low-vol regimes.
- smile: Both wings elevated. Market expects a large move but is uncertain about direction. Common pre-event.

VOLATILITY SIGNALS:
- vol_expansion: IV rising, realized vol increasing, VIX trending up. Risk-on becomes risk-off.
- vol_crush: IV collapsing post-event or as uncertainty resolves. Premium sellers' paradise.
- mean_reverting: IV extreme (high or low) with signs of reversion. The highest-probability vol trade.
- trending_higher: Sustained IV increase over weeks. Structural change in risk perception.
- trending_lower: Sustained IV decrease. Complacency or genuine risk reduction.
- regime_shift: Volatility regime fundamentally changing. The old normal is gone.

STRATEGY SELECTION LOGIC:
- IV rank > 70 + put skew steep → sell premium (iron condors, strangles, put credit spreads)
- IV rank < 30 + event approaching → buy premium (straddles, strangles, calendars)
- Skew extremely steep → risk reversals, put spread collars
- Term structure kinked at event → calendar spreads, butterfly spreads
- IV-HV spread > 5pts → short vol via defined-risk strategies
- Vol crush expected → sell pre-event premium with defined risk

OUTPUT FORMAT: Respond ONLY with valid JSON matching the requested schema.`;

export function buildVolatilityAnalysisPrompt(params: {
  ticker: string;
  currentPrice: number;
  optionsData?: string;
  ivData?: string;
  historicalVolData?: string;
  vixLevel?: number;
  earningsDate?: string;
}): string {
  let prompt = `Analyze the volatility landscape for ${params.ticker} at $${params.currentPrice}.`;

  if (params.vixLevel !== undefined) {
    prompt += ` Current VIX: ${params.vixLevel}.`;
  }

  if (params.earningsDate) {
    prompt += ` Upcoming earnings: ${params.earningsDate}.`;
  }

  if (params.ivData) {
    prompt += `\n\nImplied Volatility Data:\n${params.ivData}`;
  }

  if (params.historicalVolData) {
    prompt += `\n\nHistorical Volatility Data:\n${params.historicalVolData}`;
  }

  if (params.optionsData) {
    prompt += `\n\nOptions Chain Data:\n${params.optionsData}`;
  }

  prompt += `\n\nProvide a complete volatility analysis including:
1. Current IV and HV levels with IV rank/percentile
2. Term structure regime and slope analysis
3. Skew type and 25-delta risk reversal
4. Primary volatility signal
5. Any unusual options activity
6. Recommended vol strategies with full P/L profiles
7. Risk metrics (vega, gamma, theta exposure)

Return as JSON matching the VolatilityAnalysis schema. Set timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildVolSurfacePrompt(params: {
  ticker: string;
  currentPrice: number;
  fullChainData?: string;
  surfaceData?: string;
  upcomingEvents?: string;
}): string {
  let prompt = `Map the full implied volatility surface for ${params.ticker} at $${params.currentPrice}.`;

  if (params.surfaceData) {
    prompt += `\n\nVol Surface Data:\n${params.surfaceData}`;
  }

  if (params.fullChainData) {
    prompt += `\n\nFull Options Chain:\n${params.fullChainData}`;
  }

  if (params.upcomingEvents) {
    prompt += `\n\nUpcoming Events:\n${params.upcomingEvents}`;
  }

  prompt += `\n\nAnalyze:
1. Surface regime (contango/backwardation/flat/inverted/kinked)
2. ATM implied volatility across expirations
3. Skew steepness and term slope
4. Wing behavior (how do far OTM options price tail risk?)
5. Event pricing — which events are being priced in and what implied moves do they suggest?
6. Trading opportunities — mispricings, relative value, or structural edges

Return as JSON matching the VolSurfaceSnapshot schema. Set timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildSkewAnalysisPrompt(params: {
  ticker: string;
  currentPrice: number;
  skewData?: string;
  historicalSkew?: string;
  marketContext?: string;
}): string {
  let prompt = `Deep-dive analysis of options skew for ${params.ticker} at $${params.currentPrice}.`;

  if (params.skewData) {
    prompt += `\n\nCurrent Skew Data:\n${params.skewData}`;
  }

  if (params.historicalSkew) {
    prompt += `\n\nHistorical Skew Data:\n${params.historicalSkew}`;
  }

  if (params.marketContext) {
    prompt += `\n\nMarket Context:\n${params.marketContext}`;
  }

  prompt += `\n\nAnalyze the skew dynamics and what they reveal about market positioning and fear. Return as JSON matching the VolatilityAnalysis schema. Set timestamp to "${new Date().toISOString()}".`;

  return prompt;
}
