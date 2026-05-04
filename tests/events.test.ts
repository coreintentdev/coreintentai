import { describe, it, expect, beforeEach } from "vitest";
import {
  EventCategory,
  EventImpact,
  MarketEventSchema,
  EventCalendarSchema,
  EventImpactAnalysisSchema,
} from "../src/types/index.js";
import {
  buildEventScanPrompt,
  buildEventImpactPrompt,
  buildEventStrategyPrompt,
  EVENT_SYSTEM_PROMPT,
} from "../src/capabilities/events/prompts.js";
import { EventIntelligence } from "../src/capabilities/events/index.js";
import { Orchestrator } from "../src/orchestrator/index.js";

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

describe("Event Intelligence — Schemas", () => {
  describe("EventCategory enum", () => {
    it.each([
      "earnings",
      "economic_data",
      "fed_meeting",
      "options_expiry",
      "dividend",
      "conference",
      "regulatory",
      "geopolitical",
      "ipo_lockup",
      "index_rebalance",
    ])("accepts %s", (value) => {
      expect(EventCategory.parse(value)).toBe(value);
    });

    it("rejects invalid category", () => {
      expect(EventCategory.safeParse("weather").success).toBe(false);
    });
  });

  describe("EventImpact enum", () => {
    it.each(["low", "medium", "high", "critical"])("accepts %s", (value) => {
      expect(EventImpact.parse(value)).toBe(value);
    });

    it("rejects invalid impact", () => {
      expect(EventImpact.safeParse("extreme").success).toBe(false);
    });
  });

  describe("MarketEventSchema", () => {
    const validEvent = {
      name: "AAPL Q2 Earnings",
      category: "earnings",
      date: "2026-05-10",
      time: "16:30 ET",
      expectedImpact: "high",
      affectedTickers: ["AAPL", "QQQ"],
      historicalAvgMove: 4.2,
      impliedMove: 5.1,
      consensus: "EPS $2.10, Revenue $94.5B",
      surprise: undefined,
      tradingStrategy: {
        priorToEvent: "Reduce position size, consider protective puts",
        duringEvent: "Do not trade — wait for confirmation",
        afterEvent: "Fade initial gap if >2x implied move",
      },
      risks: ["Guidance revision risk", "Services growth deceleration"],
    };

    it("accepts a valid market event", () => {
      expect(MarketEventSchema.safeParse(validEvent).success).toBe(true);
    });

    it("accepts event without optional fields", () => {
      const minimal = {
        name: "NFP Report",
        category: "economic_data",
        date: "2026-05-02",
        expectedImpact: "critical",
        affectedTickers: ["SPY", "TLT", "DXY"],
        historicalAvgMove: 0.8,
        tradingStrategy: {
          priorToEvent: "Reduce exposure",
          duringEvent: "Watch for volatility",
          afterEvent: "Trade the trend",
        },
        risks: ["Surprise upside could spike yields"],
      };
      expect(MarketEventSchema.safeParse(minimal).success).toBe(true);
    });

    it("enforces non-negative historicalAvgMove", () => {
      expect(
        MarketEventSchema.safeParse({
          ...validEvent,
          historicalAvgMove: -1.5,
        }).success
      ).toBe(false);
    });

    it("enforces non-negative impliedMove", () => {
      expect(
        MarketEventSchema.safeParse({
          ...validEvent,
          impliedMove: -0.5,
        }).success
      ).toBe(false);
    });

    it("rejects missing required fields", () => {
      const { name: _, ...noName } = validEvent;
      expect(MarketEventSchema.safeParse(noName).success).toBe(false);
    });
  });

  describe("EventCalendarSchema", () => {
    const validCalendar = {
      startDate: "2026-05-04",
      endDate: "2026-05-10",
      events: [
        {
          name: "FOMC Decision",
          category: "fed_meeting",
          date: "2026-05-07",
          time: "14:00 ET",
          expectedImpact: "critical",
          affectedTickers: ["SPY", "TLT", "GLD"],
          historicalAvgMove: 1.1,
          impliedMove: 1.4,
          tradingStrategy: {
            priorToEvent: "Reduce delta exposure",
            duringEvent: "Await statement and press conference",
            afterEvent: "Trade directional break after 30min",
          },
          risks: ["Hawkish surprise", "Dot plot shift"],
        },
      ],
      highImpactCount: 3,
      riskDensity: "heavy",
      weeklyOutlook:
        "FOMC-dominated week with mega-cap earnings. Expect elevated vol.",
      keyThemes: ["Monetary policy", "AI earnings", "Labor market"],
      tradingBias: {
        direction: "volatile",
        confidence: 0.6,
        rationale: "FOMC + earnings cluster creates two-way risk",
      },
      positioningAdvice: [
        "Reduce gross exposure by 20%",
        "Add protective puts on concentrated positions",
      ],
      summary: "Heavy event week dominated by FOMC and mega-cap earnings.",
      timestamp: "2026-05-04T12:00:00.000Z",
    };

    it("accepts a valid calendar", () => {
      expect(EventCalendarSchema.safeParse(validCalendar).success).toBe(true);
    });

    it.each(["light", "moderate", "heavy", "extreme"])(
      "accepts riskDensity %s",
      (density) => {
        expect(
          EventCalendarSchema.safeParse({
            ...validCalendar,
            riskDensity: density,
          }).success
        ).toBe(true);
      }
    );

    it.each(["bullish", "bearish", "neutral", "volatile"])(
      "accepts tradingBias direction %s",
      (direction) => {
        expect(
          EventCalendarSchema.safeParse({
            ...validCalendar,
            tradingBias: { ...validCalendar.tradingBias, direction },
          }).success
        ).toBe(true);
      }
    );

    it("enforces confidence 0-1", () => {
      expect(
        EventCalendarSchema.safeParse({
          ...validCalendar,
          tradingBias: { ...validCalendar.tradingBias, confidence: 1.5 },
        }).success
      ).toBe(false);
    });

    it("enforces non-negative highImpactCount", () => {
      expect(
        EventCalendarSchema.safeParse({
          ...validCalendar,
          highImpactCount: -1,
        }).success
      ).toBe(false);
    });
  });

  describe("EventImpactAnalysisSchema", () => {
    const validImpact = {
      event: "CPI Release",
      category: "economic_data",
      actual: "3.2% YoY",
      expected: "3.4% YoY",
      surprise: "-0.2% (below expectations)",
      marketReaction: {
        immediate: "S&P +0.8%, 10Y yield -12bps",
        shortTerm: "Risk-on rally expected to continue 2-3 sessions",
        interpretation:
          "Disinflation trend intact, supports rate cut narrative",
      },
      sectorImpact: [
        {
          sector: "Technology",
          impact: "positive" as const,
          magnitude: 0.8,
          reasoning: "Lower rates = higher duration asset valuations",
        },
        {
          sector: "Financials",
          impact: "negative" as const,
          magnitude: 0.4,
          reasoning: "Lower rates compress net interest margins",
        },
      ],
      secondOrderEffects: [
        "Strengthens case for September rate cut",
        "Dollar weakness benefits multinationals",
        "Gold may rally on real rate compression",
      ],
      historicalComparison: {
        similarEvents: 8,
        avgNextDayMove: 0.45,
        avgNextWeekMove: 0.72,
        winRate: 0.62,
        pattern: "Below-expectation CPI has led to sustained 3-5 day rallies",
      },
      tradingPlaybook: [
        {
          strategy: "Long QQQ calls",
          timeframe: "5-day",
          conviction: 0.7,
          risk: "Reversal if Fed rhetoric stays hawkish",
        },
      ],
      summary:
        "Cooler-than-expected CPI reinforces disinflation, supports risk assets.",
      timestamp: "2026-05-04T12:00:00.000Z",
    };

    it("accepts a valid impact analysis", () => {
      expect(EventImpactAnalysisSchema.safeParse(validImpact).success).toBe(
        true
      );
    });

    it("accepts without optional fields", () => {
      const minimal = {
        ...validImpact,
        actual: undefined,
        expected: undefined,
        surprise: undefined,
      };
      expect(EventImpactAnalysisSchema.safeParse(minimal).success).toBe(true);
    });

    it("enforces sector impact magnitude 0-1", () => {
      const bad = {
        ...validImpact,
        sectorImpact: [
          { sector: "Tech", impact: "positive", magnitude: 1.5, reasoning: "test" },
        ],
      };
      expect(EventImpactAnalysisSchema.safeParse(bad).success).toBe(false);
    });

    it("enforces historical winRate 0-1", () => {
      const bad = {
        ...validImpact,
        historicalComparison: {
          ...validImpact.historicalComparison,
          winRate: 1.2,
        },
      };
      expect(EventImpactAnalysisSchema.safeParse(bad).success).toBe(false);
    });

    it("enforces non-negative similarEvents count", () => {
      const bad = {
        ...validImpact,
        historicalComparison: {
          ...validImpact.historicalComparison,
          similarEvents: -1,
        },
      };
      expect(EventImpactAnalysisSchema.safeParse(bad).success).toBe(false);
    });

    it.each(["positive", "negative", "neutral", "mixed"])(
      "accepts sector impact %s",
      (impact) => {
        const data = {
          ...validImpact,
          sectorImpact: [
            { sector: "Tech", impact, magnitude: 0.5, reasoning: "test" },
          ],
        };
        expect(EventImpactAnalysisSchema.safeParse(data).success).toBe(true);
      }
    );

    it("enforces playbook conviction 0-1", () => {
      const bad = {
        ...validImpact,
        tradingPlaybook: [
          { strategy: "test", timeframe: "1d", conviction: 2.0, risk: "none" },
        ],
      };
      expect(EventImpactAnalysisSchema.safeParse(bad).success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

describe("Event Intelligence — Prompts", () => {
  describe("EVENT_SYSTEM_PROMPT", () => {
    it("defines all event categories", () => {
      expect(EVENT_SYSTEM_PROMPT).toContain("earnings");
      expect(EVENT_SYSTEM_PROMPT).toContain("economic_data");
      expect(EVENT_SYSTEM_PROMPT).toContain("fed_meeting");
      expect(EVENT_SYSTEM_PROMPT).toContain("options_expiry");
      expect(EVENT_SYSTEM_PROMPT).toContain("index_rebalance");
    });

    it("defines risk density levels", () => {
      expect(EVENT_SYSTEM_PROMPT).toContain("light");
      expect(EVENT_SYSTEM_PROMPT).toContain("moderate");
      expect(EVENT_SYSTEM_PROMPT).toContain("heavy");
      expect(EVENT_SYSTEM_PROMPT).toContain("extreme");
    });

    it("includes trading playbook rules", () => {
      expect(EVENT_SYSTEM_PROMPT).toContain("Never enter a new position blind");
      expect(EVENT_SYSTEM_PROMPT).toContain("Gap fills");
    });
  });

  describe("buildEventScanPrompt", () => {
    it("includes date range", () => {
      const prompt = buildEventScanPrompt({
        startDate: "2026-05-04",
        endDate: "2026-05-10",
      });
      expect(prompt).toContain("2026-05-04");
      expect(prompt).toContain("2026-05-10");
    });

    it("includes focus tickers", () => {
      const prompt = buildEventScanPrompt({
        startDate: "2026-05-04",
        endDate: "2026-05-10",
        tickers: ["AAPL", "MSFT", "NVDA"],
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("MSFT");
      expect(prompt).toContain("NVDA");
    });

    it("includes sectors", () => {
      const prompt = buildEventScanPrompt({
        startDate: "2026-05-04",
        endDate: "2026-05-10",
        sectors: ["Technology", "Healthcare"],
      });
      expect(prompt).toContain("Technology");
      expect(prompt).toContain("Healthcare");
    });

    it("includes default event types", () => {
      const prompt = buildEventScanPrompt({
        startDate: "2026-05-04",
        endDate: "2026-05-10",
      });
      expect(prompt).toContain("economic data releases");
      expect(prompt).toContain("Fed meetings");
      expect(prompt).toContain("earnings reports");
    });
  });

  describe("buildEventImpactPrompt", () => {
    it("includes event details", () => {
      const prompt = buildEventImpactPrompt({
        event: "CPI Release",
        category: "economic_data",
      });
      expect(prompt).toContain("CPI Release");
      expect(prompt).toContain("economic_data");
    });

    it("includes actual and expected values", () => {
      const prompt = buildEventImpactPrompt({
        event: "NFP",
        category: "economic_data",
        actual: "256K",
        expected: "180K",
      });
      expect(prompt).toContain("Actual: 256K");
      expect(prompt).toContain("Expected: 180K");
    });

    it("includes market and sector data", () => {
      const prompt = buildEventImpactPrompt({
        event: "FOMC",
        category: "fed_meeting",
        marketData: "SPY down 1.2%",
        sectorData: "XLF -2.3%, XLK +0.5%",
      });
      expect(prompt).toContain("Market Reaction Data");
      expect(prompt).toContain("Sector Performance Data");
    });
  });

  describe("buildEventStrategyPrompt", () => {
    it("lists events with dates", () => {
      const prompt = buildEventStrategyPrompt({
        events: [
          { name: "FOMC", date: "2026-05-07", category: "fed_meeting" },
          { name: "AAPL Earnings", date: "2026-05-08", category: "earnings" },
        ],
      });
      expect(prompt).toContain("FOMC");
      expect(prompt).toContain("2026-05-07");
      expect(prompt).toContain("AAPL Earnings");
    });

    it("includes portfolio context", () => {
      const prompt = buildEventStrategyPrompt({
        events: [
          { name: "CPI", date: "2026-05-10", category: "economic_data" },
        ],
        portfolioContext: "60% equities, 30% bonds, 10% cash",
        riskTolerance: "moderate",
      });
      expect(prompt).toContain("60% equities");
      expect(prompt).toContain("Risk Tolerance: moderate");
    });
  });
});

// ---------------------------------------------------------------------------
// EventIntelligence class
// ---------------------------------------------------------------------------

describe("EventIntelligence — Class", () => {
  let mockOrchestrator: Orchestrator;

  beforeEach(() => {
    mockOrchestrator = new Orchestrator();
  });

  it("constructs with default orchestrator", () => {
    const events = new EventIntelligence();
    expect(events).toBeInstanceOf(EventIntelligence);
  });

  it("constructs with provided orchestrator", () => {
    const events = new EventIntelligence(mockOrchestrator);
    expect(events).toBeInstanceOf(EventIntelligence);
  });

  it("exposes all expected methods", () => {
    const events = new EventIntelligence(mockOrchestrator);
    expect(typeof events.scan).toBe("function");
    expect(typeof events.impactAnalysis).toBe("function");
    expect(typeof events.eventStrategy).toBe("function");
    expect(typeof events.consensus).toBe("function");
    expect(typeof events.fullBriefing).toBe("function");
  });
});
