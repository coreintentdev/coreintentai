/**
 * CoreIntent AI — Market Analyst Agent
 *
 * Autonomous agent that performs comprehensive market analysis by combining
 * sentiment analysis, technical assessment, and fundamental research.
 *
 * Pipeline: Research → Sentiment → Technical Analysis → Synthesis
 */

import { BaseAgent } from "./base.js";
import type { AgentResult } from "../types/index.js";
import { Orchestrator } from "../orchestrator/index.js";

const MARKET_ANALYST_SYSTEM = `You are the CoreIntent Market Analyst — an autonomous AI agent specialized in comprehensive market analysis.

CAPABILITIES:
- Multi-source sentiment aggregation
- Technical pattern recognition and indicator analysis
- Fundamental valuation assessment
- Macro environment impact analysis
- Catalyst identification and timing

PERSONALITY:
- Objective and data-driven
- Risk-aware — always flag the downside
- Concise but thorough
- Conviction-weighted — stronger evidence = stronger language

When performing analysis, structure your output as:
1. EXECUTIVE SUMMARY (2-3 sentences)
2. SENTIMENT ASSESSMENT (with score -1 to +1)
3. TECHNICAL OUTLOOK (key levels, patterns, indicators)
4. FUNDAMENTAL VIEW (valuation, earnings, growth)
5. CATALYSTS (upcoming events that could move the stock)
6. RISK FACTORS (what could go wrong)
7. VERDICT (actionable conclusion with conviction level)`;

export class MarketAnalystAgent extends BaseAgent {
  constructor(orchestrator?: Orchestrator) {
    super(
      {
        name: "MarketAnalyst",
        role: "Comprehensive market analysis agent",
        systemPrompt: MARKET_ANALYST_SYSTEM,
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
    const maxTurns = this.config.maxTurns ?? 5;

    // Step 1: Research phase — gather current data
    const researchData = await this.research(
      `Gather the latest market data, news, and analyst opinions for: ${input}. Include recent price action, volume trends, and any notable events.`
    );

    if (this.messages.length / 2 >= maxTurns) {
      return this.buildResult(researchData, start);
    }

    // Step 2: Fast sentiment read
    const sentimentRead = await this.fastAnalyze(
      `Based on this research, provide a quick sentiment assessment (-1 to +1) with key drivers:\n\n${researchData.slice(0, 2000)}`
    );

    if (this.messages.length / 2 >= maxTurns) {
      return this.buildResult(sentimentRead, start);
    }

    // Step 3: Deep synthesis — combine everything into a comprehensive analysis
    const contextStr = context
      ? `\nAdditional context: ${JSON.stringify(context)}`
      : "";

    const synthesis = await this.reason(
      `Synthesize a comprehensive market analysis for: ${input}

Research findings:
${researchData.slice(0, 2000)}

Sentiment assessment:
${sentimentRead.slice(0, 1000)}
${contextStr}

Provide your full analysis following the structured format (Executive Summary through Verdict). Be specific with price levels, percentages, and timeframes.`
    );

    return this.buildResult(synthesis, start);
  }
}
