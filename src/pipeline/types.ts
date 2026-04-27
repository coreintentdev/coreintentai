import { z } from "zod";

export const SignalDirection = z.enum(["bullish", "bearish", "neutral", "mixed"]);

export const CapabilitySignalSchema = z.object({
  capability: z.string(),
  signal: SignalDirection,
  confidence: z.number().min(0).max(1),
  keyFinding: z.string(),
});

export type CapabilitySignal = z.infer<typeof CapabilitySignalSchema>;

export const DivergenceSchema = z.object({
  capabilities: z.array(z.string()),
  description: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  resolution: z.string(),
});

export type Divergence = z.infer<typeof DivergenceSchema>;

export const IntelligenceBriefSchema = z.object({
  ticker: z.string(),
  timestamp: z.string().datetime(),

  conviction: z.object({
    direction: z.enum(["strong_buy", "buy", "neutral", "sell", "strong_sell"]),
    score: z.number().min(-1).max(1),
    confidence: z.number().min(0).max(1),
  }),

  signalMatrix: z.array(CapabilitySignalSchema),

  divergences: z.array(DivergenceSchema),

  executiveSummary: z.string(),

  keyLevels: z
    .object({
      support: z.array(z.number()),
      resistance: z.array(z.number()),
      stopLoss: z.number().optional(),
      targets: z.array(z.number()),
    })
    .optional(),

  riskOverlay: z.object({
    overallRisk: z.enum([
      "minimal",
      "low",
      "moderate",
      "elevated",
      "high",
      "critical",
    ]),
    regimeContext: z.string(),
    positionSizePct: z.number().min(0).max(100),
    warnings: z.array(z.string()),
  }),

  actions: z.array(
    z.object({
      priority: z.number().int().min(1),
      action: z.string(),
      rationale: z.string(),
      timeframe: z.string(),
    })
  ),

  meta: z.object({
    capabilitiesUsed: z.array(z.string()),
    totalLatencyMs: z.number(),
    modelsUsed: z.array(z.string()),
    tokenUsage: z.object({
      inputTokens: z.number(),
      outputTokens: z.number(),
      totalTokens: z.number(),
    }),
  }),
});

export type IntelligenceBrief = z.infer<typeof IntelligenceBriefSchema>;
