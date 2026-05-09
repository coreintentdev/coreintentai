import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AssetIntelligenceSchema,
  PreTradeIntelligenceSchema,
  MarketStateSchema,
  IntelligenceConflictSchema,
  CapabilitySummarySchema,
  ConvictionLevel,
  TradeGateDecision,
  MarketPhase,
} from "../src/types/index.js";
import { IntelligenceFusion } from "../src/capabilities/fusion/index.js";
import {
  ASSET_INTELLIGENCE_SYSTEM_PROMPT,
  PRE_TRADE_GATE_SYSTEM_PROMPT,
  MARKET_STATE_SYSTEM_PROMPT,
  buildAssetIntelligencePrompt,
  buildPreTradeGatePrompt,
  buildMarketStatePrompt,
} from "../src/capabilities/fusion/prompts.js";
import * as modelsModule from "../src/models/index.js";
import type { CompletionResponse } from "../src/models/base.js";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

function makeMockResponse(
  content: string,
  provider: "claude" | "grok" | "perplexity" = "claude"
): CompletionResponse {
  return {
    content,
    provider,
    model: `mock-${provider}`,
    tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
    latencyMs: 50,
    finishReason: "end_turn",
  };
}

const VALID_SENTIMENT = {
  ticker: "AAPL",
  sentiment: "bullish" as const,
  confidence: 0.82,
  score: 0.65,
  drivers: [
    { factor: "Strong earnings", impact: "positive" as const, weight: 0.5 },
    { factor: "Guidance raised", impact: "positive" as const, weight: 0.3 },
  ],
  summary: "Bullish on AAPL",
  timeHorizon: "short_term" as const,
  timestamp: "2026-04-19T12:00:00.000Z",
};

const VALID_REGIME = {
  ticker: "AAPL",
  regime: "trending_up" as const,
  confidence: 0.78,
  volatilityRegime: "normal" as const,
  trendStrength: 0.72,
  regimeAge: "3 weeks",
  transitionProbability: 0.15,
  transitionTargets: [
    { regime: "ranging", probability: 0.1, trigger: "Earnings miss" },
  ],
  indicators: [{ name: "SMA200", value: "above", signal: "bullish" }],
  strategyImplications: {
    recommended: ["trend following"],
    avoid: ["mean reversion"],
    positionSizing: "standard",
    stopLossApproach: "trailing",
  },
  summary: "Trending up",
  timestamp: "2026-04-19T12:00:00.000Z",
};

const VALID_SIGNAL = {
  ticker: "AAPL",
  action: "buy" as const,
  confidence: 0.75,
  entryPrice: 185.0,
  stopLoss: 178.0,
  takeProfit: [195.0, 205.0],
  timeframe: "swing" as const,
  reasoning: "Breakout above resistance",
  technicalFactors: [
    { indicator: "RSI", value: "55", signal: "bullish" as const },
  ],
  riskRewardRatio: 2.5,
  timestamp: "2026-04-19T12:00:00.000Z",
};

const VALID_RISK = {
  ticker: "AAPL",
  portfolioScope: false,
  overallRisk: "moderate" as const,
  riskScore: 42,
  components: [
    {
      category: "market_risk" as const,
      level: "moderate" as const,
      score: 45,
      description: "Normal market conditions",
    },
  ],
  positionSizing: {
    maxPositionPct: 5,
    recommendedPositionPct: 3,
    kellyFraction: 0.12,
  },
  warnings: ["Earnings in 2 weeks"],
  recommendations: ["Use trailing stops"],
  timestamp: "2026-04-19T12:00:00.000Z",
};

const VALID_ANOMALY = {
  ticker: "AAPL",
  anomalies: [
    {
      type: "volume_spike" as const,
      severity: 35,
      description: "Volume 1.5x average",
      evidence: ["Institutional buying"],
      possibleCauses: ["Rebalancing"],
      actionable: false,
    },
  ],
  overallAnomalyScore: 25,
  marketContext: "Normal conditions",
  crossAssetSignals: [],
  alertLevel: "watch" as const,
  summary: "Minor volume anomaly",
  timestamp: "2026-04-19T12:00:00.000Z",
};

