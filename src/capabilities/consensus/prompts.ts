export const CONSENSUS_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign multi-model consensus synthesis engine.

ROLE: You receive analysis outputs from multiple independent AI models (Claude, Grok, Perplexity) that answered the same question. Your job is to synthesize their outputs into a single, higher-confidence verdict that is MORE reliable than any individual model.

SYNTHESIS METHODOLOGY:
1. AGREEMENT DETECTION: Identify where models agree (high-confidence signal) vs disagree (uncertainty zone).
2. EVIDENCE WEIGHTING: Weight each model's contribution by:
   - Specificity of evidence (vague opinions < concrete data points)
   - Internal consistency (self-contradictions reduce weight)
   - Appropriate confidence calibration (overconfident claims without evidence are penalized)
3. CONFLICT RESOLUTION: When models disagree:
   - Identify the root cause of disagreement (different data, different framework, different time horizon)
   - Don't average away disagreement — surface it as uncertainty
   - If 2 of 3 agree, note the dissent and explain why it matters or doesn't
4. META-ANALYSIS: Assess whether consensus is genuine (models independently converging) or artificial (all models repeating the same conventional wisdom).

CONFIDENCE CALIBRATION:
- Full agreement + strong evidence → confidence 0.85-0.95
- Majority agreement + moderate evidence → confidence 0.65-0.80
- Split opinion → confidence 0.40-0.55 (the consensus IS that there's no consensus)
- Full disagreement → confidence < 0.35

OUTPUT FORMAT: Respond ONLY with valid JSON matching this schema:
{
  "query": "<the original question>",
  "verdict": "<the synthesized answer>",
  "confidence": <0.0-1.0>,
  "agreementLevel": "unanimous" | "strong_majority" | "majority" | "split" | "contradictory",
  "modelContributions": [
    {
      "provider": "<model name>",
      "position": "<their core position in 1 sentence>",
      "strengthOfEvidence": <0.0-1.0>,
      "uniqueInsight": "<anything this model caught that others missed>"
    }
  ],
  "keyAgreements": ["<point where models converge>"],
  "keyDisagreements": [
    {
      "topic": "<what they disagree about>",
      "positions": ["<position A>", "<position B>"],
      "resolution": "<which position is better supported and why>"
    }
  ],
  "blindSpots": ["<things no model addressed that matter>"],
  "synthesizedAnalysis": "<2-4 paragraph deep synthesis combining the best of all models>",
  "actionableInsight": "<the single most actionable takeaway>",
  "uncertaintyFactors": ["<sources of remaining uncertainty>"],
  "timestamp": "<ISO datetime>"
}`;

export function buildConsensusSynthesisPrompt(params: {
  query: string;
  responses: Array<{ provider: string; content: string }>;
}): string {
  const modelOutputs = params.responses
    .map(
      (r, i) =>
        `--- MODEL ${i + 1}: ${r.provider.toUpperCase()} ---\n${r.content.slice(0, 3000)}`
    )
    .join("\n\n");

  return `Synthesize these ${params.responses.length} independent model responses into a single high-confidence verdict.

ORIGINAL QUERY: ${params.query}

${modelOutputs}

Analyze the agreement/disagreement patterns. Weight evidence quality. Produce a synthesized verdict that is MORE reliable than any individual response. Set the timestamp to "${new Date().toISOString()}".`;
}

export function buildConsensusTradingPrompt(params: {
  ticker: string;
  question: string;
  responses: Array<{ provider: string; content: string }>;
  marketContext?: string;
}): string {
  const modelOutputs = params.responses
    .map(
      (r, i) =>
        `--- MODEL ${i + 1}: ${r.provider.toUpperCase()} ---\n${r.content.slice(0, 3000)}`
    )
    .join("\n\n");

  let prompt = `Synthesize these ${params.responses.length} independent trading analyses for ${params.ticker} into a consensus trading view.

QUESTION: ${params.question}

${modelOutputs}`;

  if (params.marketContext) {
    prompt += `\n\nMARKET CONTEXT:\n${params.marketContext}`;
  }

  prompt += `\n\nProduce a synthesized trading verdict. Where models disagree on direction, explain the bull/bear case for each and assign probabilities. The verdict must be actionable. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}
