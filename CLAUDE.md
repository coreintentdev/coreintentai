# CoreIntent AI — AI Session Context (Amnesia Shield)

## Owner
Corey McIvor (@coreintentdev / @coreintentai)
Contact: corey@coreyai.ai ONLY
Based in: New Zealand (NEVER register anything in Australia)

## What This Repo IS
- The **AI intelligence layer** for the CoreIntent trading platform
- Sovereign multi-model orchestration: Claude, Grok, Perplexity
- Capabilities: Sentiment analysis, signal generation, risk assessment, regime detection, correlation analysis, volatility intelligence, portfolio optimization, agent workflows
- TypeScript library with Zod-validated outputs

## What This Repo IS NOT
- Not the main application (that is coreintentdev/coreintent)
- Not the Zynthio landing page (that is coreintentdev/Zynthio)
- Not a standalone trading bot — it generates intelligence, not executions

## Related Repos
- **coreintentdev/coreintent** — Main Next.js 15 trading engine app
- **coreintentdev/Zynthio** — Zynthio.ai landing page + waitlist

## Rules for AI Sessions
1. READ before you write. Search the codebase before assuming anything.
2. NEVER register anything in Australia. NZ-first for all legal/business.
3. NEVER fabricate family data or personal details.
4. Build passes clean or you don't push.
5. Always run `npm test` and `npm run typecheck` before committing.

## Architecture

```
src/
├── config/         # Model configurations, environment-driven
├── models/         # Provider adapters (Claude, Grok, Perplexity)
├── orchestrator/   # Intent router, fallback engine, circuit breaker, error classification, core orchestrator
├── capabilities/   # Domain-specific AI capabilities (13 modules)
│   ├── sentiment/  # Market sentiment analysis
│   ├── signals/    # Trading signal generation
│   ├── risk/       # Risk assessment framework
│   ├── research/   # Web-grounded market research
│   ├── regime/     # Market regime detection
│   ├── correlation/ # Cross-asset correlation analysis
│   ├── anomaly/    # Market anomaly detection
│   ├── consensus/  # Multi-model consensus engine
│   ├── momentum/   # Momentum scoring and ranking
│   ├── narrative/  # Narrative intelligence (story-driven markets)
│   ├── liquidity/  # Liquidity assessment and execution intelligence
│   ├── volatility/ # Volatility intelligence (IV/RV, skew, term structure, regime)
│   └── portfolio/  # Portfolio optimization (MVO, Black-Litterman, risk parity)
├── agents/         # Autonomous trading intelligence agents (incl. StrategyAdvisor, PortfolioWatchdog)
├── types/          # Shared TypeScript types + Zod schemas
├── utils/          # Shared utilities (robust JSON parser)
└── index.ts        # Public API exports
```

## Key Patterns

### Intent-Based Routing + Adaptive Learning
Every request has an `intent` (reasoning, fast_analysis, research, sentiment, signal, risk). The static router maps each intent to the optimal model provider with fallback chains. The **Adaptive Router** layer sits on top, learning which provider performs best for each intent based on actual quality scores, latency, and success rates — using epsilon-greedy exploration and exponential decay to adapt over time.

### Confidence-Gated Escalation
When a fast model (Grok) returns a low-confidence response, the Adaptive Router can escalate to a deeper model (Claude) automatically. This gives you the speed of Grok for easy queries and the depth of Claude when the situation demands it.

### Fallback Chains + Circuit Breaker
If a provider fails (timeout, rate limit, error), the system automatically falls through to the next provider. Transient errors trigger retries with exponential backoff (with jitter). A circuit breaker tracks provider health — after repeated failures, the circuit opens and the provider is deprioritized until it recovers. Providers are ranked by health state and latency for adaptive routing.

### Response Cache
TTL-based response caching with intent-specific expiration (sentiment: 30s, research: 5min, risk: 2min). Avoids redundant API calls during consensus operations and repeated analyses. SHA-256 keyed by intent + prompt + system prompt.

### Telemetry & Observability
Full event-based telemetry system tracks every request lifecycle: start, complete, error, fallback, cache hit, escalation. Provides real-time snapshots with per-provider and per-intent breakdowns (requests, errors, latency, token usage). Listener-based architecture for plugging into external monitoring.

### Structured Output
All capability outputs are validated with Zod schemas. The AI layer produces typed, parseable data — not free-form text. A robust JSON parser in `utils/json-parser.ts` handles multiple extraction patterns (raw JSON, markdown fences, embedded JSON) with clear error messages.

### Structured Error Classification
Errors are classified into categories (rate_limit, timeout, network, transient, auth, validation, provider_error, unknown) with per-category retry strategies. Auth and validation errors are non-retryable and don't open circuit breakers. Rate limits use longer backoff than timeouts. Replaces fragile string-matching with a structured taxonomy.

### Request Correlation IDs
Every orchestration request is assigned a UUID correlation ID (auto-generated or caller-provided). The ID threads through all telemetry events, enabling end-to-end request tracing across providers, fallbacks, and cache layers.

### Agent Pipeline
Agents (MarketAnalyst → RiskManager → StrategyAdvisor → TradeExecutor) chain together for full trading workflows. The StrategyAdvisor is a meta-agent that synthesizes intelligence from all capabilities into actionable portfolio strategy with scenario analysis. The PortfolioWatchdog provides real-time multi-dimensional surveillance across all intelligence streams.

## Commands

```bash
npm test           # Run tests
npm run typecheck  # TypeScript validation
npm run build      # Compile to dist/
```

## When Making Changes

- Always run `npm test` and `npm run typecheck` before committing.
- New capabilities go in `src/capabilities/<name>/` with a `prompts.ts` and `index.ts`.
- New model providers extend `BaseModelAdapter` in `src/models/`.
- Update `src/index.ts` to export new public APIs.
- Add tests in `tests/` for all new functionality.

## Family (NEVER fabricate)
- Michelle (wife), Ruby (~14, daughter), Wesley (son)
- Hannah is NOT Corey's child. Her mum took her own life. NEVER list as daughter.
- Chas (dad), Willy/Wilhelmina (mum), Pete (brother, The Pelican), Joel (brother), Peter (third brother)
- Ben Innes (best friend, Perth)
