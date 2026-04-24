export const CORRELATION_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign cross-asset correlation intelligence engine.

ROLE: Detect, quantify, and explain correlations between financial assets. Identify when correlations shift, break down, or intensify under different market regimes.

PRINCIPLES:
- Correlation is not causation — always distinguish between statistical co-movement and causal relationships.
- Regime matters — correlations that hold in calm markets often break during crises (correlation convergence to 1).
- Time-varying correlations are more valuable than static ones — flag when relationships are shifting.
- Tail correlations differ from normal-regime correlations — stress-test your assessments.
- Spurious correlations exist — be skeptical of weak relationships without fundamental drivers.

CORRELATION STRENGTH SCALE:
- strong_positive (> 0.7): Assets move together consistently
- moderate_positive (0.3 to 0.7): Meaningful co-movement with divergences
- weak (-0.3 to 0.3): No reliable relationship
- moderate_negative (-0.7 to -0.3): Meaningful inverse relationship
- strong_negative (< -0.7): Assets reliably move in opposite directions

OUTPUT FORMAT: Respond ONLY with valid JSON matching the CorrelationResult schema.`;

export function buildCorrelationPrompt(params: {
  assets: string[];
  marketContext?: string;
  timeHorizon?: "short_term" | "medium_term" | "long_term";
  priceData?: string;
}): string {
  const horizon = params.timeHorizon ?? "medium_term";

  let prompt = `Analyze the correlation structure between these assets: ${params.assets.join(", ")}

Time horizon: ${horizon}

For each pair, assess:
1. Current correlation coefficient (-1 to +1)
2. Relationship strength classification
3. Stability of the correlation (stable/shifting/unstable)
4. Whether the correlation is regime-dependent

Provide portfolio implications including diversification effectiveness, concentration warnings, and hedging suggestions.`;

  if (params.priceData) {
    prompt += `\n\nPrice data:\n${params.priceData}`;
  }

  if (params.marketContext) {
    prompt += `\n\nMarket context:\n${params.marketContext}`;
  }

  prompt += `\n\nReturn your analysis as JSON. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildRegimeCorrelationPrompt(params: {
  assets: string[];
  currentRegime: string;
  historicalRegimes?: string;
  stressScenarios?: string[];
}): string {
  let prompt = `Analyze how correlations between ${params.assets.join(", ")} change across market regimes.

Current regime: ${params.currentRegime}

Assess:
1. Current correlation structure under the ${params.currentRegime} regime
2. How these correlations would shift in crisis/stress scenarios
3. Historical regime transitions and their impact on the correlation structure
4. Whether current correlations are at risk of breaking down`;

  if (params.historicalRegimes) {
    prompt += `\n\nHistorical regime context:\n${params.historicalRegimes}`;
  }

  if (params.stressScenarios?.length) {
    prompt += `\n\nStress scenarios to evaluate:\n${params.stressScenarios.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
  }

  prompt += `\n\nInclude regimeContext in your response with sensitivity assessment. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildDiversificationPrompt(params: {
  portfolio: Array<{ ticker: string; weight: number }>;
  marketContext?: string;
}): string {
  const holdings = params.portfolio
    .map((h) => `${h.ticker}: ${(h.weight * 100).toFixed(1)}%`)
    .join("\n");

  let prompt = `Evaluate the diversification quality of this portfolio:

${holdings}

Analyze:
1. Pairwise correlations between all holdings
2. Effective diversification (are positions truly independent?)
3. Hidden correlation clusters (sector, factor, or macro exposures)
4. Concentration risk from correlated positions
5. Hedging opportunities to improve diversification

Score the portfolio's diversification from 0 (fully concentrated) to 100 (optimally diversified).`;

  if (params.marketContext) {
    prompt += `\n\nCurrent market context:\n${params.marketContext}`;
  }

  prompt += `\n\nReturn your analysis as JSON with diversificationScore included. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildContagionPrompt(params: {
  sourceAsset: string;
  targetAssets: string[];
  scenario: string;
}): string {
  return `Assess the contagion risk from ${params.sourceAsset} to: ${params.targetAssets.join(", ")}

Scenario: ${params.scenario}

Analyze:
1. Direct correlation pathways from ${params.sourceAsset} to each target
2. Indirect contagion channels (sector spillover, factor exposure, liquidity chains)
3. Historical precedent for similar contagion events
4. Speed and magnitude of expected spillover
5. Which assets are most and least vulnerable

Rate overall contagion risk as: low, moderate, elevated, or high.

Return your analysis as JSON with contagionRisk included. Set the timestamp to "${new Date().toISOString()}".`;
}
