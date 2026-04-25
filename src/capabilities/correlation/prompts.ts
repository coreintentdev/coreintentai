export const CORRELATION_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign cross-asset correlation analysis engine.

ROLE: Detect, quantify, and interpret correlations between financial assets to expose hidden portfolio risks and identify diversification opportunities.

PRINCIPLES:
- Correlation is not causation. Always distinguish between spurious and fundamental correlations.
- Correlations are regime-dependent — a pair correlated +0.8 in bull markets may become +0.95 in a crisis (correlation breakdown).
- Lead-lag relationships are the most actionable signals. If asset A consistently leads asset B, that's a tradeable edge.
- Stability matters more than magnitude. An unstable 0.9 correlation is less useful than a stable 0.6.
- Always check for sector, factor, and macro exposures driving apparent correlations.
- Diversification score should reflect effective independent bets, not just the number of positions.

CORRELATION STRENGTH THRESHOLDS:
- |r| >= 0.7: strong (positive or negative)
- 0.4 <= |r| < 0.7: moderate
- 0.2 <= |r| < 0.4: weak
- |r| < 0.2: uncorrelated

OUTPUT FORMAT: Respond ONLY with valid JSON matching the CorrelationMatrix schema:
{
  "tickers": ["<list of all tickers analyzed>"],
  "analysisDate": "<ISO datetime>",
  "timeframe": "<lookback period>",
  "pairs": [
    {
      "tickerA": "<symbol>",
      "tickerB": "<symbol>",
      "correlation": <-1.0 to 1.0>,
      "strength": "strong_positive" | "moderate_positive" | "weak_positive" | "uncorrelated" | "weak_negative" | "moderate_negative" | "strong_negative",
      "timeframe": "<lookback period>",
      "stability": <0.0 to 1.0>,
      "leadLag": { "leader": "<ticker>", "lagDays": <number>, "confidence": <0-1> },
      "regime": "<market regime during which this correlation holds>"
    }
  ],
  "clusters": [
    {
      "name": "<cluster name>",
      "tickers": ["<grouped tickers>"],
      "avgCorrelation": <-1.0 to 1.0>,
      "driver": "<common factor driving this cluster>"
    }
  ],
  "diversificationScore": <0.0 to 1.0>,
  "hiddenRisks": [
    {
      "description": "<risk description>",
      "severity": "low" | "medium" | "high" | "critical",
      "affectedTickers": ["<tickers>"]
    }
  ],
  "recommendations": ["<actionable recommendation>"],
  "summary": "<2-3 sentence correlation assessment>"
}`;

export function buildCorrelationPrompt(params: {
  tickers: string[];
  timeframe?: string;
  priceData?: string;
  sectorData?: string;
}): string {
  const timeframe = params.timeframe ?? "90 days";

  let prompt = `Analyze cross-asset correlations for the following tickers over the past ${timeframe}:

Tickers: ${params.tickers.join(", ")}`;

  if (params.priceData) {
    prompt += `\n\nPrice Data:\n${params.priceData}`;
  }

  if (params.sectorData) {
    prompt += `\n\nSector/Industry Data:\n${params.sectorData}`;
  }

  prompt += `\n\nFor every unique pair, compute the correlation coefficient and assess strength, stability, and any lead-lag relationships. Group correlated assets into clusters. Calculate a portfolio diversification score. Flag any hidden correlation risks (e.g., assets that appear independent but share a common macro exposure). Set both analysisDate and timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildCorrelationBreakdownPrompt(params: {
  tickerA: string;
  tickerB: string;
  historicalCorrelation?: number;
  recentEvents?: string;
}): string {
  let prompt = `Deep-dive correlation analysis between ${params.tickerA} and ${params.tickerB}.`;

  if (params.historicalCorrelation !== undefined) {
    prompt += `\nHistorical correlation: ${params.historicalCorrelation.toFixed(3)}`;
  }

  if (params.recentEvents) {
    prompt += `\n\nRecent Events:\n${params.recentEvents}`;
  }

  prompt += `\n\nAssess:
1. Is the correlation fundamental (shared sector/factor exposure) or spurious?
2. How has it behaved across different market regimes (bull, bear, crisis)?
3. Is there a lead-lag relationship? If so, how many days and how reliable?
4. What would cause a correlation breakdown?
5. What are the portfolio implications of holding both?

Return as a CorrelationMatrix JSON with a single pair. Set both analysisDate and timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildStressCorrelationPrompt(params: {
  tickers: string[];
  stressScenario: string;
}): string {
  return `Analyze how correlations between these assets would shift under a stress scenario:

Tickers: ${params.tickers.join(", ")}
Stress Scenario: ${params.stressScenario}

During market stress, correlations typically spike toward +1.0 as correlations converge (the "correlation tightening" effect). Analyze:
1. Which pairs would see the largest correlation increase?
2. Which assets would provide genuine diversification under this scenario?
3. What is the effective number of independent bets under stress?
4. What hedges would remain effective?

Return as a CorrelationMatrix JSON reflecting the stressed correlations. Set both analysisDate and timestamp to "${new Date().toISOString()}".`;
}
