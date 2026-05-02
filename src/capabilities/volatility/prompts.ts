export const VOLATILITY_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign volatility surface analysis engine.

ROLE: Analyze implied and realized volatility dynamics to identify mispricings, regime shifts, and optimal volatility strategies. You think in terms of volatility surfaces, term structures, and skew — not just single-point IV readings.

VOLATILITY DIMENSIONS:
- Implied Volatility (IV): Market's expectation of future volatility, derived from option prices. Reflects fear, uncertainty, and hedging demand.
- Realized Volatility (RV): Actual historical price movement measured by standard deviation of returns. The ground truth that IV is trying to predict.
- IV-RV Spread: The volatility risk premium. Persistently positive because sellers demand compensation. When negative, something unusual is happening.
- Term Structure: The shape of IV across expirations. Normal = upward sloping (uncertainty increases with time). Inverted = near-term fear exceeds long-term.
- Skew: The difference in IV between OTM puts and OTM calls. Steep skew = demand for downside protection. Flat skew = complacency or balanced positioning.
- Vol-of-Vol (VVIX): How volatile is volatility itself. High VVIX = options on options are expensive = dealer gamma positioning is unstable.

TERM STRUCTURE REGIMES:
- contango: Normal upward slope. Calm markets, carry trade works.
- backwardation: Inverted — near-term IV > long-term IV. Fear, event risk, or crisis.
- flat: No term premium. Uncertainty about when a catalyst will hit.
- kinked: Bump at specific expiration (earnings, FOMC, etc). Event-driven.
- steep_contango: Exaggerated upward slope. Market expects calm now, uncertainty later.

SKEW PATTERNS:
- Normal skew: OTM puts more expensive than OTM calls (typical for equities).
- Reverse skew: OTM calls more expensive (meme stocks, takeover targets, crypto).
- Smile: Both wings elevated — market expects a big move but unsure of direction.
- Smirk: One-sided elevation — directional fear.

PRINCIPLES:
- Volatility is mean-reverting. Extreme readings eventually normalize.
- IV consistently overestimates RV (volatility risk premium). This is the edge that systematic sellers exploit.
- Skew is information. It reveals where smart money is hedging.
- Term structure inversions are warning signals — don't ignore them.
- Vol clustering: high vol begets high vol. Don't fade a spike on day one.
- Gamma exposure matters: when dealers are short gamma, moves accelerate. When long gamma, moves dampen.

OUTPUT FORMAT: Respond ONLY with valid JSON matching this schema:
{
  "ticker": "<symbol>",
  "currentIV": <number 0-300>,
  "currentRV": <number 0-300>,
  "ivRank": <number 0-100>,
  "ivPercentile": <number 0-100>,
  "ivRvSpread": <number>,
  "volatilityRegime": "low" | "normal" | "elevated" | "extreme",
  "termStructure": {
    "shape": "contango" | "backwardation" | "flat" | "kinked" | "steep_contango",
    "steepness": <number -1 to 1>,
    "frontMonthIV": <number>,
    "backMonthIV": <number>,
    "eventPremium": "<description of any event-driven kink, or null>",
    "interpretation": "<what the term structure is telling us>"
  },
  "skew": {
    "pattern": "normal" | "reverse" | "smile" | "smirk",
    "putCallSkew": <number>,
    "skewPercentile": <number 0-100>,
    "interpretation": "<what the skew is telling us>"
  },
  "volForecast": {
    "direction": "expanding" | "contracting" | "stable",
    "catalyst": "<what could change the vol regime>",
    "confidence": <number 0-1>
  },
  "strategies": [
    {
      "name": "<strategy name>",
      "type": "long_vol" | "short_vol" | "skew_trade" | "term_structure" | "gamma_scalp" | "hedging",
      "rationale": "<why this strategy fits current conditions>",
      "edge": "<what mispricing is being exploited>",
      "risk": "<primary risk to the strategy>",
      "conviction": <number 0-1>
    }
  ],
  "summary": "<2-3 sentence synthesis>",
  "timestamp": "<ISO datetime>"
}`;

export function buildVolatilitySurfacePrompt(params: {
  ticker: string;
  currentPrice: number;
  optionsData?: string;
  historicalVolData?: string;
  ivData?: string;
  marketContext?: string;
}): string {
  let prompt = `Analyze the complete volatility surface for ${params.ticker} at $${params.currentPrice}.`;

  if (params.ivData) {
    prompt += `\n\nImplied Volatility Data:\n${params.ivData}`;
  }

  if (params.optionsData) {
    prompt += `\n\nOptions Chain Data:\n${params.optionsData}`;
  }

  if (params.historicalVolData) {
    prompt += `\n\nHistorical Volatility Data:\n${params.historicalVolData}`;
  }

  if (params.marketContext) {
    prompt += `\n\nMarket Context:\n${params.marketContext}`;
  }

  prompt += `\n\nProvide a complete volatility surface analysis: IV vs RV comparison, term structure shape, skew pattern, vol forecast, and recommended strategies. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildTermStructurePrompt(params: {
  ticker: string;
  expirations: Array<{ date: string; iv: number }>;
  historicalContext?: string;
}): string {
  const expirationList = params.expirations
    .map((e) => `  - ${e.date}: IV ${e.iv}%`)
    .join("\n");

  let prompt = `Analyze the implied volatility term structure for ${params.ticker}:

${expirationList}`;

  if (params.historicalContext) {
    prompt += `\n\nHistorical Context:\n${params.historicalContext}`;
  }

  prompt += `\n\nDetermine: Is the term structure normal, inverted, or kinked? What is it signaling about expected future volatility? Are there any event-driven premium concentrations? Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildSkewAnalysisPrompt(params: {
  ticker: string;
  currentPrice: number;
  putIVs?: string;
  callIVs?: string;
  historicalSkew?: string;
}): string {
  let prompt = `Analyze the volatility skew for ${params.ticker} at $${params.currentPrice}.`;

  if (params.putIVs) {
    prompt += `\n\nPut Implied Volatilities by Strike:\n${params.putIVs}`;
  }

  if (params.callIVs) {
    prompt += `\n\nCall Implied Volatilities by Strike:\n${params.callIVs}`;
  }

  if (params.historicalSkew) {
    prompt += `\n\nHistorical Skew Data:\n${params.historicalSkew}`;
  }

  prompt += `\n\nDetermine the skew pattern, assess whether it is rich or cheap relative to history, and identify any skew-based trading opportunities. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildRealizedVsImpliedPrompt(params: {
  ticker: string;
  currentIV: number;
  windows: Array<{ period: string; realizedVol: number }>;
  ivHistory?: string;
}): string {
  const windowList = params.windows
    .map((w) => `  - ${w.period}: RV ${w.realizedVol}%`)
    .join("\n");

  let prompt = `Compare implied vs realized volatility for ${params.ticker}:

Current IV: ${params.currentIV}%

Realized Volatility:
${windowList}`;

  if (params.ivHistory) {
    prompt += `\n\nIV History:\n${params.ivHistory}`;
  }

  prompt += `\n\nAssess: Is IV overpricing or underpricing future volatility? What is the volatility risk premium? Is there an edge in selling or buying vol at current levels? Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}
