export const CORRELATION_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign cross-asset correlation analysis engine.

ROLE: Analyze correlations between assets, detect correlation regimes, identify diversification opportunities, and flag concentration risks.

PRINCIPLES:
- Correlations are REGIME-DEPENDENT. A correlation observed in bull markets may invert in crisis. Always note regime context.
- Rolling correlations reveal more than static ones. Recent windows (20-60 day) matter more than annual.
- Correlation ≠ causation. Identify the DRIVER behind correlated moves (macro factor, sector exposure, liquidity).
- Cluster analysis reveals hidden portfolio structure. Assets that "look" different may share the same factor exposure.
- Tail correlations spike toward 1.0 in crisis — diversification disappears when you need it most.
- A diversificationScore near 0 means the portfolio is effectively a single bet. Near 1 means genuine multi-factor exposure.

OUTPUT FORMAT: Respond ONLY with valid JSON matching this schema:
{
  "tickers": ["<all tickers analyzed>"],
  "pairs": [
    {
      "tickerA": "<symbol>",
      "tickerB": "<symbol>",
      "correlation": <-1.0 to 1.0>,
      "rollingWindow": "<e.g. 30d, 60d>",
      "stability": <0.0-1.0>,
      "regime": "stable" | "breaking_down" | "strengthening" | "regime_dependent"
    }
  ],
  "clusterCount": <number of identified clusters>,
  "clusters": [
    {
      "id": <integer>,
      "tickers": ["<symbols in this cluster>"],
      "theme": "<what binds this cluster: sector, factor, macro driver>",
      "intraClusterCorrelation": <average pairwise correlation within cluster>
    }
  ],
  "diversificationScore": <0.0-1.0>,
  "concentrationRisk": "low" | "moderate" | "high" | "critical",
  "regimeNote": "<how current market regime affects these correlations>",
  "recommendations": ["<actionable diversification or hedging recommendations>"],
  "timestamp": "<ISO datetime>"
}`;

export function buildCorrelationPrompt(params: {
  tickers: string[];
  priceData?: string;
  timeframe?: string;
  marketContext?: string;
}): string {
  let prompt = `Analyze cross-asset correlations for: ${params.tickers.join(", ")}.`;

  if (params.timeframe) {
    prompt += `\nAnalysis window: ${params.timeframe}`;
  }

  if (params.priceData) {
    prompt += `\n\nPrice/Return Data:\n${params.priceData}`;
  }

  if (params.marketContext) {
    prompt += `\n\nMarket Context:\n${params.marketContext}`;
  }

  prompt += `\n\nFor each pair, estimate the rolling correlation, assess stability, and classify the correlation regime. Group correlated assets into clusters. Calculate portfolio diversification score and concentration risk. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildPortfolioCorrelationPrompt(params: {
  positions: Array<{ ticker: string; weight: number }>;
  priceData?: string;
  regime?: string;
}): string {
  const positionList = params.positions
    .map((p) => `  ${p.ticker}: ${(p.weight * 100).toFixed(1)}%`)
    .join("\n");

  let prompt = `Analyze portfolio correlation structure for these positions:\n\n${positionList}`;

  if (params.regime) {
    prompt += `\n\nCurrent market regime: ${params.regime}`;
  }

  if (params.priceData) {
    prompt += `\n\nPrice/Return Data:\n${params.priceData}`;
  }

  prompt += `\n\nWeight the analysis by position size. Identify hidden concentration risks where nominally different positions share factor exposure. Flag pairs where tail correlation is likely much higher than normal correlation. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildCorrelationShiftPrompt(params: {
  tickers: string[];
  historicalCorrelation: string;
  recentEvents?: string;
}): string {
  return `Detect correlation regime shifts among: ${params.tickers.join(", ")}.

Historical Correlation Data:
${params.historicalCorrelation}

${params.recentEvents ? `Recent Events:\n${params.recentEvents}\n\n` : ""}Identify:
1. Pairs where correlation is significantly deviating from historical norms
2. Whether the shift is transient (event-driven) or structural (regime change)
3. Implications for portfolio risk and hedging effectiveness

Provide your analysis as JSON. Set the timestamp to "${new Date().toISOString()}".`;
}
