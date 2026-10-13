export const OPTIONS_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign options intelligence engine for derivatives trading and volatility analysis.

ROLE: Analyze options markets to extract actionable intelligence from flow, volatility surfaces, positioning, and Greeks exposure. Your analysis bridges options market signals to equity and portfolio decisions.

PRINCIPLES:
- Options markets lead equity markets. Unusual flow is signal, not noise.
- Implied volatility tells you what the market expects. Realized volatility tells you what happened. The spread between them is opportunity.
- Never treat the options market as a casino. Every trade has a counterparty with information.
- Size matters more than direction. A $5M put buy means more than a thousand $500 call buys.
- Distinguish between hedging flow (institutional protection) and speculative flow (directional bets).
- Skew reveals fear. Term structure reveals timing. Surface shape reveals consensus.
- Greeks are not static — second-order effects (gamma, charm, vanna) drive market mechanics.

OPTIONS FLOW CATEGORIES:
- sweep: Aggressive multi-exchange sweep — highest conviction
- block: Large negotiated block — institutional
- unusual_volume: Strike/expiry with volume >> open interest
- opening_position: New position established (volume > OI)
- closing_position: Existing position liquidated
- roll: Position rolled to different strike/expiry
- spread: Multi-leg spread execution

VOLATILITY ANALYSIS:
- IV Rank: Current IV relative to 52-week range (0-100)
- IV Percentile: % of days IV was lower in past year (0-100)
- Skew: Put IV vs call IV at same delta — measures fear premium
- Term Structure: Near-term vs far-term IV — contango (normal) vs backwardation (fear)
- Volatility Surface: Full strike × expiry IV matrix

STRATEGY CATEGORIES:
- directional: Calls, puts, verticals (bullish/bearish view)
- volatility: Straddles, strangles, butterflies (vol expansion/contraction)
- income: Covered calls, cash-secured puts, iron condors (theta collection)
- hedge: Protective puts, collars, tail-risk hedges (portfolio protection)
- arbitrage: Calendar spreads, ratio spreads, conversions (relative value)

OUTPUT FORMAT: Respond ONLY with valid JSON matching the requested schema.`;

export function buildOptionsFlowPrompt(params: {
  ticker: string;
  flowData: string;
  currentPrice: number;
  historicalIV?: string;
  openInterest?: string;
}): string {
  let prompt = `Analyze the options flow for ${params.ticker} (current price: $${params.currentPrice}).

Flow Data:
${params.flowData}`;

  if (params.historicalIV) {
    prompt += `\n\nHistorical IV Context:\n${params.historicalIV}`;
  }

  if (params.openInterest) {
    prompt += `\n\nOpen Interest Distribution:\n${params.openInterest}`;
  }

  prompt += `\n\nAnalyze: (1) Is the flow bullish, bearish, or hedging? (2) What is the smart money positioning? (3) What size is significant vs noise? (4) What strikes and expirations are targeted?

Return JSON with schema:
{
  "ticker": "<symbol>",
  "flowBias": "strongly_bullish" | "bullish" | "neutral" | "bearish" | "strongly_bearish",
  "confidence": <0.0-1.0>,
  "totalPremium": { "calls": <dollar value>, "puts": <dollar value>, "ratio": <put/call ratio> },
  "significantTrades": [
    {
      "type": "sweep" | "block" | "unusual_volume" | "opening_position" | "closing_position" | "roll" | "spread",
      "side": "call" | "put",
      "strike": <strike price>,
      "expiry": "<date>",
      "premium": <dollar value>,
      "size": <contracts>,
      "sentiment": "bullish" | "bearish" | "neutral",
      "interpretation": "<what this trade means>"
    }
  ],
  "smartMoneySignal": "<interpretation of institutional/smart money positioning>",
  "keyLevels": {
    "maxPainStrike": <max pain price>,
    "highestCallOI": <strike with most call OI>,
    "highestPutOI": <strike with most put OI>,
    "gammaFlip": <price where dealer gamma flips from long to short>
  },
  "summary": "<2-3 sentence actionable summary>",
  "timestamp": "${new Date().toISOString()}"
}`;

  return prompt;
}

export function buildVolatilitySurfacePrompt(params: {
  ticker: string;
  currentPrice: number;
  ivData: string;
  historicalVolatility?: number;
  earningsDate?: string;
  vixLevel?: number;
}): string {
  let prompt = `Analyze the implied volatility surface for ${params.ticker} (current price: $${params.currentPrice}).

