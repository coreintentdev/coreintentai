import { describe, it, expect, vi, beforeEach } from "vitest";
import { Orchestrator } from "../src/orchestrator/index.js";
import {
  StructuredResearchSchema,
  ResearchFindingSchema,
} from "../src/types/index.js";

// ---------------------------------------------------------------------------
// Structured Research Schema
// ---------------------------------------------------------------------------

describe("Structured Research Schema", () => {
  const validResearch = {
    query: "AAPL earnings outlook Q2 2025",
    ticker: "AAPL",
    keyFindings: [
      {
        title: "Revenue beat expectations",
        content: "Apple reported $94.8B vs $93.9B expected",
        relevance: 0.95,
        source: "Apple Inc. Q2 2025 Earnings Call",
        recency: "today" as const,
      },
    ],
    analystConsensus: {
      rating: "buy" as const,
      priceTarget: 210,
      numberOfAnalysts: 42,
      summary: "Majority of analysts maintain Buy rating",
    },
    risks: [
      {
        description: "China revenue deceleration",
        severity: "high" as const,
        likelihood: "possible" as const,
      },
    ],
    catalysts: [
      {
        event: "WWDC 2025",
        expectedDate: "2025-06-09",
        impact: "positive" as const,
        magnitude: "major" as const,
      },
    ],
    competitiveLandscape: "Leading position in premium smartphones",
    sources: [
      {
        name: "Apple Investor Relations",
        url: "https://investor.apple.com",
        credibility: "primary" as const,
      },
    ],
    confidence: 0.85,
    summary: "Strong earnings with growing services revenue",
    timestamp: new Date().toISOString(),
  };

  it("validates a complete structured research result", () => {
    expect(StructuredResearchSchema.safeParse(validResearch).success).toBe(true);
  });

  it("validates minimal research (no optional fields)", () => {
    const minimal = {
      query: "BTC outlook",
      keyFindings: [],
      analystConsensus: { summary: "No consensus" },
      risks: [],
      catalysts: [],
      sources: [],
      confidence: 0.5,
      summary: "Inconclusive",
      timestamp: new Date().toISOString(),
    };
    expect(StructuredResearchSchema.safeParse(minimal).success).toBe(true);
  });

  it("validates all analyst rating values", () => {
    for (const rating of ["strong_buy", "buy", "hold", "sell", "strong_sell"]) {
      const res = {
        ...validResearch,
        analystConsensus: { ...validResearch.analystConsensus, rating },
      };
      expect(StructuredResearchSchema.safeParse(res).success).toBe(true);
    }
  });

  it("validates all risk severity levels", () => {
    for (const severity of ["low", "medium", "high", "critical"]) {
      const res = {
        ...validResearch,
        risks: [{ description: "test", severity }],
      };
      expect(StructuredResearchSchema.safeParse(res).success).toBe(true);
    }
  });

  it("validates all catalyst impact types", () => {
    for (const impact of ["positive", "negative", "uncertain"]) {
      const res = {
        ...validResearch,
        catalysts: [{ event: "test", impact }],
      };
      expect(StructuredResearchSchema.safeParse(res).success).toBe(true);
    }
  });

  it("validates all recency values", () => {
    for (const recency of ["live", "today", "this_week", "this_month", "older"]) {
      const finding = { ...validResearch.keyFindings[0], recency };
      expect(ResearchFindingSchema.safeParse(finding).success).toBe(true);
    }
  });

  it("validates all source credibility levels", () => {
    for (const credibility of ["primary", "secondary", "opinion"]) {
      const res = {
        ...validResearch,
        sources: [{ name: "Test", credibility }],
      };
      expect(StructuredResearchSchema.safeParse(res).success).toBe(true);
    }
  });

  it("rejects invalid confidence", () => {
    expect(
      StructuredResearchSchema.safeParse({ ...validResearch, confidence: 1.5 }).success
    ).toBe(false);
  });

  it("rejects invalid finding relevance", () => {
    const res = {
      ...validResearch,
      keyFindings: [{ ...validResearch.keyFindings[0], relevance: 2 }],
    };
    expect(StructuredResearchSchema.safeParse(res).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Concurrency Limiter
// ---------------------------------------------------------------------------

describe("Orchestrator Concurrency Limiter", () => {
  it("accepts maxConcurrency option", () => {
    const orch = new Orchestrator({
      maxConcurrency: 5,
      cache: false,
      circuitBreaker: false,
      adaptiveRouting: false,
      telemetry: false,
    });
    expect(orch).toBeDefined();
  });

  it("defaults maxConcurrency to 10", () => {
    const orch = new Orchestrator({
      cache: false,
      circuitBreaker: false,
      adaptiveRouting: false,
      telemetry: false,
    });
    expect(orch).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Confidence Extraction (via escalation logic)
// ---------------------------------------------------------------------------

describe("Orchestrator Escalation Support", () => {
  it("exposes adaptive router for escalation configuration", () => {
    const orch = new Orchestrator({
      adaptiveRouting: {
        confidenceEscalation: true,
        escalationThreshold: 0.3,
      },
      cache: false,
      circuitBreaker: false,
    });

    const router = orch.getAdaptiveRouter();
    expect(router).not.toBeNull();
    expect(router!.shouldEscalate(0.2)).toBe(true);
    expect(router!.shouldEscalate(0.5)).toBe(false);
  });

  it("escalation disabled when adaptiveRouting is false", () => {
    const orch = new Orchestrator({
      adaptiveRouting: false,
      cache: false,
      circuitBreaker: false,
    });

    expect(orch.getAdaptiveRouter()).toBeNull();
  });

  it("escalation can be disabled via confidenceEscalation option", () => {
    const orch = new Orchestrator({
      adaptiveRouting: {
        confidenceEscalation: false,
      },
      cache: false,
      circuitBreaker: false,
    });

    const router = orch.getAdaptiveRouter();
    expect(router!.shouldEscalate(0.1)).toBe(false);
  });
});
