import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MarketIntelligencePipeline } from "../src/pipeline/index.js";
import {
  IntelligenceBriefSchema,
  CapabilitySignalSchema,
  DivergenceSchema,
} from "../src/pipeline/types.js";
import {
  INTELLIGENCE_EXTRACTION_PROMPTS,
  SYNTHESIS_SYSTEM_PROMPT,
  buildSynthesisPrompt,
} from "../src/pipeline/prompts.js";
import { Orchestrator } from "../src/orchestrator/index.js";
import * as modelsModule from "../src/models/index.js";
import type { CompletionResponse } from "../src/models/base.js";

function mockResponse(
  content: string,
  provider: "claude" | "grok" | "perplexity" = "claude"
): CompletionResponse {
  return {
    content,
    provider,
    model: `mock-${provider}`,
    tokenUsage: { inputTokens: 80, outputTokens: 120, totalTokens: 200 },
    latencyMs: 30,
    finishReason: "end_turn",
  };
}

function makeCapabilityResponse(
  signal: string,
  confidence: number,
  keyFinding: string
): string {
  return JSON.stringify({ signal, confidence, keyFinding });
}

const MOCK_BRIEF = JSON.stringify({
  ticker: "AAPL",
  timestamp: "2026-04-27T12:00:00.000Z",
  conviction: { direction: "buy", score: 0.6, confidence: 0.75 },
  signalMatrix: [
    {
      capability: "sentiment",
      signal: "bullish",
      confidence: 0.8,
      keyFinding: "Strong earnings",
    },
    {
      capability: "regime",
      signal: "bullish",
      confidence: 0.7,
      keyFinding: "Trending up",
    },
  ],
  divergences: [],
  executiveSummary: "AAPL shows aligned bullish signals across sentiment and regime.",
  riskOverlay: {
    overallRisk: "moderate",
    regimeContext: "Trending up with normal volatility",
    positionSizePct: 3,
    warnings: ["Earnings event risk in 2 weeks"],
  },
  actions: [
    {
      priority: 1,
      action: "Enter long position",
      rationale: "Aligned bullish signals with moderate risk",
      timeframe: "This week",
    },
  ],
  meta: {
    capabilitiesUsed: ["sentiment", "regime"],
    totalLatencyMs: 500,
    modelsUsed: ["mock-grok", "mock-claude"],
    tokenUsage: { inputTokens: 300, outputTokens: 400, totalTokens: 700 },
  },
});

