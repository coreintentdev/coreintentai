import { Orchestrator } from "../../orchestrator/index.js";
import {
  AssetIntelligenceSchema,
  PreTradeIntelligenceSchema,
  MarketStateSchema,
  type AssetIntelligence,
  type PreTradeIntelligence,
  type MarketState,
  type SentimentResult,
  type TradingSignal,
  type RiskAssessment,
  type MarketRegime,
  type AnomalyReport,
  type MomentumRanking,
  type CorrelationMatrix,
  type NarrativeReport,
  type LiquidityAssessment,
} from "../../types/index.js";
import { parseJsonResponse } from "../../utils/json-parser.js";
import { SentimentAnalyzer } from "../sentiment/index.js";
import { SignalGenerator } from "../signals/index.js";
import { RiskAssessor } from "../risk/index.js";
import { RegimeDetector } from "../regime/index.js";
import { AnomalyDetector } from "../anomaly/index.js";
import { MomentumScorer } from "../momentum/index.js";
import { CorrelationAnalyzer } from "../correlation/index.js";
import { NarrativeIntelligence } from "../narrative/index.js";
import { LiquidityAnalyzer } from "../liquidity/index.js";
import {
  ASSET_INTELLIGENCE_SYSTEM_PROMPT,
  PRE_TRADE_GATE_SYSTEM_PROMPT,
  MARKET_STATE_SYSTEM_PROMPT,
  buildAssetIntelligencePrompt,
  buildPreTradeGatePrompt,
  buildMarketStatePrompt,
} from "./prompts.js";

interface CapabilityResult<T> {
  data: T | null;
  error: string | null;
  latencyMs: number;
}

async function runCapability<T>(
  _name: string,
  fn: () => Promise<T>
): Promise<CapabilityResult<T>> {
  const start = performance.now();
  try {
    const data = await fn();
    return { data, error: null, latencyMs: Math.round(performance.now() - start) };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: Math.round(performance.now() - start),
    };
  }
}

export class IntelligenceFusion {
  private orchestrator: Orchestrator;
  private sentiment: SentimentAnalyzer;
  private signals: SignalGenerator;
  private risk: RiskAssessor;
  private regime: RegimeDetector;
  private anomaly: AnomalyDetector;
  private momentum: MomentumScorer;
  private correlation: CorrelationAnalyzer;
  private narrative: NarrativeIntelligence;
  private liquidity: LiquidityAnalyzer;

  constructor(orchestrator?: Orchestrator) {
    this.orchestrator = orchestrator ?? new Orchestrator();
    this.sentiment = new SentimentAnalyzer(this.orchestrator);
    this.signals = new SignalGenerator(this.orchestrator);
    this.risk = new RiskAssessor(this.orchestrator);
    this.regime = new RegimeDetector(this.orchestrator);
    this.anomaly = new AnomalyDetector(this.orchestrator);
    this.momentum = new MomentumScorer(this.orchestrator);
    this.correlation = new CorrelationAnalyzer(this.orchestrator);
    this.narrative = new NarrativeIntelligence(this.orchestrator);
    this.liquidity = new LiquidityAnalyzer(this.orchestrator);
  }

