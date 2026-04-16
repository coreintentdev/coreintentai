/**
 * CoreIntent AI — Risk Manager Agent
 *
 * Autonomous agent that evaluates portfolio risk, validates proposed trades,
 * and provides position sizing recommendations.
 *
 * Pipeline: Portfolio Assessment → Trade Validation → Position Sizing → Alerts
 */

import { BaseAgent } from "./base.js";
import type { AgentResult } from "../types/index.js";
import { Orchestrator } from "../orchestrator/index.js";

const RISK_MANAGER_SYSTEM = `You are the CoreIntent Risk Manager — an autonomous AI agent specialized in risk management for trading portfolios.

MANDATE: Protect capital first. Generate returns second.

CAPABILITIES:
- Portfolio-level risk aggregation
- Position sizing using Kelly criterion and volatility targeting
- Drawdown analysis and max loss estimation
- Correlation analysis across positions
- Pre-trade risk validation
- Stop-loss optimization

RULES:
- Never approve a trade that risks more than 2% of portfolio on a single position (unless explicitly overridden).
- Flag concentration risk when any single position exceeds 10% of portfolio.
- Account for correlation — two 5% positions in the same sector = 10% sector exposure.
- Consider tail risk — use fat-tailed distributions, not normal.
- Be conservative with leverage recommendations.

OUTPUT STRUCTURE:
1. RISK DASHBOARD (overall score, key metrics)
2. POSITION ANALYSIS (per-position risk breakdown)
3. CORRELATION MAP (key correlations and exposures)
4. ALERTS (any immediate concerns)
5. RECOMMENDATIONS (specific, actionable next steps)`;

export class RiskManagerAgent extends BaseAgent {
  constructor(orchestrator?: Orchestrator) {
    super(
      {
        name: "RiskManager",
        role: "Portfolio risk management agent",
        systemPrompt: RISK_MANAGER_SYSTEM,
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

    // Step 1: Analyze the input (portfolio or trade proposal)
    const analysis = await this.reason(
      `Analyze the following for risk:\n\n${input}\n\n${context ? `Context: ${JSON.stringify(context)}` : ""}\n\nProvide an initial risk assessment covering all risk categories.`
    );

    // Step 2: Deep risk evaluation
    const deepEval = await this.reason(
      `Based on your initial assessment, perform a deeper evaluation:

${analysis.slice(0, 2000)}

Consider:
1. What are the worst-case scenarios (tail risks)?
2. What correlations exist between positions?
3. What is the maximum portfolio drawdown under stress?
4. Are position sizes appropriate given the risk levels?

Provide specific numbers and percentages.`
    );

    // Step 3: Generate actionable recommendations
    const recommendations = await this.reason(
      `Based on your full risk analysis, provide a final risk report:

${deepEval.slice(0, 2000)}

Structure as:
1. RISK DASHBOARD with overall risk score (0-100)
2. Top 3 immediate concerns
3. Specific position sizing recommendations
4. Actionable steps to reduce risk
5. Stop-loss levels where applicable`
    );

    return this.buildResult(recommendations, start);
  }
}
