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

### 5. Market Regime Detection
**Class:** `RegimeDetector`

Classifies the current market regime and predicts transitions.

**Methods:**
- `detect()` — Classify current regime with transition probabilities
- `trackTransition()` — Monitor a regime for signs of change
- `strategyFit()` — Assess which strategies fit the current regime

**Output:** Structured `MarketRegime` with:
- 7 regime types (trending_up, trending_down, ranging, volatile_expansion, compression, crisis, rotation)
- Volatility regime classification (low/normal/elevated/extreme)
- Trend strength and regime age
- Transition probabilities with triggers
- Strategy implications (recommended, avoid, position sizing, stop approach)

---

### 6. Cross-Asset Correlation Analysis
**Class:** `CorrelationAnalyzer`

Detects correlation structures, clusters, and hidden diversification risks.

**Methods:**
- `analyzeMatrix()` — Full N×N correlation matrix with clustering
- `detectBreak()` — Identify correlation breakdowns (regime change signal)
- `diversificationCheck()` — Score portfolio diversification quality

**Output:** Structured `CorrelationMatrix` with:
- Pairwise correlations with strength classification
- Lead-lag relationships
- Asset clusters with drivers
- Diversification score (0-1)
- Hidden risk identification

---

### 7. Anomaly Detection
**Class:** `AnomalyDetector`

Detects statistically unusual market activity that may signal informed trading, regime shifts, or exploitable mispricings.

**Methods:**
- `detect()` — Scan a single ticker for anomalies
- `multiAssetScan()` — Scan multiple tickers for correlated anomalies
- `deepDive()` — Deep analysis of a specific detected anomaly

**Anomaly Categories:** volume_spike, price_dislocation, volatility_anomaly, correlation_break, options_flow, order_flow, fundamental_divergence, cross_asset_signal

**Output:** Structured `AnomalyReport` with:
- Per-anomaly severity scoring (0-100)
- Evidence and possible causes
- Historical precedent matching
- Alert level classification (none/watch/alert/critical)
- Cross-asset signal detection

---

### 8. Multi-Model Consensus Engine
**Class:** `ConsensusEngine`

Queries multiple AI models with the same question, then synthesizes their responses into a single high-confidence verdict.

**Methods:**
- `synthesize()` — General multi-model consensus with synthesis
- `tradingConsensus()` — Trading-specific consensus with market context
- `quickConsensus()` — Fast 2-model (Claude + Grok) consensus

**Output:** Structured `ConsensusResult` with:
- Unified verdict with confidence score
- Agreement level (unanimous → contradictory)
- Per-model contributions with unique insights
- Key agreements and disagreements with resolutions
- Blind spot identification
- Actionable insight synthesis

---

### 9. Momentum Scoring
**Class:** `MomentumScorer`

Ranks assets by composite momentum score and detects momentum shifts.

**Methods:**
- `rank()` — Rank tickers by composite momentum (price + volume + relative strength)
- `screen()` — Screen a universe for momentum setups matching criteria
- `detectShift()` — Detect if a ticker is experiencing momentum acceleration or exhaustion
- `crossValidatedRank()` — Multi-model ranking (Grok speed + Claude depth) for high-conviction picks

**Output:** Structured `MomentumReport` with:
- Per-ticker composite score, rank, and component breakdown
- Acceleration signal (accelerating/steady/decelerating/reversing)
- Timeframe alignment assessment
- Exhaustion risk scoring
- Sector rotation map (leading/lagging/emerging)
- Market breadth score and assessment

---

### 10. Narrative Intelligence
**Class:** `NarrativeIntelligence`

Detects, tracks, and scores the stories and themes driving price action. Markets are narrative-driven machines — this capability makes those narratives explicit and quantifiable.

**Methods:**
- `detect()` — Identify all active narratives driving a ticker
- `scoreStrength()` — Score a specific narrative's current power
- `detectShifts()` — Identify when narratives are changing or dying
- `mapSector()` — Map all active narratives across a market sector
- `crossValidate()` — Multi-model narrative detection for high-conviction identification

**Narrative Categories:** macro, sector, company, geopolitical, structural, thematic

**Narrative Lifecycle:** emerging → accelerating → consensus → exhausted → reversing

**Output:** Structured `NarrativeReport` with:
- Per-narrative scoring: strength (0-100), conviction (0-1), freshness (0-1), crowding (0-1), price reflexivity (0-1)
- Dominant narrative identification
- Narrative conflicts and shift signals
- Trading implications per narrative
- Related narrative mapping

---

### 11. Liquidity Intelligence
**Class:** `LiquidityAnalyzer`

