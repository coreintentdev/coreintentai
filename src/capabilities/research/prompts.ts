/**
 * CoreIntent AI — Market Research Prompts
 *
 * Prompts for web-grounded market research using Perplexity.
 */

export const RESEARCH_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign market research engine.

ROLE: Provide thorough, citation-backed market research and analysis with structured, machine-parseable output.

PRINCIPLES:
- Always cite sources. Research without citations is opinion.
- Distinguish between facts, consensus views, and contrarian takes.
- Prioritize recency — stale data can be worse than no data.
- Flag any conflicts of interest or bias in sources.
- Be concise but thorough — cover what matters, skip the filler.
- Classify finding relevance honestly — not everything is "high" relevance.
- Rate your own confidence — low data quality means low confidence.

RECENCY CLASSIFICATION:
- "breaking": Within the last 24 hours
- "recent": Within the last 7 days
- "dated": Older than 7 days (still potentially valuable for context)

OUTPUT FORMAT: When structured output is requested, respond ONLY with valid JSON matching the ResearchResult schema:
{
  "topic": "<research topic>",
  "ticker": "<ticker if applicable>",
  "findings": [{ "title": "...", "content": "...", "relevance": "high|medium|low", "source": "...", "recency": "breaking|recent|dated" }],
  "overallSentiment": "bullish|bearish|neutral|mixed",
  "keyMetrics": [{ "name": "...", "value": "...", "trend": "improving|stable|deteriorating" }],
  "catalysts": [{ "event": "...", "expectedDate": "...", "impact": "positive|negative|uncertain", "magnitude": "high|medium|low" }],
  "risks": ["..."],
  "summary": "<2-3 sentence summary>",
  "confidence": <0.0-1.0>,
  "timestamp": "<ISO 8601>"
}`;

export function buildResearchPrompt(params: {
  query: string;
  ticker?: string;
  depth?: "quick" | "standard" | "deep";
}): string {
  const depth = params.depth ?? "standard";

  let prompt = params.query;

  if (params.ticker) {
    prompt = `Research ${params.ticker}: ${params.query}`;
  }

  if (depth === "quick") {
    prompt += "\n\nProvide a brief summary in 2-3 paragraphs with key sources.";
  } else if (depth === "deep") {
    prompt += "\n\nProvide comprehensive research covering: recent developments, analyst consensus, key metrics, risks, catalysts, and competitive landscape. Cite all sources.";
  }

  return prompt;
}

export function buildStructuredResearchPrompt(params: {
  query: string;
  ticker?: string;
  depth?: "quick" | "standard" | "deep";
}): string {
  const depth = params.depth ?? "standard";
  const tickerContext = params.ticker ? ` for ${params.ticker}` : "";

  let prompt = `Perform structured market research${tickerContext}: ${params.query}`;

  if (depth === "quick") {
    prompt += "\n\nProvide at least 3 key findings with sources.";
  } else if (depth === "deep") {
    prompt += "\n\nProvide comprehensive research with at least 5 findings, key metrics, upcoming catalysts, and risk factors. Cite all sources.";
  } else {
    prompt += "\n\nProvide 3-5 key findings with sources, relevant metrics, and any upcoming catalysts.";
  }

  prompt += `\n\nReturn your analysis as JSON matching the ResearchResult schema. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildInsightSynthesisPrompt(params: {
  webResearch: string;
  reasoningAnalysis: string;
  query: string;
  ticker?: string;
}): string {
  return `Synthesize these two research perspectives into a unified, structured analysis${params.ticker ? ` for ${params.ticker}` : ""}:

WEB RESEARCH (real-time data, citations):
${params.webResearch}

DEEP ANALYSIS (reasoning, implications):
${params.reasoningAnalysis}

Original query: ${params.query}

Merge the factual findings from web research with the analytical depth from the reasoning model. Resolve any contradictions by favoring more recent data. Produce a single coherent research report.

Return your synthesis as JSON matching the ResearchResult schema. Set the timestamp to "${new Date().toISOString()}".`;
}

export function buildCompetitorAnalysisPrompt(params: {
  ticker: string;
  competitors?: string[];
}): string {
  const compList = params.competitors?.length
    ? `Known competitors: ${params.competitors.join(", ")}`
    : "Identify the top 3-5 competitors";

  return `Competitive analysis for ${params.ticker}:

${compList}

For each competitor, assess:
1. Market position and market cap
2. Recent performance and momentum
3. Key competitive advantages/disadvantages vs ${params.ticker}
4. Valuation comparison (P/E, P/S, EV/EBITDA where available)

Conclude with how ${params.ticker} is positioned relative to peers.`;
}

export function buildCatalystResearchPrompt(params: {
  ticker: string;
  timeHorizon: "near_term" | "medium_term" | "long_term";
}): string {
  const horizonMap = {
    near_term: "next 1-4 weeks",
    medium_term: "next 1-6 months",
    long_term: "next 6-18 months",
  };

  return `Identify upcoming catalysts for ${params.ticker} over the ${horizonMap[params.timeHorizon]}:

For each catalyst, provide:
1. Event description and expected date
2. Potential impact (positive/negative/uncertain)
3. Market expectations and positioning
4. Historical precedent if available

Rank catalysts by potential impact magnitude.`;
}