IV Data:
${params.ivData}`;

  if (params.historicalVolatility !== undefined) {
    prompt += `\nHistorical (Realized) Volatility: ${(params.historicalVolatility * 100).toFixed(1)}%`;
  }

  if (params.earningsDate) {
    prompt += `\nNext Earnings Date: ${params.earningsDate}`;
  }

  if (params.vixLevel !== undefined) {
    prompt += `\nVIX Level: ${params.vixLevel}`;
  }

  prompt += `\n\nAnalyze the volatility surface shape, skew dynamics, term structure, and identify mispricings or opportunities.

Return JSON with schema:
{
  "ticker": "<symbol>",
  "ivRank": <0-100>,
  "ivPercentile": <0-100>,
  "currentIV30": <30-day IV as decimal>,
  "realizedVol30": <30-day RV as decimal>,
  "ivRvSpread": <IV minus RV>,
  "skew": {
    "put25Delta": <25-delta put IV>,
    "call25Delta": <25-delta call IV>,
    "skewIndex": <put IV / call IV ratio>,
    "interpretation": "<what the skew tells us>"
  },
  "termStructure": {
    "shape": "contango" | "backwardation" | "flat" | "humped",
    "frontMonth": <front month IV>,
    "backMonth": <back month IV>,
    "eventPremium": <IV premium around events>,
    "interpretation": "<what the term structure tells us>"
  },
  "surfaceSignals": [
    {
      "signal": "<description of surface anomaly or pattern>",
      "location": "<strike/expiry region>",
      "significance": "high" | "medium" | "low",
      "tradeable": <boolean>
    }
  ],
  "regime": "low_vol" | "normal" | "elevated" | "crisis",
  "outlook": "<vol expansion or contraction expected and why>",
  "summary": "<2-3 sentence summary>",
  "timestamp": "${new Date().toISOString()}"
}`;

  return prompt;
}

export function buildOptionsStrategyPrompt(params: {
  ticker: string;
  currentPrice: number;
  outlook: "bullish" | "bearish" | "neutral" | "volatile";
  timeHorizon: "weekly" | "monthly" | "quarterly";
  riskTolerance: "conservative" | "moderate" | "aggressive";
  accountSize: number;
  ivEnvironment?: string;
  constraints?: string[];
}): string {
  let prompt = `Recommend an options strategy for ${params.ticker} (current price: $${params.currentPrice}).

Trader Parameters:
- Outlook: ${params.outlook}
- Time Horizon: ${params.timeHorizon}
- Risk Tolerance: ${params.riskTolerance}
- Account Size: $${params.accountSize.toLocaleString()}`;

  if (params.ivEnvironment) {
    prompt += `\n- IV Environment: ${params.ivEnvironment}`;
  }

  if (params.constraints?.length) {
    prompt += `\n- Constraints: ${params.constraints.join(", ")}`;
  }

  prompt += `\n\nRecommend the optimal strategy with exact strikes, expiries, and position sizing. Include risk/reward analysis and management rules.

Return JSON with schema:
{
  "ticker": "<symbol>",
  "strategy": {
    "name": "<strategy name, e.g. Bull Call Spread, Iron Condor>",
    "category": "directional" | "volatility" | "income" | "hedge" | "arbitrage",
    "legs": [
      {
        "action": "buy" | "sell",
        "type": "call" | "put",
        "strike": <strike price>,
        "expiry": "<date>",
        "quantity": <number of contracts>,
        "estimatedPrice": <per-contract price>
      }
    ],
    "netDebit": <net cost or credit, negative for credit>,
    "maxProfit": <maximum profit>,
    "maxLoss": <maximum loss>,
    "breakeven": [<breakeven price(s)>],
    "probabilityOfProfit": <0.0-1.0>,
    "riskRewardRatio": <ratio>
  },
  "greeksExposure": {
    "delta": <net delta>,
    "gamma": <net gamma>,
    "theta": <daily theta>,
    "vega": <net vega>
  },
  "managementRules": {
    "profitTarget": "<when to take profit>",
    "stopLoss": "<when to cut losses>",
    "adjustment": "<how to adjust if trade moves against>",
    "rollTrigger": "<when to roll the position>"
  },
  "rationale": "<why this strategy fits the outlook and environment>",
  "alternatives": [
    {
      "name": "<alternative strategy>",
      "tradeoff": "<why you might choose this instead>"
    }
  ],
  "warnings": ["<risk warnings>"],
  "summary": "<2-3 sentence actionable summary>",
  "timestamp": "${new Date().toISOString()}"
}`;

  return prompt;
}

export function buildGreeksAnalysisPrompt(params: {
  ticker: string;
  positions: string;
  currentPrice: number;
  daysToExpiry: number;
  impliedVolatility: number;
}): string {
  return `Analyze the Greeks exposure for these ${params.ticker} options positions (current price: $${params.currentPrice}, ${params.daysToExpiry} DTE, IV: ${(params.impliedVolatility * 100).toFixed(1)}%):