describe("Market Intelligence Pipeline", () => {
  let mockAdapter: {
    complete: ReturnType<typeof vi.fn>;
    ping: ReturnType<typeof vi.fn>;
    provider: string;
    model: string;
  };

  beforeEach(() => {
    mockAdapter = {
      complete: vi.fn(),
      ping: vi.fn().mockResolvedValue(true),
      provider: "claude",
      model: "mock-claude",
    };
    vi.spyOn(modelsModule, "getAdapter").mockReturnValue(mockAdapter as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Schema Validation", () => {
    it("validates a well-formed IntelligenceBrief", () => {
      const brief = IntelligenceBriefSchema.parse(JSON.parse(MOCK_BRIEF));
      expect(brief.ticker).toBe("AAPL");
      expect(brief.conviction.direction).toBe("buy");
      expect(brief.signalMatrix).toHaveLength(2);
    });

    it("validates CapabilitySignal", () => {
      const signal = CapabilitySignalSchema.parse({
        capability: "sentiment",
        signal: "bullish",
        confidence: 0.85,
        keyFinding: "Strong earnings beat",
      });
      expect(signal.signal).toBe("bullish");
    });

    it("rejects invalid signal direction", () => {
      expect(() =>
        CapabilitySignalSchema.parse({
          capability: "test",
          signal: "yolo",
          confidence: 0.5,
          keyFinding: "test",
        })
      ).toThrow();
    });

    it("validates Divergence", () => {
      const divergence = DivergenceSchema.parse({
        capabilities: ["sentiment", "risk"],
        description: "Sentiment bullish but risk elevated",
        severity: "high",
        resolution: "Reduce position size",
      });
      expect(divergence.severity).toBe("high");
    });

    it("rejects conviction score out of range", () => {
      const bad = JSON.parse(MOCK_BRIEF);
      bad.conviction.score = 2.0;
      expect(() => IntelligenceBriefSchema.parse(bad)).toThrow();
    });

    it("rejects missing required fields", () => {
      expect(() =>
        IntelligenceBriefSchema.parse({ ticker: "AAPL" })
      ).toThrow();
    });
  });

  describe("Prompt Building", () => {
    it("builds extraction prompts for all capabilities", () => {
      const capabilities = Object.keys(INTELLIGENCE_EXTRACTION_PROMPTS) as Array<
        keyof typeof INTELLIGENCE_EXTRACTION_PROMPTS
      >;
      expect(capabilities).toContain("sentiment");
      expect(capabilities).toContain("regime");
      expect(capabilities).toContain("momentum");
      expect(capabilities).toContain("risk");
      expect(capabilities).toContain("technicals");
      expect(capabilities).toContain("catalysts");

      for (const cap of capabilities) {
        const prompt = INTELLIGENCE_EXTRACTION_PROMPTS[cap]("AAPL", "Test context");
        expect(prompt).toContain("AAPL");
        expect(prompt).toContain("Test context");
      }
    });

    it("builds extraction prompts without context", () => {
      const prompt = INTELLIGENCE_EXTRACTION_PROMPTS.sentiment("TSLA");
      expect(prompt).toContain("TSLA");
      expect(prompt).not.toContain("Context:");
    });

    it("synthesis system prompt is substantive", () => {
      expect(SYNTHESIS_SYSTEM_PROMPT).toContain("CoreIntent");
      expect(SYNTHESIS_SYSTEM_PROMPT).toContain("REGIME PRIMACY");
      expect(SYNTHESIS_SYSTEM_PROMPT).toContain("RISK FIRST");
    });

    it("builds synthesis prompt with all sections", () => {
      const prompt = buildSynthesisPrompt({
        ticker: "NVDA",
        signalMatrix: [
          {
            capability: "sentiment",
            signal: "bullish",
            confidence: 0.8,
            keyFinding: "AI demand surge",
          },
        ],
        divergences: [
          {
            capabilities: ["sentiment", "risk"],
            description: "Bullish sentiment vs elevated risk",
            severity: "medium",
            resolution: "Tighten stops",
          },
        ],
        capabilityOutputs: [
          { name: "sentiment", output: '{"signal": "bullish"}' },
        ],
        context: "Earnings next week",
        portfolioValue: 100_000,
        riskTolerancePct: 1,
      });

      expect(prompt).toContain("NVDA");
      expect(prompt).toContain("sentiment");
      expect(prompt).toContain("Earnings next week");
      expect(prompt).toContain("100,000");
      expect(prompt).toContain("[MEDIUM]");
    });
  });

  describe("Pipeline Execution", () => {
    it("runs capabilities in parallel and produces a brief", async () => {
      let callCount = 0;
      mockAdapter.complete.mockImplementation(() => {
        callCount++;
        if (callCount <= 6) {
          return Promise.resolve(
            mockResponse(
              makeCapabilityResponse("bullish", 0.8, "Strong momentum"),
              "grok"
            )
          );
        }
        return Promise.resolve(mockResponse(MOCK_BRIEF));
      });

      const pipeline = new MarketIntelligencePipeline();
      const brief = await pipeline.analyze({ ticker: "AAPL" });

      expect(brief.ticker).toBe("AAPL");
      expect(brief.conviction.direction).toBe("buy");
      expect(brief.meta.capabilitiesUsed.length).toBeGreaterThan(0);
    });

    it("handles partial capability failures gracefully", async () => {
      let callCount = 0;
      mockAdapter.complete.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.reject(new Error("Provider down"));
        if (callCount === 2) return Promise.reject(new Error("Timeout"));
        if (callCount <= 6) {
          return Promise.resolve(
            mockResponse(
              makeCapabilityResponse("bearish", 0.7, "Declining volume"),
              "grok"
            )
          );
        }
        return Promise.resolve(
          mockResponse(
            JSON.stringify({
              ...JSON.parse(MOCK_BRIEF),
              conviction: { direction: "sell", score: -0.4, confidence: 0.65 },
            })
          )
        );
      });

      const pipeline = new MarketIntelligencePipeline();
      const brief = await pipeline.analyze({ ticker: "TSLA" });

      expect(brief).toBeDefined();
      expect(brief.meta.capabilitiesUsed.length).toBeLessThan(6);
    });

    it("throws when all capabilities fail", async () => {
      mockAdapter.complete.mockRejectedValue(new Error("All down"));

      const pipeline = new MarketIntelligencePipeline();
      await expect(pipeline.analyze({ ticker: "BAD" })).rejects.toThrow(
        "Intelligence pipeline failed"
      );
    });

    it("respects custom capability selection", async () => {
      let callCount = 0;
      mockAdapter.complete.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.resolve(
            mockResponse(
              makeCapabilityResponse("neutral", 0.6, "No clear signal"),
              "grok"
            )
          );
        }
        return Promise.resolve(mockResponse(MOCK_BRIEF));
      });

      const pipeline = new MarketIntelligencePipeline({
        capabilities: ["sentiment", "risk"],
      });
      const brief = await pipeline.analyze({ ticker: "SPY" });

      expect(brief.meta.capabilitiesUsed).toHaveLength(2);
    });

    it("passes portfolio context to synthesis", async () => {
      let synthesisPrompt = "";
      let callCount = 0;
      mockAdapter.complete.mockImplementation((req: { prompt: string }) => {
        callCount++;
        if (callCount <= 6) {
          return Promise.resolve(
            mockResponse(
              makeCapabilityResponse("bullish", 0.75, "Uptrend"),
              "grok"
            )
          );
        }
        synthesisPrompt = req.prompt;
        return Promise.resolve(mockResponse(MOCK_BRIEF));
      });

      const pipeline = new MarketIntelligencePipeline();
      await pipeline.analyze({
        ticker: "AMZN",
        portfolioValue: 250_000,
        riskTolerancePct: 0.5,
      });

      expect(synthesisPrompt).toContain("250,000");
    });
  });

  describe("quickSignalCheck", () => {
    it("returns signals without synthesis step", async () => {
      mockAdapter.complete.mockResolvedValue(
        mockResponse(
          makeCapabilityResponse("bullish", 0.85, "Strong earnings"),
          "grok"
        )
      );

      const pipeline = new MarketIntelligencePipeline({
        capabilities: ["sentiment", "momentum", "technicals"],
      });
      const result = await pipeline.quickSignalCheck("AAPL");

      expect(result.signals).toHaveLength(3);
      expect(result.overallDirection).toBe("bullish");
      expect(result.overallConfidence).toBeCloseTo(0.85, 1);
      expect(result.divergences).toHaveLength(0);
    });

    it("detects mixed signals as divergence", async () => {
      let callCount = 0;
      mockAdapter.complete.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.resolve(
            mockResponse(
              makeCapabilityResponse("bullish", 0.8, "Strong sentiment"),
              "grok"
            )
          );
        }
        return Promise.resolve(
          mockResponse(
            makeCapabilityResponse("bearish", 0.7, "Elevated risk"),
            "grok"
          )
        );
      });

      const pipeline = new MarketIntelligencePipeline({
        capabilities: ["sentiment", "momentum", "risk", "technicals"],
      });
      const result = await pipeline.quickSignalCheck("TSLA");

      expect(result.divergences.length).toBeGreaterThan(0);
    });
  });

  describe("Divergence Detection", () => {
    it("detects bullish vs bearish divergence", () => {
      const pipeline = new MarketIntelligencePipeline();
      const results = [
        makeFakeResult("sentiment", "bullish", 0.8),
        makeFakeResult("risk", "bearish", 0.75),
        makeFakeResult("technicals", "neutral", 0.6),
      ];

      const divergences = pipeline.detectDivergences(results);

      expect(divergences.length).toBeGreaterThan(0);
      const bullBear = divergences.find(
        (d) => d.description.includes("bullish") && d.description.includes("bearish")
      );
      expect(bullBear).toBeDefined();
      expect(bullBear!.severity).toBe("medium");
    });

    it("detects high-severity divergence with many disagreements", () => {
      const pipeline = new MarketIntelligencePipeline();
      const results = [
        makeFakeResult("sentiment", "bullish", 0.8),
        makeFakeResult("momentum", "bullish", 0.7),
        makeFakeResult("risk", "bearish", 0.75),
        makeFakeResult("technicals", "bearish", 0.65),
        makeFakeResult("regime", "bearish", 0.6),
      ];

      const divergences = pipeline.detectDivergences(results);

      const highSeverity = divergences.find((d) => d.severity === "high");
      expect(highSeverity).toBeDefined();
    });

    it("detects risk-sentiment divergence", () => {
      const pipeline = new MarketIntelligencePipeline();
      const results = [
        makeFakeResult("sentiment", "bullish", 0.8),
        makeFakeResult("risk", "bearish", 0.7),
      ];

      const divergences = pipeline.detectDivergences(results);

      const riskDiv = divergences.find(
        (d) => d.description.includes("bull trap")
      );
      expect(riskDiv).toBeDefined();
      expect(riskDiv!.severity).toBe("high");
    });

    it("detects regime-momentum divergence", () => {
      const pipeline = new MarketIntelligencePipeline();
      const results = [
        makeFakeResult("regime", "bearish", 0.7),
        makeFakeResult("momentum", "bullish", 0.8),
      ];

      const divergences = pipeline.detectDivergences(results);

      const regimeDiv = divergences.find(
        (d) =>
          d.description.includes("regime") &&
          d.description.includes("momentum") &&
          d.description.includes("misaligned")
      );
      expect(regimeDiv).toBeDefined();
      expect(regimeDiv!.severity).toBe("medium");
    });

    it("returns empty for aligned signals", () => {
      const pipeline = new MarketIntelligencePipeline();
      const results = [
        makeFakeResult("sentiment", "bullish", 0.8),
        makeFakeResult("momentum", "bullish", 0.7),
        makeFakeResult("regime", "bullish", 0.75),
      ];

      const divergences = pipeline.detectDivergences(results);

      const bullBearDiv = divergences.filter(
        (d) => d.description.includes("bullish") && d.description.includes("bearish")
      );
      expect(bullBearDiv).toHaveLength(0);
    });

    it("ignores low-confidence signals in divergence detection", () => {
      const pipeline = new MarketIntelligencePipeline();
      const results = [
        makeFakeResult("sentiment", "bullish", 0.8),
        makeFakeResult("risk", "bearish", 0.3),
      ];

      const divergences = pipeline.detectDivergences(results);

      const bullBearDiv = divergences.filter(
        (d) =>
          d.capabilities.length > 2 ||
          (d.capabilities.includes("sentiment") &&
            d.capabilities.includes("risk") &&
            d.description.includes("bullish") &&
            d.description.includes("bearish"))
      );
      expect(bullBearDiv).toHaveLength(0);
    });
  });
});

function makeFakeResult(
  name: string,
  signal: "bullish" | "bearish" | "neutral" | "mixed",
  confidence: number
) {
  return {
    name,
    signal,
    confidence,
    keyFinding: `${name} finding`,
    rawOutput: JSON.stringify({ signal, confidence }),
    provider: "grok",
    model: "mock-grok",
    latencyMs: 20,
    tokenUsage: { inputTokens: 50, outputTokens: 80, totalTokens: 130 },
  };
}
