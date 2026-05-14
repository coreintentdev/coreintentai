import type { CapabilitySignal, Divergence } from "./types.js";

export const INTELLIGENCE_EXTRACTION_PROMPTS = {
  sentiment: (ticker: string, context?: string) =>
    `Rapid sentiment assessment for ${ticker}.${context ? `\nContext: ${context}` : ""}

Rate the current market sentiment. Respond with ONLY this JSON:
{
  "signal": "bullish" | "bearish" | "neutral" | "mixed",
  "confidence": <0.0-1.0>,
  "score": <-1.0 to 1.0>,
  "keyFinding": "<one sentence: the dominant sentiment driver>",
  "drivers": ["<driver1>", "<driver2>", "<driver3>"]
}`,

  regime: (ticker: string, context?: string) =>
    `Identify the current market regime for ${ticker}.${context ? `\nContext: ${context}` : ""}

Classify the regime and assess risk. Respond with ONLY this JSON:
{
  "signal": "bullish" | "bearish" | "neutral" | "mixed",
  "confidence": <0.0-1.0>,
  "regime": "trending_up" | "trending_down" | "ranging" | "volatile_expansion" | "compression" | "crisis" | "rotation",
  "volatility": "low" | "normal" | "elevated" | "extreme",
  "keyFinding": "<one sentence: the regime and its implication>",
  "transitionRisk": <0.0-1.0>
}`,

  momentum: (ticker: string, context?: string) =>
    `Assess momentum for ${ticker}.${context ? `\nContext: ${context}` : ""}

Evaluate price and volume momentum. Respond with ONLY this JSON:
{
  "signal": "bullish" | "bearish" | "neutral" | "mixed",
  "confidence": <0.0-1.0>,
  "compositeScore": <0-100>,
  "acceleration": "accelerating" | "steady" | "decelerating" | "reversing",
  "keyFinding": "<one sentence: the momentum state and trend>",
  "exhaustionRisk": <0.0-1.0>
}`,

  risk: (ticker: string, context?: string) =>
    `Assess the risk profile for a position in ${ticker}.${context ? `\nContext: ${context}` : ""}

Evaluate current risk factors. Respond with ONLY this JSON:
{
  "signal": "bullish" | "bearish" | "neutral" | "mixed",
  "confidence": <0.0-1.0>,
  "riskLevel": "minimal" | "low" | "moderate" | "elevated" | "high" | "critical",
  "riskScore": <0-100>,
  "keyFinding": "<one sentence: the dominant risk factor>",
  "warnings": ["<warning1>", "<warning2>"]
}`,

  technicals: (ticker: string, context?: string) =>
    `Quick technical signal for ${ticker}.${context ? `\nContext: ${context}` : ""}

Assess the technical setup. Respond with ONLY this JSON:
{
  "signal": "bullish" | "bearish" | "neutral" | "mixed",
  "confidence": <0.0-1.0>,
  "keyFinding": "<one sentence: the dominant technical signal>",
  "supportLevels": [<price1>, <price2>],
  "resistanceLevels": [<price1>, <price2>],
  "keyIndicators": ["<indicator1: value>", "<indicator2: value>"]
}`,

  catalysts: (ticker: string, context?: string) =>
    `Identify upcoming catalysts for ${ticker}.${context ? `\nContext: ${context}` : ""}

Identify events that could move the price. Respond with ONLY this JSON:
{
  "signal": "bullish" | "bearish" | "neutral" | "mixed",
  "confidence": <0.0-1.0>,
  "keyFinding": "<one sentence: the most important upcoming catalyst>",
  "catalysts": [
    { "event": "<description>", "timing": "<when>", "impact": "positive" | "negative" | "uncertain" }
  ]
}`,
} as const;

export type IntelligenceCapability = keyof typeof INTELLIGENCE_EXTRACTION_PROMPTS;

export const SYNTHESIS_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign multi-model intelligence synthesis engine for trading.

YOUR ROLE: You receive parallel intelligence signals from multiple analysis capabilities (sentiment, regime, momentum, risk, technicals, catalysts). Your job is to synthesize these into a single, coherent, actionable intelligence brief.

SYNTHESIS PRINCIPLES:
1. CROSS-REFERENCE: When signals agree, conviction increases. When they diverge, flag it explicitly.
2. REGIME PRIMACY: The market regime frames everything — a bullish signal in a crisis regime means something different than in a trending-up regime.
3. RISK FIRST: Capital preservation overrides opportunity. If risk is elevated, reduce conviction and position size.
4. WEIGHT BY CONFIDENCE: Higher-confidence signals get more weight. Low-confidence signals are noted but don't drive decisions.
5. DIVERGENCE IS INFORMATION: When capabilities disagree, that itself is a signal — it often means uncertainty or a turning point.
6. BE SPECIFIC: Name price levels, percentages, timeframes. No vague language.

OUTPUT FORMAT: Respond ONLY with valid JSON matching the IntelligenceBrief schema.`;

export function buildSynthesisPrompt(params: {
  ticker: string;
  signalMatrix: CapabilitySignal[];
  divergences: Divergence[];
  capabilityOutputs: Array<{ name: string; output: string }>;
  context?: string;
  portfolioValue?: number;
  riskTolerancePct?: number;
}): string {
  const { ticker, signalMatrix, divergences, capabilityOutputs } = params;

  const signalSummary = signalMatrix
    .map(
      (s) =>
        `  ${s.capability}: ${s.signal} (confidence: ${s.confidence.toFixed(2)}) — ${s.keyFinding}`
    )
    .join("\n");

  const divergenceSummary =
    divergences.length > 0
      ? divergences
          .map(
            (d) =>
              `  [${d.severity.toUpperCase()}] ${d.capabilities.join(" vs ")}: ${d.description}`
          )
          .join("\n")
      : "  None — signals are aligned.";

  const detailedOutputs = capabilityOutputs
    .map((c) => `--- ${c.name} ---\n${c.output}`)
    .join("\n\n");

  const portfolioContext = params.portfolioValue
    ? `\nPortfolio: $${params.portfolioValue.toLocaleString()}, Risk tolerance: ${params.riskTolerancePct ?? 1}% per trade`
    : "";

  return `Synthesize a unified intelligence brief for ${ticker}.
${params.context ? `\nMarket context: ${params.context}` : ""}${portfolioContext}

SIGNAL MATRIX:
${signalSummary}

DIVERGENCES DETECTED:
${divergenceSummary}

DETAILED CAPABILITY OUTPUTS:
${detailedOutputs}

Produce a complete IntelligenceBrief JSON with:
- ticker: "${ticker}"
- timestamp: "${new Date().toISOString()}"
- conviction: direction + score (-1 to 1) + confidence (0 to 1)
- signalMatrix: the signals above (copy them)
- divergences: the divergences above (copy them, or add new ones you detect)
- executiveSummary: 2-4 sentences, actionable
- keyLevels: support[], resistance[], optional stopLoss and targets[]
- riskOverlay: overallRisk level, regimeContext, positionSizePct (0-100), warnings[]
- actions: prioritized list of { priority, action, rationale, timeframe }
- meta: { capabilitiesUsed: [${signalMatrix.map((s) => `"${s.capability}"`).join(", ")}], totalLatencyMs: 0, modelsUsed: [], tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } }

Be decisive. Synthesize, don't just repeat.`;
}
