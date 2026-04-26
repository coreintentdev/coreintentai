import { describe, it, expect } from "vitest";
import { ConsensusResultSchema } from "../src/types/index.js";
import {
  buildConsensusSynthesisPrompt,
  buildConsensusTradingPrompt,
} from "../src/capabilities/consensus/prompts.js";

describe("Multi-Model Consensus", () => {
  describe("ConsensusResultSchema", () => {
    const validConsensus = {
      query: "What is the outlook for AAPL over the next 3 months?",
      verdict:
        "Moderately bullish with earnings catalyst support but macro headwinds capping upside.",
      confidence: 0.72,
      agreementLevel: "strong_majority",
      modelContributions: [
        {
          provider: "claude",
          position: "Bullish — strong services growth and AI integration justify premium valuation",
          strengthOfEvidence: 0.82,
          uniqueInsight: "Identified underappreciated margin expansion in services segment",
        },
        {
          provider: "grok",
          position: "Moderately bullish — technical momentum supportive but overbought near-term",
          strengthOfEvidence: 0.68,
          uniqueInsight: "Noted bearish divergence on RSI daily chart",
        },
        {
          provider: "perplexity",
          position: "Bullish — analyst consensus price target 15% above current, recent upgrades",
          strengthOfEvidence: 0.75,
          uniqueInsight: "Three major analyst upgrades in past 2 weeks citing AI monetization",
        },
      ],
      keyAgreements: [
        "All models agree AAPL fundamentals are strong",
        "Services segment is the key growth driver",
        "AI integration is a meaningful catalyst",
      ],
      keyDisagreements: [
        {
          topic: "Near-term technical setup",
          positions: [
            "Grok: overbought and due for pullback",
            "Claude: pullback would be buying opportunity",
          ],
          resolution:
            "Both positions are compatible — near-term weakness doesn't negate medium-term bullish thesis",
        },
      ],
      blindSpots: [
        "No model addressed regulatory risk from EU Digital Markets Act",
        "China revenue concentration risk not discussed",
      ],
      synthesizedAnalysis:
        "AAPL presents a moderately bullish setup over the next 3 months. All three models converge on strong fundamentals driven by services growth and AI integration. The key debate is timing: technical indicators suggest near-term overbought conditions that could produce a 3-5% pullback, but this would likely be a buying opportunity given the fundamental backdrop.\n\nThe strongest evidence comes from Claude's deep dive into services margin expansion and Perplexity's citation of recent analyst upgrades. Grok's technical caution adds useful near-term context without invalidating the thesis. Notable blind spots include regulatory risk and China exposure.",
      actionableInsight:
        "Accumulate on weakness below $190 with a 3-month target of $215. Use a 5% trailing stop.",
      uncertaintyFactors: [
        "Macro rates environment remains uncertain",
        "iPhone cycle timing could shift sentiment",
        "Regulatory landscape evolving",
      ],
      timestamp: "2026-04-26T10:00:00.000Z",
    };

    it("accepts valid consensus result", () => {
      const result = ConsensusResultSchema.parse(validConsensus);
      expect(result.verdict).toContain("bullish");
      expect(result.confidence).toBe(0.72);
      expect(result.agreementLevel).toBe("strong_majority");
      expect(result.modelContributions).toHaveLength(3);
    });

    it("accepts all agreement levels", () => {
      const levels = [
        "unanimous",
        "strong_majority",
        "majority",
        "split",
        "contradictory",
      ] as const;
      for (const level of levels) {
        const result = ConsensusResultSchema.parse({
          ...validConsensus,
          agreementLevel: level,
        });
        expect(result.agreementLevel).toBe(level);
      }
    });

    it("rejects confidence out of range", () => {
      expect(() =>
        ConsensusResultSchema.parse({
          ...validConsensus,
          confidence: 1.5,
        })
      ).toThrow();
    });

    it("rejects negative confidence", () => {
      expect(() =>
        ConsensusResultSchema.parse({
          ...validConsensus,
          confidence: -0.1,
        })
      ).toThrow();
    });

    it("rejects invalid agreement level", () => {
      expect(() =>
        ConsensusResultSchema.parse({
          ...validConsensus,
          agreementLevel: "total_chaos",
        })
      ).toThrow();
    });

    it("rejects strength of evidence out of range", () => {
      expect(() =>
        ConsensusResultSchema.parse({
          ...validConsensus,
          modelContributions: [
            { ...validConsensus.modelContributions[0], strengthOfEvidence: 2.0 },
          ],
        })
      ).toThrow();
    });

    it("accepts contributions without unique insight", () => {
      const result = ConsensusResultSchema.parse({
        ...validConsensus,
        modelContributions: [
          {
            provider: "claude",
            position: "Bullish",
            strengthOfEvidence: 0.8,
          },
        ],
      });
      expect(result.modelContributions[0].uniqueInsight).toBeUndefined();
    });

    it("accepts empty arrays for optional collections", () => {
      const result = ConsensusResultSchema.parse({
        ...validConsensus,
        keyAgreements: [],
        keyDisagreements: [],
        blindSpots: [],
        uncertaintyFactors: [],
      });
      expect(result.keyAgreements).toHaveLength(0);
      expect(result.keyDisagreements).toHaveLength(0);
    });

    it("validates disagreement structure", () => {
      const result = ConsensusResultSchema.parse(validConsensus);
      expect(result.keyDisagreements[0].topic).toBe("Near-term technical setup");
      expect(result.keyDisagreements[0].positions).toHaveLength(2);
      expect(result.keyDisagreements[0].resolution).toBeTruthy();
    });

    it("rejects missing required fields", () => {
      expect(() =>
        ConsensusResultSchema.parse({
          query: "test",
          verdict: "test",
        })
      ).toThrow();
    });
  });

  describe("Consensus Prompts", () => {
    it("builds synthesis prompt from multiple model responses", () => {
      const prompt = buildConsensusSynthesisPrompt({
        query: "Is NVDA a buy?",
        responses: [
          { provider: "claude", content: "Bullish due to AI demand" },
          { provider: "grok", content: "Buy with caution, valuation stretched" },
          { provider: "perplexity", content: "Analyst consensus: Strong Buy" },
        ],
      });
      expect(prompt).toContain("NVDA");
      expect(prompt).toContain("CLAUDE");
      expect(prompt).toContain("GROK");
      expect(prompt).toContain("PERPLEXITY");
      expect(prompt).toContain("3 independent");
    });

    it("truncates long model responses", () => {
      const longContent = "A".repeat(5000);
      const prompt = buildConsensusSynthesisPrompt({
        query: "test",
        responses: [{ provider: "claude", content: longContent }],
      });
      expect(prompt.length).toBeLessThan(longContent.length);
    });

    it("builds trading consensus prompt", () => {
      const prompt = buildConsensusTradingPrompt({
        ticker: "TSLA",
        question: "Should I buy before earnings?",
        responses: [
          { provider: "claude", content: "High risk pre-earnings" },
          { provider: "grok", content: "Implied move is 8%, overpriced" },
        ],
      });
      expect(prompt).toContain("TSLA");
      expect(prompt).toContain("earnings");
      expect(prompt).toContain("trading");
    });

    it("includes market context in trading prompt", () => {
      const prompt = buildConsensusTradingPrompt({
        ticker: "AMZN",
        question: "Post-earnings outlook",
        responses: [{ provider: "claude", content: "Positive" }],
        marketContext: "Broad market in uptrend, tech leading",
      });
      expect(prompt).toContain("MARKET CONTEXT");
      expect(prompt).toContain("tech leading");
    });

    it("handles single model response", () => {
      const prompt = buildConsensusSynthesisPrompt({
        query: "test query",
        responses: [{ provider: "claude", content: "single response" }],
      });
      expect(prompt).toContain("1 independent");
      expect(prompt).toContain("MODEL 1: CLAUDE");
    });
  });
});
