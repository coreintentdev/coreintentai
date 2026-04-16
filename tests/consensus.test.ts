import { describe, it, expect } from "vitest";
import {
  buildConsensusArbitrationPrompt,
  buildMarketConsensusPrompt,
} from "../src/capabilities/consensus/prompts.js";
import {
  ConsensusResultSchema,
  ConsensusDivergenceSchema,
} from "../src/types/index.js";

describe("Consensus Engine", () => {
  describe("Prompts", () => {
    it("builds arbitration prompt with model outputs", () => {
      const prompt = buildConsensusArbitrationPrompt({
        question: "Is AAPL a buy right now?",
        modelOutputs: [
          { provider: "claude", output: "AAPL looks bullish due to strong earnings." },
          { provider: "grok", output: "AAPL is overvalued at current levels." },
        ],
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("CLAUDE");
      expect(prompt).toContain("GROK");
      expect(prompt).toContain("MODEL 1");
      expect(prompt).toContain("MODEL 2");
      expect(prompt).toContain("bullish");
      expect(prompt).toContain("overvalued");
      expect(prompt).toContain("consensus");
    });

    it("handles three-model arbitration", () => {
      const prompt = buildConsensusArbitrationPrompt({
        question: "Market outlook for Q2",
        modelOutputs: [
          { provider: "claude", output: "Cautiously optimistic." },
          { provider: "grok", output: "Bearish macro environment." },
          { provider: "perplexity", output: "Mixed signals from economic data." },
        ],
      });
      expect(prompt).toContain("3 independent AI models");
      expect(prompt).toContain("PERPLEXITY");
    });

    it("builds market consensus prompt with ticker", () => {
      const prompt = buildMarketConsensusPrompt({
        ticker: "NVDA",
        question: "What are the key risk factors?",
      });
      expect(prompt).toContain("NVDA");
      expect(prompt).toContain("risk factors");
      expect(prompt).toContain("confidence level");
    });

    it("includes timeframe in market consensus prompt", () => {
      const prompt = buildMarketConsensusPrompt({
        ticker: "TSLA",
        question: "Direction?",
        timeframe: "swing",
      });
      expect(prompt).toContain("TSLA");
      expect(prompt).toContain("swing");
    });
  });

  describe("Schema Validation", () => {
    it("validates a complete consensus result", () => {
      const result = ConsensusResultSchema.parse({
        verdict: "AAPL is moderately bullish on a swing timeframe",
        confidence: 0.72,
        agreementScore: 0.85,
        strongPoints: [
          "Strong earnings beat",
          "Technical breakout above 200 DMA",
        ],
        divergencePoints: [
          {
            topic: "Valuation",
            positions: [
              "Claude: fairly valued at 28x P/E",
              "Grok: overvalued relative to growth",
            ],
            resolution: "Valuation is stretched but not extreme given AI tailwinds",
          },
        ],
        synthesizedView:
          "AAPL shows bullish momentum supported by earnings strength and technical breakout. Valuation is the primary disagreement point, but AI-driven growth expectations provide justification.",
        riskFactors: [
          "iPhone cycle uncertainty",
          "China regulatory risk",
        ],
        actionableInsight:
          "Buy on pullbacks to the 200 DMA with a stop below the breakout level.",
      });
      expect(result.confidence).toBe(0.72);
      expect(result.agreementScore).toBe(0.85);
      expect(result.strongPoints).toHaveLength(2);
      expect(result.divergencePoints).toHaveLength(1);
    });

    it("rejects consensus result with invalid confidence", () => {
      expect(() =>
        ConsensusResultSchema.parse({
          verdict: "Test",
          confidence: 1.5,
          agreementScore: 0.5,
          strongPoints: [],
          divergencePoints: [],
          synthesizedView: "Test",
          riskFactors: [],
          actionableInsight: "Test",
        })
      ).toThrow();
    });

    it("rejects consensus result with invalid agreement score", () => {
      expect(() =>
        ConsensusResultSchema.parse({
          verdict: "Test",
          confidence: 0.5,
          agreementScore: -0.1,
          strongPoints: [],
          divergencePoints: [],
          synthesizedView: "Test",
          riskFactors: [],
          actionableInsight: "Test",
        })
      ).toThrow();
    });

    it("validates divergence schema independently", () => {
      const divergence = ConsensusDivergenceSchema.parse({
        topic: "Interest rate sensitivity",
        positions: ["Model A sees minimal impact", "Model B sees major drag"],
        resolution: "Rate sensitivity depends on duration of holdings",
      });
      expect(divergence.topic).toBe("Interest rate sensitivity");
      expect(divergence.positions).toHaveLength(2);
    });

    it("validates consensus with empty divergence points", () => {
      const result = ConsensusResultSchema.parse({
        verdict: "Strong bullish consensus",
        confidence: 0.9,
        agreementScore: 0.95,
        strongPoints: ["All models agree on uptrend"],
        divergencePoints: [],
        synthesizedView: "Full agreement across models.",
        riskFactors: [],
        actionableInsight: "Buy with confidence.",
      });
      expect(result.divergencePoints).toHaveLength(0);
      expect(result.agreementScore).toBe(0.95);
    });
  });
});