Assesses market microstructure conditions, detects liquidity traps, and provides execution intelligence for optimal trade execution.

**Methods:**
- `assess()` — Assess current liquidity conditions for a ticker
- `executionRisk()` — Evaluate execution risk for a specific trade size
- `detectTraps()` — Identify liquidity traps (markets that appear liquid but are fragile)
- `microstructure()` — Deep microstructure analysis (order flow, information asymmetry, market maker behavior)
- `optimalExecution()` — Multi-model execution planning (Grok + Claude fan-out)

**Liquidity Regimes:** abundant, normal, thin, crisis

**Output:** Structured `LiquidityAssessment` + `ExecutionPlan` with:
- Regime classification and depth scoring
- Spread in basis points, dark pool percentage
- Optimal execution windows with quality ratings
- Algorithm selection (TWAP/VWAP/IS/Iceberg/Block)
- Split strategy with per-tranche routing
- Expected slippage estimation
- Contingency planning

---

## Resilience Layer

### Circuit Breaker
Tracks provider health and automatically deprioritizes failing providers.

**Features:**
- Three states: closed (healthy), open (failing), half_open (recovering)
- Configurable failure threshold and reset timeout
- Latency tracking with sliding window
- Adaptive provider ranking by health + latency
- Graceful degradation — never hard-fails if any provider is available

### Fallback Engine
Executes requests across provider chains with retry logic.

**Features:**
- Exponential backoff with jitter on transient errors
- Transient error detection (timeouts, rate limits, 5xx, network errors)
- Per-provider attempt tracking
- Full error chain reporting for diagnostics

---

## Agent System

### Autonomous Trading Intelligence Agents

Five specialized agents that can operate independently or chain together:

#### MarketAnalyst Agent
**Pipeline:** Research → Sentiment Read → Deep Synthesis

Multi-step analysis combining web research, fast sentiment assessment, and deep reasoning into a comprehensive market report. Output includes: Executive Summary, Sentiment Assessment, Technical Outlook, Fundamental View, Catalysts, Risk Factors, and Verdict.

#### RiskManager Agent
**Pipeline:** Risk Assessment → Deep Evaluation → Recommendations

Autonomous risk evaluation covering tail risks, correlations, drawdown scenarios, and position sizing. Output includes: Risk Dashboard, Position Analysis, Correlation Map, Alerts, and Recommendations.

#### TradeExecutor Agent
**Pipeline:** Setup Analysis → Execution Planning → Order Specification

Generates detailed trade execution plans with specific order types, prices, quantities, and contingencies. Output includes: Trade Thesis, Entry Plan, Exit Plan, Position Sizing, Execution Timeline, Contingencies, and Order Specifications.

#### StrategyAdvisor Agent
**Pipeline:** Multi-source Gather → Deep Synthesis → Stress Test

Meta-agent that sits above all other agents and capabilities. Gathers intelligence in parallel (sentiment + regime), synthesizes into a coherent strategy, then stress-tests it. Output includes: Market Regime & Context, Conviction Matrix, Strategy Recommendation, Scenario Analysis (bull/bear/base), Risk Budget, Execution Priority, Review Triggers.

#### PortfolioWatchdog Agent
**Pipeline:** 5-stream Parallel Scan → Cross-reference Synthesis → Action Plan

Real-time portfolio surveillance across all intelligence dimensions simultaneously. Launches 5 concurrent scans (narrative, liquidity, anomaly, regime, correlation) and synthesizes into a single actionable health report. Designed for the 4am check — scan in 30 seconds, know immediately if something needs attention.

**Methods:**
- `execute()` — Full multi-dimensional health scan
- `quickScan()` — Fast single-pass for routine monitoring
- `threatAnalysis()` — Deep dive when a specific concern is flagged

Output includes: Health Score (0-100), Alert Level, Top Threats, Narrative Shifts, Liquidity Warnings, Anomalies, Regime Status, Immediate Actions, Watch List.

#### Full Trading Pipeline
`runTradingPipeline()` — Chains four agents:
1. MarketAnalyst evaluates the opportunity
2. RiskManager assesses the risk
3. StrategyAdvisor synthesizes analysis + risk into strategic recommendation
4. TradeExecutor generates the execution plan

---

## Technical Stack

- **TypeScript** — Full type safety with strict mode
- **Zod** — Runtime schema validation for all AI outputs
- **Anthropic SDK** — Native Claude integration
- **OpenAI SDK** — Grok and Perplexity via OpenAI-compatible APIs
- **Vitest** — Fast testing with 314+ tests
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
