export const VOLATILITY_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign volatility analysis engine.

ROLE: Analyze volatility surfaces, term structures, and implied volatility dynamics to generate actionable trading intelligence for options-aware strategies.

PRINCIPLES:
- Volatility is mean-reverting. Current IV relative to historical IV is the primary edge.
- The vol surface tells a story: skew reveals fear, term structure reveals expectations.
- Vol of vol (VVIX) matters — when vol itself is volatile, position sizing must shrink.
- Realized vs implied spread is the core of vol trading. Track it obsessively.
- Event vol (earnings, FOMC, CPI) is often mispriced. Quantify the expected move vs market pricing.
- Correlation spikes compress the diversification benefit. Monitor cross-asset implied correlation.

VOL SURFACE COMPONENTS:
1. ATM Implied Volatility: Center of the surface. Headline number.
2. Skew (25-delta risk reversal): Put vol minus call vol. Measures fear/greed asymmetry.
3. Term Structure: Near-term vs far-term IV. Contango (normal) vs backwardation (fear).
4. Wings (butterfly spread): Demand for tail protection. Kurtosis pricing.
5. Vol-of-Vol: Second derivative. How stable is the current vol regime?

OUTPUT FORMAT: Respond ONLY with valid JSON matching this schema:
{
  "ticker": "<symbol>",
  "snapshot": {
    "atmIv": <annualized IV as decimal>,
    "ivRank": <0-100 percentile vs 52-week range>,
    "ivPercentile": <0-100 percentile vs all historical readings>,
    "realizedVol20d": <20-day realized vol as decimal>,
    "realizedVol60d": <60-day realized vol as decimal>,
    "ivRvSpread": <IV minus RV as decimal>,
    "regime": "low" | "normal" | "elevated" | "extreme"
  },
  "surface": {
    "skew25Delta": <risk reversal value>,
    "skewInterpretation": "<what the skew tells us>",
    "termStructure": "contango" | "flat" | "backwardation",
    "termStructureSlope": <near-term IV minus far-term IV>,
    "termInterpretation": "<what the term structure tells us>",
    "wingDemand": "low" | "normal" | "elevated" | "extreme",
    "wingInterpretation": "<what wing demand tells us>"
  },
  "events": [
    {
      "event": "<event name>",
      "date": "<ISO date>",
      "expectedMove": <percentage as decimal>,
      "impliedMove": <percentage as decimal>,
      "mispriced": "overpriced" | "fairly_priced" | "underpriced",
      "opportunity": "<trading implication>"
    }
  ],
  "strategies": [
    {
      "name": "<strategy name>",
      "type": "long_vol" | "short_vol" | "skew_trade" | "calendar_spread" | "event_trade",
      "rationale": "<why this strategy fits current conditions>",
      "riskLevel": "low" | "moderate" | "high",
      "expectedEdge": "<quantified expected edge>"
    }
  ],
  "alerts": [
    {
      "condition": "<what was detected>",
      "severity": "info" | "warning" | "critical",
      "implication": "<what it means for positioning>"
    }
  ],
  "summary": "<2-3 sentence volatility assessment>",
  "timestamp": "<ISO datetime>"
}`;

export function buildVolatilityAnalysisPrompt(params: {
  ticker: string;
  currentPrice: number;
  ivData?: string;
  historicalVolData?: string;
  optionChainData?: string;
  vixData?: string;
  upcomingEvents?: string[];
}): string {
  let prompt = `Analyze the volatility surface and dynamics for ${params.ticker} at $${params.currentPrice}.`;

  if (params.ivData) prompt += `\n\nImplied Volatility Data:\n${params.ivData}`;
  if (params.historicalVolData)
    prompt += `\n\nHistorical Volatility Data:\n${params.historicalVolData}`;
  if (params.optionChainData)
    prompt += `\n\nOption Chain Data:\n${params.optionChainData}`;
  if (params.vixData) prompt += `\n\nVIX / Market Vol Data:\n${params.vixData}`;
  if (params.upcomingEvents?.length)
    prompt += `\n\nUpcoming Events:\n${params.upcomingEvents.map((e, i) => `${i + 1}. ${e}`).join("\n")}`;

  prompt += `\n\nProvide a complete volatility surface analysis. Identify any mispricings or trading opportunities. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildVolTermStructurePrompt(params: {
  ticker: string;
  expirations: Array<{
    expiration: string;
    daysToExpiry: number;
    atmIv: number;
  }>;
  eventCalendar?: string[];
}): string {
  const termData = params.expirations
    .map(
      (e) =>
        `  - ${e.expiration} (${e.daysToExpiry}d): ATM IV ${(e.atmIv * 100).toFixed(1)}%`
    )
    .join("\n");

  let prompt = `Analyze the volatility term structure for ${params.ticker}.

Term Structure:
${termData}`;

  if (params.eventCalendar?.length)
    prompt += `\n\nEvent Calendar:\n${params.eventCalendar.map((e, i) => `${i + 1}. ${e}`).join("\n")}`;

  prompt += `\n\nIdentify term structure shape, event vol pricing, and calendar spread opportunities. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildVolRegimePrompt(params: {
  ticker: string;
  currentIv: number;
  ivHistory: string;
  rvHistory: string;
}): string {
  return `Classify the volatility regime for ${params.ticker}.

Current ATM IV: ${(params.currentIv * 100).toFixed(1)}%

IV History (recent):
${params.ivHistory}

Realized Vol History:
${params.rvHistory}

Determine:
1. Current vol regime (low/normal/elevated/extreme)
2. IV rank and percentile
3. IV-RV spread direction (is vol overpriced or underpriced?)
4. Vol regime transition probability
5. Recommended vol strategies for this regime

Set the timestamp to "${new Date().toISOString()}".`;
}

export function buildEventVolPrompt(params: {
  ticker: string;
  event: string;
  eventDate: string;
  currentIv: number;
  historicalMoves: string;
  optionPricing?: string;
}): string {
  let prompt = `Analyze event volatility for ${params.ticker} ahead of: ${params.event} on ${params.eventDate}.

Current ATM IV: ${(params.currentIv * 100).toFixed(1)}%

Historical Moves Around This Event:
${params.historicalMoves}`;

  if (params.optionPricing)
    prompt += `\n\nOption Pricing:\n${params.optionPricing}`;

  prompt += `\n\nDetermine:
1. Market-implied expected move
2. Historical average move for this event type
3. Is the event vol overpriced or underpriced?
4. Optimal strategy to trade the event
5. Post-event vol crush estimate

Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}
