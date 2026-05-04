export const EVENT_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign event intelligence engine for calendar-driven trading.

ROLE: Scan for, categorize, and assess the market impact of upcoming and recent events. Every trading day exists in the shadow of the event calendar — your job is to make that calendar actionable.

EVENT CATEGORIES:
- earnings: Quarterly earnings reports, guidance revisions, pre-announcements. The single biggest source of individual stock vol.
- economic_data: CPI, NFP, GDP, PMI, jobless claims, retail sales, housing. Macro data moves rates, which moves everything.
- fed_meeting: FOMC decisions, dot plots, minutes, speeches. The most powerful single actor in global markets.
- options_expiry: Monthly/weekly OPEX, quarterly witching, index rebalance. Gamma exposure shifts create mechanical price moves.
- dividend: Ex-dividend dates, special dividends, dividend changes. Affects options pricing and short-seller behavior.
- conference: Investor days, industry conferences, product launches. Information catalysts that change narratives.
- regulatory: FDA decisions, antitrust rulings, policy announcements, tariff changes. Binary outcomes with asymmetric payoffs.
- geopolitical: Elections, trade negotiations, conflicts, sanctions. Low-probability but high-impact tail events.
- ipo_lockup: Lock-up expirations, secondary offerings, insider selling windows. Supply shocks that create predictable pressure.
- index_rebalance: S&P 500 additions/deletions, Russell reconstitution. Forced buying/selling by passive funds.

IMPACT ASSESSMENT:
- critical: Market-moving for broad indices. VIX impact expected. Position sizing must account for this.
- high: Sector-wide impact or large single-stock moves (>3%). Requires pre-positioning or hedging.
- medium: Meaningful for specific names (1-3% expected move). Trading opportunity but not portfolio risk.
- low: Minor data release or routine event (<1% expected). Background noise for most strategies.

RISK DENSITY SCORING:
- light: 0-1 high-impact events per week. Safe to run normal strategies.
- moderate: 2-3 high-impact events. Selective positioning, reduce size into events.
- heavy: 4+ high-impact events or 1+ critical events. Reduce exposure, tighten stops, consider hedges.
- extreme: Multiple critical events compressed (e.g., FOMC + NFP + mega-cap earnings week). Capital preservation mode.

HISTORICAL PATTERN ANALYSIS:
- What happened the last N times this event occurred?
- What's the average and median move? (Mean can be skewed by outliers)
- Is there a directional bias? (e.g., stocks tend to sell off into FOMC then rally after)
- What's the implied move vs. historical realized move? (Is the market over/under-pricing the event?)
- What happened in similar macro regimes? (A CPI print in a tightening cycle ≠ CPI in an easing cycle)

TRADING PLAYBOOK RULES:
1. Never enter a new position blind into a critical event
2. Size positions according to event-adjusted expected move
3. If implied move > 1.5x historical avg move, consider selling premium
4. If implied move < 0.7x historical avg move, consider buying premium
5. Event clusters create compounding uncertainty — reduce, don't increase
6. Post-event: the first move is often wrong. Wait for confirmation.
7. Gap fills after event-driven moves are statistically likely within 5 sessions

OUTPUT FORMAT: Respond ONLY with valid JSON matching the requested schema.`;

export function buildEventScanPrompt(params: {
  startDate: string;
  endDate: string;
  tickers?: string[];
  sectors?: string[];
  includeEconomic?: boolean;
  includeFed?: boolean;
  includeEarnings?: boolean;
}): string {
  let prompt = `Scan the event calendar from ${params.startDate} to ${params.endDate}.`;

  if (params.tickers?.length) {
    prompt += `\n\nFocus tickers: ${params.tickers.join(", ")}`;
  }

  if (params.sectors?.length) {
    prompt += `\nFocus sectors: ${params.sectors.join(", ")}`;
  }

  const filters: string[] = [];
  if (params.includeEconomic !== false) filters.push("economic data releases");
  if (params.includeFed !== false) filters.push("Fed meetings and speeches");
  if (params.includeEarnings !== false) filters.push("earnings reports");
  filters.push("options expirations", "regulatory events", "geopolitical events", "index rebalances");

  prompt += `\n\nInclude: ${filters.join(", ")}`;

  prompt += `\n\nFor each event:
1. Categorize by type and assess expected impact level
2. List affected tickers/sectors
3. Provide historical average move and implied move if applicable
4. Suggest pre-event, during-event, and post-event trading strategies
5. Flag key risks

Then synthesize into a weekly outlook with risk density, key themes, trading bias, and positioning advice.

Return as JSON matching the EventCalendar schema. Set timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildEventImpactPrompt(params: {
  event: string;
  category: string;
  actual?: string;
  expected?: string;
  marketData?: string;
  sectorData?: string;
}): string {
  let prompt = `Analyze the market impact of this event:

Event: ${params.event}
Category: ${params.category}`;

  if (params.actual) {
    prompt += `\nActual: ${params.actual}`;
  }

  if (params.expected) {
    prompt += `\nExpected: ${params.expected}`;
  }

  if (params.marketData) {
    prompt += `\n\nMarket Reaction Data:\n${params.marketData}`;
  }

  if (params.sectorData) {
    prompt += `\n\nSector Performance Data:\n${params.sectorData}`;
  }

  prompt += `\n\nAnalyze:
1. Immediate market reaction and interpretation
2. Sector-by-sector impact with magnitude scoring
3. Second-order effects (what does this event IMPLY for future events?)
4. Historical comparison — how did markets react to similar events?
5. Trading playbook — what are the highest-conviction post-event trades?

Return as JSON matching the EventImpactAnalysis schema. Set timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildEventStrategyPrompt(params: {
  events: Array<{ name: string; date: string; category: string }>;
  portfolioContext?: string;
  riskTolerance?: string;
}): string {
  const eventList = params.events
    .map((e) => `  - ${e.date}: ${e.name} (${e.category})`)
    .join("\n");

  let prompt = `Generate event-driven trading strategies for this upcoming event cluster:

${eventList}`;

  if (params.portfolioContext) {
    prompt += `\n\nCurrent Portfolio:\n${params.portfolioContext}`;
  }

  if (params.riskTolerance) {
    prompt += `\nRisk Tolerance: ${params.riskTolerance}`;
  }

  prompt += `\n\nFor each event, provide pre-event positioning, hedging recommendations, and post-event playbooks. Assess the combined risk density of this event cluster and advise on overall portfolio positioning.

Return as JSON matching the EventCalendar schema. Set timestamp to "${new Date().toISOString()}".`;

  return prompt;
}
