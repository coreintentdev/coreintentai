import { describe, it, expect } from "vitest";
import {
  OptionsFlowSchema,
  VolatilitySurfaceSchema,
  OptionsStrategySchema,
  GreeksAnalysisSchema,
  GexAnalysisSchema,
} from "../src/types/index.js";
import {
  buildOptionsFlowPrompt,
  buildVolatilitySurfacePrompt,
  buildOptionsStrategyPrompt,
  buildGreeksAnalysisPrompt,
  buildGexAnalysisPrompt,
} from "../src/capabilities/options/prompts.js";

describe("Options Intelligence", () => {
  // -------------------------------------------------------------------------
  // OptionsFlowSchema
  // -------------------------------------------------------------------------
  describe("OptionsFlowSchema", () => {
    const validFlow = {
      ticker: "AAPL",
      flowBias: "bullish",
      confidence: 0.78,
      totalPremium: { calls: 12500000, puts: 4200000, ratio: 0.336 },
      significantTrades: [
        {
          type: "sweep",
          side: "call",
          strike: 200,
          expiry: "2026-06-20",
          premium: 2800000,
          size: 5000,
          sentiment: "bullish",
          interpretation:
            "Aggressive multi-exchange sweep at $200 strike — high conviction directional bet.",
        },
        {
          type: "block",
          side: "put",
          strike: 180,
          expiry: "2026-07-18",
          premium: 1500000,
          size: 3000,
          sentiment: "neutral",
          interpretation:
            "Institutional protective put — likely hedging existing long equity position.",
        },
      ],
      smartMoneySignal:
        "Net bullish. Call sweep volume concentrated at near-term OTM strikes suggests directional conviction. Put block appears hedging, not speculative.",
      keyLevels: {
        maxPainStrike: 192.5,
        highestCallOI: 200,
        highestPutOI: 180,
        gammaFlip: 195,
      },
      summary:
        "Bullish options flow with aggressive call sweeps at $200 strike. Smart money is buying upside while hedging downside with protective puts at $180.",
      timestamp: "2026-05-08T10:00:00.000Z",
    };

    it("accepts valid options flow", () => {
      const result = OptionsFlowSchema.parse(validFlow);
      expect(result.ticker).toBe("AAPL");
      expect(result.flowBias).toBe("bullish");
      expect(result.significantTrades).toHaveLength(2);
    });

    it("accepts all flow bias values", () => {
      const biases = [
        "strongly_bullish",
        "bullish",
        "neutral",
        "bearish",
        "strongly_bearish",
      ] as const;
      for (const bias of biases) {
        const result = OptionsFlowSchema.parse({ ...validFlow, flowBias: bias });
        expect(result.flowBias).toBe(bias);
      }
    });

    it("accepts all flow types", () => {
      const types = [
        "sweep",
        "block",
        "unusual_volume",
        "opening_position",
        "closing_position",
        "roll",
        "spread",
      ] as const;
      for (const type of types) {
        const flow = {
          ...validFlow,
          significantTrades: [{ ...validFlow.significantTrades[0], type }],
        };
        const result = OptionsFlowSchema.parse(flow);
        expect(result.significantTrades[0].type).toBe(type);
      }
    });

    it("rejects confidence out of range", () => {
      expect(() =>
        OptionsFlowSchema.parse({ ...validFlow, confidence: 1.5 })
      ).toThrow();
    });

    it("rejects negative premium", () => {
      expect(() =>
        OptionsFlowSchema.parse({
          ...validFlow,
          totalPremium: { calls: -1, puts: 0, ratio: 0 },
        })
      ).toThrow();
    });

    it("rejects zero or negative strike", () => {
      expect(() =>
        OptionsFlowSchema.parse({
          ...validFlow,
          significantTrades: [
            { ...validFlow.significantTrades[0], strike: 0 },
          ],
        })
      ).toThrow();
    });

    it("rejects zero or negative contract size", () => {
      expect(() =>
        OptionsFlowSchema.parse({
          ...validFlow,
          significantTrades: [
            { ...validFlow.significantTrades[0], size: 0 },
          ],
        })
      ).toThrow();
    });

    it("accepts empty trades array", () => {
      const result = OptionsFlowSchema.parse({
        ...validFlow,
        significantTrades: [],
      });
      expect(result.significantTrades).toHaveLength(0);
    });

    it("accepts optional gammaFlip", () => {
      const withoutGammaFlip = {
        ...validFlow,
        keyLevels: {
          maxPainStrike: 192.5,
          highestCallOI: 200,
          highestPutOI: 180,
        },
      };
      const result = OptionsFlowSchema.parse(withoutGammaFlip);
      expect(result.keyLevels.gammaFlip).toBeUndefined();
    });

    it("rejects invalid flow type", () => {
      expect(() =>
        OptionsFlowSchema.parse({
          ...validFlow,
          significantTrades: [
            { ...validFlow.significantTrades[0], type: "magic" },
          ],
        })
      ).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // VolatilitySurfaceSchema
  // -------------------------------------------------------------------------
  describe("VolatilitySurfaceSchema", () => {
    const validSurface = {
      ticker: "TSLA",
      ivRank: 72,
      ivPercentile: 85,
      currentIV30: 0.48,
      realizedVol30: 0.35,
      ivRvSpread: 0.13,
      skew: {
        put25Delta: 0.55,
        call25Delta: 0.42,
        skewIndex: 1.31,
        interpretation:
          "Elevated put skew indicates hedging demand and downside fear premium.",
      },
      termStructure: {
        shape: "humped" as const,
        frontMonth: 0.52,
        backMonth: 0.44,
        eventPremium: 0.08,
        interpretation:
          "Humped term structure with front-month premium ahead of earnings. Post-earnings vol expected to compress.",
      },
      surfaceSignals: [
        {
          signal: "Put skew steepening at 10-delta",
          location: "30-DTE OTM puts",
          significance: "high" as const,
          tradeable: true,
        },
      ],
      regime: "elevated" as const,
      outlook:
        "IV likely to compress post-earnings. Current skew offers premium selling opportunities on the put side.",
      summary:
        "TSLA volatility surface showing elevated IV rank (72) with steep put skew. Term structure humped around earnings date.",
      timestamp: "2026-05-08T10:00:00.000Z",
    };

    it("accepts valid volatility surface", () => {
      const result = VolatilitySurfaceSchema.parse(validSurface);
      expect(result.ticker).toBe("TSLA");
      expect(result.ivRank).toBe(72);
      expect(result.skew.skewIndex).toBe(1.31);
    });

    it("accepts all term structure shapes", () => {
      const shapes = ["contango", "backwardation", "flat", "humped"] as const;
      for (const shape of shapes) {
        const result = VolatilitySurfaceSchema.parse({
          ...validSurface,
          termStructure: { ...validSurface.termStructure, shape },
        });
        expect(result.termStructure.shape).toBe(shape);
      }
    });

    it("accepts all vol regimes", () => {
      const regimes = ["low_vol", "normal", "elevated", "crisis"] as const;
      for (const regime of regimes) {
        const result = VolatilitySurfaceSchema.parse({
          ...validSurface,
          regime,
        });
        expect(result.regime).toBe(regime);
      }
    });

    it("rejects IV rank out of range", () => {
      expect(() =>
        VolatilitySurfaceSchema.parse({ ...validSurface, ivRank: 150 })
      ).toThrow();
    });

    it("rejects negative IV percentile", () => {
      expect(() =>
        VolatilitySurfaceSchema.parse({ ...validSurface, ivPercentile: -5 })
      ).toThrow();
    });

    it("accepts negative ivRvSpread", () => {
      const result = VolatilitySurfaceSchema.parse({
        ...validSurface,
        ivRvSpread: -0.05,
      });
      expect(result.ivRvSpread).toBe(-0.05);
    });

    it("accepts empty surface signals", () => {
      const result = VolatilitySurfaceSchema.parse({
        ...validSurface,
        surfaceSignals: [],
      });
      expect(result.surfaceSignals).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // OptionsStrategySchema
  // -------------------------------------------------------------------------
  describe("OptionsStrategySchema", () => {
    const validStrategy = {
      ticker: "NVDA",
      strategy: {
        name: "Bull Call Spread",
        category: "directional" as const,
        legs: [
          {
            action: "buy" as const,
            type: "call" as const,
            strike: 950,
            expiry: "2026-06-20",
            quantity: 10,
            estimatedPrice: 28.5,
          },
          {
            action: "sell" as const,
            type: "call" as const,
            strike: 1000,
            expiry: "2026-06-20",
            quantity: 10,
            estimatedPrice: 15.2,
          },
        ],
        netDebit: 13300,
        maxProfit: 36700,
        maxLoss: 13300,
        breakeven: [963.3],
        probabilityOfProfit: 0.55,
        riskRewardRatio: 2.76,
      },
      greeksExposure: {
        delta: 3.2,
        gamma: 0.08,
        theta: -42.5,
        vega: 18.3,
      },
      managementRules: {
        profitTarget: "Close at 50% of max profit ($18,350)",
        stopLoss: "Close if position loses 60% of debit paid",
        adjustment:
          "If NVDA drops below $930, roll long call down to $920 strike",
        rollTrigger: "Roll entire spread forward if < 14 DTE and not at target",
      },
      rationale:
        "Bullish outlook on NVDA with defined risk. IV is moderate so buying spreads is cost-efficient. The $950-$1000 range targets the next resistance zone.",
      alternatives: [
        {
          name: "Long Call",
          tradeoff:
            "Higher max profit but costs more and has larger theta decay",
        },
        {
          name: "Broken Wing Butterfly",
          tradeoff:
            "Lower cost but needs NVDA to pin near $975 for max profit",
        },
      ],
      warnings: [
        "NVDA earnings in 2 weeks — expect IV expansion then crush",
        "Position sizing: this spread uses 13.3% of account — consider reducing to 2-5%",
      ],
      summary:
        "Bull call spread on NVDA ($950/$1000) for June expiry. Defined risk of $13.3K for potential $36.7K profit. 2.76:1 risk/reward.",
      timestamp: "2026-05-08T10:00:00.000Z",
    };

    it("accepts valid options strategy", () => {
      const result = OptionsStrategySchema.parse(validStrategy);
      expect(result.ticker).toBe("NVDA");
      expect(result.strategy.name).toBe("Bull Call Spread");
      expect(result.strategy.legs).toHaveLength(2);
    });

    it("accepts all strategy categories", () => {
      const categories = [
        "directional",
        "volatility",
        "income",
        "hedge",
        "arbitrage",
      ] as const;
      for (const category of categories) {
        const result = OptionsStrategySchema.parse({
          ...validStrategy,
          strategy: { ...validStrategy.strategy, category },
        });
        expect(result.strategy.category).toBe(category);
      }
    });

    it("accepts negative netDebit (credit strategy)", () => {
      const result = OptionsStrategySchema.parse({
        ...validStrategy,
        strategy: { ...validStrategy.strategy, netDebit: -850 },
      });
      expect(result.strategy.netDebit).toBe(-850);
    });

    it("rejects zero quantity legs", () => {
      expect(() =>
        OptionsStrategySchema.parse({
          ...validStrategy,
          strategy: {
            ...validStrategy.strategy,
            legs: [{ ...validStrategy.strategy.legs[0], quantity: 0 }],
          },
        })
      ).toThrow();
    });

    it("rejects probability of profit out of range", () => {
      expect(() =>
        OptionsStrategySchema.parse({
          ...validStrategy,
          strategy: {
            ...validStrategy.strategy,
            probabilityOfProfit: 1.5,
          },
        })
      ).toThrow();
    });

    it("accepts multiple breakeven points", () => {
      const result = OptionsStrategySchema.parse({
        ...validStrategy,
        strategy: {
          ...validStrategy.strategy,
          breakeven: [940, 1010],
        },
      });
      expect(result.strategy.breakeven).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // GreeksAnalysisSchema
  // -------------------------------------------------------------------------
  describe("GreeksAnalysisSchema", () => {
    const validGreeks = {
      ticker: "SPY",
      netGreeks: {
        delta: 125.5,
        gamma: 8.2,
        theta: -340,
        vega: 95.3,
        rho: 12.1,
      },
      secondOrder: {
        gammaRisk:
          "High gamma near $520 strike — delta will change rapidly if SPY moves through this level.",
        charm: "Delta decaying at -2.3 per day — position becoming less directional over time.",
        vanna:
          "If IV rises 5%, delta increases by ~15 — the position becomes more bullish in a vol spike.",
        volga:
          "Vega sensitivity is flat — position does not have significant vol-of-vol risk.",
      },
      scenarioAnalysis: [
        {
          scenario: "SPY +2%, IV flat",
          pnl: 8500,
          newDelta: 165,
          risk: "low" as const,
        },
        {
          scenario: "SPY -3%, IV +5%",
          pnl: -12300,
          newDelta: 45,
          risk: "high" as const,
        },
        {
          scenario: "SPY flat, IV -3%",
          pnl: -2860,
          newDelta: 120,
          risk: "medium" as const,
        },
      ],
      riskMetrics: {
        dollarDelta: 65450,
        gammaScalp: 1200,
        thetaBurn: -340,
        vegaExposure: 4765,
        maxLossScenario: "SPY -5% with IV spike of 10%",
        maxLossAmount: 28500,
      },
      recommendations: [
        "Consider selling $530 calls to reduce vega and collect theta",
        "Add a $505 put hedge to cap downside delta exposure",
      ],
      summary:
        "Net long delta (125) and long vega (95) position. Main risk is a sharp selloff with vol spike. Daily theta burn of $340.",
      timestamp: "2026-05-08T10:00:00.000Z",
    };

    it("accepts valid Greeks analysis", () => {
      const result = GreeksAnalysisSchema.parse(validGreeks);
      expect(result.ticker).toBe("SPY");
      expect(result.netGreeks.delta).toBe(125.5);
      expect(result.scenarioAnalysis).toHaveLength(3);
    });

    it("accepts negative Greeks values", () => {
      const result = GreeksAnalysisSchema.parse({
        ...validGreeks,
        netGreeks: { delta: -50, gamma: -2, theta: 150, vega: -30, rho: -5 },
      });
      expect(result.netGreeks.delta).toBe(-50);
      expect(result.netGreeks.theta).toBe(150);
    });

    it("accepts all scenario risk levels", () => {
      const levels = ["low", "medium", "high"] as const;
      for (const risk of levels) {
        const result = GreeksAnalysisSchema.parse({
          ...validGreeks,
          scenarioAnalysis: [
            { ...validGreeks.scenarioAnalysis[0], risk },
          ],
        });
        expect(result.scenarioAnalysis[0].risk).toBe(risk);
      }
    });

    it("rejects missing required second-order fields", () => {
      expect(() =>
        GreeksAnalysisSchema.parse({
          ...validGreeks,
          secondOrder: { gammaRisk: "test" },
        })
      ).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // GexAnalysisSchema
  // -------------------------------------------------------------------------
  describe("GexAnalysisSchema", () => {
    const validGex = {
      ticker: "SPX",
      netGex: 5200000000,
      gexRegime: "positive" as const,
      flipPoint: 5150,
      keyLevels: [
        {
          price: 5200,
          gammaNotional: 2100000000,
          type: "pin" as const,
          strength: "strong" as const,
          mechanism:
            "Massive call OI at $5200 strike. Dealers are long gamma — they buy dips and sell rallies, suppressing volatility.",
        },
        {
          price: 5100,
          gammaNotional: -800000000,
          type: "support" as const,
          strength: "moderate" as const,
          mechanism:
            "Put OI cluster creates support. Dealers short gamma below here — would amplify moves.",
        },
      ],
      priceImplications: {
        expectedRange: { low: 5150, high: 5250 },
        pinRisk: 0.72,
        breakoutProbability: 0.15,
        volatilitySuppression: true,
      },
      dealerHedging: {
        direction: "buying_dips" as const,
        magnitude: "heavy" as const,
        explanation:
          "Positive GEX regime. Dealers are net long gamma and must delta-hedge by buying on dips and selling on rallies. This creates a volatility-dampening effect and tends to pin price near the highest GEX strike.",
      },
      summary:
        "SPX in positive GEX regime with strong pin at $5200. Dealers buying dips / selling rallies. Low breakout probability until GEX flips at $5150.",
      timestamp: "2026-05-08T10:00:00.000Z",
    };

    it("accepts valid GEX analysis", () => {
      const result = GexAnalysisSchema.parse(validGex);
      expect(result.ticker).toBe("SPX");
      expect(result.gexRegime).toBe("positive");
      expect(result.keyLevels).toHaveLength(2);
    });

    it("accepts all GEX regimes", () => {
      const regimes = ["positive", "negative", "neutral"] as const;
      for (const regime of regimes) {
        const result = GexAnalysisSchema.parse({
          ...validGex,
          gexRegime: regime,
        });
        expect(result.gexRegime).toBe(regime);
      }
    });

    it("accepts all dealer hedging directions", () => {
      const directions = [
        "buying_dips",
        "selling_rallies",
        "amplifying_moves",
      ] as const;
      for (const direction of directions) {
        const result = GexAnalysisSchema.parse({
          ...validGex,
          dealerHedging: { ...validGex.dealerHedging, direction },
        });
        expect(result.dealerHedging.direction).toBe(direction);
      }
    });

    it("accepts all key level types", () => {
      const types = ["support", "resistance", "pin"] as const;
      for (const type of types) {
        const result = GexAnalysisSchema.parse({
          ...validGex,
          keyLevels: [{ ...validGex.keyLevels[0], type }],
        });
        expect(result.keyLevels[0].type).toBe(type);
      }
    });

    it("rejects pin risk out of range", () => {
      expect(() =>
        GexAnalysisSchema.parse({
          ...validGex,
          priceImplications: {
            ...validGex.priceImplications,
            pinRisk: 1.5,
          },
        })
      ).toThrow();
    });

    it("accepts negative GEX values", () => {
      const result = GexAnalysisSchema.parse({
        ...validGex,
        netGex: -3000000000,
      });
      expect(result.netGex).toBe(-3000000000);
    });

    it("accepts negative gammaNotional", () => {
      const result = GexAnalysisSchema.parse({
        ...validGex,
        keyLevels: [
          { ...validGex.keyLevels[0], gammaNotional: -1500000000 },
        ],
      });
      expect(result.keyLevels[0].gammaNotional).toBe(-1500000000);
    });
  });

  // -------------------------------------------------------------------------
  // Prompt Builders
  // -------------------------------------------------------------------------
  describe("Options Prompts", () => {
    it("builds options flow prompt with required params", () => {
      const prompt = buildOptionsFlowPrompt({
        ticker: "AAPL",
        flowData: "Large call sweep at $200",
        currentPrice: 195,
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("$195");
      expect(prompt).toContain("Large call sweep");
      expect(prompt).toContain("smart money");
    });

    it("builds options flow prompt with optional IV data", () => {
      const prompt = buildOptionsFlowPrompt({
        ticker: "TSLA",
        flowData: "Block put trade",
        currentPrice: 250,
        historicalIV: "30-day IV: 55%, IV rank: 80",
      });
      expect(prompt).toContain("Historical IV Context");
      expect(prompt).toContain("IV rank: 80");
    });

    it("builds options flow prompt with OI data", () => {
      const prompt = buildOptionsFlowPrompt({
        ticker: "MSFT",
        flowData: "Call volume 3x puts",
        currentPrice: 420,
        openInterest: "Max pain at $415, highest call OI at $430",
      });
      expect(prompt).toContain("Open Interest Distribution");
      expect(prompt).toContain("Max pain");
    });

    it("builds volatility surface prompt", () => {
      const prompt = buildVolatilitySurfacePrompt({
        ticker: "NVDA",
        currentPrice: 950,
        ivData: "30-day IV: 42%, 60-day IV: 38%",
      });
      expect(prompt).toContain("NVDA");
      expect(prompt).toContain("$950");
      expect(prompt).toContain("volatility surface");
    });

    it("builds vol surface prompt with all optional params", () => {
      const prompt = buildVolatilitySurfacePrompt({
        ticker: "AAPL",
        currentPrice: 195,
        ivData: "IV data here",
        historicalVolatility: 0.22,
        earningsDate: "2026-05-15",
        vixLevel: 15.5,
      });
      expect(prompt).toContain("22.0%");
      expect(prompt).toContain("2026-05-15");
      expect(prompt).toContain("15.5");
    });

    it("builds options strategy prompt", () => {
      const prompt = buildOptionsStrategyPrompt({
        ticker: "SPY",
        currentPrice: 520,
        outlook: "bullish",
        timeHorizon: "monthly",
        riskTolerance: "moderate",
        accountSize: 100000,
      });
      expect(prompt).toContain("SPY");
      expect(prompt).toContain("bullish");
      expect(prompt).toContain("monthly");
      expect(prompt).toContain("moderate");
      expect(prompt).toContain("$100,000");
    });

    it("builds strategy prompt with IV environment and constraints", () => {
      const prompt = buildOptionsStrategyPrompt({
        ticker: "TSLA",
        currentPrice: 250,
        outlook: "volatile",
        timeHorizon: "weekly",
        riskTolerance: "aggressive",
        accountSize: 50000,
        ivEnvironment: "IV rank 85, elevated skew",
        constraints: ["no naked short options", "max 5% of account per trade"],
      });
      expect(prompt).toContain("IV rank 85");
      expect(prompt).toContain("no naked short options");
      expect(prompt).toContain("max 5%");
    });

    it("builds Greeks analysis prompt", () => {
      const prompt = buildGreeksAnalysisPrompt({
        ticker: "AAPL",
        positions: "Long 10x $200C Jun, Short 10x $210C Jun",
        currentPrice: 195,
        daysToExpiry: 42,
        impliedVolatility: 0.28,
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("$195");
      expect(prompt).toContain("42 DTE");
      expect(prompt).toContain("28.0%");
      expect(prompt).toContain("gamma");
      expect(prompt).toContain("vanna");
    });

    it("builds GEX analysis prompt", () => {
      const prompt = buildGexAnalysisPrompt({
        ticker: "SPX",
        currentPrice: 5200,
        optionsOIData: "Call OI: 500K at 5200, Put OI: 300K at 5100",
      });
      expect(prompt).toContain("SPX");
      expect(prompt).toContain("$5200");
      expect(prompt).toContain("Gamma Exposure");
      expect(prompt).toContain("dealer");
    });

    it("builds GEX prompt with dealer positioning", () => {
      const prompt = buildGexAnalysisPrompt({
        ticker: "SPY",
        currentPrice: 520,
        optionsOIData: "OI data here",
        dealerPositioning: "Net long gamma above $515, net short below",
      });
      expect(prompt).toContain("Dealer Positioning");
      expect(prompt).toContain("Net long gamma");
    });
  });
});