const VALID_MOMENTUM = {
  ticker: "AAPL",
  compositeScore: 72,
  rank: 1,
  priceScore: 75,
  volumeScore: 68,
  relativeStrengthScore: 71,
  accelerationSignal: "accelerating" as const,
  timeframeAlignment: "aligned" as const,
  exhaustionRisk: 0.2,
  keyDriver: "Price breakout",
  watchFor: "Divergence on RSI",
};

const VALID_ASSET_INTELLIGENCE = {
  ticker: "AAPL",
  convictionScore: 65,
  convictionLevel: "moderate_conviction_long" as const,
  opportunityScore: 72,
  riskAdjustedScore: 38,
  capabilitySummary: {
    sentiment: { score: 0.65, signal: "bullish", confidence: 0.82 },
    regime: { type: "trending_up", volatilityRegime: "normal", confidence: 0.78 },
    momentum: { score: 72, acceleration: "accelerating", exhaustionRisk: 0.2 },
    signal: { action: "buy", confidence: 0.75, riskReward: 2.5 },
    risk: { level: "moderate", score: 42, criticalWarnings: [] },
    anomaly: { alertLevel: "watch", score: 25, activeAnomalies: ["volume_spike"] },
  },
  conflicts: [
    {
      capabilityA: "signal",
      capabilityB: "anomaly",
      conflict: "Buy signal during volume anomaly",
      severity: "minor" as const,
      resolution: "Volume spike is institutional buying — supports signal",
      impact: "Increases conviction slightly",
    },
  ],
  synthesis:
    "AAPL shows strong alignment across capabilities. Bullish sentiment, trending up regime, and buy signal all converge. Risk is moderate and manageable. Minor volume anomaly actually supports the thesis.",
  actionableRecommendation:
    "Enter long position at $185 with $178 stop-loss. Target $195-$205.",
  keyRisks: ["Earnings in 2 weeks", "Market risk moderate"],
  catalysts: ["Earnings beat expectations", "New product launch"],
  invalidationPoints: ["Break below $178", "Regime shift to ranging"],
  confidence: 0.74,
  timestamp: "2026-04-19T12:00:00.000Z",
};

const VALID_PRE_TRADE = {
  ticker: "AAPL",
  action: "buy" as const,
  decision: "approved" as const,
  readinessScore: 78,
  signalAlignment: {
    signalAction: "buy",
    signalConfidence: 0.75,
    matchesIntent: true,
  },
  riskProfile: {
    overallRisk: "moderate",
    riskScore: 42,
    positionSizePct: 3,
    warnings: ["Earnings in 2 weeks"],
  },
  liquidityProfile: {
    regime: "normal",
    expectedSlippageBps: 2,
    executionWindow: "10:00-11:30 ET",
  },
  anomalyCheck: {
    alertLevel: "watch",
    blockers: [],
  },
  blockingFactors: [],
  proceedConditions: [
    "Price above $183 support",
    "Volume confirms breakout",
  ],
  executionGuidance: {
    algorithm: "VWAP",
    timing: "First 90 minutes of session",
    urgency: "normal",
    notes: "Split across 3 tranches",
  },
  synthesis:
    "Trade approved with normal conditions. Signal aligns with intent, risk manageable, liquidity adequate.",
  timestamp: "2026-04-19T12:00:00.000Z",
};

