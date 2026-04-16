/**
 * CoreIntent AI — Market Research Prompts
 *
 * Prompts for web-grounded market research using Perplexity.
 * Includes both free-text and structured JSON output variants.
 */

export const RESEARCH_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign market research engine.

ROLE: Provide thorough, citation-backed market research and analysis.

RULES:
- Always cite sources. Research without citations is opinion.
- Distinguish between facts, consensus views, and contrarian takes.
- Prioritize recency — stale data can be worse than no data.
- Flag any conflicts of interest or bias in sources.
- Be concise but thorough — cover what matters, skip the filler.`;

export const STRUCTURED_RESEARCH_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign market research engine that outputs structured JSON.

ROLE: Provide thorough, citation-backed market research and analysis.
OUTPUT: You MUST respond with a single JSON object (no markdown fences, no preamble).

RULES:
- Always cite sources. Research without citations is opinion.
- Distinguish between facts, consensus views, and contrarian takes.
- Prioritize recency — stale data can be worse than no data.
- Flag any conflicts of interest or bias in sources.

REQUIRED JSON SCHEMA:
{
  "ticker": "optional — the ticker symbol if applicable",
  "query": "the research query",
  "summary": "2-3 sentence executive summary",
  "findings": [
    {
      "claim": "specific finding or data point",
      "source": "where this came from",
      "confidence": "confirmed | likely | speculative",
      "recency": "breaking | recent | dated"
    }
  ],
  "catalysts": [
    {
      "event": "catalyst description",
      "expectedDate": "date or timeframe",
      "impact": "positive | negative | uncertain",
      "magnitude": "low | medium | high"
    }
  ],
  "risks": ["key risk 1", "key risk 2"],
  "consensus": "what the market broadly expects",
  "contrarianView": "optional — credible alternative thesis",
  "dataFreshness": "real_time | same_day | this_week | older",
  "sources": ["source1", "source2"],
  "timestamp": "ISO 8601 datetime"
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
  additionalContext?: string;
}): string {
  const depth = params.depth ?? "standard";

  let prompt = params.ticker
    ? `Research ${params.ticker}: ${params.query}`
    : params.query;

  if (depth === "quick") {
    prompt +=
      "\n\nProvide a focused summary with the most important findings. Include 3-5 key findings.";
  } else if (depth === "deep") {
    prompt +=
      "\n\nProvide comprehensive research. Include at least 5-8 findings covering: recent developments, analyst consensus, key metrics, risks, catalysts, and competitive landscape.";
  } else {
    prompt +=
      "\n\nProvide balanced research with 4-6 key findings, risks, and consensus view.";
  }

  if (params.additionalContext) {
    prompt += `\n\nADDITIONAL CONTEXT (synthesize this into your structured output):\n${params.additionalContext}`;
  }

  prompt +=
    "\n\nRespond with ONLY the JSON object matching the schema. No markdown, no preamble. Use the current timestamp in the timestamp field.";

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
