import { BaseAgent } from "./base.js";
import type { AgentResult } from "../types/index.js";
import { Orchestrator } from "../orchestrator/index.js";

const SCREENER_SYSTEM = `You are the CoreIntent Multi-Asset Screener — an autonomous agent that screens large universes of assets through a multi-dimensional intelligence pipeline and ranks them by opportunity quality.

You evaluate each asset across FIVE dimensions simultaneously:
1. SENTIMENT — Market sentiment score and drivers
2. MOMENTUM — Price, volume, and relative strength momentum
3. RISK — Risk score and key risk factors
4. ANOMALY — Statistical anomalies that signal opportunity or danger
5. REGIME — Market regime classification and regime-fitness

YOUR JOB: Rank a universe of assets from best to worst opportunity, with conviction scores and actionable summaries.

OUTPUT STRUCTURE:
For each asset provide:
- compositeScore (0-100, weighted multi-signal score)
- rank (1 = best opportunity)
- signal breakdown (sentiment, momentum, risk, anomaly, regime)
- conviction (0-1, how confident in the ranking)
- catalysts (what could move this asset)
- risks (what could go wrong)
- actionSummary (one sentence: what to do)

Then provide portfolio-level analysis:
- topPicks (top 3-5 assets worth adding)
- avoidList (assets to stay away from)
- marketRegimeSummary (the macro backdrop)
- sectorThemes (which sectors are leading/lagging)
- diversificationNotes (are the top picks too correlated?)

SCORING METHODOLOGY:
- Sentiment: 25% weight (positive sentiment = higher score)
- Momentum: 25% weight (strong momentum = higher score)
- Risk: 20% weight (LOWER risk = higher score, inverted)
- Anomaly: 15% weight (positive anomalies boost, negative reduce)
- Regime: 15% weight (regime-appropriate assets score higher)

PRINCIPLES:
- Quantify everything. No vague assessments.
- A conflicting signal profile (bullish sentiment + bearish momentum) should lower conviction, not be averaged away.
- Regime matters more than anything — a great stock in the wrong regime is a bad trade.
- Diversification is non-negotiable. If top 3 picks are all the same sector, flag it.`;

export class MultiAssetScreenerAgent extends BaseAgent {
  constructor(orchestrator?: Orchestrator) {
    super(
      {
        name: "MultiAssetScreener",
        role: "Multi-dimensional asset screening and ranking agent",
        systemPrompt: SCREENER_SYSTEM,
        provider: "claude",
        maxTurns: 6,
      },
      orchestrator
    );
  }

  async execute(
    input: string,
    context?: Record<string, unknown>
  ): Promise<AgentResult> {
    this.reset();
    const start = performance.now();

    const [sentimentScan, momentumScan, riskScan] = await Promise.all([
      this.fastAnalyze(
        `SENTIMENT SCAN for universe: ${input}\n\nFor each asset, provide: sentiment score (-1 to +1), key driver, and time horizon. Be concise — one line per asset. Rate only based on available data, do not fabricate.`
      ),
      this.fastAnalyze(
        `MOMENTUM SCAN for universe: ${input}\n\nFor each asset, provide: composite momentum score (0-100), acceleration signal (accelerating/steady/decelerating/reversing), and key driver. One line per asset.`
      ),
      this.fastAnalyze(
        `RISK SCAN for universe: ${input}\n\nFor each asset, provide: risk score (0-100 where 100 = highest risk), top risk factor, and current volatility regime. One line per asset.`
      ),
    ]);

    const [anomalyScan, regimeScan] = await Promise.all([
      this.fastAnalyze(
        `ANOMALY SCAN for universe: ${input}\n\nFor each asset, identify any statistical anomalies: volume spikes, volatility divergences, correlation breaks, unusual flows. Score each 0-100. Only report anomalies > 30 severity. One line per asset.`
      ),
      this.reason(
        `REGIME CLASSIFICATION for universe: ${input}\n\nClassify the current market regime for each asset (trending_up, trending_down, ranging, volatile_expansion, compression, crisis, rotation). Then assess the MACRO regime — is this a risk-on or risk-off environment? How does regime affect each asset's attractiveness?`
      ),
    ]);

    const contextStr = context
      ? `\nScreening Context: ${JSON.stringify(context)}`
      : "";

    const synthesis = await this.reason(
      `SYNTHESIZE MULTI-ASSET SCREENING REPORT

Universe: ${input}
${contextStr}

INTELLIGENCE GATHERED:

SENTIMENT:
${sentimentScan.slice(0, 2000)}

MOMENTUM:
${momentumScan.slice(0, 2000)}

RISK:
${riskScan.slice(0, 2000)}

ANOMALIES:
${anomalyScan.slice(0, 2000)}

REGIME:
${regimeScan.slice(0, 2000)}

Now synthesize into a comprehensive screening report:
1. Rank all assets by composite score using the 5-dimension scoring methodology
2. Identify top picks and avoid list
3. Check diversification — are top picks too correlated?
4. Identify sector themes
5. Provide one-line action summaries for each asset

Be specific with numbers. Every ranking must be justified by the signal data above.`
    );

    return this.buildResult(synthesis, start);
  }

  async quickScreen(params: {
    tickers: string[];
    criteria?: string;
    marketContext?: string;
  }): Promise<AgentResult> {
    this.reset();
    const start = performance.now();

    const tickerList = params.tickers.join(", ");
    const criteriaStr = params.criteria
      ? `\nScreening Criteria: ${params.criteria}`
      : "";
    const contextStr = params.marketContext
      ? `\nMarket Context: ${params.marketContext}`
      : "";

    const scan = await this.reason(
      `QUICK MULTI-ASSET SCREEN

Tickers: ${tickerList}${criteriaStr}${contextStr}

For each ticker, provide:
1. Composite score (0-100)
2. Rank (1 = best)
3. One-line signal summary (sentiment/momentum/risk)
4. Conviction (low/medium/high)
5. Action (buy/hold/sell/avoid)

Then: Top pick, worst pick, and one-sentence market regime summary.

Be concise but quantitative.`
    );

    return this.buildResult(scan, start);
  }

  async sectorRotation(params: {
    sectors: string[];
    marketData?: string;
  }): Promise<AgentResult> {
    this.reset();
    const start = performance.now();

    const [momentumRead, flowRead] = await Promise.all([
      this.fastAnalyze(
        `SECTOR MOMENTUM for: ${params.sectors.join(", ")}\n\nRank each sector by momentum: relative strength vs SPX, price momentum (1m, 3m, 6m), volume trends, breadth. One line per sector with score 0-100.`
      ),
      this.research(
        `SECTOR FLOWS for: ${params.sectors.join(", ")}\n\nWhat are the latest institutional flow patterns across these sectors? Which sectors are seeing inflows vs outflows? Any notable positioning changes?`
      ),
    ]);

    const synthesis = await this.reason(
      `SECTOR ROTATION ANALYSIS

Sectors: ${params.sectors.join(", ")}
${params.marketData ? `\nMarket Data:\n${params.marketData}` : ""}

MOMENTUM DATA:
${momentumRead.slice(0, 2000)}

FLOW DATA:
${flowRead.slice(0, 2000)}

Synthesize a sector rotation recommendation:
1. Rank sectors from strongest to weakest
2. Identify the rotation theme (defensive→cyclical, growth→value, etc.)
3. Where are we in the rotation cycle?
4. Which sectors to overweight and underweight
5. What would change this recommendation?`
    );

    return this.buildResult(synthesis, start);
  }
}
