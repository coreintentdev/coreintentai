import { describe, it, expect } from "vitest";
import { CorrelationAnalysisSchema } from "../src/types/index.js";
import {
  buildCorrelationPrompt,
  buildStressCorrelationPrompt,
  buildConcentrationPrompt,
} from "../src/capabilities/correlation/prompts.js";

describe("Correlation Analysis", () => {
  describe("CorrelationAnalysisSchema", () => {
    const validAnalysis = {
      assets: ["AAPL", "MSFT", "GOOGL", "AMZN"],
      correlationPairs: [
        { assetA: "AAPL", assetB: "MSFT", correlation: 0.85, regime: "normal" as const },
        { assetA: "AAPL", assetB: "GOOGL", correlation: 0.78, regime: "normal" as const },
        { assetA: "AAPL", assetB: "AMZN", correlation: 0.72, regime: "normal" as const },
        { assetA: "MSFT", assetB: "GOOGL", correlation: 0.82, regime: "stress" as const },
      ],
      clusters: [
        {
          name: "Big Tech",
          assets: ["AAPL", "MSFT", "GOOGL", "AMZN"],
          avgCorrelation: 0.79,
          riskContribution: 0.95,
          description: "All positions are mega-cap tech — single cluster",
        },
      ],
      concentrationRisks: [
        {
          type: "sector" as const,
          exposure: 1.0,
          assets: ["AAPL", "MSFT", "GOOGL", "AMZN"],
          severity: "critical" as const,
          description: "100% technology sector exposure",
        },
        {
          type: "factor" as const,
          exposure: 0.85,
          assets: ["AAPL", "MSFT", "GOOGL"],
          severity: "high" as const,
          description: "Strong momentum factor exposure",
        },
      ],
      diversificationScore: 15,
      effectivePositions: 1.3,
      tailRiskAssessment: {
        crisisCorrelation: 0.95,
        expectedDrawdownPct: 45,
        vulnerabilities: [
          "Rate hike sensitivity across all positions",
          "Antitrust regulatory risk",
        ],
      },
      recommendations: [
        {
          action: "add" as const,
          asset: "GLD",
          rationale: "Add uncorrelated hedge via gold exposure",
          priority: "urgent" as const,
        },
        {
          action: "reduce" as const,
          asset: "AMZN",
          rationale: "Reduce overlapping tech exposure",
          priority: "high" as const,
        },
      ],
      summary:
        "Portfolio is effectively a single mega-cap tech bet with minimal diversification.",
      timestamp: "2026-04-23T12:00:00.000Z",
    };

    it("accepts valid correlation analysis", () => {
      const result = CorrelationAnalysisSchema.parse(validAnalysis);
      expect(result.assets).toHaveLength(4);
      expect(result.diversificationScore).toBe(15);
      expect(result.effectivePositions).toBe(1.3);
    });

    it("validates correlation range (-1 to 1)", () => {
      expect(() =>
        CorrelationAnalysisSchema.parse({
          ...validAnalysis,
          correlationPairs: [
            { assetA: "A", assetB: "B", correlation: 1.5, regime: "normal" },
          ],
        })
      ).toThrow();
    });

    it("validates negative correlation values", () => {
      const withNegative = {
        ...validAnalysis,
        correlationPairs: [
          { assetA: "SPY", assetB: "TLT", correlation: -0.45, regime: "normal" },
        ],
      };
      const result = CorrelationAnalysisSchema.parse(withNegative);
      expect(result.correlationPairs[0].correlation).toBe(-0.45);
    });

    it("rejects invalid regime", () => {
      expect(() =>
        CorrelationAnalysisSchema.parse({
          ...validAnalysis,
          correlationPairs: [
            { assetA: "A", assetB: "B", correlation: 0.5, regime: "panic" },
          ],
        })
      ).toThrow();
    });

    it("validates concentration risk types", () => {
      expect(() =>
        CorrelationAnalysisSchema.parse({
          ...validAnalysis,
          concentrationRisks: [
            {
              type: "currency",
              exposure: 0.5,
              assets: ["X"],
              severity: "low",
              description: "test",
            },
          ],
        })
      ).toThrow();
    });

    it("validates diversification score range (0-100)", () => {
      expect(() =>
        CorrelationAnalysisSchema.parse({
          ...validAnalysis,
          diversificationScore: 150,
        })
      ).toThrow();
    });

    it("requires positive effective positions", () => {
      expect(() =>
        CorrelationAnalysisSchema.parse({
          ...validAnalysis,
          effectivePositions: 0,
        })
      ).toThrow();
    });

    it("validates recommendation actions", () => {
      const result = CorrelationAnalysisSchema.parse(validAnalysis);
      expect(result.recommendations[0].action).toBe("add");
      expect(result.recommendations[1].action).toBe("reduce");
    });

    it("rejects invalid recommendation action", () => {
      expect(() =>
        CorrelationAnalysisSchema.parse({
          ...validAnalysis,
          recommendations: [
            { action: "yolo", asset: "BTC", rationale: "moon", priority: "high" },
          ],
        })
      ).toThrow();
    });

    it("validates tail risk assessment", () => {
      const result = CorrelationAnalysisSchema.parse(validAnalysis);
      expect(result.tailRiskAssessment.crisisCorrelation).toBe(0.95);
      expect(result.tailRiskAssessment.expectedDrawdownPct).toBe(45);
      expect(result.tailRiskAssessment.vulnerabilities).toHaveLength(2);
    });

    it("validates crisis correlation range", () => {
      expect(() =>
        CorrelationAnalysisSchema.parse({
          ...validAnalysis,
          tailRiskAssessment: {
            crisisCorrelation: 2.0,
            expectedDrawdownPct: 30,
            vulnerabilities: [],
          },
        })
      ).toThrow();
    });

    it("accepts all five concentration risk types", () => {
      const types = ["sector", "factor", "geographic", "thematic", "liquidity"] as const;
      for (const type of types) {
        const analysis = {
          ...validAnalysis,
          concentrationRisks: [
            {
              type,
              exposure: 0.5,
              assets: ["TEST"],
              severity: "moderate" as const,
              description: `${type} test`,
            },
          ],
        };
        const result = CorrelationAnalysisSchema.parse(analysis);
        expect(result.concentrationRisks[0].type).toBe(type);
      }
    });

    it("accepts all rebalance action types", () => {
      const actions = ["add", "reduce", "hedge", "replace", "maintain"] as const;
      for (const action of actions) {
        const analysis = {
          ...validAnalysis,
          recommendations: [
            {
              action,
              asset: "TEST",
              rationale: "test",
              priority: "medium" as const,
            },
          ],
        };
        const result = CorrelationAnalysisSchema.parse(analysis);
        expect(result.recommendations[0].action).toBe(action);
      }
    });
  });

  describe("Correlation Prompts", () => {
    it("builds portfolio correlation prompt", () => {
      const prompt = buildCorrelationPrompt({
        positions: [
          { ticker: "AAPL", weight: 0.25, sector: "Technology", beta: 1.2 },
          { ticker: "XOM", weight: 0.15, sector: "Energy" },
          { ticker: "JNJ", weight: 0.10, sector: "Healthcare" },
        ],
        totalValue: 500000,
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("25.0%");
      expect(prompt).toContain("Technology");
      expect(prompt).toContain("β=1.2");
      expect(prompt).toContain("XOM");
      expect(prompt).toContain("Energy");
      expect(prompt).toContain("$500,000");
      expect(prompt).toContain("Herfindahl");
    });

    it("includes benchmarks when provided", () => {
      const prompt = buildCorrelationPrompt({
        positions: [{ ticker: "AAPL", weight: 1.0 }],
        benchmarks: ["SPY", "QQQ"],
      });
      expect(prompt).toContain("SPY");
      expect(prompt).toContain("QQQ");
    });

    it("builds stress correlation prompt", () => {
      const prompt = buildStressCorrelationPrompt({
        positions: [
          { ticker: "AAPL", weight: 0.3 },
          { ticker: "MSFT", weight: 0.3 },
          { ticker: "TLT", weight: 0.4 },
        ],
        scenario: "Federal Reserve raises rates by 100bps unexpectedly",
      });
      expect(prompt).toContain("100bps");
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("TLT");
      expect(prompt).toContain("hedging");
    });

    it("builds concentration-only prompt", () => {
      const prompt = buildConcentrationPrompt({
        positions: [
          { ticker: "AAPL", weight: 0.2, sector: "Technology", region: "US" },
          { ticker: "TSM", weight: 0.15, sector: "Semiconductors", region: "Taiwan" },
        ],
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("Technology");
      expect(prompt).toContain("US");
      expect(prompt).toContain("TSM");
      expect(prompt).toContain("Taiwan");
      expect(prompt).toContain("Thematic");
    });
  });
});
