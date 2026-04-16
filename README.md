# CoreIntent AI

> Sovereign multi-model orchestration for algorithmic trading intelligence.

CoreIntent AI is the intelligence layer powering the [CoreIntent](https://coreintent.dev) trading platform. It orchestrates Claude, Grok, and Perplexity — routing each task to the model best suited for the job — to deliver market sentiment analysis, trading signal generation, risk assessment, and autonomous agent workflows.

Built by Corey McIvor / [Zynthio.ai](https://zynthio.ai) (NZ).

## Relationship to Other Repos

| Repo | Purpose |
|------|---------|
| [coreintent](https://github.com/coreintentdev/coreintent) | Main application — Next.js 14, trading engine, AI fleet |
| [coreintentai](https://github.com/coreintentdev/coreintentai) | This repo — AI intelligence layer |
| [Zynthio](https://github.com/coreintentdev/Zynthio) | Zynthio.ai landing page + waitlist |

## Quick Start

```bash
# Install
npm install

# Configure
cp .env.example .env
# Add your API keys to .env

# Test
npm test

# Build
npm run build
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   CoreIntent AI                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────┐  ┌────────────┐  ┌──────────────┐ │
│  │  Sentiment   │  │  Signals   │  │    Risk      │ │
│  │  Analyzer    │  │  Generator │  │  Assessor    │ │
│  └──────┬───────┘  └─────┬──────┘  └──────┬───────┘ │
│         │                │                │          │
│  ┌──────┴────────────────┴────────────────┴───────┐ │
│  │              Orchestrator                       │ │
│  │         Intent Router + Fallback Engine         │ │
│  └──────┬────────────────┬────────────────┬───────┘ │
│         │                │                │          │
│  ┌──────┴──────┐  ┌─────┴──────┐  ┌──────┴───────┐ │
│  │   Claude    │  │    Grok    │  │  Perplexity  │ │
│  │  (Depth)    │  │  (Speed)   │  │  (Research)  │ │
│  └─────────────┘  └────────────┘  └──────────────┘ │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │                Agent System                      │ │
│  │  MarketAnalyst → RiskManager → TradeExecutor    │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Usage

```typescript
import {
  Orchestrator,
  SentimentAnalyzer,
  SignalGenerator,
  RiskAssessor,
  runTradingPipeline,
} from "@coreintent/ai";

// Direct orchestration
const orchestrator = new Orchestrator();
const result = await orchestrator.execute({
  intent: "sentiment",
  prompt: "Analyze AAPL sentiment after Q1 earnings beat",
});

// Sentiment analysis
const sentiment = new SentimentAnalyzer();
const analysis = await sentiment.analyze({
  ticker: "AAPL",
  timeHorizon: "short_term",
});
// → { sentiment: "bullish", confidence: 0.82, score: 0.65, drivers: [...] }

// Trading signals
const signals = new SignalGenerator();
const signal = await signals.generate({
  ticker: "NVDA",
  currentPrice: 950,
  timeframe: "swing",
});
// → { action: "buy", confidence: 0.75, stopLoss: 920, takeProfit: [980, 1020] }

// Risk assessment
const risk = new RiskAssessor();
const check = await risk.preTradeCheck({
  ticker: "TSLA",
  action: "buy",
  proposedSize: 15000,
  currentPortfolio: "...",
});
// → { approved: true, assessment: { riskScore: 42, ... } }

// Full autonomous pipeline
const pipeline = await runTradingPipeline({
  input: "NVDA breakout above $950 with volume confirmation",
  portfolioValue: 100_000,
  riskTolerancePct: 1,
});
// → { analysis, riskAssessment, executionPlan }
```

## Multi-Model Strategy

| Model | Role | Routed Tasks |
|-------|------|-------------|
| **Claude** | Deep reasoning engine | Signals, risk, complex analysis |
| **Grok** | Speed-optimized | Sentiment, fast screening, real-time |
| **Perplexity** | Web-grounded research | News, catalysts, fact-checking |

The orchestrator automatically routes each request to the optimal model and falls through to alternatives on failure.

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
npm run typecheck     # TypeScript validation
```

## See Also

- [CAPABILITIES.md](./CAPABILITIES.md) — Full capabilities manifest
- [CLAUDE.md](./CLAUDE.md) — Development guide for AI-assisted coding

## License

MIT — Corey McIvor / CoreIntent
