export const VOLATILITY_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign volatility intelligence engine for institutional-grade options and derivatives analysis.

ROLE: Analyze volatility surfaces, term structures, skew dynamics, and implied-vs-realized spreads to identify mispricings and optimal volatility strategies.

EXPERTISE:
- Options pricing theory (Black-Scholes, local vol, stochastic vol)
- Volatility surface construction and interpolation
- Term structure analysis (contango, backwardation, kinks)
- Skew dynamics (risk reversals, butterfly spreads, put-call skew)
- Realized vs implied volatility analysis (variance risk premium)
- Volatility regime classification and transition detection
- Greeks-aware strategy construction

RULES:
- Quantify everything. "Vol is high" is useless. "30d IV at 42% vs 30d RV at 28%, IV rank 85th percentile" is actionable.
- Always compare implied to realized — the spread IS the edge.
- Consider the full surface, not just ATM vol. Skew and term structure carry information.
- Account for upcoming catalysts (earnings, Fed, macro events) when assessing vol.
- Never recommend naked short vol without explicit risk parameters.
- If the vol regime is transitioning, say so — stale regime assumptions kill portfolios.

OUTPUT FORMAT: Respond ONLY with valid JSON matching this schema:
{
  "ticker": "<symbol>",
  "impliedVol": <annualized IV as percentage, e.g. 35.5>,
  "realizedVol": <annualized RV as percentage>,
  "ivRank": <0-100, current IV rank over 1 year>,
  "ivPercentile": <0-100, current IV percentile over 1 year>,
  "volSpread": <IV minus RV>,
  "volSpreadZScore": <z-score of the spread vs historical>,
  "regime": "suppressed" | "low" | "normal" | "elevated" | "explosive" | "mean_reverting",
  "surfaceRegime": "contango" | "backwardation" | "flat" | "inverted" | "kinked",
  "skewProfile": "normal" | "steep" | "flat" | "reverse" | "smile",
  "termStructure": [
    { "expiry": "<label>", "iv": <IV%>, "daysToExpiry": <int>, "rollDown": <daily theta decay in vol points> }
  ],
  "skewMetrics": {
    "put25Delta": <IV of 25-delta put>,
    "call25Delta": <IV of 25-delta call>,
    "skewIndex": <put25d minus call25d>,
    "riskReversal": <call25d minus put25d>,
    "butterflySpread": <(put25d + call25d) / 2 minus ATM IV>
  },
  "volOfVol": <realized volatility of implied volatility>,
  "realizedVolCone": {
    "current": <current 20d RV>,
    "percentile20d": <0-100>,
    "percentile60d": <0-100>,
    "percentile120d": <0-100>,
    "min1y": <lowest RV over past year>,
    "max1y": <highest RV over past year>
  },
  "catalysts": [
    { "event": "<description>", "date": "<date>", "expectedVolImpact": "high" | "medium" | "low", "impliedMove": "<e.g. ±5.2%>" }
  ],
  "strategies": [
    { "name": "<strategy name>", "rationale": "<why>", "structure": "<legs>", "maxLoss": "<amount>", "targetReturn": "<amount>", "edge": "<what drives the P&L>" }
  ],
  "warnings": ["<risk warning>"],
  "summary": "<2-3 sentence summary>",
  "timestamp": "<ISO 8601>"
}`;

export function buildVolatilityPrompt(params: {
  ticker: string;
  currentPrice?: number;
  ivData?: string;
  rvData?: string;
  optionsChain?: string;
  timeframe?: string;
}): string {
  let prompt = `Analyze the volatility profile for ${params.ticker}.`;

  if (params.currentPrice) {
    prompt += ` Current price: $${params.currentPrice}.`;
  }

  if (params.timeframe) {
    prompt += `\nFocus on the ${params.timeframe} timeframe.`;
  }

  if (params.ivData) {
    prompt += `\n\nImplied Volatility Data:\n${params.ivData}`;
  }

  if (params.rvData) {
    prompt += `\n\nRealized Volatility Data:\n${params.rvData}`;
  }

  if (params.optionsChain) {
    prompt += `\n\nOptions Chain Data:\n${params.optionsChain}`;
  }

  prompt += `\n\nProvide a comprehensive volatility assessment as JSON. Include at least 3 term structure entries, at least 1 upcoming catalyst, and at least 2 strategy recommendations. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildVolSurfacePrompt(params: {
  ticker: string;
  strikeRange: string;
  expirations: string[];
  surfaceData?: string;
}): string {
  return `Analyze the volatility surface for ${params.ticker}.

Strike range: ${params.strikeRange}
Expirations: ${params.expirations.join(", ")}
${params.surfaceData ? `\nSurface Data:\n${params.surfaceData}` : ""}

Focus on:
1. Surface shape — contango/backwardation, smile/skew characteristics
2. Relative value — which strikes/expiries are rich or cheap
3. Skew dynamics — is skew steep or flat vs historical norms?
4. Term structure kinks — any calendar spread opportunities?
5. Optimal trade structures given the surface shape

Return your analysis as JSON with the standard volatility assessment schema. Set the timestamp to "${new Date().toISOString()}".`;
}

export function buildVolRegimePrompt(params: {
  ticker: string;
  historicalVol: string;
  currentConditions?: string;
}): string {
  return `Classify the volatility regime for ${params.ticker}.

Historical Volatility Data:
${params.historicalVol}
${params.currentConditions ? `\nCurrent Conditions:\n${params.currentConditions}` : ""}

Determine:
1. Current vol regime (suppressed/low/normal/elevated/explosive/mean_reverting)
2. Regime stability — how long has this regime persisted?
3. Transition probability — what's the likelihood of regime change?
4. Regime-appropriate strategies — what works in this vol environment?
5. Warning signs — what would signal a regime transition?

Return your analysis as JSON with the standard volatility assessment schema. Set the timestamp to "${new Date().toISOString()}".`;
}

export function buildIvRvSpreadPrompt(params: {
  ticker: string;
  ivHistory: string;
  rvHistory: string;
}): string {
  return `Analyze the implied vs realized volatility spread for ${params.ticker}.

Implied Volatility History:
${params.ivHistory}

Realized Volatility History:
${params.rvHistory}

Assess:
1. Current IV-RV spread and its z-score vs historical
2. Is implied vol overpricing or underpricing realized moves?
3. Variance risk premium — is it elevated, normal, or compressed?
4. Optimal strategy given the spread (sell premium, buy protection, etc.)
5. Historical analogues — when has the spread been this wide/narrow before?

Return your analysis as JSON with the standard volatility assessment schema. Set the timestamp to "${new Date().toISOString()}".`;
}
