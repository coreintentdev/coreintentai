/**
 * CoreIntent AI — Trade Executor Agent
 *
 * Autonomous agent that generates execution plans for trades.
 * Combines signal generation, risk assessment, and execution strategy.
 *
 * NOTE: This agent generates trade PLANS, not actual executions.
 * Execution is handled by the CoreIntent trading platform.
 *
 * Pipeline: Signal Analysis → Risk Check → Execution Planning → Order Generation
 */

import { BaseAgent } from "./base.js";
import type { AgentResult } from "../types/index.js";
import { Orchestrator } from "../orchestrator/index.js";

const TRADE_EXECUTOR_SYSTEM = `You are the CoreIntent Trade Executor — an autonomous AI agent that generates detailed trade execution plans.

IMPORTANT: You generate PLANS and ORDER SPECIFICATIONS. You do NOT execute trades directly.

CAPABILITIES:
- Optimal entry/exit strategy design
- Order type selection (market, limit, stop-limit, trailing stop)
- Execution timing optimization
- Scaling in/out strategy
- Slippage estimation

RULES:
- Every plan must include a stop-loss. No exceptions.
- Risk per trade must not exceed the specified risk tolerance (default 1% of portfolio).
- Consider market microstructure — don't plan orders that would move the market.
- Account for bid-ask spread and typical slippage for the asset.
- Plan for multiple exit scenarios (target hit, stop hit, time-based exit).

OUTPUT STRUCTURE:
1. TRADE THESIS (why this trade, what's the edge)
2. ENTRY PLAN (order type, price levels, scaling approach)
3. EXIT PLAN (targets, stop-loss, trailing stops, time exits)
4. POSITION SIZING (units, dollar amount, % of portfolio)
5. EXECUTION TIMELINE (when to enter, how to scale)
6. CONTINGENCIES (what if X happens)
7. ORDER SPECIFICATIONS (ready-to-execute order parameters)`;

export class TradeExecutorAgent extends BaseAgent {
  constructor(orchestrator?: Orchestrator) {
    super(
      {
        name: "TradeExecutor",
        role: "Trade execution planning agent",
        systemPrompt: TRADE_EXECUTOR_SYSTEM,
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

    const portfolioValue = (context?.portfolioValue as number) ?? 100_000;
    const riskTolerance = (context?.riskTolerancePct as number) ?? 1;

    // Step 1: Analyze the trade setup
    const setupAnalysis = await this.reason(
      `Analyze this trade setup and determine optimal execution strategy:

${input}

Portfolio Value: $${portfolioValue.toLocaleString()}
Risk Tolerance: ${riskTolerance}% per trade ($${((portfolioValue * riskTolerance) / 100).toLocaleString()} max risk)

Assess the setup quality, identify optimal entry/exit levels, and determine the best order types for execution.`
    );

    // Step 2: Generate detailed execution plan
    const executionPlan = await this.reason(
      `Based on your analysis, generate a complete trade execution plan:

${setupAnalysis.slice(0, 2000)}

Include:
1. Specific order types and prices
2. Position sizing (units and dollar amount)
3. Scaling in/out schedule if applicable
4. All stop-loss and take-profit levels
5. Time-based exit conditions
6. Contingency plans

The plan must be specific enough to be directly converted into orders.`
    );

    // Step 3: Generate order specifications
    const orderSpecs = await this.reason(
      `Convert this execution plan into precise order specifications:

${executionPlan.slice(0, 2000)}

For each order, specify:
- Order type (market/limit/stop/stop-limit/trailing-stop)
- Side (buy/sell)
- Quantity
- Price (for limit/stop orders)
- Trail amount (for trailing stops)
- Time-in-force (GTC/DAY/IOC)
- Conditions (if any)

Format as a structured list. These should be copy-paste ready for order entry.`
    );

    return this.buildResult(orderSpecs, start);
  }
}
