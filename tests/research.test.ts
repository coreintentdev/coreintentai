import { describe, it, expect } from "vitest";
import { ResearchResultSchema } from "../src/types/index.js";
import {
  RESEARCH_SYSTEM_PROMPT,
  RESEARCH_SYNTHESIS_PROMPT,
  buildResearchPrompt,
  buildCompetitorAnalysisPrompt,
  buildCatalystResearchPrompt,
  buildSynthesisPrompt,
} from "../src/capabilities/research/prompts.js";

describe("Research Schema", () => {
  const validResearch = {
    ticker: "NVDA",
    query: "AI chip market outlook",
    summary:
      "NVIDIA dominates the AI accelerator market with 80%+ share. Strong demand from hyperscalers continues.",
    sections: [
      {
        heading: "Market Position",
        content:
          "NVIDIA holds dominant market share in AI training and inference chips.",
        confidence: 0.9,
        sources: [
          {
            title: "Mercury Research Q1 2026",
            url: "https://example.com/report",
            relevance: "high" as const,
          },
        ],
      },
      {
        heading: "Competitive Landscape",
        content:
          "AMD and custom silicon from hyperscalers represent emerging competition.",
        confidence: 0.75,
      },
    ],
    catalysts: [
      {
        event: "Next-gen Blackwell Ultra launch",
        expectedDate: "Q3 2026",
        impact: "positive" as const,
        magnitude: "high" as const,
      },
      {
        event: "Potential export restriction changes",
        impact: "uncertain" as const,
        magnitude: "high" as const,
      },
    ],
    risks: [
      "Custom silicon competition from Google TPU and Amazon Trainium",
      "Potential US-China export control escalation",
    ],
    sources: [
      {
        title: "Mercury Research Q1 2026",
        url: "https://example.com/report",
        relevance: "high" as const,
      },
      {
        title: "Analyst consensus compilation",
        relevance: "medium" as const,
      },
    ],
    dataFreshness: "recent" as const,
    overallConfidence: 0.85,
    timestamp: "2026-04-16T12:00:00.000Z",
  };

  it("accepts valid research data", () => {
    const result = ResearchResultSchema.parse(validResearch);
    expect(result.ticker).toBe("NVDA");
    expect(result.sections).toHaveLength(2);
    expect(result.catalysts).toHaveLength(2);
    expect(result.sources).toHaveLength(2);
    expect(result.overallConfidence).toBe(0.85);
  });

  it("accepts research without optional ticker", () => {
    const { ticker, ...noTicker } = validResearch;
    const result = ResearchResultSchema.parse(noTicker);
    expect(result.ticker).toBeUndefined();
  });

  it("accepts research without optional catalysts and risks", () => {
    const { catalysts, risks, ...minimal } = validResearch;
    const result = ResearchResultSchema.parse(minimal);
    expect(result.catalysts).toBeUndefined();
    expect(result.risks).toBeUndefined();
  });

  it("rejects confidence out of range", () => {
    expect(() =>
      ResearchResultSchema.parse({
        ...validResearch,
        overallConfidence: 1.5,
      })
    ).toThrow();
  });

  it("rejects invalid data freshness", () => {
    expect(() =>
      ResearchResultSchema.parse({
        ...validResearch,
        dataFreshness: "stale",
      })
    ).toThrow();
  });

  it("rejects invalid source relevance", () => {
    expect(() =>
      ResearchResultSchema.parse({
        ...validResearch,
        sources: [{ title: "Test", relevance: "critical" }],
      })
    ).toThrow();
  });

  it("rejects section confidence out of range", () => {
    expect(() =>
      ResearchResultSchema.parse({
        ...validResearch,
        sections: [
          {
            heading: "Test",
            content: "Test content",
            confidence: -0.1,
          },
        ],
      })
    ).toThrow();
  });

  it("validates catalyst impact enum", () => {
    expect(() =>
      ResearchResultSchema.parse({
        ...validResearch,
        catalysts: [
          {
            event: "Test",
            impact: "very_positive",
            magnitude: "high",
          },
        ],
      })
    ).toThrow();
  });
});

describe("Research Prompts (Upgraded)", () => {
  it("includes timestamp in the system prompt schema", () => {
    expect(RESEARCH_SYSTEM_PROMPT).toContain(
      `"timestamp": "<ISO 8601 timestamp>"`
    );
  });

  it("includes explicit schema in synthesis prompt", () => {
    expect(RESEARCH_SYNTHESIS_PROMPT).toContain(
      `"timestamp": "<ISO 8601 timestamp>"`
    );
    expect(RESEARCH_SYNTHESIS_PROMPT).toContain(`"sections": [`);
    expect(RESEARCH_SYNTHESIS_PROMPT).toContain(`"sources": [`);
  });

  it("builds structured research prompt for standard depth", () => {
    const prompt = buildResearchPrompt({
      query: "What is the outlook for AAPL?",
      ticker: "AAPL",
    });
    expect(prompt).toContain("AAPL");
    expect(prompt).toContain("thorough");
    expect(prompt).toContain("3 sources");
  });

  it("builds focused quick prompt", () => {
    const prompt = buildResearchPrompt({
      query: "Quick update",
      depth: "quick",
    });
    expect(prompt).toContain("focused");
    expect(prompt).toContain("2 sources");
  });

  it("builds comprehensive deep prompt", () => {
    const prompt = buildResearchPrompt({
      query: "Full analysis",
      ticker: "TSLA",
      depth: "deep",
    });
    expect(prompt).toContain("comprehensive");
    expect(prompt).toContain("4-6 sections");
    expect(prompt).toContain("catalysts");
    expect(prompt).toContain("risks");
  });

  it("builds competitor analysis prompt", () => {
    const prompt = buildCompetitorAnalysisPrompt({
      ticker: "MSFT",
      competitors: ["AAPL", "GOOGL"],
    });
    expect(prompt).toContain("MSFT");
    expect(prompt).toContain("AAPL");
    expect(prompt).toContain("GOOGL");
    expect(prompt).toContain("Competitive Moat");
    expect(prompt).toContain("Valuation Comparison");
  });

  it("builds catalyst prompt with correct time horizon", () => {
    const prompt = buildCatalystResearchPrompt({
      ticker: "AMZN",
      timeHorizon: "medium_term",
    });
    expect(prompt).toContain("AMZN");
    expect(prompt).toContain("1-6 months");
    expect(prompt).toContain("Earnings & Financials");
  });

  it("builds synthesis prompt with both inputs", () => {
    const prompt = buildSynthesisPrompt({
      webResearch: "Web data here",
      analysis: "Analysis here",
      query: "Test query",
      ticker: "NVDA",
    });
    expect(prompt).toContain("Web data here");
    expect(prompt).toContain("Analysis here");
    expect(prompt).toContain("[NVDA]");
    expect(prompt).toContain("conflict");
  });
});
