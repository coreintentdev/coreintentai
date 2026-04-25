import { BaseAgent } from "./base.js";
import type { AgentResult } from "../types/index.js";
import { Orchestrator } from "../orchestrator/index.js";

const STRATEGY_ADVISOR_SYSTEM = `You are the CoreIntent Strategy Advisor — an autonomous meta-agent that synthesizes market intelligence into actionable portfolio strategy.

You sit ABOVE the individual analysts. You receive outputs from:
- Market Analyst (sentiment, technicals, fundamentals)
- Risk Manager (portfolio risk, position sizing, warnings)
- Regime Detector (market regime, transition probabilities)
- Correlation Analyzer (cross-asset correlations, hidden risks)

YOUR JOB: Synthesize these diverse inputs into a coherent, actionable strategy.

CAPABILITIES:
- Cross-capability synthesis — combine conflicting signals into a unified view
- Conviction scoring — weight each signal source by its reliability in the current regime
- Strategy construction — translate intelligence into specific portfolio actions
- Scenario planning — articulate bull/bear/base cases with probabilities
- Capital allocation — determine how to deploy capital across opportunities

OUTPUT STRUCTURE:
1. MARKET REGIME & CONTEXT (current regime, key macro factors)
2. CONVICTION MATRIX (each signal source, its conviction, and weight)
3. STRATEGY RECOMMENDATION
   - Primary strategy (what to do)
   - Position changes (specific adds/trims/exits)
   - Hedging overlay (how to protect)
4. SCENARIO ANALYSIS
   - Bull case (probability, triggers, actions)
   - Base case (probability, expectations)
   - Bear case (probability, triggers, defensive actions)
5. RISK BUDGET (how much risk to take, where to allocate it)
6. EXECUTION PRIORITY (what to do first, second, third)
7. REVIEW TRIGGERS (what events would change this strategy)`;

export class StrategyAdvisorAgent extends BaseAgent {
  constructor(orchestrator?: Orchestrator) {
    super(
      {
        name: "StrategyAdvisor",
        role: "Meta-strategy synthesis agent",
        systemPrompt: STRATEGY_ADVISOR_SYSTEM,
        provider: "claude",
        maxTurns: 5,
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

    // Step 1: Gather multi-source intelligence in parallel via fan
    const [sentimentRead, regimeRead] = await Promise.all([
      this.fastAnalyze(
        `Quick market sentiment assessment for: ${input}. Rate -1 to +1 with key drivers. Be concise.`
      ),
      this.reason(
        `What is the current market regime for: ${input}? Classify as trending_up, trending_down, ranging, volatile_expansion, compression, crisis, or rotation. Explain briefly.`,
        "reasoning"
      ),
    ]);

    // Step 2: Synthesize inputs with deep reasoning
    const contextStr = context
      ? `\nPortfolio Context: ${JSON.stringify(context)}`
      : "";

    const synthesis = await this.reason(
      `You are building a comprehensive strategy recommendation for: ${input}

Intelligence gathered:

SENTIMENT:
${sentimentRead.slice(0, 1500)}

REGIME:
${regimeRead.slice(0, 1500)}
${contextStr}

Now synthesize into a full strategy recommendation following your output structure. Be specific — name tickers, price levels, percentages, timeframes. Conviction must be evidence-based.`
    );

    // Step 3: Stress-test the strategy
    const stressTest = await this.reason(
      `Stress-test this strategy recommendation:

${synthesis.slice(0, 2000)}

Challenge it:
1. What's the biggest blind spot?
2. What scenario would cause maximum pain?
3. Is the risk budget appropriate for the regime?
4. Would you adjust anything after this review?

Provide a final, refined strategy with any adjustments incorporated. This is the version that goes to the portfolio manager.`
    );

    return this.buildResult(stressTest, start);
  }

  async adviseOnTrade(params: {
    ticker: string;
    proposedAction: string;
    analysis: string;
    riskAssessment: string;
    portfolioContext?: string;
  }): Promise<AgentResult> {
    this.reset();
    const start = performance.now();

    const synthesis = await this.reason(
      `A trade is being proposed. Synthesize the available intelligence and provide your strategic recommendation.

PROPOSED TRADE: ${params.proposedAction} ${params.ticker}

ANALYST VIEW:
${params.analysis.slice(0, 2000)}

RISK ASSESSMENT:
${params.riskAssessment.slice(0, 2000)}

${params.portfolioContext ? `PORTFOLIO CONTEXT:\n${params.portfolioContext}\n` : ""}
Recommendation:
1. Should we take this trade? (YES/NO/MODIFY)
2. If MODIFY, what changes?
3. How does it fit the overall strategy?
4. What's the risk/reward assessment?
5. What would make you change your mind?`
    );

    return this.buildResult(synthesis, start);
  }
}
