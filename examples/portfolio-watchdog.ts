/**
 * Example: Portfolio Watchdog — Real-time surveillance
 *
 * Demonstrates the Portfolio Watchdog agent scanning an entire portfolio
 * across all intelligence dimensions simultaneously.
 */

import { PortfolioWatchdogAgent, Orchestrator } from "../src/index.js";

async function main() {
  const orchestrator = new Orchestrator({
    onRoute: (req, providers) =>
      console.log(`  [${req.intent}] → ${providers[0]}`),
    onComplete: (res) =>
      console.log(`  ✓ ${res.provider} (${res.latencyMs}ms)`),
  });

  const watchdog = new PortfolioWatchdogAgent(orchestrator);

  console.log("=== CoreIntent Portfolio Watchdog ===\n");

  // Full portfolio health scan
  console.log("--- FULL SCAN ---");
  console.log("Portfolio: NVDA 30%, AAPL 20%, MSFT 15%, TSLA 10%, BTC 10%, TLT 15%\n");

  const result = await watchdog.execute(
    "NVDA 30% @ $950, AAPL 20% @ $185, MSFT 15% @ $420, TSLA 10% @ $250, BTC 10% @ $95000, TLT 15% @ $88. Portfolio value: $500K. Concentrated tech + crypto exposure.",
    {
      portfolioValue: 500_000,
      maxDrawdownTolerance: 0.15,
      riskBudget: "moderate-aggressive",
    }
  );

  console.log("\n" + result.output.slice(0, 3000));
  console.log(`\nScan completed in ${result.totalLatencyMs}ms (${result.turnsUsed} reasoning steps)`);

  // Quick scan — for routine 4am checks
  console.log("\n\n--- QUICK SCAN ---\n");

  const quick = await watchdog.quickScan({
    positions: [
      { ticker: "NVDA", weight: 0.30 },
      { ticker: "AAPL", weight: 0.20 },
      { ticker: "MSFT", weight: 0.15 },
      { ticker: "TSLA", weight: 0.10 },
      { ticker: "BTC", weight: 0.10 },
      { ticker: "TLT", weight: 0.15 },
    ],
    marketContext: "VIX at 18, 10Y yield 4.2%, Fed meeting in 3 days",
  });

  console.log(quick.output);
  console.log(`\nQuick scan: ${quick.totalLatencyMs}ms`);
}

main().catch(console.error);
