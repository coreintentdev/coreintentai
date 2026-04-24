import { describe, it, expect } from "vitest";
import {
  ResearchResultSchema,
  ResearchFindingSchema,
} from "../src/types/index.js";
import {
  buildStructuredResearchPrompt,
  buildInsightSynthesisPrompt,
} from "../src/capabilities/research/prompts.js";

describe("ResearchResultSchema", () => {
  const validResult = {
    topic: "AAPL Q4 earnings outlook",
    ticker: "AAPL",
    findings: [
      {
        title: "iPhone 16 Pro sales exceed expectations",
        content: "Supply chain checks indicate strong demand in China and India.",
        relevance: "high",
        source: "Ming-Chi Kuo via X",
        recency: "recent",
      },
      {
        title: "Services revenue acceleration",
        content: "Apple TV+ subscriber growth and App Store commission changes.",
        relevance: "medium",
        source: "Bloomberg",
        recency: "dated",
      },
    ],
    overallSentiment: "bullish",
    keyMetrics: [
      { name: "P/E Ratio", value: "32.5x", trend: "stable" },
      { name: "Revenue Growth YoY", value: "8.2%", trend: "improving" },
    ],
    catalysts: [
      {
        event: "Q4 Earnings Report",
        expectedDate: "2026-01-30",
        impact: "positive",
        magnitude: "high",
      },
    ],
    risks: ["China regulatory crackdown", "AI hardware competition from Samsung"],
    summary: "AAPL shows strong momentum heading into Q4 earnings with iPhone demand and services growth as primary drivers.",
    confidence: 0.78,
    timestamp: new Date().toISOString(),
  };

  it("accepts valid research result", () => {
    const result = ResearchResultSchema.parse(validResult);
    expect(result.findings).toHaveLength(2);
    expect(result.ticker).toBe("AAPL");
  });

  it("accepts result without optional fields", () => {
    const minimal = {
      topic: "General market outlook",
      findings: [
        {
          title: "Markets rally",
          content: "Broad-based gains across sectors.",
          relevance: "high",
        },
      ],
      summary: "Markets are up.",
      confidence: 0.5,
      timestamp: new Date().toISOString(),
    };
    const result = ResearchResultSchema.parse(minimal);
    expect(result.ticker).toBeUndefined();
    expect(result.keyMetrics).toBeUndefined();
  });

  it("validates confidence range 0-1", () => {
    expect(() =>
      ResearchResultSchema.parse({ ...validResult, confidence: 1.5 })
    ).toThrow();
  });

  it("validates finding relevance enum", () => {
    for (const relevance of ["high", "medium", "low"]) {
      const finding = ResearchFindingSchema.parse({
        title: "Test",
        content: "Test content",
        relevance,
      });
      expect(finding.relevance).toBe(relevance);
    }
  });

  it("validates recency enum", () => {
    for (const recency of ["breaking", "recent", "dated"]) {
      const finding = ResearchFindingSchema.parse({
        title: "Test",
        content: "Content",
        relevance: "high",
        recency,
      });
      expect(finding.recency).toBe(recency);
    }
  });

  it("validates sentiment enum", () => {
    for (const sentiment of ["bullish", "bearish", "neutral", "mixed"]) {
      const result = ResearchResultSchema.parse({
        ...validResult,
        overallSentiment: sentiment,
      });
      expect(result.overallSentiment).toBe(sentiment);
    }
  });

  it("validates catalyst impact enum", () => {
    for (const impact of ["positive", "negative", "uncertain"]) {
      const result = ResearchResultSchema.parse({
        ...validResult,
        catalysts: [
          {
            event: "Test event",
            impact,
            magnitude: "medium",
          },
        ],
      });
      expect(result.catalysts![0].impact).toBe(impact);
    }
  });

  it("validates metric trend enum", () => {
    for (const trend of ["improving", "stable", "deteriorating"]) {
      const result = ResearchResultSchema.parse({
        ...validResult,
        keyMetrics: [{ name: "Test", value: "123", trend }],
      });
      expect(result.keyMetrics![0].trend).toBe(trend);
    }
  });
});

describe("Structured Research Prompts", () => {
  it("buildStructuredResearchPrompt includes ticker", () => {
    const prompt = buildStructuredResearchPrompt({
      query: "earnings outlook",
      ticker: "NVDA",
    });
    expect(prompt).toContain("NVDA");
    expect(prompt).toContain("structured market research");
    expect(prompt).toContain("ResearchResult schema");
  });

  it("buildStructuredResearchPrompt handles depth levels", () => {
    const quick = buildStructuredResearchPrompt({
      query: "overview",
      depth: "quick",
    });
    expect(quick).toContain("at least 3 key findings");

    const deep = buildStructuredResearchPrompt({
      query: "full analysis",
      depth: "deep",
    });
    expect(deep).toContain("at least 5 findings");
  });

  it("buildInsightSynthesisPrompt combines inputs", () => {
    const prompt = buildInsightSynthesisPrompt({
      webResearch: "iPhone sales are strong",
      reasoningAnalysis: "Valuation is stretched at 35x PE",
      query: "AAPL outlook",
      ticker: "AAPL",
    });
    expect(prompt).toContain("iPhone sales are strong");
    expect(prompt).toContain("Valuation is stretched");
    expect(prompt).toContain("WEB RESEARCH");
    expect(prompt).toContain("DEEP ANALYSIS");
    expect(prompt).toContain("AAPL");
  });
});
