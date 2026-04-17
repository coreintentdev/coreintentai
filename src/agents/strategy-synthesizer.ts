import { BaseAgent } from "./base.js";
import type { AgentResult } from "../types/index.js";
import { Orchestrator } from "../orchestrator/index.js";

const STRATEGY_SYNTHESIZER_SYSTEM = `You are the CoreIntent Strategy Synthesizer — the final decision-making intelligence in the trading pipeline.

You receive outputs from three upstream agents:
1. Market Analyst — comprehensive market analysis
2. Risk Manager — risk assessment and position sizing
3. Trade Executor — execution plan and order specifications

Plus a market regime classification that provides structural context.

YOUR JOB: Synthesize all inputs into a single, decisive strategy recommendation.

PRINCIPLES:
- Risk management OVERRIDES signal strength. If risk says no, you say no.
- Regime context modifies everything. A bullish signal in a crisis regime gets downgraded.
- Conflicts between agents must be resolved explicitly with reasoning.
- Confidence is calibrated: 0.9+ means overwhelming evidence, 0.5 means coin flip.
- Position sizing is regime-adjusted: reduce in high_volatility/crisis, increase in trending.

Respond as JSON:
{
  "decision": "strong_go" | "go" | "conditional_go" | "wait" | "no_go",
  "confidence": 0.0-1.0,
  "thesis": "One-paragraph core investment thesis",
  "regime": "current regime",
  "regimeAlignment": 0.0-1.0 (how well the trade aligns with the current regime),
  "adjustedSignal": {
    "action": "strong_buy" | "buy" | "hold" | "sell" | "strong_sell",
    "positionSizePct": 0-100,
    "entryStrategy": "description",
    "exitStrategy": "description",
    "stopLoss": "description with levels",
    "timeframe": "description"
  },
  "riskBudget": {
    "maxLossPct": number,
    "maxPositionPct": number,
    "hedgeRecommendation": "optional hedge description"
  },
  "conditions": ["conditions that must be true for this trade"],
  "invalidationCriteria": ["what would invalidate this thesis"],
  "summary": "2-3 sentence executive summary",
  "timestamp": "ISO-8601"
}

Decision criteria:
- strong_go: High confidence, regime-aligned, acceptable risk, clear catalyst
- go: Good setup, reasonable risk, positive expected value
- conditional_go: Promising but needs a specific condition met before entry
- wait: Not enough conviction, better opportunities may exist, or regime is unfavorable
- no_go: Unacceptable risk, poor regime alignment, or conflicting signals`;

export class StrategySynthesizerAgent extends BaseAgent {
  constructor(orchestrator?: Orchestrator) {
    super(
      {
        name: "StrategySynthesizer",
        role: "Final strategy synthesis and decision-making",
        systemPrompt: STRATEGY_SYNTHESIZER_SYSTEM,
        provider: "claude",
        maxTurns: 4,
      },
      orchestrator
    );
  }

  async execute(
    input: string,
    context?: Record<string, unknown>
  ): Promise<AgentResult> {
    this.reset();
    const start = performance.now();
    const maxTurns = this.config.maxTurns ?? 4;

    const analysis = (context?.analysis as string) ?? "";
    const riskAssessment = (context?.riskAssessment as string) ?? "";
    const executionPlan = (context?.executionPlan as string) ?? "";
    const regime = (context?.regime as string) ?? "unknown";

    const conflictCheck = await this.reason(
      `Review these three agent outputs and identify any conflicts or contradictions:

MARKET ANALYSIS:
${analysis.slice(0, 1500)}

RISK ASSESSMENT:
${riskAssessment.slice(0, 1500)}

EXECUTION PLAN:
${executionPlan.slice(0, 1000)}

MARKET REGIME: ${regime}

List: (1) points of agreement, (2) conflicts, (3) which agent's view should dominate for each conflict and why.`
    );

    if (this.messages.length / 2 >= maxTurns) {
      return this.buildResult(conflictCheck, start);
    }

    const regimeAdjustment = await this.reason(
      `Given the current market regime is "${regime}", how should the trading strategy be adjusted?

Regime considerations:
- trending_bull/bear: Trade with the trend, wider stops in trend direction
- ranging: Mean-reversion preferred, tighter stops
- high_volatility: Reduce size, wider stops, shorter timeframes
- crisis: Minimal exposure, hedged positions only
- recovery: Cautious accumulation, scaled entries

Original analysis conflict resolution:
${conflictCheck.slice(0, 2000)}

Describe specific regime-based adjustments to position sizing, stop widths, entry timing, and timeframe selection.`
    );

    if (this.messages.length / 2 >= maxTurns) {
      return this.buildResult(regimeAdjustment, start);
    }

    const synthesis = await this.reason(
      `Now produce the final strategy synthesis as JSON.

Original request: ${input}

Conflict resolution:
${conflictCheck.slice(0, 1500)}

Regime adjustments:
${regimeAdjustment.slice(0, 1500)}

Key data from agents:
- Analysis summary: ${analysis.slice(0, 500)}
- Risk verdict: ${riskAssessment.slice(0, 500)}
- Execution approach: ${executionPlan.slice(0, 500)}

Produce the complete JSON strategy synthesis. Be decisive. Commit to a decision.
Timestamp: ${new Date().toISOString()}`
    );

    return this.buildResult(synthesis, start);
  }
}
