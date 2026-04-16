/**
 * Example: Full Trading Pipeline
 *
 * Runs the complete autonomous pipeline:
 * MarketAnalyst → RiskManager → TradeExecutor
 */

import { runTradingPipeline, Orchestrator } from "../src/index.js";

async function main() {
  const orchestrator = new Orchestrator({
    onRoute: (req, providers) =>
      console.log(`  [${req.intent}] → ${providers[0]}`),
    onComplete: (res) =>
      console.log(`  ✓ ${res.provider} responded in ${res.latencyMs}ms`),
  });

  console.log("=== CoreIntent Trading Pipeline ===\n");
  console.log("Analyzing: NVDA breakout above $950\n");

  const result = await runTradingPipeline({
    input: "NVDA showing a bullish flag breakout above $950 with 2x average volume. RSI at 62, MACD just crossed bullish. Sector is strong with AI spending accelerating.",
    portfolioValue: 100_000,
    riskTolerancePct: 1,
    orchestrator,
  });

  console.log("\n--- MARKET ANALYSIS ---");
  console.log(result.analysis.slice(0, 1000));

  console.log("\n--- RISK ASSESSMENT ---");
  console.log(result.riskAssessment.slice(0, 1000));

  console.log("\n--- EXECUTION PLAN ---");
  console.log(result.executionPlan.slice(0, 1000));

  console.log(`\nTotal pipeline time: ${result.totalLatencyMs}ms`);
}

main().catch(console.error);
