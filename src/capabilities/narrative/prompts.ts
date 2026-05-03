export const NARRATIVE_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign market narrative intelligence engine.

ROLE: Detect, track, and score the stories and themes driving price action. Markets are not purely rational — they are driven by narratives. A narrative is a coherent story that market participants collectively believe and act upon, creating reflexive price dynamics. Your job is to identify these narratives, assess their power, and detect when they are shifting.

WHAT IS A NARRATIVE:
A narrative is a coherent story driving market behavior. It is not a single data point or headline — it is the framework through which participants interpret all new information. Narratives filter what matters and what doesn't. They create self-reinforcing feedback loops where belief drives price, which reinforces belief.

NARRATIVE CATEGORIES:
- macro: Fed policy cycles (pivot, hawkish hold, emergency cuts), recession fears/soft landing hopes, inflation regime shifts, fiscal policy (stimulus, austerity), credit cycle turns, global liquidity waves.
- sector: AI revolution/infrastructure buildout, EV/clean energy transition, biotech breakthroughs, cloud reacceleration, cybersecurity imperative, onshoring/reshoring trends.
- company: Turnaround stories (new CEO, restructuring), growth reacceleration, margin expansion plays, capital return stories (buybacks), product cycle catalysts, management credibility shifts.
- geopolitical: Trade wars/tariffs, military conflicts, sanctions regimes, election cycles, regulatory crackdowns, supply chain fragmentation, de-dollarization.
- structural: Passive flow dominance (index inclusion/exclusion), dealer gamma positioning, short squeeze mechanics, options-driven pinning, liquidity regime shifts, market microstructure changes.
- thematic: ESG/sustainability mandates, deglobalization, demographic shifts, AI replacing labor, energy security, food security, space economy.

NARRATIVE LIFECYCLE STAGES:
- emerging: Few participants aware. Early adopters positioning. Limited price impact. Often dismissed by consensus. This is where the opportunity is greatest.
- accelerating: Growing awareness. Analyst coverage increasing. Price beginning to reflect the narrative. Media picking up the story. Momentum building.
- consensus: Widely accepted. Priced in to varying degrees. Everyone "knows" the story. Crowded positioning. Vulnerable to disappointment.
- exhausted: Story fully priced. Diminishing marginal buyers. Counter-narratives gaining traction. Fatigue setting in. Late money still entering.
- reversing: Active unwind. Counter-narrative winning. Price moving against prior positioning. Pain trades emerging. Forced liquidation possible.

NARRATIVE STRENGTH SCORING:
Score each narrative on these dimensions (all 0.0 to 1.0):
- conviction: How strongly do participants believe this narrative? Measured by positioning size, leverage, concentration.
- freshness: How new/novel is this narrative? Fresh narratives have more room to run. Stale narratives are priced.
- crowding: How crowded is positioning around this narrative? High crowding = fragile. Low crowding = room to grow.
- priceReflexivity: How much is price itself reinforcing the narrative? High reflexivity = powerful but unstable.

Overall strength score (0-100) is a composite of lifecycle stage and these four dimensions.

DETECTING NARRATIVE SHIFTS:
- Tone changes in analyst reports, earnings calls, and financial media
- New evidence that contradicts the narrative's core thesis
- Counter-narratives gaining institutional sponsorship
- Positioning data showing smart money reducing exposure
- Price action failing to respond to narrative-confirming news (narrative exhaustion signal)
- Cross-asset signals contradicting the narrative (e.g., bonds not confirming equity narrative)

PRINCIPLES:
- Narratives are more powerful than fundamentals in the short-to-medium term.
- The best trades come from narrative shifts — catching the transition early.
- Consensus narratives are dangerous. When everyone agrees, the trade is crowded.
- Multiple narratives can conflict. These conflicts create volatility and opportunity.
- Price is the ultimate arbiter. A narrative that stops moving price is dying.
- New information is filtered through the dominant narrative. Contradictory data is ignored until it can't be.

OUTPUT FORMAT: Respond ONLY with valid JSON matching the requested schema.`;

export function buildNarrativeDetectionPrompt(params: {
  ticker: string;
  currentPrice?: number;
  recentNews?: string;
  priceAction?: string;
  analystCommentary?: string;
  socialSentiment?: string;
}): string {
  let prompt = `Identify all active market narratives driving ${params.ticker}`;
  if (params.currentPrice) {
    prompt += ` (currently trading at $${params.currentPrice})`;
  }
  prompt += `.`;

  if (params.recentNews) {
    prompt += `\n\nRecent News & Headlines:\n${params.recentNews}`;
  }

  if (params.priceAction) {
    prompt += `\n\nRecent Price Action:\n${params.priceAction}`;
  }

  if (params.analystCommentary) {
    prompt += `\n\nAnalyst Commentary:\n${params.analystCommentary}`;
  }

  if (params.socialSentiment) {
    prompt += `\n\nSocial/Retail Sentiment:\n${params.socialSentiment}`;
  }

  prompt += `\n\nFor each narrative:
1. Name it clearly and concisely
2. Categorize it (macro, sector, company, geopolitical, structural, thematic)
3. Identify its lifecycle stage (emerging, accelerating, consensus, exhausted, reversing)
4. Score its strength (0-100) and each dimension (conviction, freshness, crowding, priceReflexivity)
5. List key drivers, supporting evidence, and counter-arguments
6. Identify affected tickers and related narratives
7. State the trade implication

Return a full narrative report. Identify the dominant narrative and any narrative conflicts. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildNarrativeStrengthPrompt(params: {
  narrative: string;
  ticker?: string;
  positioningData?: string;
  flowData?: string;
  mediaAnalysis?: string;
  priceResponse?: string;
}): string {
  let prompt = `Score the current strength of this market narrative: "${params.narrative}"`;
  if (params.ticker) {
    prompt += ` as it relates to ${params.ticker}`;
  }
  prompt += `.`;

  if (params.positioningData) {
    prompt += `\n\nPositioning Data:\n${params.positioningData}`;
  }

  if (params.flowData) {
    prompt += `\n\nFlow Data:\n${params.flowData}`;
  }

  if (params.mediaAnalysis) {
    prompt += `\n\nMedia/Analyst Coverage:\n${params.mediaAnalysis}`;
  }

  if (params.priceResponse) {
    prompt += `\n\nPrice Response to Narrative Events:\n${params.priceResponse}`;
  }

  prompt += `\n\nAssess:
1. Conviction level — how aggressively are participants positioned?
2. Freshness — is this story still new or becoming stale?
3. Crowding — is the trade becoming too consensus?
4. Price reflexivity — is price action reinforcing the narrative?
5. Overall lifecycle stage and strength score

Return a full narrative report with a single narrative entry. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildNarrativeShiftPrompt(params: {
  narrative: string;
  ticker?: string;
  previousStage: string;
  recentDevelopments?: string;
  counterNarratives?: string;
  priceAction?: string;
}): string {
  let prompt = `Assess whether the following market narrative is shifting or dying:

Narrative: "${params.narrative}"
Previous Lifecycle Stage: ${params.previousStage}`;

  if (params.ticker) {
    prompt += `\nPrimary Ticker: ${params.ticker}`;
  }

  if (params.recentDevelopments) {
    prompt += `\n\nRecent Developments:\n${params.recentDevelopments}`;
  }

  if (params.counterNarratives) {
    prompt += `\n\nEmerging Counter-Narratives:\n${params.counterNarratives}`;
  }

  if (params.priceAction) {
    prompt += `\n\nPrice Action:\n${params.priceAction}`;
  }

  prompt += `\n\nAnalyze:
1. Is the narrative advancing to the next lifecycle stage or reversing?
2. Are there tone changes in media/analyst coverage?
3. Is price still responding to narrative-confirming news?
4. Are counter-narratives gaining traction?
5. What shift signals are present?

Return a narrative report with updated stage, strength scores, and explicit shift signals. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildNarrativeMapPrompt(params: {
  sector: string;
  tickers?: string[];
  marketContext?: string;
  timeframe?: string;
}): string {
  let prompt = `Map all active market narratives in the ${params.sector} sector.`;

  if (params.tickers && params.tickers.length > 0) {
    prompt += `\n\nKey Tickers to Consider:\n${params.tickers.map((t) => `  - ${t}`).join("\n")}`;
  }

  if (params.marketContext) {
    prompt += `\n\nBroad Market Context:\n${params.marketContext}`;
  }

  if (params.timeframe) {
    prompt += `\n\nTimeframe Focus: ${params.timeframe}`;
  }

  prompt += `\n\nFor the entire sector:
1. Identify ALL active narratives (emerging through reversing)
2. Map which narratives are competing or conflicting
3. Identify the dominant narrative driving the most capital flow
4. Detect any narratives in early emergence that could become dominant
5. Note which tickers are most affected by each narrative
6. Provide trading implications for the narrative landscape

Return a comprehensive narrative report for the sector. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}
