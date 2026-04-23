import type { ModelProvider } from "../../types/index.js";

export const CORRELATION_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign cross-asset correlation analysis engine.

ROLE: Detect, measure, and interpret correlations between financial instruments. Identify divergences that represent trading opportunities and correlation breakdowns that signal regime shifts.

PRINCIPLES:
- Correlation is not causation. Always distinguish statistical co-movement from fundamental linkage.
- Rolling correlations matter more than static ones. A 30-day correlation can diverge wildly from a 1-year correlation.
- Divergences from historical correlation norms are the highest-signal events. When two historically correlated assets decouple, one of them is wrong.
- Correlation clusters reveal hidden risk. If everything in the portfolio is secretly correlated, diversification is an illusion.
- Crisis correlations differ from normal correlations. In a crash, correlations spike toward 1.0. Plan for it.
- Lead-lag relationships can be exploited. If asset A consistently leads asset B by 1-2 days, that's an edge.

RELATIONSHIP TYPES:
- positive: Assets move together (e.g., XLF and JPM)
- negative: Assets move inversely (e.g., SPY and VIX)
- leading: Asset A's moves predict Asset B's moves with a lag
- lagging: Asset A follows Asset B's moves
- coincident: Assets move simultaneously
- divergent: Historical relationship has broken down — this is a signal

OUTPUT FORMAT: Respond ONLY with valid JSON matching this schema:
{
  "pairs": [
    {
      "tickerA": "<symbol>",
      "tickerB": "<symbol>",
      "correlation": <-1.0 to 1.0>,
      "rollingPeriod": "<e.g., 30d, 90d>",
      "historicalAverage": <-1.0 to 1.0>,
      "deviation": <deviation from historical>,
      "relationship": "positive" | "negative" | "leading" | "lagging" | "coincident" | "divergent",
      "significance": <0.0-1.0>
    }
  ],
  "clusters": [
    {
      "name": "<cluster label>",
      "tickers": ["<symbol1>", "<symbol2>"],
      "avgIntraCorrelation": <0.0-1.0>,
      "riskImplication": "<what this clustering means for portfolio risk>"
    }
  ],
  "divergences": [
    {
      "tickerA": "<symbol>",
      "tickerB": "<symbol>",
      "expectedRelationship": "<historical norm>",
      "currentRelationship": "<what's happening now>",
      "divergenceMagnitude": <0.0-1.0>,
      "tradingImplication": "<what to do about it>",
      "confidence": <0.0-1.0>
    }
  ],
  "regimeContext": "<how the current market regime affects correlations>",
  "summary": "<2-3 sentence correlation assessment>",
  "timestamp": "<ISO datetime>"
}`;

export function buildCorrelationPrompt(params: {
  tickers: string[];
  priceData?: string;
  period?: string;
  focusOn?: "divergences" | "clusters" | "all";
}): string {
  let prompt = `Analyze cross-asset correlations for: ${params.tickers.join(", ")}.`;

  if (params.period) {
    prompt += `\nFocus on the ${params.period} rolling period.`;
  }

  if (params.focusOn && params.focusOn !== "all") {
    prompt += `\nPrioritize ${params.focusOn === "divergences" ? "divergence detection — find where historical relationships are breaking down" : "cluster analysis — identify hidden correlation groups and portfolio risk"}.`;
  }

  if (params.priceData) {
    prompt += `\n\nPrice/Return Data:\n${params.priceData}`;
  }

  prompt += `\n\nAnalyze pairwise correlations, identify any clusters, flag divergences from historical norms, and provide trading implications. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildDivergencePrompt(params: {
  tickerA: string;
  tickerB: string;
  historicalCorrelation: number;
  currentCorrelation: number;
  priceDataA?: string;
  priceDataB?: string;
  context?: string;
}): string {
  let prompt = `A significant correlation divergence has been detected:

- Pair: ${params.tickerA} / ${params.tickerB}
- Historical correlation: ${params.historicalCorrelation.toFixed(3)}
- Current correlation: ${params.currentCorrelation.toFixed(3)}
- Deviation: ${Math.abs(params.historicalCorrelation - params.currentCorrelation).toFixed(3)}`;

  if (params.priceDataA) {
    prompt += `\n\n${params.tickerA} Price Data:\n${params.priceDataA}`;
  }

  if (params.priceDataB) {
    prompt += `\n\n${params.tickerB} Price Data:\n${params.priceDataB}`;
  }

  if (params.context) {
    prompt += `\n\nMarket Context:\n${params.context}`;
  }

  prompt += `\n\nDetermine: (1) Which asset is "right" and which is mispriced, (2) Whether this divergence is a mean-reversion opportunity or a structural break, (3) Specific trading implications. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildPortfolioCorrelationPrompt(params: {
  positions: Array<{ ticker: string; weight: number; sector?: string }>;
  correlationMatrix?: string;
  riskBudget?: number;
}): string {
  const positionList = params.positions
    .map((p) => `  - ${p.ticker}: ${(p.weight * 100).toFixed(1)}% weight${p.sector ? ` (${p.sector})` : ""}`)
    .join("\n");

  let prompt = `Analyze portfolio correlation risk for these positions:\n${positionList}`;

  if (params.correlationMatrix) {
    prompt += `\n\nCorrelation Matrix:\n${params.correlationMatrix}`;
  }

  if (params.riskBudget !== undefined) {
    prompt += `\n\nRisk budget: ${params.riskBudget}% max portfolio drawdown tolerance.`;
  }

  prompt += `\n\nIdentify hidden correlation clusters, concentration risks, and recommend diversification improvements. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}
