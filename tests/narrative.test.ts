import { describe, it, expect } from "vitest";
import {
  NarrativeSchema,
  NarrativeReportSchema,
  NarrativeCategory,
  NarrativeStage,
} from "../src/types/index.js";
import {
  buildNarrativeDetectionPrompt,
  buildNarrativeStrengthPrompt,
  buildNarrativeShiftPrompt,
  buildNarrativeMapPrompt,
} from "../src/capabilities/narrative/prompts.js";
import { NarrativeIntelligence } from "../src/capabilities/narrative/index.js";

describe("Narrative Intelligence", () => {
  describe("NarrativeSchema", () => {
    const validNarrative = {
      id: "ai-infrastructure-boom",
      name: "AI Infrastructure Boom",
      category: "sector",
      stage: "accelerating",
      strength: 85,
      conviction: 0.9,
      freshness: 0.6,
      crowding: 0.7,
      priceReflexivity: 0.85,
      description:
        "Massive capital expenditure cycle driven by generative AI demand for GPUs, data centers, and networking equipment.",
      keyDrivers: [
        "NVDA earnings beats",
        "Hyperscaler capex guidance increases",
        "Enterprise AI adoption accelerating",
      ],
      supportingEvidence: [
        "NVDA revenue tripled YoY",
        "MSFT/GOOGL/AMZN all raising capex guidance",
        "Power demand from data centers surging",
      ],
      counterArguments: [
        "Spending may outpace actual AI revenue generation",
        "Semiconductor cycles historically mean-revert",
        "Competition from custom silicon (TPUs, Trainium)",
      ],
      affectedTickers: ["NVDA", "AMD", "AVGO", "MRVL", "SMCI"],
      relatedNarratives: ["AI replacing labor", "Energy crisis from AI"],
      tradeImplication:
        "Long semiconductor and data center infrastructure names. Watch for signs of capex fatigue in hyperscaler earnings calls.",
    };

    it("accepts valid narrative", () => {
      const result = NarrativeSchema.parse(validNarrative);
      expect(result.id).toBe("ai-infrastructure-boom");
      expect(result.name).toBe("AI Infrastructure Boom");
      expect(result.strength).toBe(85);
    });

    it("accepts all narrative categories", () => {
      const categories = [
        "macro",
        "sector",
        "company",
        "geopolitical",
        "structural",
        "thematic",
      ] as const;
      for (const category of categories) {
        const result = NarrativeSchema.parse({
          ...validNarrative,
          category,
        });
        expect(result.category).toBe(category);
      }
    });

    it("accepts all narrative stages", () => {
      const stages = [
        "emerging",
        "accelerating",
        "consensus",
        "exhausted",
        "reversing",
      ] as const;
      for (const stage of stages) {
        const result = NarrativeSchema.parse({
          ...validNarrative,
          stage,
        });
        expect(result.stage).toBe(stage);
      }
    });

    it("rejects invalid category", () => {
      expect(() =>
        NarrativeSchema.parse({
          ...validNarrative,
          category: "fantasy",
        })
      ).toThrow();
    });

    it("rejects invalid stage", () => {
      expect(() =>
        NarrativeSchema.parse({
          ...validNarrative,
          stage: "dormant",
        })
      ).toThrow();
    });

    it("rejects strength out of range", () => {
      expect(() =>
        NarrativeSchema.parse({
          ...validNarrative,
          strength: 150,
        })
      ).toThrow();
    });

    it("rejects negative strength", () => {
      expect(() =>
        NarrativeSchema.parse({
          ...validNarrative,
          strength: -10,
        })
      ).toThrow();
    });

    it("rejects conviction out of range", () => {
      expect(() =>
        NarrativeSchema.parse({
          ...validNarrative,
          conviction: 1.5,
        })
      ).toThrow();
    });

    it("rejects negative conviction", () => {
      expect(() =>
        NarrativeSchema.parse({
          ...validNarrative,
          conviction: -0.1,
        })
      ).toThrow();
    });

    it("rejects freshness out of range", () => {
      expect(() =>
        NarrativeSchema.parse({
          ...validNarrative,
          freshness: 2.0,
        })
      ).toThrow();
    });

    it("rejects crowding out of range", () => {
      expect(() =>
        NarrativeSchema.parse({
          ...validNarrative,
          crowding: 1.1,
        })
      ).toThrow();
    });

    it("rejects priceReflexivity out of range", () => {
      expect(() =>
        NarrativeSchema.parse({
          ...validNarrative,
          priceReflexivity: -0.5,
        })
      ).toThrow();
    });

    it("accepts boundary values for scoring dimensions", () => {
      const result = NarrativeSchema.parse({
        ...validNarrative,
        strength: 0,
        conviction: 0,
        freshness: 0,
        crowding: 0,
        priceReflexivity: 0,
      });
      expect(result.strength).toBe(0);
      expect(result.conviction).toBe(0);

      const result2 = NarrativeSchema.parse({
        ...validNarrative,
        strength: 100,
        conviction: 1,
        freshness: 1,
        crowding: 1,
        priceReflexivity: 1,
      });
      expect(result2.strength).toBe(100);
      expect(result2.conviction).toBe(1);
    });

    it("accepts empty arrays for list fields", () => {
      const result = NarrativeSchema.parse({
        ...validNarrative,
        keyDrivers: [],
        supportingEvidence: [],
        counterArguments: [],
        affectedTickers: [],
        relatedNarratives: [],
      });
      expect(result.keyDrivers).toHaveLength(0);
      expect(result.affectedTickers).toHaveLength(0);
    });

    it("rejects missing required fields", () => {
      expect(() =>
        NarrativeSchema.parse({
          id: "test",
          name: "Test",
        })
      ).toThrow();
    });
  });

  describe("NarrativeReportSchema", () => {
    const validNarrative = {
      id: "fed-rate-cuts",
      name: "Fed Rate Cut Cycle",
      category: "macro",
      stage: "consensus",
      strength: 72,
      conviction: 0.8,
      freshness: 0.3,
      crowding: 0.85,
      priceReflexivity: 0.6,
      description:
        "Market pricing in aggressive rate cuts as inflation declines.",
      keyDrivers: ["CPI declining", "Labor market softening", "Fed dot plot"],
      supportingEvidence: [
        "Fed funds futures pricing 4 cuts",
        "Bond yields falling",
      ],
      counterArguments: [
        "Core services inflation sticky",
        "Fiscal deficits inflationary",
      ],
      affectedTickers: ["TLT", "XLU", "XLRE"],
      relatedNarratives: ["Soft landing", "Duration trade"],
      tradeImplication: "Long duration. But crowding risk is elevated.",
    };

    const validReport = {
      ticker: "NVDA",
      narratives: [validNarrative],
      dominantNarrative: "AI Infrastructure Boom",
      narrativeConflicts: [
        {
          narrativeA: "AI Infrastructure Boom",
          narrativeB: "Semiconductor Cycle Peak",
          tension:
            "AI demand vs. historical pattern of cyclical mean-reversion in semis",
          resolution:
            "Likely resolves in favor of AI narrative unless orders cancel",
        },
      ],
      shiftSignals: [
        {
          narrative: "Fed Rate Cut Cycle",
          signal: "Hot CPI print contradicting rate cut thesis",
          direction: "stalling" as const,
          confidence: 0.65,
        },
      ],
      tradingImplications: [
        "Stay long AI infrastructure names",
        "Reduce duration exposure given shift signals",
        "Watch for semiconductor order cancellations as exhaustion signal",
      ],
      summary:
        "AI infrastructure narrative remains dominant and accelerating. Fed rate cut narrative showing signs of exhaustion with elevated crowding. Potential conflict between semiconductor cycle bears and AI bulls creates volatility opportunity.",
      timestamp: "2026-05-03T10:00:00.000Z",
    };

    it("accepts valid narrative report", () => {
      const result = NarrativeReportSchema.parse(validReport);
      expect(result.ticker).toBe("NVDA");
      expect(result.narratives).toHaveLength(1);
      expect(result.dominantNarrative).toBe("AI Infrastructure Boom");
    });

    it("accepts report with sector instead of ticker", () => {
      const result = NarrativeReportSchema.parse({
        ...validReport,
        ticker: undefined,
        sector: "Technology",
      });
      expect(result.sector).toBe("Technology");
      expect(result.ticker).toBeUndefined();
    });

    it("accepts report with both ticker and sector", () => {
      const result = NarrativeReportSchema.parse({
        ...validReport,
        sector: "Semiconductors",
      });
      expect(result.ticker).toBe("NVDA");
      expect(result.sector).toBe("Semiconductors");
    });

    it("accepts report with neither ticker nor sector", () => {
      const result = NarrativeReportSchema.parse({
        ...validReport,
        ticker: undefined,
      });
      expect(result.ticker).toBeUndefined();
      expect(result.sector).toBeUndefined();
    });

    it("validates narrative conflicts structure", () => {
      const result = NarrativeReportSchema.parse(validReport);
      expect(result.narrativeConflicts).toHaveLength(1);
      expect(result.narrativeConflicts[0].narrativeA).toBe(
        "AI Infrastructure Boom"
      );
      expect(result.narrativeConflicts[0].narrativeB).toBe(
        "Semiconductor Cycle Peak"
      );
    });

    it("accepts conflict without resolution", () => {
      const result = NarrativeReportSchema.parse({
        ...validReport,
        narrativeConflicts: [
          {
            narrativeA: "Bull",
            narrativeB: "Bear",
            tension: "Opposing views",
          },
        ],
      });
      expect(result.narrativeConflicts[0].resolution).toBeUndefined();
    });

    it("validates shift signals structure", () => {
      const result = NarrativeReportSchema.parse(validReport);
      expect(result.shiftSignals).toHaveLength(1);
      expect(result.shiftSignals[0].direction).toBe("stalling");
      expect(result.shiftSignals[0].confidence).toBe(0.65);
    });

    it("accepts all shift signal directions", () => {
      const directions = ["advancing", "stalling", "reversing"] as const;
      for (const direction of directions) {
        const result = NarrativeReportSchema.parse({
          ...validReport,
          shiftSignals: [
            { ...validReport.shiftSignals[0], direction },
          ],
        });
        expect(result.shiftSignals[0].direction).toBe(direction);
      }
    });

    it("rejects invalid shift signal direction", () => {
      expect(() =>
        NarrativeReportSchema.parse({
          ...validReport,
          shiftSignals: [
            { ...validReport.shiftSignals[0], direction: "exploding" },
          ],
        })
      ).toThrow();
    });

    it("rejects shift signal confidence out of range", () => {
      expect(() =>
        NarrativeReportSchema.parse({
          ...validReport,
          shiftSignals: [
            { ...validReport.shiftSignals[0], confidence: 1.5 },
          ],
        })
      ).toThrow();
    });

    it("accepts empty arrays", () => {
      const result = NarrativeReportSchema.parse({
        ...validReport,
        narratives: [],
        narrativeConflicts: [],
        shiftSignals: [],
        tradingImplications: [],
      });
      expect(result.narratives).toHaveLength(0);
      expect(result.narrativeConflicts).toHaveLength(0);
      expect(result.shiftSignals).toHaveLength(0);
      expect(result.tradingImplications).toHaveLength(0);
    });

    it("accepts multiple narratives", () => {
      const secondNarrative = {
        ...validNarrative,
        id: "ai-bubble-fear",
        name: "AI Bubble Fear",
        category: "sector" as const,
        stage: "emerging" as const,
        strength: 35,
      };
      const result = NarrativeReportSchema.parse({
        ...validReport,
        narratives: [validNarrative, secondNarrative],
      });
      expect(result.narratives).toHaveLength(2);
    });

    it("rejects missing required fields", () => {
      expect(() =>
        NarrativeReportSchema.parse({
          ticker: "AAPL",
          narratives: [],
        })
      ).toThrow();
    });

    it("rejects invalid timestamp", () => {
      expect(() =>
        NarrativeReportSchema.parse({
          ...validReport,
          timestamp: "not-a-date",
        })
      ).toThrow();
    });
  });

  describe("NarrativeCategory enum", () => {
    it("contains all expected categories", () => {
      const expected = [
        "macro",
        "sector",
        "company",
        "geopolitical",
        "structural",
        "thematic",
      ];
      for (const cat of expected) {
        expect(NarrativeCategory.parse(cat)).toBe(cat);
      }
    });

    it("rejects unknown categories", () => {
      expect(() => NarrativeCategory.parse("crypto")).toThrow();
      expect(() => NarrativeCategory.parse("technical")).toThrow();
    });
  });

  describe("NarrativeStage enum", () => {
    it("contains all expected stages", () => {
      const expected = [
        "emerging",
        "accelerating",
        "consensus",
        "exhausted",
        "reversing",
      ];
      for (const stage of expected) {
        expect(NarrativeStage.parse(stage)).toBe(stage);
      }
    });

    it("rejects unknown stages", () => {
      expect(() => NarrativeStage.parse("dormant")).toThrow();
      expect(() => NarrativeStage.parse("exploding")).toThrow();
    });
  });

  describe("Narrative Prompts", () => {
    it("builds detection prompt with ticker only", () => {
      const prompt = buildNarrativeDetectionPrompt({
        ticker: "NVDA",
      });
      expect(prompt).toContain("NVDA");
      expect(prompt).toContain("narrative");
    });

    it("builds detection prompt with current price", () => {
      const prompt = buildNarrativeDetectionPrompt({
        ticker: "AAPL",
        currentPrice: 195.5,
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("$195.5");
    });

    it("includes recent news when provided", () => {
      const prompt = buildNarrativeDetectionPrompt({
        ticker: "TSLA",
        recentNews: "Tesla announces robotaxi launch date",
      });
      expect(prompt).toContain("Recent News");
      expect(prompt).toContain("robotaxi");
    });

    it("includes price action when provided", () => {
      const prompt = buildNarrativeDetectionPrompt({
        ticker: "META",
        priceAction: "Up 15% in two weeks on AI momentum",
      });
      expect(prompt).toContain("Price Action");
      expect(prompt).toContain("15%");
    });

    it("includes analyst commentary when provided", () => {
      const prompt = buildNarrativeDetectionPrompt({
        ticker: "AMZN",
        analystCommentary: "Multiple upgrades on AWS reacceleration thesis",
      });
      expect(prompt).toContain("Analyst Commentary");
      expect(prompt).toContain("AWS reacceleration");
    });

    it("includes social sentiment when provided", () => {
      const prompt = buildNarrativeDetectionPrompt({
        ticker: "GME",
        socialSentiment: "Retail enthusiasm surging on Reddit",
      });
      expect(prompt).toContain("Social");
      expect(prompt).toContain("Reddit");
    });

    it("builds strength prompt with narrative name", () => {
      const prompt = buildNarrativeStrengthPrompt({
        narrative: "AI Infrastructure Boom",
      });
      expect(prompt).toContain("AI Infrastructure Boom");
      expect(prompt).toContain("strength");
    });

    it("builds strength prompt with ticker context", () => {
      const prompt = buildNarrativeStrengthPrompt({
        narrative: "Fed Pivot",
        ticker: "TLT",
      });
      expect(prompt).toContain("Fed Pivot");
      expect(prompt).toContain("TLT");
    });

    it("includes positioning data in strength prompt", () => {
      const prompt = buildNarrativeStrengthPrompt({
        narrative: "Short Squeeze",
        positioningData: "Short interest at 35% of float",
      });
      expect(prompt).toContain("Positioning Data");
      expect(prompt).toContain("35%");
    });

    it("includes flow data in strength prompt", () => {
      const prompt = buildNarrativeStrengthPrompt({
        narrative: "Rotation to Value",
        flowData: "Record outflows from growth ETFs",
      });
      expect(prompt).toContain("Flow Data");
      expect(prompt).toContain("outflows");
    });

    it("includes media analysis in strength prompt", () => {
      const prompt = buildNarrativeStrengthPrompt({
        narrative: "Soft Landing",
        mediaAnalysis: "CNBC coverage shifted bullish",
      });
      expect(prompt).toContain("Media");
      expect(prompt).toContain("CNBC");
    });

    it("includes price response in strength prompt", () => {
      const prompt = buildNarrativeStrengthPrompt({
        narrative: "AI Bubble",
        priceResponse: "Market rallied on hot CPI ignoring inflation risk",
      });
      expect(prompt).toContain("Price Response");
      expect(prompt).toContain("CPI");
    });

    it("builds shift prompt with required params", () => {
      const prompt = buildNarrativeShiftPrompt({
        narrative: "Fed Rate Cut Cycle",
        previousStage: "consensus",
      });
      expect(prompt).toContain("Fed Rate Cut Cycle");
      expect(prompt).toContain("consensus");
      expect(prompt).toContain("shifting");
    });

    it("includes ticker in shift prompt", () => {
      const prompt = buildNarrativeShiftPrompt({
        narrative: "EV Revolution",
        previousStage: "accelerating",
        ticker: "TSLA",
      });
      expect(prompt).toContain("TSLA");
    });

    it("includes recent developments in shift prompt", () => {
      const prompt = buildNarrativeShiftPrompt({
        narrative: "China Reopening",
        previousStage: "exhausted",
        recentDevelopments: "PMI data disappointing for third month",
      });
      expect(prompt).toContain("Recent Developments");
      expect(prompt).toContain("PMI");
    });

    it("includes counter-narratives in shift prompt", () => {
      const prompt = buildNarrativeShiftPrompt({
        narrative: "Soft Landing",
        previousStage: "consensus",
        counterNarratives: "Hard landing thesis gaining institutional backing",
      });
      expect(prompt).toContain("Counter-Narratives");
      expect(prompt).toContain("Hard landing");
    });

    it("includes price action in shift prompt", () => {
      const prompt = buildNarrativeShiftPrompt({
        narrative: "Growth Dominance",
        previousStage: "accelerating",
        priceAction: "Growth underperforming value for 3 consecutive weeks",
      });
      expect(prompt).toContain("Price Action");
      expect(prompt).toContain("underperforming");
    });

    it("builds sector map prompt", () => {
      const prompt = buildNarrativeMapPrompt({
        sector: "Technology",
      });
      expect(prompt).toContain("Technology");
      expect(prompt).toContain("narrative");
    });

    it("includes tickers in sector map prompt", () => {
      const prompt = buildNarrativeMapPrompt({
        sector: "Semiconductors",
        tickers: ["NVDA", "AMD", "INTC", "AVGO"],
      });
      expect(prompt).toContain("NVDA");
      expect(prompt).toContain("AMD");
      expect(prompt).toContain("INTC");
      expect(prompt).toContain("AVGO");
    });

    it("includes market context in sector map prompt", () => {
      const prompt = buildNarrativeMapPrompt({
        sector: "Energy",
        marketContext: "Oil at $85, OPEC+ maintaining cuts",
      });
      expect(prompt).toContain("Market Context");
      expect(prompt).toContain("OPEC");
    });

    it("includes timeframe in sector map prompt", () => {
      const prompt = buildNarrativeMapPrompt({
        sector: "Financials",
        timeframe: "Q2 2026",
      });
      expect(prompt).toContain("Timeframe");
      expect(prompt).toContain("Q2 2026");
    });
  });

  describe("NarrativeIntelligence class", () => {
    it("can be instantiated without arguments", () => {
      const ni = new NarrativeIntelligence();
      expect(ni).toBeInstanceOf(NarrativeIntelligence);
    });

    it("has detect method", () => {
      const ni = new NarrativeIntelligence();
      expect(typeof ni.detect).toBe("function");
    });

    it("has scoreStrength method", () => {
      const ni = new NarrativeIntelligence();
      expect(typeof ni.scoreStrength).toBe("function");
    });

    it("has detectShifts method", () => {
      const ni = new NarrativeIntelligence();
      expect(typeof ni.detectShifts).toBe("function");
    });

    it("has mapSector method", () => {
      const ni = new NarrativeIntelligence();
      expect(typeof ni.mapSector).toBe("function");
    });

    it("has crossValidate method", () => {
      const ni = new NarrativeIntelligence();
      expect(typeof ni.crossValidate).toBe("function");
    });
  });
});
