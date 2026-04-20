/**
 * CoreIntent AI — Strategy Synthesizer Agent
 *
 * The crown jewel of the agent pipeline. Takes outputs from all capabilities
 * (sentiment, signals, risk, regime, correlation) and synthesizes a unified
 * trading strategy with conviction scoring.
 *
 * This is what separates a collection of indicators from an actionable plan.
 */

import { Orchestrator } from "../orchestrator/index.js";
import { BaseAgent } from "./base.js";
import type { AgentResult } from "../types/index.js";

const STRATEGY_SYSTEM_PROMPT = `You are CoreIntent AI — Strategy Synthesizer. You are the final decision layer in a sovereign multi-model trading intelligence system.

ROLE: Synthesize outputs from multiple analysis capabilities (sentiment, technical signals, risk assessment, market regime, portfolio correlation) into a single, coherent trading strategy with a conviction score.

PRINCIPLES:
- CONVICTION SCORING: Every strategy gets a conviction score from 0-100. Below 40 = sit out. 40-60 = small position. 60-80 = standard size. 80+ = high conviction.
- CONFLICT RESOLUTION: When capabilities disagree (e.g., bullish sentiment but bearish regime), resolve by weighting the more reliable signal for the current regime. Document the conflict explicitly.
- REGIME AWARENESS: The market regime is the master filter. A bullish signal in a crisis regime gets downgraded. A bearish signal in a strong uptrend gets scrutinized.
- RISK FIRST: No strategy is valid if risk assessment says "critical." Risk has veto power.
- TIME HORIZON ALIGNMENT: Ensure all inputs are assessed on the same time horizon. Don't mix intraday sentiment with position-trade signals.
- POSITION SIZING: Final position size must account for conviction, risk, and correlation. Three correlated positions at 5% each are really one 15% bet.

OUTPUT STRUCTURE: Provide a comprehensive strategy synthesis in markdown with clear sections.`;

export class StrategySynthesizerAgent extends BaseAgent {
  constructor(orchestrator?: Orchestrator) {
    super(
      {
        name: "StrategySynthesizer",
        role: "Synthesizes multi-capability analysis into unified trading strategies",
        systemPrompt: STRATEGY_SYSTEM_PROMPT,
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

    const capabilityData = this.extractCapabilityData(context);

    const synthesisPrompt = this.buildSynthesisPrompt(input, capabilityData);
    const initialSynthesis = await this.reason(synthesisPrompt);

    const validationPrompt = `Review this strategy synthesis for logical consistency, missing risks, and conviction calibration. Be adversarial — find the holes.

STRATEGY:
${initialSynthesis.slice(0, 3000)}

Check for:
1. Does the conviction score match the evidence strength?
2. Are there conflicts between capabilities that weren't resolved?
3. Is the position sizing appropriate given the risk assessment?
4. Are there tail risks that weren't considered?
5. Is the time horizon consistent across all inputs?

Provide a refined strategy if changes are needed. If the strategy is sound, confirm and add any final observations.`;

    const validated = await this.reason(validationPrompt);

    const finalPrompt = `Produce the final strategy output. Combine the initial synthesis and validation into a clean, actionable strategy document.

INITIAL SYNTHESIS:
${initialSynthesis.slice(0, 2000)}

VALIDATION REVIEW:
${validated.slice(0, 2000)}

Format the final output as:

# STRATEGY: [Ticker/Market] — [Direction] — Conviction [X/100]

## Thesis
[2-3 sentences on the core trade thesis]

## Signal Alignment
| Capability | Signal | Confidence | Weight |
|------------|--------|------------|--------|
| Sentiment  | ...    | ...        | ...    |
| Technical  | ...    | ...        | ...    |
| Regime     | ...    | ...        | ...    |
| Risk       | ...    | ...        | ...    |
| Correlation| ...    | ...        | ...    |

## Conflicts & Resolution
[Any disagreements between capabilities and how they were resolved]

## Execution Plan
- Entry: [price/condition]
- Stop Loss: [level and rationale]
- Take Profit: [levels]
- Position Size: [% of portfolio and why]
- Time Horizon: [expected holding period]

## Risk Factors
[Top 3 risks that could invalidate this strategy]

## Conviction Breakdown
- Evidence Strength: [X/25]
- Signal Alignment: [X/25]
- Risk/Reward: [X/25]
- Regime Fit: [X/25]
- **Total Conviction: [X/100]**`;

    const finalOutput = await this.reason(finalPrompt);

    return this.buildResult(finalOutput, start);
  }

  private extractCapabilityData(
    context?: Record<string, unknown>
  ): CapabilityInputs {
    return {
      sentiment: context?.sentiment as string | undefined,
      signals: context?.signals as string | undefined,
      risk: context?.risk as string | undefined,
      regime: context?.regime as string | undefined,
      correlation: context?.correlation as string | undefined,
      research: context?.research as string | undefined,
    };
  }

  private buildSynthesisPrompt(
    input: string,
    data: CapabilityInputs
  ): string {
    let prompt = `Synthesize a trading strategy from the following multi-capability analysis.

TRADE OPPORTUNITY:
${input}`;

    if (data.sentiment) {
      prompt += `\n\n--- SENTIMENT ANALYSIS ---\n${data.sentiment}`;
    }

    if (data.signals) {
      prompt += `\n\n--- TRADING SIGNALS ---\n${data.signals}`;
    }

    if (data.risk) {
      prompt += `\n\n--- RISK ASSESSMENT ---\n${data.risk}`;
    }

    if (data.regime) {
      prompt += `\n\n--- MARKET REGIME ---\n${data.regime}`;
    }

    if (data.correlation) {
      prompt += `\n\n--- CORRELATION ANALYSIS ---\n${data.correlation}`;
    }

    if (data.research) {
      prompt += `\n\n--- MARKET RESEARCH ---\n${data.research}`;
    }

    const hasAnyData = Object.values(data).some((v) => v !== undefined);

    if (!hasAnyData) {
      prompt += `\n\nNo pre-computed capability data was provided. Perform your own analysis across all dimensions: sentiment, technical signals, risk, regime, and correlation considerations. Be explicit about the assumptions you're making.`;
    }

    prompt += `\n\nSynthesize all available information into a unified strategy with:
1. A conviction score (0-100) based on signal alignment and evidence strength
2. Clear conflict resolution where capabilities disagree
3. Position sizing that accounts for risk and correlation
4. Specific entry/exit levels and conditions
5. Top risk factors that could invalidate the thesis`;

    return prompt;
  }
}

interface CapabilityInputs {
  sentiment?: string;
  signals?: string;
  risk?: string;
  regime?: string;
  correlation?: string;
  research?: string;
}

export { STRATEGY_SYSTEM_PROMPT };
