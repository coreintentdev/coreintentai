/**
 * CoreIntent AI — Market Research Prompts
 *
 * Structured prompts for web-grounded market research.
 * All prompts enforce JSON output with citation tracking.
 */

const RESEARCH_OUTPUT_SCHEMA = `{
  "ticker": "<symbol or null>",
  "query": "<original research question>",
  "summary": "<2-4 sentence executive summary>",
  "sections": [
    {
      "heading": "<section title>",
      "content": "<detailed findings>",
      "confidence": <0.0-1.0>,
      "sources": [{ "title": "<source>", "url": "<url>", "relevance": "high" | "medium" | "low" }]
    }
  ],
  "catalysts": [
    {
      "event": "<catalyst description>",
      "expectedDate": "<date or null>",
      "impact": "positive" | "negative" | "uncertain",
      "magnitude": "high" | "medium" | "low"
    }
  ],
  "risks": ["<risk 1>", "<risk 2>"],
  "sources": [{ "title": "<source>", "url": "<url>", "relevance": "high" | "medium" | "low" }],
  "dataFreshness": "real_time" | "recent" | "dated" | "unknown",
  "overallConfidence": <0.0-1.0>,
  "timestamp": "<ISO 8601 timestamp>"
}`;

export const RESEARCH_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign market research engine.

ROLE: Provide thorough, citation-backed market research and analysis.

RULES:
- Always cite sources with title and URL where available.
- Distinguish between facts, consensus views, and contrarian takes.
- Prioritize recency — stale data can be worse than no data.
- Flag any conflicts of interest or bias in sources.
- Rate your confidence honestly — if data is sparse, say so.
- Be concise but thorough — cover what matters, skip the filler.

OUTPUT FORMAT: Respond ONLY with valid JSON matching this schema:
${RESEARCH_OUTPUT_SCHEMA}`;

export const RESEARCH_SYNTHESIS_PROMPT = `You are CoreIntent AI — a sovereign research synthesizer.

ROLE: Synthesize multiple research inputs into a single, structured report.
You will receive web-grounded research AND analytical reasoning. Combine them
into a unified view, resolving contradictions and noting where sources agree.

OUTPUT FORMAT: Respond ONLY with valid JSON matching this schema:
${RESEARCH_OUTPUT_SCHEMA}
Merge sources from all inputs. Flag any contradictions in the summary. Set
overallConfidence based on the quality and agreement of the combined inputs.`;

export function buildResearchPrompt(params: {
  query: string;
  ticker?: string;
  depth?: "quick" | "standard" | "deep";
}): string {
  const depth = params.depth ?? "standard";

  let prompt = params.ticker
    ? `Research ${params.ticker}: ${params.query}`
    : params.query;

  if (depth === "quick") {
    prompt += `\n\nProvide a focused analysis with 2-3 key sections. Cite at least 2 sources. Set the timestamp to "${new Date().toISOString()}".`;
  } else if (depth === "deep") {
    prompt += `\n\nProvide comprehensive research with 4-6 sections covering: recent developments, analyst consensus, key metrics, risks, catalysts, and competitive landscape. Cite all sources with URLs. Include at least 3 catalysts and 3 risks. Set the timestamp to "${new Date().toISOString()}".`;
  } else {
    prompt += `\n\nProvide a thorough analysis with 3-4 key sections. Cite at least 3 sources. Include any notable catalysts and risks. Set the timestamp to "${new Date().toISOString()}".`;
  }

  return prompt;
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

Structure your research into sections:
1. Market Overview — ${params.ticker}'s position and market cap
2. Competitor Profiles — each competitor's key metrics and trajectory
3. Competitive Moat — advantages/disadvantages vs peers
4. Valuation Comparison — P/E, P/S, EV/EBITDA where available
5. Verdict — how ${params.ticker} is positioned relative to peers

Include each competitor comparison as a catalyst (impact = their trajectory relative to ${params.ticker}).
List competitive risks in the risks array. Cite all data sources. Set the timestamp to "${new Date().toISOString()}".`;
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
2. Potential impact (positive/negative/uncertain) and magnitude (high/medium/low)
3. Market expectations and positioning
4. Historical precedent if available

Structure findings into sections: Earnings & Financials, Product & Strategy, Macro & Regulatory, and Competitive Dynamics.
Populate the catalysts array with all identified events, ranked by magnitude.
Include risk factors that could derail the thesis. Cite all sources. Set the timestamp to "${new Date().toISOString()}".`;
}

export function buildSynthesisPrompt(params: {
  webResearch: string;
  analysis: string;
  query: string;
  ticker?: string;
}): string {
  return `Synthesize these two research inputs into a single unified report:

--- WEB RESEARCH (real-time data) ---
${params.webResearch}

--- ANALYTICAL REASONING ---
${params.analysis}

Original query: ${params.ticker ? `[${params.ticker}] ` : ""}${params.query}

Combine the factual data from web research with the analytical depth from the reasoning model.
Where they agree, increase confidence. Where they conflict, note the disagreement in the summary
and lower confidence for those sections. Merge all sources. Set the timestamp to "${new Date().toISOString()}".`;
}
