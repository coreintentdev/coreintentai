import { describe, it, expect } from "vitest";
import {
  PortfolioIntelligenceSchema,
  PositionIntelligenceSchema,
  ScenarioAnalysisSchema,
  PortfolioHealthLevel,
  ActionRecommendation,
  Urgency,
} from "../src/types/index.js";
import {
  PORTFOLIO_INTELLIGENCE_SYSTEM_PROMPT,
  buildPortfolioAnalysisPrompt,
  buildQuickScanPrompt,
  buildStressTestPrompt,
} from "../src/capabilities/portfolio/prompts.js";

describe("Portfolio Intelligence", () => {
  describe("schemas", () => {
    const validPosition = {
      ticker: "AAPL",
      sentimentBias: "bullish" as const,
      sentimentScore: 0.65,
      momentumScore: 72,
      anomalyAlert: false,
      riskContribution: 25,
      keyInsight: "Strong earnings momentum with institutional accumulation",
      actionRecommendation: "hold" as const,
      confidence: 0.78,
    };

    const validScenario = {
      scenario: "bull" as const,
      probability: 0.35,
      portfolioImpactPct: 12.5,
      trigger: "Fed rate cut + strong Q2 earnings season",
      topMovers: [
        { ticker: "NVDA", impactPct: 18.0 },
        { ticker: "AAPL", impactPct: 8.5 },
      ],
      hedgingSuggestion: "Sell OTM calls on strongest performers to lock gains",
    };

    const validPortfolio = {
      portfolioHealthScore: 72,
      healthLevel: "good" as const,
      regimeContext: {
        currentRegime: "trending_up",
        regimeConfidence: 0.75,
        regimeImplication:
          "Favorable for growth-oriented positions, maintain exposure",
      },
      positions: [validPosition],
      riskDashboard: {
        overallRiskScore: 42,
        diversificationScore: 0.65,
        concentrationRisk: "Moderate — 3 of 5 positions in tech sector",
        tailRiskExposure: "Low — portfolio beta 1.1, adequate cash buffer",
        maxDrawdownEstimate: "-15% in a 2-sigma event",
      },
      correlationInsights: {
        highlyCorrelatedPairs: ["AAPL-MSFT (0.82)", "NVDA-AMD (0.78)"],
        diversificationGaps: [
          "No fixed income exposure",
          "No international diversification",
        ],
        hiddenRisks: [
          "Tech concentration amplifies sector rotation risk",
        ],
      },
      actionPlan: [
        {
          priority: 1,
          action: "Add bond ETF (TLT or AGG) for 10% allocation",
          rationale:
            "Reduce portfolio beta and add negative correlation hedge",
          urgency: "this_week" as const,
        },
      ],
      scenarios: [validScenario],
      reviewTriggers: [
        "VIX crosses above 25",
        "Fed changes rate guidance",
        "Any position drops 10% from entry",
      ],
      executiveSummary:
        "Portfolio is positioned well for current trending regime but has meaningful tech concentration risk. Priority action: add fixed income for diversification.",
      timestamp: "2026-05-02T12:00:00.000Z",
    };

    describe("PositionIntelligenceSchema", () => {
      it("accepts valid position intelligence", () => {
        const result = PositionIntelligenceSchema.parse(validPosition);
        expect(result.ticker).toBe("AAPL");
        expect(result.actionRecommendation).toBe("hold");
      });

      it("rejects invalid sentiment bias", () => {
        expect(() =>
          PositionIntelligenceSchema.parse({
            ...validPosition,
            sentimentBias: "mega_bullish",
          })
        ).toThrow();
      });

      it("rejects momentum score out of range", () => {
        expect(() =>
          PositionIntelligenceSchema.parse({
            ...validPosition,
            momentumScore: 150,
          })
        ).toThrow();
      });

      it("rejects confidence out of range", () => {
        expect(() =>
          PositionIntelligenceSchema.parse({
            ...validPosition,
            confidence: 1.5,
          })
        ).toThrow();
      });

      it("validates all action recommendations", () => {
        for (const action of ["add", "hold", "trim", "exit", "watch"]) {
          const result = PositionIntelligenceSchema.parse({
            ...validPosition,
            actionRecommendation: action,
          });
          expect(result.actionRecommendation).toBe(action);
        }
      });

      it("rejects sentiment score out of range", () => {
        expect(() =>
          PositionIntelligenceSchema.parse({
            ...validPosition,
            sentimentScore: 2.0,
          })
        ).toThrow();
      });
    });

    describe("ScenarioAnalysisSchema", () => {
      it("accepts valid scenario", () => {
        const result = ScenarioAnalysisSchema.parse(validScenario);
        expect(result.scenario).toBe("bull");
        expect(result.probability).toBe(0.35);
      });

      it("rejects invalid scenario type", () => {
        expect(() =>
          ScenarioAnalysisSchema.parse({
            ...validScenario,
            scenario: "neutral",
          })
        ).toThrow();
      });

      it("rejects probability out of range", () => {
        expect(() =>
          ScenarioAnalysisSchema.parse({
            ...validScenario,
            probability: 1.5,
          })
        ).toThrow();
      });

      it("allows negative portfolio impact", () => {
        const result = ScenarioAnalysisSchema.parse({
          ...validScenario,
          portfolioImpactPct: -18.5,
        });
        expect(result.portfolioImpactPct).toBe(-18.5);
      });
    });

    describe("PortfolioIntelligenceSchema", () => {
      it("accepts valid portfolio intelligence", () => {
        const result = PortfolioIntelligenceSchema.parse(validPortfolio);
        expect(result.portfolioHealthScore).toBe(72);
        expect(result.healthLevel).toBe("good");
        expect(result.positions).toHaveLength(1);
        expect(result.scenarios).toHaveLength(1);
        expect(result.actionPlan).toHaveLength(1);
      });

      it("rejects health score out of range", () => {
        expect(() =>
          PortfolioIntelligenceSchema.parse({
            ...validPortfolio,
            portfolioHealthScore: 150,
          })
        ).toThrow();
      });

      it("rejects invalid health level", () => {
        expect(() =>
          PortfolioIntelligenceSchema.parse({
            ...validPortfolio,
            healthLevel: "amazing",
          })
        ).toThrow();
      });

      it("validates all health levels", () => {
        for (const level of [
          "excellent",
          "good",
          "fair",
          "poor",
          "critical",
        ]) {
          const result = PortfolioIntelligenceSchema.parse({
            ...validPortfolio,
            healthLevel: level,
          });
          expect(result.healthLevel).toBe(level);
        }
      });

      it("validates all urgency levels", () => {
        for (const urgency of [
          "immediate",
          "this_week",
          "this_month",
          "monitor",
        ]) {
          const result = PortfolioIntelligenceSchema.parse({
            ...validPortfolio,
            actionPlan: [
              { ...validPortfolio.actionPlan[0], urgency },
            ],
          });
          expect(result.actionPlan[0].urgency).toBe(urgency);
        }
      });

      it("rejects diversification score out of range", () => {
        expect(() =>
          PortfolioIntelligenceSchema.parse({
            ...validPortfolio,
            riskDashboard: {
              ...validPortfolio.riskDashboard,
              diversificationScore: 1.5,
            },
          })
        ).toThrow();
      });

      it("accepts multiple positions", () => {
        const multiPositionPortfolio = {
          ...validPortfolio,
          positions: [
            validPosition,
            { ...validPosition, ticker: "MSFT", actionRecommendation: "add" },
            { ...validPosition, ticker: "NVDA", actionRecommendation: "trim" },
          ],
        };
        const result =
          PortfolioIntelligenceSchema.parse(multiPositionPortfolio);
        expect(result.positions).toHaveLength(3);
      });

      it("accepts multiple scenarios", () => {
        const multiScenarioPortfolio = {
          ...validPortfolio,
          scenarios: [
            validScenario,
            {
              ...validScenario,
              scenario: "base",
              probability: 0.45,
              portfolioImpactPct: 3.0,
            },
            {
              ...validScenario,
              scenario: "bear",
              probability: 0.2,
              portfolioImpactPct: -15.0,
            },
          ],
        };
        const result =
          PortfolioIntelligenceSchema.parse(multiScenarioPortfolio);
        expect(result.scenarios).toHaveLength(3);
      });
    });

    describe("enum schemas", () => {
      it("PortfolioHealthLevel contains all levels", () => {
        const values = PortfolioHealthLevel.options;
        expect(values).toContain("excellent");
        expect(values).toContain("good");
        expect(values).toContain("fair");
        expect(values).toContain("poor");
        expect(values).toContain("critical");
      });

      it("ActionRecommendation contains all actions", () => {
        const values = ActionRecommendation.options;
        expect(values).toContain("add");
        expect(values).toContain("hold");
        expect(values).toContain("trim");
        expect(values).toContain("exit");
        expect(values).toContain("watch");
      });

      it("Urgency contains all levels", () => {
        const values = Urgency.options;
        expect(values).toContain("immediate");
        expect(values).toContain("this_week");
        expect(values).toContain("this_month");
        expect(values).toContain("monitor");
      });
    });
  });

  describe("prompts", () => {
    it("system prompt includes all analysis dimensions", () => {
      expect(PORTFOLIO_INTELLIGENCE_SYSTEM_PROMPT).toContain(
        "REGIME CONTEXT"
      );
      expect(PORTFOLIO_INTELLIGENCE_SYSTEM_PROMPT).toContain(
        "PER-POSITION INTELLIGENCE"
      );
      expect(PORTFOLIO_INTELLIGENCE_SYSTEM_PROMPT).toContain(
        "RISK DASHBOARD"
      );
      expect(PORTFOLIO_INTELLIGENCE_SYSTEM_PROMPT).toContain(
        "CORRELATION INSIGHTS"
      );
      expect(PORTFOLIO_INTELLIGENCE_SYSTEM_PROMPT).toContain("ACTION PLAN");
      expect(PORTFOLIO_INTELLIGENCE_SYSTEM_PROMPT).toContain(
        "SCENARIO ANALYSIS"
      );
      expect(PORTFOLIO_INTELLIGENCE_SYSTEM_PROMPT).toContain(
        "REVIEW TRIGGERS"
      );
    });

    it("system prompt includes health scoring bands", () => {
      expect(PORTFOLIO_INTELLIGENCE_SYSTEM_PROMPT).toContain("80-100");
      expect(PORTFOLIO_INTELLIGENCE_SYSTEM_PROMPT).toContain("excellent");
      expect(PORTFOLIO_INTELLIGENCE_SYSTEM_PROMPT).toContain("0-19");
      expect(PORTFOLIO_INTELLIGENCE_SYSTEM_PROMPT).toContain("critical");
    });

    it("system prompt enforces JSON output", () => {
      expect(PORTFOLIO_INTELLIGENCE_SYSTEM_PROMPT).toContain(
        "Respond ONLY with valid JSON"
      );
    });

    it("system prompt emphasizes capital preservation", () => {
      expect(PORTFOLIO_INTELLIGENCE_SYSTEM_PROMPT).toContain(
        "Capital preservation"
      );
    });

    describe("buildPortfolioAnalysisPrompt", () => {
      it("includes all positions with weights", () => {
        const prompt = buildPortfolioAnalysisPrompt({
          positions: [
            { ticker: "AAPL", weight: 0.3, currentPrice: 185 },
            { ticker: "NVDA", weight: 0.25, entryPrice: 750, pnlPct: 15.2 },
          ],
        });
        expect(prompt).toContain("AAPL");
        expect(prompt).toContain("30.0% weight");
        expect(prompt).toContain("price $185");
        expect(prompt).toContain("NVDA");
        expect(prompt).toContain("25.0% weight");
        expect(prompt).toContain("entry $750");
        expect(prompt).toContain("+15.2%");
      });

      it("includes optional context sections", () => {
        const prompt = buildPortfolioAnalysisPrompt({
          positions: [{ ticker: "SPY", weight: 1.0 }],
          totalValue: 100000,
          cashPct: 15.5,
          regimeContext: "Trending up with moderate volatility",
          sentimentData: "Broadly bullish",
          momentumData: "Strong momentum across tech",
          correlationData: "Tech stocks highly correlated",
          riskData: "Moderate overall risk",
          anomalyData: "No anomalies detected",
          marketContext: "Post-earnings season, Fed meeting next week",
        });
        expect(prompt).toContain("$100,000");
        expect(prompt).toContain("15.5%");
        expect(prompt).toContain("MARKET REGIME ANALYSIS");
        expect(prompt).toContain("SENTIMENT DATA");
        expect(prompt).toContain("MOMENTUM DATA");
        expect(prompt).toContain("CORRELATION DATA");
        expect(prompt).toContain("RISK DATA");
        expect(prompt).toContain("ANOMALY SIGNALS");
        expect(prompt).toContain("MARKET CONTEXT");
      });

      it("handles negative P&L", () => {
        const prompt = buildPortfolioAnalysisPrompt({
          positions: [
            { ticker: "META", weight: 0.2, pnlPct: -8.3 },
          ],
        });
        expect(prompt).toContain("-8.3%");
      });

      it("includes timestamp instruction", () => {
        const prompt = buildPortfolioAnalysisPrompt({
          positions: [{ ticker: "SPY", weight: 1.0 }],
        });
        expect(prompt).toContain("timestamp");
      });
    });

    describe("buildQuickScanPrompt", () => {
      it("lists all tickers", () => {
        const prompt = buildQuickScanPrompt({
          tickers: ["AAPL", "MSFT", "NVDA"],
        });
        expect(prompt).toContain("AAPL, MSFT, NVDA");
      });

      it("includes market context when provided", () => {
        const prompt = buildQuickScanPrompt({
          tickers: ["SPY"],
          marketContext: "VIX at 18, market broadly calm",
        });
        expect(prompt).toContain("Market Context");
        expect(prompt).toContain("VIX at 18");
      });
    });

    describe("buildStressTestPrompt", () => {
      it("includes scenario and positions", () => {
        const prompt = buildStressTestPrompt({
          positions: [
            { ticker: "AAPL", weight: 0.3 },
            { ticker: "NVDA", weight: 0.25 },
          ],
          scenario: "US-China trade war escalation with 50% tariffs",
        });
        expect(prompt).toContain("US-China trade war");
        expect(prompt).toContain("AAPL: 30.0%");
        expect(prompt).toContain("NVDA: 25.0%");
      });

      it("includes historical context when provided", () => {
        const prompt = buildStressTestPrompt({
          positions: [{ ticker: "SPY", weight: 1.0 }],
          scenario: "Pandemic-style crash",
          historicalContext: "March 2020: SPY dropped 34% in 23 trading days",
        });
        expect(prompt).toContain("Historical Precedent");
        expect(prompt).toContain("March 2020");
      });
    });
  });
});
