/**
 * Example: Market Sentiment Analysis
 *
 * Demonstrates single-ticker analysis, news sentiment, and multi-model consensus.
 */

import { SentimentAnalyzer, Orchestrator } from "../src/index.js";

async function main() {
  const orchestrator = new Orchestrator({
    onRoute: (req, providers) =>
      console.log(`[${req.intent}] → ${providers.join(" → ")}`),
  });

  const sentiment = new SentimentAnalyzer(orchestrator);

  // Basic sentiment analysis
  console.log("=== Basic Sentiment Analysis ===");
  const basic = await sentiment.analyze({
    ticker: "AAPL",
    timeHorizon: "short_term",
    context: "Just reported Q1 earnings with a 12% revenue beat",
  });
  console.log(`Sentiment: ${basic.sentiment} (score: ${basic.score})`);
  console.log(`Confidence: ${(basic.confidence * 100).toFixed(0)}%`);
  console.log(`Drivers:`);
  basic.drivers.forEach((d) =>
    console.log(`  ${d.impact === "positive" ? "+" : d.impact === "negative" ? "-" : "~"} ${d.factor} (${(d.weight * 100).toFixed(0)}%)`)
  );

  // News sentiment
  console.log("\n=== News Sentiment ===");
  const news = await sentiment.analyzeNews({
    ticker: "TSLA",
    headlines: [
      "Tesla Q1 deliveries beat analyst estimates by 15%",
      "New Shanghai Gigafactory expansion approved",
      "Elon Musk warns of supply chain constraints in H2",
      "Tesla FSD v13 receives regulatory approval in EU",
    ],
  });
  console.log(`Sentiment: ${news.sentiment} (score: ${news.score})`);

  // Multi-model consensus
  console.log("\n=== Multi-Model Consensus ===");
  const consensus = await sentiment.consensus({
    ticker: "NVDA",
    context: "AI spending continues to accelerate, but valuation concerns mount",
  });
  console.log(`Aggregate Score: ${consensus.aggregateScore.toFixed(2)}`);
  console.log(`Aggregate Sentiment: ${consensus.aggregateSentiment}`);
  console.log(`Model Agreement: ${(consensus.agreement * 100).toFixed(0)}%`);
  consensus.results.forEach((r, i) =>
    console.log(`  Model ${i + 1}: ${r.sentiment} (${r.score.toFixed(2)})`)
  );
}

main().catch(console.error);
