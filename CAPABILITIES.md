# CoreIntent AI — Capabilities Manifest

> Sovereign multi-model orchestration for algorithmic trading intelligence.

## Core Engine

### Multi-Model Orchestrator
The brain of the AI layer. Routes every request to the optimal model based on task intent, with automatic fallback chains for resilience.

| Intent | Primary Model | Fallbacks | Use Case |
|--------|--------------|-----------|----------|
| `reasoning` | Claude | Grok | Complex analysis, structured generation |
| `fast_analysis` | Grok | Claude | Speed-critical market reads |
| `research` | Perplexity | Grok, Claude | Web-grounded research with citations |
| `sentiment` | Grok | Claude, Perplexity | Real-time sentiment extraction |
| `signal` | Claude | Grok | Trading signal generation |
| `risk` | Claude | Grok | Risk assessment and position sizing |

**Features:**
- Intent-based routing with configurable provider preferences
- Automatic fallback with exponential backoff retry
- Request fan-out for parallel multi-model queries
- Consensus mode for multi-model agreement scoring
- Timeout enforcement per request
- Full token usage tracking

---

## Capabilities

### 1. Market Sentiment Analysis
**Class:** `SentimentAnalyzer`

Extracts structured market sentiment from news, earnings data, and market context.

**Methods:**
- `analyze()` — General sentiment analysis for any ticker
- `analyzeNews()` — Sentiment from news headlines
- `analyzeEarnings()` — Post-earnings sentiment (EPS, revenue, guidance)
- `consensus()` — Multi-model sentiment with agreement scoring

**Output:** Structured `SentimentResult` with:
- 7-level sentiment scale (strongly_bearish → strongly_bullish)
- Confidence score (0.0 - 1.0)
- Numeric score (-1.0 to +1.0)
- Weighted sentiment drivers
- Time horizon classification

---

### 2. Trading Signal Generation
**Class:** `SignalGenerator`

Generates risk-aware trading signals with entry/exit levels, stop-losses, and technical justification.

**Methods:**
- `generate()` — Single-ticker signal with full technical analysis
- `generateBatch()` — Multi-ticker signals in one request
- `generateWithReview()` — Two-pass: generate then validate with second model
- `consensus()` — Multi-model signal with agreement scoring

**Output:** Structured `TradingSignal` with:
- 5-level action scale (strong_sell → strong_buy)
- Entry price, stop-loss, multiple take-profit levels
- Technical factors with indicator values
- Optional fundamental factors
- Risk/reward ratio calculation

---

### 3. Risk Assessment Framework
**Class:** `RiskAssessor`

Multi-dimensional risk analysis for individual positions and entire portfolios.

**Methods:**
- `assessPosition()` — Single position risk with 7 risk categories
- `assessPortfolio()` — Portfolio-level risk aggregation
- `preTradeCheck()` — Pre-trade risk gate (approve/reject with reasoning)
- `quickScore()` — Fast numeric risk score (0-100) for automated decisions

**Output:** Structured `RiskAssessment` with:
- 6-level risk scale (minimal → critical)
- Numeric risk score (0-100)
- Per-category risk breakdown (market, volatility, liquidity, concentration, correlation, drawdown, event)
- Position sizing recommendations with Kelly criterion
- Actionable warnings and recommendations

**Risk Categories:**
| Category | What It Measures |
|----------|-----------------|
| `market_risk` | Broad market exposure |
| `volatility_risk` | Vol expansion/contraction |
| `liquidity_risk` | Entry/exit slippage potential |
| `concentration_risk` | Single-name/sector overexposure |
| `correlation_risk` | Hidden correlation reducing diversification |
| `drawdown_risk` | Peak-to-trough decline potential |
| `event_risk` | Binary events (earnings, FDA, elections) |

---

### 4. Market Research
**Class:** `MarketResearcher`

Web-grounded market research powered by Perplexity with Claude analysis fallback.

**Methods:**
- `research()` — General research with configurable depth (quick/standard/deep)
- `competitorAnalysis()` — Competitive landscape analysis
- `catalysts()` — Upcoming catalyst identification and ranking
- `deepDive()` — Parallel web research + reasoning analysis

---

## Agent System

### Autonomous Trading Intelligence Agents

Three specialized agents that can operate independently or chain together:

#### MarketAnalyst Agent
**Pipeline:** Research → Sentiment Read → Deep Synthesis

Multi-step analysis combining web research, fast sentiment assessment, and deep reasoning into a comprehensive market report. Output includes: Executive Summary, Sentiment Assessment, Technical Outlook, Fundamental View, Catalysts, Risk Factors, and Verdict.

#### RiskManager Agent
**Pipeline:** Risk Assessment → Deep Evaluation → Recommendations

Autonomous risk evaluation covering tail risks, correlations, drawdown scenarios, and position sizing. Output includes: Risk Dashboard, Position Analysis, Correlation Map, Alerts, and Recommendations.

#### TradeExecutor Agent
**Pipeline:** Setup Analysis → Execution Planning → Order Specification

Generates detailed trade execution plans with specific order types, prices, quantities, and contingencies. Output includes: Trade Thesis, Entry Plan, Exit Plan, Position Sizing, Execution Timeline, Contingencies, and Order Specifications.

#### Full Trading Pipeline
`runTradingPipeline()` — Chains all three agents:
1. MarketAnalyst evaluates the opportunity
2. RiskManager assesses the risk
3. TradeExecutor generates the execution plan

---

## Technical Stack

- **TypeScript** — Full type safety with strict mode
- **Zod** — Runtime schema validation for all AI outputs
- **Anthropic SDK** — Native Claude integration
- **OpenAI SDK** — Grok and Perplexity via OpenAI-compatible APIs
- **Vitest** — Fast testing with 45+ tests
- **Zero external runtime dependencies** beyond the AI SDKs

---

## Model Providers

| Provider | SDK | Strengths | Use Cases |
|----------|-----|-----------|-----------|
| **Claude** (Anthropic) | `@anthropic-ai/sdk` | Deep reasoning, structured output, nuance | Signals, risk, complex analysis |
| **Grok** (xAI) | `openai` (compatible) | Speed, real-time data, market awareness | Sentiment, fast reads, screening |
| **Perplexity** | `openai` (compatible) | Web-grounded, citations, current data | Research, news, fact-checking |

---

*Built by Corey McIvor — CoreIntent AI*
