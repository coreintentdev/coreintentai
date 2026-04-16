/**
 * Example: Risk Assessment
 *
 * Demonstrates position risk, portfolio risk, and pre-trade checks.
 */

import { RiskAssessor, Orchestrator } from "../src/index.js";

async function main() {
  const orchestrator = new Orchestrator({
    onRoute: (req, providers) =>
      console.log(`[${req.intent}] → ${providers.join(" → ")}`),
  });

  const risk = new RiskAssessor(orchestrator);

  // Position risk assessment
  console.log("=== Position Risk Assessment ===");
  const positionRisk = await risk.assessPosition({
    ticker: "NVDA",
    currentPrice: 950,
    positionSize: 19000,
    portfolioValue: 100000,
    stopLoss: 920,
    beta: 1.8,
    sector: "Technology",
    volatility: 0.45,
  });
  console.log(`Risk Level: ${positionRisk.overallRisk}`);
  console.log(`Risk Score: ${positionRisk.riskScore}/100`);
  console.log("Components:");
  positionRisk.components.forEach((c) =>
    console.log(`  ${c.category}: ${c.level} (${c.score}/100) — ${c.description}`)
  );
  if (positionRisk.positionSizing) {
    console.log(`Recommended Size: ${positionRisk.positionSizing.recommendedPositionPct}%`);
  }

  // Pre-trade risk check
  console.log("\n=== Pre-Trade Risk Check ===");
  const check = await risk.preTradeCheck({
    ticker: "TSLA",
    action: "buy",
    proposedSize: 25000,
    currentPortfolio: `
      Portfolio: $100,000
      NVDA: $19,000 (19%) — Technology
      AAPL: $15,000 (15%) — Technology
      Cash: $66,000 (66%)
    `,
    marketConditions: "VIX at 22, slight risk-off tone in broad market",
  });
  console.log(`Approved: ${check.approved}`);
  console.log(`Reason: ${check.reason}`);

  // Portfolio risk
  console.log("\n=== Portfolio Risk Assessment ===");
  const portfolioRisk = await risk.assessPortfolio({
    positions: [
      { ticker: "NVDA", value: 19000, pctOfPortfolio: 19, sector: "Technology", beta: 1.8 },
      { ticker: "AAPL", value: 15000, pctOfPortfolio: 15, sector: "Technology", beta: 1.2 },
      { ticker: "TSLA", value: 25000, pctOfPortfolio: 25, sector: "Consumer Discretionary", beta: 2.0 },
    ],
    totalValue: 100000,
    cashPct: 41,
  });
  console.log(`Portfolio Risk: ${portfolioRisk.overallRisk} (${portfolioRisk.riskScore}/100)`);
  console.log(`Warnings: ${portfolioRisk.warnings.join("; ")}`);
}

main().catch(console.error);