const VALID_MARKET_STATE = {
  tickers: ["AAPL", "MSFT", "GOOGL"],
  systemicRiskScore: 35,
  marketPhase: "cautious" as const,
  regimeMap: [
    { ticker: "AAPL", regime: "trending_up", confidence: 0.78 },
    { ticker: "MSFT", regime: "ranging", confidence: 0.65 },
    { ticker: "GOOGL", regime: "trending_up", confidence: 0.71 },
  ],
  correlationInsights: {
    diversificationScore: 0.45,
    dominantCluster: "Tech mega-caps",
    hiddenRisks: ["High sector concentration"],
  },
  narrativeLandscape: {
    dominantNarrative: "AI infrastructure spending",
    narrativeCount: 4,
    shiftSignals: ["Rotation from growth to value"],
  },
  anomalyHeatMap: [
    { ticker: "AAPL", alertLevel: "watch", topAnomaly: "volume_spike" },
    { ticker: "MSFT", alertLevel: "none" },
    { ticker: "GOOGL", alertLevel: "none" },
  ],
  synthesis:
    "Mixed market with tech bias. Regime divergence between AAPL/GOOGL (trending) and MSFT (ranging). High correlation risk.",
  actionableInsights: [
    "Reduce tech concentration",
    "Watch for rotation signal",
  ],
  watchList: ["MSFT regime transition", "AI narrative crowding"],
  timestamp: "2026-04-19T12:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Schema tests
// ---------------------------------------------------------------------------

describe("Intelligence Fusion Schemas", () => {
  describe("ConvictionLevel", () => {
    it("accepts all valid conviction levels", () => {
      const levels = [
        "high_conviction_long",
        "moderate_conviction_long",
        "low_conviction_long",
        "neutral",
        "low_conviction_short",
        "moderate_conviction_short",
        "high_conviction_short",
      ];
      for (const level of levels) {
        expect(ConvictionLevel.parse(level)).toBe(level);
      }
    });

    it("rejects invalid conviction level", () => {
      expect(() => ConvictionLevel.parse("maybe_bullish")).toThrow();
    });
  });

  describe("TradeGateDecision", () => {
    it("accepts valid decisions", () => {
      expect(TradeGateDecision.parse("approved")).toBe("approved");
      expect(TradeGateDecision.parse("caution")).toBe("caution");
      expect(TradeGateDecision.parse("blocked")).toBe("blocked");
    });

    it("rejects invalid decisions", () => {
      expect(() => TradeGateDecision.parse("maybe")).toThrow();
    });
  });

  describe("MarketPhase", () => {
    it("accepts all valid phases", () => {
      const phases = ["risk_on", "cautious", "risk_off", "crisis", "transitioning"];
      for (const phase of phases) {
        expect(MarketPhase.parse(phase)).toBe(phase);
      }
    });
  });

  describe("IntelligenceConflictSchema", () => {
    it("validates a complete conflict", () => {
      const conflict = {
        capabilityA: "signal",
        capabilityB: "risk",
        conflict: "Signal says buy but risk is critical",
        severity: "critical",
        resolution: "Risk overrides — do not trade",
        impact: "Blocks trade execution",
      };
      expect(() => IntelligenceConflictSchema.parse(conflict)).not.toThrow();
    });

    it("requires all severity levels", () => {
      for (const severity of ["minor", "moderate", "critical"]) {
        const conflict = {
          capabilityA: "a",
          capabilityB: "b",
          conflict: "test",
          severity,
          resolution: "test",
          impact: "test",
        };
        expect(() => IntelligenceConflictSchema.parse(conflict)).not.toThrow();
      }
    });

    it("rejects invalid severity", () => {
      const conflict = {
        capabilityA: "a",
        capabilityB: "b",
        conflict: "test",
        severity: "high",
        resolution: "test",
        impact: "test",
      };
      expect(() => IntelligenceConflictSchema.parse(conflict)).toThrow();
    });
  });

  describe("CapabilitySummarySchema", () => {
    it("validates complete capability summary", () => {
      const summary = VALID_ASSET_INTELLIGENCE.capabilitySummary;
      expect(() => CapabilitySummarySchema.parse(summary)).not.toThrow();
    });

    it("enforces score bounds", () => {
      const bad = {
        ...VALID_ASSET_INTELLIGENCE.capabilitySummary,
        sentiment: { score: 2.0, signal: "bullish", confidence: 0.5 },
      };
      expect(() => CapabilitySummarySchema.parse(bad)).toThrow();
    });
  });

  describe("AssetIntelligenceSchema", () => {
    it("validates complete asset intelligence report", () => {
      const result = AssetIntelligenceSchema.parse(VALID_ASSET_INTELLIGENCE);
      expect(result.ticker).toBe("AAPL");
      expect(result.convictionScore).toBe(65);
      expect(result.convictionLevel).toBe("moderate_conviction_long");
      expect(result.conflicts).toHaveLength(1);
    });

    it("enforces conviction score range (-100 to 100)", () => {
      expect(() =>
        AssetIntelligenceSchema.parse({
          ...VALID_ASSET_INTELLIGENCE,
          convictionScore: 150,
        })
      ).toThrow();

      expect(() =>
        AssetIntelligenceSchema.parse({
          ...VALID_ASSET_INTELLIGENCE,
          convictionScore: -150,
        })
      ).toThrow();

      // Negative conviction (short) is valid
      const shortResult = AssetIntelligenceSchema.parse({
        ...VALID_ASSET_INTELLIGENCE,
        convictionScore: -75,
        convictionLevel: "moderate_conviction_short",
      });
      expect(shortResult.convictionScore).toBe(-75);
    });

    it("enforces risk-adjusted score range", () => {
      expect(() =>
        AssetIntelligenceSchema.parse({
          ...VALID_ASSET_INTELLIGENCE,
          riskAdjustedScore: 200,
        })
      ).toThrow();
    });

    it("validates with empty conflicts array", () => {
      const result = AssetIntelligenceSchema.parse({
        ...VALID_ASSET_INTELLIGENCE,
        conflicts: [],
      });
      expect(result.conflicts).toHaveLength(0);
    });

    it("validates with multiple invalidation points", () => {
      const result = AssetIntelligenceSchema.parse(VALID_ASSET_INTELLIGENCE);
      expect(result.invalidationPoints.length).toBeGreaterThan(0);
    });

    it("requires timestamp", () => {
      const { timestamp: _, ...noTimestamp } = VALID_ASSET_INTELLIGENCE;
      expect(() => AssetIntelligenceSchema.parse(noTimestamp)).toThrow();
    });
  });

  describe("PreTradeIntelligenceSchema", () => {
    it("validates complete pre-trade decision", () => {
      const result = PreTradeIntelligenceSchema.parse(VALID_PRE_TRADE);
      expect(result.decision).toBe("approved");
      expect(result.readinessScore).toBe(78);
      expect(result.signalAlignment.matchesIntent).toBe(true);
    });

    it("validates blocked decision", () => {
      const blocked = {
        ...VALID_PRE_TRADE,
        decision: "blocked",
        readinessScore: 15,
        blockingFactors: ["Risk is critical", "Liquidity crisis"],
      };
      const result = PreTradeIntelligenceSchema.parse(blocked);
      expect(result.decision).toBe("blocked");
      expect(result.blockingFactors).toHaveLength(2);
    });

    it("enforces readiness score range", () => {
      expect(() =>
        PreTradeIntelligenceSchema.parse({
          ...VALID_PRE_TRADE,
          readinessScore: 120,
        })
      ).toThrow();

      expect(() =>
        PreTradeIntelligenceSchema.parse({
          ...VALID_PRE_TRADE,
          readinessScore: -5,
        })
      ).toThrow();
    });

    it("validates caution with execution guidance", () => {
      const caution = {
        ...VALID_PRE_TRADE,
        decision: "caution",
        readinessScore: 55,
        executionGuidance: {
          algorithm: "Iceberg",
          timing: "Spread across session",
          urgency: "patient",
          notes: "Use limit orders only",
        },
      };
      const result = PreTradeIntelligenceSchema.parse(caution);
      expect(result.executionGuidance.algorithm).toBe("Iceberg");
    });

    it("validates buy and sell actions", () => {
      expect(
        PreTradeIntelligenceSchema.parse({ ...VALID_PRE_TRADE, action: "buy" })
          .action
      ).toBe("buy");
      expect(
        PreTradeIntelligenceSchema.parse({
          ...VALID_PRE_TRADE,
          action: "sell",
        }).action
      ).toBe("sell");
    });
  });

  describe("MarketStateSchema", () => {
    it("validates complete market state", () => {
      const result = MarketStateSchema.parse(VALID_MARKET_STATE);
      expect(result.tickers).toHaveLength(3);
      expect(result.marketPhase).toBe("cautious");
      expect(result.systemicRiskScore).toBe(35);
    });

    it("validates all market phases", () => {
      for (const phase of ["risk_on", "cautious", "risk_off", "crisis", "transitioning"]) {
        const result = MarketStateSchema.parse({
          ...VALID_MARKET_STATE,
          marketPhase: phase,
        });
        expect(result.marketPhase).toBe(phase);
      }
    });

    it("enforces systemic risk range", () => {
      expect(() =>
        MarketStateSchema.parse({
          ...VALID_MARKET_STATE,
          systemicRiskScore: 150,
        })
      ).toThrow();
    });

    it("validates anomaly heat map with optional top anomaly", () => {
      const result = MarketStateSchema.parse(VALID_MARKET_STATE);
      expect(result.anomalyHeatMap[0].topAnomaly).toBe("volume_spike");
      expect(result.anomalyHeatMap[1].topAnomaly).toBeUndefined();
    });

    it("validates correlation insights", () => {
      const result = MarketStateSchema.parse(VALID_MARKET_STATE);
      expect(result.correlationInsights.diversificationScore).toBe(0.45);
      expect(result.correlationInsights.hiddenRisks).toHaveLength(1);
    });

    it("validates empty watch list", () => {
      const result = MarketStateSchema.parse({
        ...VALID_MARKET_STATE,
        watchList: [],
      });
      expect(result.watchList).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Prompt builder tests
// ---------------------------------------------------------------------------

describe("Fusion Prompt Builders", () => {
  describe("buildAssetIntelligencePrompt", () => {
    it("includes all capability outputs when available", () => {
      const prompt = buildAssetIntelligencePrompt({
        ticker: "AAPL",
        sentiment: VALID_SENTIMENT,
        regime: VALID_REGIME,
        momentum: VALID_MOMENTUM,
        signal: VALID_SIGNAL,
        risk: VALID_RISK,
        anomaly: VALID_ANOMALY,
      });

      expect(prompt).toContain("ASSET: AAPL");
      expect(prompt).toContain("--- SENTIMENT ---");
      expect(prompt).toContain("--- REGIME ---");
      expect(prompt).toContain("--- MOMENTUM ---");
      expect(prompt).toContain("--- SIGNAL ---");
      expect(prompt).toContain("--- RISK ---");
      expect(prompt).toContain("--- ANOMALY ---");
      expect(prompt).toContain("6/6 capabilities returned data");
      expect(prompt).not.toContain("[UNAVAILABLE");
    });

    it("marks missing capabilities as unavailable", () => {
      const prompt = buildAssetIntelligencePrompt({
        ticker: "AAPL",
        sentiment: VALID_SENTIMENT,
        regime: null,
        momentum: null,
        signal: VALID_SIGNAL,
        risk: null,
        anomaly: null,
      });

      expect(prompt).toContain("[UNAVAILABLE");
      expect(prompt).toContain("2/6 capabilities returned data");
      expect(prompt).toContain("WARNING: Reduced capability coverage");
    });

    it("includes context when provided", () => {
      const prompt = buildAssetIntelligencePrompt({
        ticker: "AAPL",
        sentiment: null,
        regime: null,
        momentum: null,
        signal: null,
        risk: null,
        anomaly: null,
        context: "Portfolio is overweight tech",
      });

      expect(prompt).toContain("ADDITIONAL CONTEXT");
      expect(prompt).toContain("Portfolio is overweight tech");
    });

    it("includes actual data from capabilities in the prompt", () => {
      const prompt = buildAssetIntelligencePrompt({
        ticker: "AAPL",
        sentiment: VALID_SENTIMENT,
        regime: null,
        momentum: null,
        signal: null,
        risk: null,
        anomaly: null,
      });

      expect(prompt).toContain("bullish");
      expect(prompt).toContain("0.82");
    });
  });

  describe("buildPreTradeGatePrompt", () => {
    it("builds complete pre-trade prompt", () => {
      const prompt = buildPreTradeGatePrompt({
        ticker: "AAPL",
        action: "buy",
        signal: VALID_SIGNAL,
        risk: VALID_RISK,
        liquidity: {
          regime: "normal",
          depthScore: 75,
          spreadBps: 1.5,
          executionWindows: [
            { window: "10:00-11:30", quality: "excellent" },
          ],
        },
        anomaly: VALID_ANOMALY,
      });

      expect(prompt).toContain("PRE-TRADE GATE CHECK");
      expect(prompt).toContain("Intended Action: BUY");
      expect(prompt).toContain("--- SIGNAL ANALYSIS ---");
      expect(prompt).toContain("--- RISK ASSESSMENT ---");
      expect(prompt).toContain("--- LIQUIDITY ---");
      expect(prompt).toContain("--- ANOMALY CHECK ---");
    });

    it("handles missing capabilities with fallback warnings", () => {
      const prompt = buildPreTradeGatePrompt({
        ticker: "AAPL",
        action: "sell",
        signal: null,
        risk: null,
        liquidity: null,
        anomaly: null,
      });

      expect(prompt).toContain("Intended Action: SELL");
      expect(prompt).toContain("[UNAVAILABLE — treat as blocking factor]");
      expect(prompt).toContain("[UNAVAILABLE — assume thin liquidity]");
    });

    it("includes quantity when provided", () => {
      const prompt = buildPreTradeGatePrompt({
        ticker: "AAPL",
        action: "buy",
        signal: null,
        risk: null,
        liquidity: null,
        anomaly: null,
        quantity: 500,
      });

      expect(prompt).toContain("Quantity: 500");
    });
  });

  describe("buildMarketStatePrompt", () => {
    it("builds complete market state prompt", () => {
      const prompt = buildMarketStatePrompt({
        tickers: ["AAPL", "MSFT"],
        regimes: [
          { ticker: "AAPL", data: VALID_REGIME },
          { ticker: "MSFT", data: null },
        ],
        correlation: {
          diversificationScore: 0.45,
          clusters: [{ name: "Tech", tickers: ["AAPL", "MSFT"] }],
          hiddenRisks: [{ description: "High sector risk", severity: "high" }],
        },
        narrative: {
          narratives: [
            { name: "AI boom", stage: "accelerating", strength: 85 },
          ],
          dominantNarrative: "AI boom",
          shiftSignals: [{ narrative: "AI boom", direction: "advancing" }],
        },
        anomalies: [
          { ticker: "AAPL", data: VALID_ANOMALY },
          { ticker: "MSFT", data: null },
        ],
      });

      expect(prompt).toContain("MARKET STATE ASSESSMENT");
      expect(prompt).toContain("Universe: AAPL, MSFT");
      expect(prompt).toContain("=== REGIME MAP ===");
      expect(prompt).toContain("AAPL: trending_up");
      expect(prompt).toContain("MSFT: [UNAVAILABLE]");
      expect(prompt).toContain("=== CORRELATION ===");
      expect(prompt).toContain("=== NARRATIVE LANDSCAPE ===");
      expect(prompt).toContain("=== ANOMALY HEAT MAP ===");
    });
  });
});

// ---------------------------------------------------------------------------
// System prompt tests
// ---------------------------------------------------------------------------

describe("Fusion System Prompts", () => {
  it("asset intelligence prompt contains synthesis framework", () => {
    expect(ASSET_INTELLIGENCE_SYSTEM_PROMPT).toContain("AGREEMENT AMPLIFICATION");
    expect(ASSET_INTELLIGENCE_SYSTEM_PROMPT).toContain("CONFLICT SURFACING");
    expect(ASSET_INTELLIGENCE_SYSTEM_PROMPT).toContain("REGIME CONTEXT");
    expect(ASSET_INTELLIGENCE_SYSTEM_PROMPT).toContain("RISK DOMINANCE");
    expect(ASSET_INTELLIGENCE_SYSTEM_PROMPT).toContain("ANOMALY ATTENTION");
    expect(ASSET_INTELLIGENCE_SYSTEM_PROMPT).toContain("CONVICTION SCORING");
  });

  it("pre-trade prompt contains decision framework", () => {
    expect(PRE_TRADE_GATE_SYSTEM_PROMPT).toContain("APPROVED");
    expect(PRE_TRADE_GATE_SYSTEM_PROMPT).toContain("CAUTION");
    expect(PRE_TRADE_GATE_SYSTEM_PROMPT).toContain("BLOCKED");
    expect(PRE_TRADE_GATE_SYSTEM_PROMPT).toContain("READINESS SCORE");
    expect(PRE_TRADE_GATE_SYSTEM_PROMPT).toContain("BLOCKING FACTORS");
    expect(PRE_TRADE_GATE_SYSTEM_PROMPT).toContain("last line of defense");
  });

  it("market state prompt contains classification framework", () => {
    expect(MARKET_STATE_SYSTEM_PROMPT).toContain("risk_on");
    expect(MARKET_STATE_SYSTEM_PROMPT).toContain("crisis");
    expect(MARKET_STATE_SYSTEM_PROMPT).toContain("transitioning");
    expect(MARKET_STATE_SYSTEM_PROMPT).toContain("SYSTEMIC RISK SCORE");
  });
});

// ---------------------------------------------------------------------------
// IntelligenceFusion class tests
// ---------------------------------------------------------------------------

describe("IntelligenceFusion", () => {
  let mockAdapter: {
    complete: ReturnType<typeof vi.fn>;
    ping: ReturnType<typeof vi.fn>;
    provider: string;
    model: string;
    config: { provider: string };
  };

  beforeEach(() => {
    mockAdapter = {
      complete: vi.fn(),
      ping: vi.fn().mockResolvedValue(true),
      provider: "claude",
      model: "mock-claude",
      config: { provider: "claude" },
    };
    vi.spyOn(modelsModule, "getAdapter").mockReturnValue(mockAdapter as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("instantiates with default orchestrator", () => {
    const fusion = new IntelligenceFusion();
    expect(fusion).toBeInstanceOf(IntelligenceFusion);
  });

  describe("assetIntelligence", () => {
    it("calls all 6 capabilities + synthesis and returns structured report", async () => {
      let callCount = 0;
      mockAdapter.complete.mockImplementation(() => {
        callCount++;
        if (callCount <= 6) {
          const mockData = [
            VALID_SENTIMENT,
            VALID_REGIME,
            { rankings: [VALID_MOMENTUM], topPick: "AAPL", avoidList: [], sectorRotation: { leading: [], lagging: [], emerging: [] }, marketBreadth: { score: 70, assessment: "healthy" }, summary: "Good", timestamp: "2026-04-19T12:00:00.000Z" },
            VALID_SIGNAL,
            VALID_RISK,
            VALID_ANOMALY,
          ][callCount - 1];
          return Promise.resolve(
            makeMockResponse(JSON.stringify(mockData))
          );
        }
        return Promise.resolve(
          makeMockResponse(JSON.stringify(VALID_ASSET_INTELLIGENCE))
        );
      });

      const fusion = new IntelligenceFusion();
      const result = await fusion.assetIntelligence({
        ticker: "AAPL",
        currentPrice: 185.0,
      });

      expect(result.report.ticker).toBe("AAPL");
      expect(result.report.convictionLevel).toBe("moderate_conviction_long");
      expect(result.capabilities).toHaveProperty("sentiment");
      expect(result.capabilities).toHaveProperty("regime");
      expect(result.capabilities).toHaveProperty("momentum");
      expect(result.capabilities).toHaveProperty("signal");
      expect(result.capabilities).toHaveProperty("risk");
      expect(result.capabilities).toHaveProperty("anomaly");
      expect(result.totalLatencyMs).toBeGreaterThanOrEqual(0);
      // 6 capability calls + 1 synthesis = 7 total
      expect(callCount).toBe(7);
    });

    it("degrades gracefully when capabilities fail", async () => {
      let callCount = 0;
      mockAdapter.complete.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(makeMockResponse(JSON.stringify(VALID_SENTIMENT)));
        }
        if (callCount <= 6) {
          return Promise.reject(new Error("Provider unavailable"));
        }
        return Promise.resolve(
          makeMockResponse(
            JSON.stringify({
              ...VALID_ASSET_INTELLIGENCE,
              confidence: 0.35,
            })
          )
        );
      });

      const fusion = new IntelligenceFusion();
      const result = await fusion.assetIntelligence({
        ticker: "AAPL",
        currentPrice: 185.0,
      });

      expect(result.report.confidence).toBe(0.35);
      expect(result.capabilities.sentiment.data).not.toBeNull();
      expect(result.capabilities.regime.error).toBeTruthy();
      expect(result.capabilities.signal.error).toBeTruthy();
    });

    it("accepts optional positionSize and portfolioValue", async () => {
      mockAdapter.complete.mockResolvedValue(
        makeMockResponse(JSON.stringify(VALID_ASSET_INTELLIGENCE))
      );

      const fusion = new IntelligenceFusion();
      const result = await fusion.assetIntelligence({
        ticker: "AAPL",
        currentPrice: 185.0,
        positionSize: 5000,
        portfolioValue: 200000,
        timeframe: "day",
      });

      expect(result.report.ticker).toBe("AAPL");
    });
  });

  describe("preTradeGate", () => {
    it("returns structured pre-trade decision", async () => {
      let callCount = 0;
      mockAdapter.complete.mockImplementation(() => {
        callCount++;
        if (callCount <= 4) {
          const mockData = [
            VALID_SIGNAL,
            VALID_RISK,
            {
              ticker: "AAPL",
              regime: "normal",
              depthScore: 75,
              spreadBps: 1.5,
              averageDailyVolume: 50000000,
              relativeLiquidity: 0.8,
              timeOfDayEffect: "Best at open",
              eventProximity: { nearby: false, description: "No events" },
              darkPoolPct: 0.35,
              executionWindows: [{ window: "10:00-11:30", quality: "excellent", reason: "Peak volume" }],
              risks: [],
              summary: "Normal liquidity",
              timestamp: "2026-04-19T12:00:00.000Z",
            },
            VALID_ANOMALY,
          ][callCount - 1];
          return Promise.resolve(makeMockResponse(JSON.stringify(mockData)));
        }
        return Promise.resolve(makeMockResponse(JSON.stringify(VALID_PRE_TRADE)));
      });

      const fusion = new IntelligenceFusion();
      const result = await fusion.preTradeGate({
        ticker: "AAPL",
        action: "buy",
        currentPrice: 185.0,
      });

      expect(result.decision.decision).toBe("approved");
      expect(result.decision.readinessScore).toBe(78);
      expect(result.capabilities).toHaveProperty("signal");
      expect(result.capabilities).toHaveProperty("risk");
      expect(result.capabilities).toHaveProperty("liquidity");
      expect(result.capabilities).toHaveProperty("anomaly");
    });

    it("handles sell action", async () => {
      mockAdapter.complete.mockResolvedValue(
        makeMockResponse(
          JSON.stringify({
            ...VALID_PRE_TRADE,
            action: "sell",
            decision: "caution",
            readinessScore: 55,
          })
        )
      );

      const fusion = new IntelligenceFusion();
      const result = await fusion.preTradeGate({
        ticker: "AAPL",
        action: "sell",
        currentPrice: 185.0,
        quantity: 100,
      });

      expect(result.decision.decision).toBe("caution");
    });
  });

  describe("marketState", () => {
    it("runs multi-asset analysis and returns market state", async () => {
      mockAdapter.complete.mockResolvedValue(
        makeMockResponse(JSON.stringify(VALID_MARKET_STATE))
      );

      const fusion = new IntelligenceFusion();
      const result = await fusion.marketState({
        tickers: [
          { ticker: "AAPL", currentPrice: 185 },
          { ticker: "MSFT", currentPrice: 420 },
          { ticker: "GOOGL", currentPrice: 175 },
        ],
      });

      expect(result.state.tickers).toHaveLength(3);
      expect(result.state.marketPhase).toBe("cautious");
      expect(result.state.systemicRiskScore).toBe(35);
      expect(result.capabilities).toHaveProperty("correlation");
      expect(result.capabilities).toHaveProperty("narrative");
      expect(result.capabilities).toHaveProperty("regime:AAPL");
      expect(result.capabilities).toHaveProperty("anomaly:AAPL");
    });

    it("includes per-ticker regime and anomaly results", async () => {
      mockAdapter.complete.mockResolvedValue(
        makeMockResponse(JSON.stringify(VALID_MARKET_STATE))
      );

      const fusion = new IntelligenceFusion();
      const result = await fusion.marketState({
        tickers: [
          { ticker: "AAPL", currentPrice: 185 },
          { ticker: "MSFT", currentPrice: 420 },
        ],
      });

      expect(result.capabilities).toHaveProperty("regime:AAPL");
      expect(result.capabilities).toHaveProperty("regime:MSFT");
      expect(result.capabilities).toHaveProperty("anomaly:AAPL");
      expect(result.capabilities).toHaveProperty("anomaly:MSFT");
    });
  });
});