  async assetIntelligence(params: {
    ticker: string;
    currentPrice: number;
    positionSize?: number;
    portfolioValue?: number;
    timeframe?: "scalp" | "day" | "swing" | "position";
    context?: string;
    marketContext?: string;
  }): Promise<{
    report: AssetIntelligence;
    capabilities: Record<string, CapabilityResult<unknown>>;
    totalLatencyMs: number;
  }> {
    const start = performance.now();
    const timeframe = params.timeframe ?? "swing";
    const positionSize = params.positionSize ?? 1000;
    const portfolioValue = params.portfolioValue ?? 100000;

    const [sentimentResult, regimeResult, momentumResult, signalResult, riskResult, anomalyResult] =
      await Promise.all([
        runCapability("sentiment", () =>
          this.sentiment.analyze({
            ticker: params.ticker,
            context: params.marketContext,
          })
        ),
        runCapability("regime", () =>
          this.regime.detect({
            ticker: params.ticker,
            currentPrice: params.currentPrice,
          })
        ),
        runCapability("momentum", () =>
          this.momentum.rank({
            tickers: [{ ticker: params.ticker, currentPrice: params.currentPrice }],
          }).then((report) => report.rankings[0] ?? null)
        ),
        runCapability("signal", () =>
          this.signals.generate({
            ticker: params.ticker,
            currentPrice: params.currentPrice,
            timeframe,
            marketContext: params.marketContext,
          })
        ),
        runCapability("risk", () =>
          this.risk.assessPosition({
            ticker: params.ticker,
            currentPrice: params.currentPrice,
            positionSize,
            portfolioValue,
          })
        ),
        runCapability("anomaly", () =>
          this.anomaly.scan({
            ticker: params.ticker,
            currentPrice: params.currentPrice,
          })
        ),
      ]);

    const synthesisResponse = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: ASSET_INTELLIGENCE_SYSTEM_PROMPT,
      prompt: buildAssetIntelligencePrompt({
        ticker: params.ticker,
        sentiment: sentimentResult.data as SentimentResult | null,
        regime: regimeResult.data as MarketRegime | null,
        momentum: momentumResult.data as MomentumRanking | null,
        signal: signalResult.data as TradingSignal | null,
        risk: riskResult.data as RiskAssessment | null,
        anomaly: anomalyResult.data as AnomalyReport | null,
        context: params.context,
      }),
    });

    const report = parseJsonResponse(synthesisResponse.content, AssetIntelligenceSchema);

    return {
      report,
      capabilities: {
        sentiment: sentimentResult,
        regime: regimeResult,
        momentum: momentumResult,
        signal: signalResult,
        risk: riskResult,
        anomaly: anomalyResult,
      },
      totalLatencyMs: Math.round(performance.now() - start),
    };
  }

  async preTradeGate(params: {
    ticker: string;
    action: "buy" | "sell";
    currentPrice: number;
    quantity?: number;
    positionSize?: number;
    portfolioValue?: number;
    timeframe?: "scalp" | "day" | "swing" | "position";
    context?: string;
  }): Promise<{
    decision: PreTradeIntelligence;
    capabilities: Record<string, CapabilityResult<unknown>>;
    totalLatencyMs: number;
  }> {
    const start = performance.now();
    const timeframe = params.timeframe ?? "swing";
    const positionSize = params.positionSize ?? 1000;
    const portfolioValue = params.portfolioValue ?? 100000;

    const [signalResult, riskResult, liquidityResult, anomalyResult] =
      await Promise.all([
        runCapability("signal", () =>
          this.signals.generate({
            ticker: params.ticker,
            currentPrice: params.currentPrice,
            timeframe,
          })
        ),
        runCapability("risk", () =>
          this.risk.assessPosition({
            ticker: params.ticker,
            currentPrice: params.currentPrice,
            positionSize,
            portfolioValue,
          })
        ),
        runCapability("liquidity", () =>
          this.liquidity.assess({
            ticker: params.ticker,
            currentPrice: params.currentPrice,
          })
        ),
        runCapability("anomaly", () =>
          this.anomaly.scan({
            ticker: params.ticker,
            currentPrice: params.currentPrice,
          })
        ),
      ]);

    const liquidityData = liquidityResult.data as LiquidityAssessment | null;

    const synthesisResponse = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: PRE_TRADE_GATE_SYSTEM_PROMPT,
      prompt: buildPreTradeGatePrompt({
        ticker: params.ticker,
        action: params.action,
        signal: signalResult.data as TradingSignal | null,
        risk: riskResult.data as RiskAssessment | null,
        liquidity: liquidityData
          ? {
              regime: liquidityData.regime,
              depthScore: liquidityData.depthScore,
              spreadBps: liquidityData.spreadBps,
              executionWindows: liquidityData.executionWindows,
            }
          : null,
        anomaly: anomalyResult.data as AnomalyReport | null,
        quantity: params.quantity,
        context: params.context,
      }),
    });

    const decision = parseJsonResponse(synthesisResponse.content, PreTradeIntelligenceSchema);

    return {
      decision,
      capabilities: {
        signal: signalResult,
        risk: riskResult,
        liquidity: liquidityResult,
        anomaly: anomalyResult,
      },
      totalLatencyMs: Math.round(performance.now() - start),
    };
  }

  async marketState(params: {
    tickers: Array<{ ticker: string; currentPrice: number }>;
    context?: string;
  }): Promise<{
    state: MarketState;
    capabilities: Record<string, CapabilityResult<unknown>>;
    totalLatencyMs: number;
  }> {
    const start = performance.now();
    const tickerNames = params.tickers.map((t) => t.ticker);

    const [regimeResults, anomalyResults, correlationResult, narrativeResult] =
      await Promise.all([
        Promise.all(
          params.tickers.map((t) =>
            runCapability(`regime:${t.ticker}`, () =>
              this.regime.detect({ ticker: t.ticker, currentPrice: t.currentPrice })
            ).then((r) => ({ ticker: t.ticker, result: r }))
          )
        ),
        Promise.all(
          params.tickers.map((t) =>
            runCapability(`anomaly:${t.ticker}`, () =>
              this.anomaly.scan({ ticker: t.ticker, currentPrice: t.currentPrice })
            ).then((r) => ({ ticker: t.ticker, result: r }))
          )
        ),
        runCapability("correlation", () =>
          this.correlation.analyze({ tickers: tickerNames })
        ),
        runCapability("narrative", () =>
          this.narrative.detect({ ticker: tickerNames[0] })
        ),
      ]);

    const correlationData = correlationResult.data as CorrelationMatrix | null;
    const narrativeData = narrativeResult.data as NarrativeReport | null;

    const synthesisResponse = await this.orchestrator.execute({
      intent: "reasoning",
      systemPrompt: MARKET_STATE_SYSTEM_PROMPT,
      prompt: buildMarketStatePrompt({
        tickers: tickerNames,
        regimes: regimeResults.map((r) => ({
          ticker: r.ticker,
          data: r.result.data as MarketRegime | null,
        })),
        correlation: correlationData
          ? {
              diversificationScore: correlationData.diversificationScore,
              clusters: correlationData.clusters,
              hiddenRisks: correlationData.hiddenRisks.map((hr) => ({
                description: hr.description,
                severity: hr.severity,
              })),
            }
          : null,
        narrative: narrativeData
          ? {
              narratives: narrativeData.narratives.map((n) => ({
                name: n.name,
                stage: n.stage,
                strength: n.strength,
              })),
              dominantNarrative: narrativeData.dominantNarrative,
              shiftSignals: narrativeData.shiftSignals.map((s) => ({
                narrative: s.narrative,
                direction: s.direction,
              })),
            }
          : null,
        anomalies: anomalyResults.map((a) => ({
          ticker: a.ticker,
          data: a.result.data as AnomalyReport | null,
        })),
        context: params.context,
      }),
    });

    const state = parseJsonResponse(synthesisResponse.content, MarketStateSchema);

    const capabilities: Record<string, CapabilityResult<unknown>> = {
      correlation: correlationResult,
      narrative: narrativeResult,
    };
    for (const r of regimeResults) {
      capabilities[`regime:${r.ticker}`] = r.result;
    }
    for (const a of anomalyResults) {
      capabilities[`anomaly:${a.ticker}`] = a.result;
    }

    return {
      state,
      capabilities,
      totalLatencyMs: Math.round(performance.now() - start),
    };
  }
}

export {
  ASSET_INTELLIGENCE_SYSTEM_PROMPT,
  PRE_TRADE_GATE_SYSTEM_PROMPT,
  MARKET_STATE_SYSTEM_PROMPT,
} from "./prompts.js";
