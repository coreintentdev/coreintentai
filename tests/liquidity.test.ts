import { describe, it, expect } from "vitest";
import {
  LiquidityAssessmentSchema,
  ExecutionPlanSchema,
  LiquidityRegime,
  ExecutionUrgency,
  ExecutionAlgorithm,
} from "../src/types/index.js";
import {
  buildLiquidityAssessmentPrompt,
  buildExecutionRiskPrompt,
  buildLiquidityTrapPrompt,
  buildMarketMicrostructurePrompt,
} from "../src/capabilities/liquidity/prompts.js";
import { LiquidityAnalyzer, LIQUIDITY_SYSTEM_PROMPT } from "../src/capabilities/liquidity/index.js";

describe("Liquidity Intelligence", () => {
  describe("LiquidityAssessmentSchema", () => {
    const validAssessment = {
      ticker: "AAPL",
      regime: "normal",
      depthScore: 72,
      spreadBps: 1.5,
      averageDailyVolume: 65000000,
      relativeLiquidity: 0.85,
      timeOfDayEffect: "Liquidity peaks at open and close, thins 11:30-14:00 ET",
      eventProximity: {
        nearby: true,
        description: "Earnings report in 2 days — expect spread widening and depth reduction",
      },
      darkPoolPct: 0.38,
      executionWindows: [
        {
          window: "09:30-10:00 ET",
          quality: "excellent" as const,
          reason: "Opening auction provides deep crossing liquidity",
        },
        {
          window: "15:30-16:00 ET",
          quality: "good" as const,
          reason: "MOC flow provides natural counterparties",
        },
        {
          window: "11:30-14:00 ET",
          quality: "poor" as const,
          reason: "Midday lull — thin books, wider spreads",
        },
      ],
      risks: [
        "Earnings proximity reducing market maker depth",
        "Elevated put/call ratio suggests potential for one-sided flow",
      ],
      summary:
        "AAPL is in a normal liquidity regime but deteriorating ahead of earnings. Execute during open/close windows to minimize impact.",
      timestamp: "2026-05-03T10:00:00.000Z",
    };

    it("accepts valid liquidity assessment", () => {
      const result = LiquidityAssessmentSchema.parse(validAssessment);
      expect(result.ticker).toBe("AAPL");
      expect(result.regime).toBe("normal");
      expect(result.depthScore).toBe(72);
    });

    it("accepts all liquidity regimes", () => {
      const regimes = ["abundant", "normal", "thin", "crisis"] as const;
      for (const regime of regimes) {
        const result = LiquidityAssessmentSchema.parse({
          ...validAssessment,
          regime,
        });
        expect(result.regime).toBe(regime);
      }
    });

    it("accepts all execution window qualities", () => {
      const qualities = ["excellent", "good", "fair", "poor"] as const;
      for (const quality of qualities) {
        const result = LiquidityAssessmentSchema.parse({
          ...validAssessment,
          executionWindows: [
            { window: "09:30-10:00 ET", quality, reason: "Test" },
          ],
        });
        expect(result.executionWindows[0].quality).toBe(quality);
      }
    });

    it("rejects depth score out of range", () => {
      expect(() =>
        LiquidityAssessmentSchema.parse({
          ...validAssessment,
          depthScore: 150,
        })
      ).toThrow();
    });

    it("rejects negative depth score", () => {
      expect(() =>
        LiquidityAssessmentSchema.parse({
          ...validAssessment,
          depthScore: -5,
        })
      ).toThrow();
    });

    it("rejects relative liquidity out of range", () => {
      expect(() =>
        LiquidityAssessmentSchema.parse({
          ...validAssessment,
          relativeLiquidity: 1.5,
        })
      ).toThrow();
    });

    it("rejects dark pool pct out of range", () => {
      expect(() =>
        LiquidityAssessmentSchema.parse({
          ...validAssessment,
          darkPoolPct: -0.1,
        })
      ).toThrow();
    });

    it("rejects negative spread", () => {
      expect(() =>
        LiquidityAssessmentSchema.parse({
          ...validAssessment,
          spreadBps: -2,
        })
      ).toThrow();
    });

    it("accepts empty execution windows", () => {
      const result = LiquidityAssessmentSchema.parse({
        ...validAssessment,
        executionWindows: [],
      });
      expect(result.executionWindows).toHaveLength(0);
    });

    it("accepts empty risks array", () => {
      const result = LiquidityAssessmentSchema.parse({
        ...validAssessment,
        risks: [],
      });
      expect(result.risks).toHaveLength(0);
    });

    it("rejects invalid regime", () => {
      expect(() =>
        LiquidityAssessmentSchema.parse({
          ...validAssessment,
          regime: "unknown",
        })
      ).toThrow();
    });

    it("rejects missing required fields", () => {
      expect(() =>
        LiquidityAssessmentSchema.parse({
          ticker: "AAPL",
          regime: "normal",
        })
      ).toThrow();
    });
  });

  describe("ExecutionPlanSchema", () => {
    const validPlan = {
      ticker: "TSLA",
      action: "buy",
      quantity: 50000,
      urgency: "normal",
      algorithm: "VWAP",
      expectedSlippageBps: 3.2,
      optimalTiming: "Execute over 09:30-11:00 ET to capture opening volume",
      splitStrategy: [
        {
          tranche: 1,
          quantity: 20000,
          timing: "09:30-09:45 ET",
          venue: "NYSE",
          limitOffset: "+0.02",
        },
        {
          tranche: 2,
          quantity: 15000,
          timing: "09:45-10:15 ET",
          venue: "Dark pool (Sigma X)",
        },
        {
          tranche: 3,
          quantity: 15000,
          timing: "10:15-11:00 ET",
          venue: "ARCA",
          limitOffset: "+0.01",
        },
      ],
      darkPoolRecommendation:
        "Route 30-40% to dark pools — sufficient natural contra flow in TSLA",
      risks: [
        "TSLA volatility may cause algo to fall behind VWAP",
        "Pre-market gap risk if executed near open",
      ],
      contingencies: [
        "If spread widens >5bps, switch to passive limit orders",
        "If price moves >1% adverse, pause and reassess",
      ],
      summary:
        "VWAP execution over first 90 minutes with 3-tranche split. Expect ~3.2bps slippage on 50k shares.",
      timestamp: "2026-05-03T10:00:00.000Z",
    };

    it("accepts valid execution plan", () => {
      const result = ExecutionPlanSchema.parse(validPlan);
      expect(result.ticker).toBe("TSLA");
      expect(result.algorithm).toBe("VWAP");
      expect(result.splitStrategy).toHaveLength(3);
    });

    it("accepts all algorithm types", () => {
      const algos = ["TWAP", "VWAP", "IS", "Iceberg", "Block"] as const;
      for (const algorithm of algos) {
        const result = ExecutionPlanSchema.parse({
          ...validPlan,
          algorithm,
        });
        expect(result.algorithm).toBe(algorithm);
      }
    });

    it("accepts all urgency levels", () => {
      const urgencies = ["patient", "normal", "urgent", "immediate"] as const;
      for (const urgency of urgencies) {
        const result = ExecutionPlanSchema.parse({
          ...validPlan,
          urgency,
        });
        expect(result.urgency).toBe(urgency);
      }
    });

    it("accepts both buy and sell actions", () => {
      for (const action of ["buy", "sell"] as const) {
        const result = ExecutionPlanSchema.parse({
          ...validPlan,
          action,
        });
        expect(result.action).toBe(action);
      }
    });

    it("rejects negative quantity", () => {
      expect(() =>
        ExecutionPlanSchema.parse({
          ...validPlan,
          quantity: -100,
        })
      ).toThrow();
    });

    it("rejects zero quantity", () => {
      expect(() =>
        ExecutionPlanSchema.parse({
          ...validPlan,
          quantity: 0,
        })
      ).toThrow();
    });

    it("rejects negative slippage", () => {
      expect(() =>
        ExecutionPlanSchema.parse({
          ...validPlan,
          expectedSlippageBps: -1,
        })
      ).toThrow();
    });

    it("rejects invalid algorithm", () => {
      expect(() =>
        ExecutionPlanSchema.parse({
          ...validPlan,
          algorithm: "RANDOM",
        })
      ).toThrow();
    });

    it("rejects invalid action", () => {
      expect(() =>
        ExecutionPlanSchema.parse({
          ...validPlan,
          action: "short",
        })
      ).toThrow();
    });

    it("accepts empty split strategy", () => {
      const result = ExecutionPlanSchema.parse({
        ...validPlan,
        splitStrategy: [],
      });
      expect(result.splitStrategy).toHaveLength(0);
    });

    it("accepts tranche without limitOffset", () => {
      const result = ExecutionPlanSchema.parse({
        ...validPlan,
        splitStrategy: [
          { tranche: 1, quantity: 50000, timing: "09:30-10:00", venue: "NYSE" },
        ],
      });
      expect(result.splitStrategy[0].limitOffset).toBeUndefined();
    });

    it("rejects missing required fields", () => {
      expect(() =>
        ExecutionPlanSchema.parse({
          ticker: "TSLA",
          action: "buy",
        })
      ).toThrow();
    });
  });

  describe("LiquidityRegime enum", () => {
    it("accepts all valid regimes", () => {
      const regimes = ["abundant", "normal", "thin", "crisis"];
      for (const regime of regimes) {
        expect(LiquidityRegime.parse(regime)).toBe(regime);
      }
    });

    it("rejects invalid regime", () => {
      expect(() => LiquidityRegime.parse("unknown")).toThrow();
    });
  });

  describe("ExecutionUrgency enum", () => {
    it("accepts all valid urgencies", () => {
      const urgencies = ["patient", "normal", "urgent", "immediate"];
      for (const urgency of urgencies) {
        expect(ExecutionUrgency.parse(urgency)).toBe(urgency);
      }
    });

    it("rejects invalid urgency", () => {
      expect(() => ExecutionUrgency.parse("asap")).toThrow();
    });
  });

  describe("ExecutionAlgorithm enum", () => {
    it("accepts all valid algorithms", () => {
      const algos = ["TWAP", "VWAP", "IS", "Iceberg", "Block"];
      for (const algo of algos) {
        expect(ExecutionAlgorithm.parse(algo)).toBe(algo);
      }
    });

    it("rejects invalid algorithm", () => {
      expect(() => ExecutionAlgorithm.parse("RANDOM")).toThrow();
    });
  });

  describe("Liquidity Prompts", () => {
    it("builds assessment prompt with ticker only", () => {
      const prompt = buildLiquidityAssessmentPrompt({
        ticker: "AAPL",
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("liquidity");
    });

    it("builds assessment prompt with price", () => {
      const prompt = buildLiquidityAssessmentPrompt({
        ticker: "AAPL",
        currentPrice: 185.5,
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("$185.5");
    });

    it("includes volume data when provided", () => {
      const prompt = buildLiquidityAssessmentPrompt({
        ticker: "MSFT",
        volumeData: "ADV: 25M shares, today: 18M (below average)",
      });
      expect(prompt).toContain("Volume Data");
      expect(prompt).toContain("ADV: 25M");
    });

    it("includes spread data when provided", () => {
      const prompt = buildLiquidityAssessmentPrompt({
        ticker: "MSFT",
        spreadData: "Current spread: 1.2bps, 20-day avg: 0.9bps",
      });
      expect(prompt).toContain("Spread Data");
      expect(prompt).toContain("1.2bps");
    });

    it("includes order book data when provided", () => {
      const prompt = buildLiquidityAssessmentPrompt({
        ticker: "NVDA",
        orderBookData: "Bid depth 5 levels: 120k shares, Ask depth: 95k shares",
      });
      expect(prompt).toContain("Order Book Data");
      expect(prompt).toContain("120k shares");
    });

    it("includes market conditions when provided", () => {
      const prompt = buildLiquidityAssessmentPrompt({
        ticker: "SPY",
        marketConditions: "VIX at 22, market in risk-off mode",
      });
      expect(prompt).toContain("Market Conditions");
      expect(prompt).toContain("VIX at 22");
    });

    it("builds execution risk prompt", () => {
      const prompt = buildExecutionRiskPrompt({
        ticker: "TSLA",
        action: "buy",
        quantity: 50000,
        urgency: "normal",
      });
      expect(prompt).toContain("TSLA");
      expect(prompt).toContain("buy");
      expect(prompt).toContain("50000");
      expect(prompt).toContain("normal");
    });

    it("builds execution risk prompt with price", () => {
      const prompt = buildExecutionRiskPrompt({
        ticker: "TSLA",
        action: "sell",
        quantity: 10000,
        urgency: "urgent",
        currentPrice: 245.0,
      });
      expect(prompt).toContain("sell");
      expect(prompt).toContain("$245");
      expect(prompt).toContain("urgent");
    });

    it("builds liquidity trap prompt", () => {
      const prompt = buildLiquidityTrapPrompt({
        ticker: "GME",
        currentPrice: 25.5,
      });
      expect(prompt).toContain("GME");
      expect(prompt).toContain("liquidity trap");
      expect(prompt).toContain("$25.5");
    });

    it("includes positioning data in trap prompt", () => {
      const prompt = buildLiquidityTrapPrompt({
        ticker: "AMC",
        positioningData: "Short interest: 22%, crowded long retail",
      });
      expect(prompt).toContain("Positioning Data");
      expect(prompt).toContain("Short interest: 22%");
    });

    it("includes options data in trap prompt", () => {
      const prompt = buildLiquidityTrapPrompt({
        ticker: "GME",
        optionsData: "Gamma exposure: +$500M at $25 strike",
      });
      expect(prompt).toContain("Options/Gamma Data");
      expect(prompt).toContain("Gamma exposure");
    });

    it("builds microstructure prompt", () => {
      const prompt = buildMarketMicrostructurePrompt({
        ticker: "AAPL",
        currentPrice: 185.0,
      });
      expect(prompt).toContain("microstructure");
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("$185");
    });

    it("includes trade data in microstructure prompt", () => {
      const prompt = buildMarketMicrostructurePrompt({
        ticker: "MSFT",
        tradeData: "Last 100 trades: 65% at ask, avg size 320 shares",
      });
      expect(prompt).toContain("Trade-by-Trade Data");
      expect(prompt).toContain("65% at ask");
    });

    it("includes dark pool data in microstructure prompt", () => {
      const prompt = buildMarketMicrostructurePrompt({
        ticker: "META",
        darkPoolData: "Dark pool volume: 42% of total, avg block size: 5k shares",
      });
      expect(prompt).toContain("Dark Pool");
      expect(prompt).toContain("42% of total");
    });

    it("includes spread history in microstructure prompt", () => {
      const prompt = buildMarketMicrostructurePrompt({
        ticker: "AMZN",
        spreadHistory: "Spread widened 3x in last hour",
      });
      expect(prompt).toContain("Spread History");
      expect(prompt).toContain("widened 3x");
    });
  });

  describe("LiquidityAnalyzer class", () => {
    it("can be instantiated without orchestrator", () => {
      const analyzer = new LiquidityAnalyzer();
      expect(analyzer).toBeDefined();
    });

    it("can be instantiated with orchestrator", () => {
      const mockOrchestrator = {} as any;
      const analyzer = new LiquidityAnalyzer(mockOrchestrator);
      expect(analyzer).toBeDefined();
    });

    it("exports LIQUIDITY_SYSTEM_PROMPT", () => {
      expect(LIQUIDITY_SYSTEM_PROMPT).toBeDefined();
      expect(LIQUIDITY_SYSTEM_PROMPT).toContain("liquidity");
    });
  });
});
