import { describe, it, expect } from "vitest";
import { ScenarioAnalysisSchema } from "../src/types/index.js";

describe("ScenarioAnalysis Schema", () => {
  const validScenario = {
    scenarioName: "Fed Emergency Rate Hike",
    scenarioType: "macro_shock" as const,
    description: "Federal Reserve announces emergency 50bps rate hike in response to sticky inflation.",
    probability: 0.1,
    severity: 78,
    timeHorizon: "2-4 weeks",
    historicalAnalogue: {
      event: "2022 Rate Shock",
      year: 2022,
      similarity: 0.75,
      marketImpact: "S&P 500 fell 25% peak-to-trough over 9 months. Growth stocks hit hardest.",
    },
    marketImpact: {
      equities: { direction: "down" as const, magnitudePct: -12, drivers: ["Multiple compression", "Earnings downgrades"] },
      bonds: { direction: "down" as const, magnitudePct: -3, drivers: ["Duration risk", "Rate repricing"] },
      commodities: { direction: "mixed" as const, magnitudePct: -2, drivers: ["USD strength offsets supply concerns"] },
      crypto: { direction: "down" as const, magnitudePct: -25, drivers: ["Risk-off", "Liquidity withdrawal"] },
      volatility: { direction: "up" as const, vixTarget: 32, drivers: ["Uncertainty spike", "Hedging demand"] },
    },
    portfolioImpact: [
      {
        ticker: "AAPL",
        currentWeight: 15,
        estimatedImpactPct: -10,
        impactDrivers: ["Multiple compression on growth", "Consumer spending concerns"],
        vulnerabilityScore: 65,
      },
    ],
    cascadeEffects: [
      { order: 1, effect: "Immediate equity selloff as multiples reprice", probability: 0.95, timelag: "immediate" },
      { order: 2, effect: "Credit spreads widen, impacting high-yield issuers", probability: 0.8, timelag: "1-3 days" },
      { order: 3, effect: "EM currencies depreciate, triggering capital outflows", probability: 0.6, timelag: "1-2 weeks" },
    ],
    hedgingRecommendations: [
      {
        instrument: "SPY put spread (5% OTM)",
        action: "buy" as const,
        rationale: "Defined-risk downside protection for equity allocation",
        cost: "0.5% of portfolio",
        effectiveness: 0.75,
      },
    ],
    portfolioVaR: {
      priorVaR95: -3.5,
      stressedVaR95: -11.2,
      maxDrawdown: -18,
      recoveryTimeline: "4-8 months based on 2022 analogue",
    },
    actionPlan: {
      immediate: ["Reduce equity exposure by 15%", "Add Treasury hedge"],
      shortTerm: ["Rotate to value/defensive sectors", "Increase cash to 20%"],
      contingent: ["If 10Y yield >5.5%, move to 40% cash"],
    },
    summary: "An emergency rate hike would trigger a 10-15% equity drawdown with significant contagion effects. Portfolio VaR triples. Immediate action: reduce equity exposure and add Treasury duration hedge.",
    timestamp: "2026-01-15T10:30:00.000Z",
  };

  it("accepts a valid scenario analysis", () => {
    const result = ScenarioAnalysisSchema.parse(validScenario);
    expect(result.scenarioName).toBe("Fed Emergency Rate Hike");
    expect(result.scenarioType).toBe("macro_shock");
    expect(result.severity).toBe(78);
    expect(result.cascadeEffects).toHaveLength(3);
  });

  it("rejects invalid scenario type", () => {
    expect(() =>
      ScenarioAnalysisSchema.parse({
        ...validScenario,
        scenarioType: "alien_invasion",
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

  it("rejects severity out of range", () => {
    expect(() =>
      ScenarioAnalysisSchema.parse({
        ...validScenario,
        severity: 150,
      })
    ).toThrow();
  });

  it("validates cascade effect order bounds", () => {
    expect(() =>
      ScenarioAnalysisSchema.parse({
        ...validScenario,
        cascadeEffects: [
          { order: 0, effect: "test", probability: 0.5, timelag: "1 day" },
        ],
      })
    ).toThrow();
  });

  it("validates hedging recommendation effectiveness", () => {
    expect(() =>
      ScenarioAnalysisSchema.parse({
        ...validScenario,
        hedgingRecommendations: [
          {
            instrument: "SPY puts",
            action: "buy",
            rationale: "downside protection",
            cost: "1%",
            effectiveness: 1.5,
          },
        ],
      })
    ).toThrow();
  });

  it("accepts empty portfolio impact", () => {
    const result = ScenarioAnalysisSchema.parse({
      ...validScenario,
      portfolioImpact: [],
    });
    expect(result.portfolioImpact).toHaveLength(0);
  });

  it("validates vulnerability score range", () => {
    expect(() =>
      ScenarioAnalysisSchema.parse({
        ...validScenario,
        portfolioImpact: [
          {
            ticker: "AAPL",
            currentWeight: 15,
            estimatedImpactPct: -10,
            impactDrivers: ["test"],
            vulnerabilityScore: 150,
          },
        ],
      })
    ).toThrow();
  });
});
