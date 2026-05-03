import { BaseAgent } from "./base.js";
import type { AgentResult } from "../types/index.js";
import { Orchestrator } from "../orchestrator/index.js";

const WATCHDOG_SYSTEM = `You are the CoreIntent Portfolio Watchdog — an autonomous surveillance agent that continuously monitors portfolio health across every dimension simultaneously.

You synthesize inputs from FIVE independent intelligence streams running in parallel:
1. NARRATIVE PULSE — What stories are driving your positions? Are any narratives shifting?
2. LIQUIDITY CONDITIONS — Can you exit if needed? Are any positions trapped?
3. ANOMALY ALERTS — Is anything statistically unusual happening right now?
4. REGIME AWARENESS — What market regime are we in? Is it changing?
5. CORRELATION DYNAMICS — Are your positions more correlated than you think?

YOUR JOB: Produce a single, actionable portfolio health report that a trader can scan in 30 seconds and know exactly what needs attention.

OUTPUT STRUCTURE:
1. HEALTH SCORE (0-100, where 100 = healthy, <50 = action required)
2. ALERT LEVEL (green / yellow / orange / red)
3. TOP THREATS (ranked by urgency, max 3)
4. NARRATIVE SHIFTS (any stories changing that affect positions)
5. LIQUIDITY WARNINGS (positions that may be hard to exit)
6. ANOMALIES DETECTED (unusual activity requiring attention)
7. REGIME STATUS (current regime + transition risk)
8. IMMEDIATE ACTIONS (what to do RIGHT NOW, if anything)
9. WATCH LIST (things to monitor over next 24-48 hours)

PRINCIPLES:
- False calm is worse than false alarm. Err toward alerting.
- A trader scanning this at 4am needs to know in 10 seconds if something is wrong.
- Every alert must be actionable. "Monitor X" is not an action. "Reduce X by Y%" is.
- Quantify everything. "Risk is elevated" is useless. "Drawdown risk: 12% in a -3σ move" is actionable.
- Cross-reference signals. Volume spike + narrative shift + liquidity thinning = high conviction alert.`;

export class PortfolioWatchdogAgent extends BaseAgent {
  constructor(orchestrator?: Orchestrator) {
    super(
      {
        name: "PortfolioWatchdog",
        role: "Autonomous portfolio surveillance agent",
        systemPrompt: WATCHDOG_SYSTEM,
        provider: "claude",
        maxTurns: 6,
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

    // Step 1: Launch parallel intelligence streams (5 concurrent scans)
    const [narrativeScan, liquidityScan, anomalyScan, regimeScan, correlationScan] =
      await Promise.all([
        this.fastAnalyze(
          `NARRATIVE SCAN for portfolio: ${input}\n\nIdentify the dominant narratives driving each position. For each narrative, state: name, stage (emerging/accelerating/consensus/exhausted/reversing), and whether it's shifting. Flag any narrative conflicts or reversals. Be concise — one line per narrative.`
        ),
        this.fastAnalyze(
          `LIQUIDITY SCAN for portfolio: ${input}\n\nFor each position, assess: current liquidity regime (abundant/normal/thin/crisis), spread conditions, and exit difficulty. Flag any positions where exiting >50% would take more than 1 day or cause >50bps slippage. One line per position.`
        ),
        this.fastAnalyze(
          `ANOMALY SCAN for portfolio: ${input}\n\nDetect statistically unusual activity across all positions: volume spikes, volatility anomalies, correlation breaks, unusual options flow. Score each anomaly 0-100 severity. Only report anomalies scoring >40. One line per anomaly.`
        ),
        this.reason(
          `REGIME ASSESSMENT for: ${input}\n\nClassify the current market regime (trending_up, trending_down, ranging, volatile_expansion, compression, crisis, rotation). Assess transition probability. How does this regime affect the portfolio? What would the portfolio look like in each alternative regime?`
        ),
        this.fastAnalyze(
          `CORRELATION SCAN for portfolio: ${input}\n\nAssess the actual correlation structure. Are positions more correlated than expected? Are there hidden risk concentrations? What is the effective diversification vs. nominal diversification? Flag any correlation breakdowns that signal regime change.`
        ),
      ]);

    // Step 2: Synthesize all intelligence streams into a unified health report
    const portfolioContext = context
      ? `\nPortfolio Context: ${JSON.stringify(context)}`
      : "";

    const synthesis = await this.reason(
      `SYNTHESIZE PORTFOLIO HEALTH REPORT

You have received 5 parallel intelligence streams for: ${input}
${portfolioContext}

NARRATIVE PULSE:
${narrativeScan.slice(0, 1500)}

LIQUIDITY CONDITIONS:
${liquidityScan.slice(0, 1500)}

ANOMALY ALERTS:
${anomalyScan.slice(0, 1500)}

REGIME STATUS:
${regimeScan.slice(0, 1500)}

CORRELATION DYNAMICS:
${correlationScan.slice(0, 1500)}

Now synthesize into your structured output (Health Score through Watch List). Cross-reference signals — where do multiple streams converge on the same risk? Those are the highest-priority alerts.

Be brutally honest. If everything is fine, say so. If the portfolio is at risk, say so clearly with specific numbers and actions.`
    );

    return this.buildResult(synthesis, start);
  }

  /**
   * Quick health check — fast single-pass assessment for routine monitoring.
   */
  async quickScan(params: {
    positions: Array<{ ticker: string; weight: number }>;
    marketContext?: string;
  }): Promise<AgentResult> {
    this.reset();
    const start = performance.now();

    const positionList = params.positions
      .map((p) => `${p.ticker} (${(p.weight * 100).toFixed(1)}%)`)
      .join(", ");

    const contextStr = params.marketContext
      ? `\nMarket Context: ${params.marketContext}`
      : "";

    const scan = await this.fastAnalyze(
      `QUICK PORTFOLIO HEALTH CHECK

Positions: ${positionList}${contextStr}

In under 200 words:
1. Overall health score (0-100)
2. Alert level (green/yellow/orange/red)
3. Top threat (if any)
4. One immediate action (if needed)
5. One thing to watch next 24h

Be direct. No fluff.`
    );

    return this.buildResult(scan, start);
  }

  /**
   * Deep threat analysis — when something feels wrong, dig in.
   */
  async threatAnalysis(params: {
    portfolio: string;
    concern: string;
    data?: string;
  }): Promise<AgentResult> {
    this.reset();
    const start = performance.now();

    const [broadScan, deepDive] = await Promise.all([
      this.fastAnalyze(
        `Quick assessment: Is "${params.concern}" a real threat to this portfolio: ${params.portfolio}? Rate 1-10 urgency. One paragraph.`
      ),
      this.reason(
        `DEEP THREAT ANALYSIS

Portfolio: ${params.portfolio}
Concern: ${params.concern}
${params.data ? `\nSupporting Data:\n${params.data}` : ""}

Analyze this threat:
1. Is it real or perceived? What's the evidence?
2. What's the probability of materialization (0-100%)?
3. What's the impact if it materializes (quantify the drawdown)?
4. What's the optimal response? (specific actions with sizing)
5. What would make you upgrade/downgrade this threat?
6. What's the worst-case scenario and how do you protect against it?`
      ),
    ]);

    const finalAssessment = await this.reason(
      `Finalize your threat assessment:

Quick scan said: ${broadScan.slice(0, 500)}

Deep analysis said: ${deepDive.slice(0, 2000)}

Provide your final recommendation: a 3-point action plan with specific hedge ratios, position adjustments, or risk reduction steps. Include trigger levels for escalation.`
    );

    return this.buildResult(finalAssessment, start);
  }
}