Positions:
${params.positions}

Provide a comprehensive Greeks analysis including second-order Greeks (gamma risk, charm, vanna) and scenario analysis showing P&L under different price and volatility moves.

Return JSON with schema:
{
  "ticker": "<symbol>",
  "netGreeks": {
    "delta": <net delta>,
    "gamma": <net gamma>,
    "theta": <daily theta decay>,
    "vega": <net vega>,
    "rho": <net rho>
  },
  "secondOrder": {
    "gammaRisk": "<assessment of gamma exposure near strikes>",
    "charm": "<delta decay rate — how delta changes with time>",
    "vanna": "<how delta changes with IV — cross-risk>",
    "volga": "<how vega changes with IV — vol-of-vol exposure>"
  },
  "scenarioAnalysis": [
    {
      "scenario": "<description, e.g. price +5%, vol flat>",
      "pnl": <estimated P&L>,
      "newDelta": <resulting delta>,
      "risk": "low" | "medium" | "high"
    }
  ],
  "riskMetrics": {
    "dollarDelta": <delta in dollar terms>,
    "gammaScalp": <daily gamma P&L at current vol>,
    "thetaBurn": <daily theta cost>,
    "vegaExposure": <P&L per 1% IV move>,
    "maxLossScenario": "<worst-case scenario description>",
    "maxLossAmount": <worst-case dollar loss>
  },
  "recommendations": ["<hedging or adjustment recommendations>"],
  "summary": "<2-3 sentence summary>",
  "timestamp": "${new Date().toISOString()}"
}`;
}

export function buildGexAnalysisPrompt(params: {
  ticker: string;
  currentPrice: number;
  optionsOIData: string;
  dealerPositioning?: string;
}): string {
  let prompt = `Analyze the Gamma Exposure (GEX) profile and dealer positioning for ${params.ticker} (current price: $${params.currentPrice}).

Options Open Interest Data:
${params.optionsOIData}`;

  if (params.dealerPositioning) {
    prompt += `\n\nDealer Positioning Estimates:\n${params.dealerPositioning}`;
  }

  prompt += `\n\nAnalyze dealer gamma positioning and its impact on price dynamics. Identify key levels where dealer hedging creates support/resistance.

Return JSON with schema:
{
  "ticker": "<symbol>",
  "netGex": <net gamma exposure in shares>,
  "gexRegime": "positive" | "negative" | "neutral",
  "flipPoint": <price where GEX flips from positive to negative>,
  "keyLevels": [
    {
      "price": <strike level>,
      "gammaNotional": <gamma in dollar terms>,
      "type": "support" | "resistance" | "pin",
      "strength": "strong" | "moderate" | "weak",
      "mechanism": "<how dealer hedging creates this level>"
    }
  ],
  "priceImplications": {
    "expectedRange": { "low": <price>, "high": <price> },
    "pinRisk": <0.0-1.0>,
    "breakoutProbability": <0.0-1.0>,
    "volatilitySuppression": <boolean>
  },
  "dealerHedging": {
    "direction": "buying_dips" | "selling_rallies" | "amplifying_moves",
    "magnitude": "heavy" | "moderate" | "light",
    "explanation": "<how dealer flows affect price action>"
  },
  "summary": "<2-3 sentence summary>",
  "timestamp": "${new Date().toISOString()}"
}`;

  return prompt;
}
