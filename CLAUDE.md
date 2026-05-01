# CoreIntent AI — AI Session Context (Amnesia Shield)

## Owner
Corey McIvor (@coreintentdev / @coreintentai)
Contact: corey@coreyai.ai ONLY
Based in: New Zealand (NEVER register anything in Australia)

## What This Repo IS
- The **AI intelligence layer** for the CoreIntent trading platform
- Sovereign multi-model orchestration: Claude, Grok, Perplexity
- Capabilities: Sentiment analysis, signal generation, risk assessment, regime detection, correlation analysis, agent workflows
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
├── orchestrator/   # Intent router, fallback engine, circuit breaker, adaptive router, core orchestrator
├── capabilities/   # Domain-specific AI capabilities
│   ├── sentiment/  # Market sentiment analysis
│   ├── signals/    # Trading signal generation
│   ├── risk/       # Risk assessment framework
│   ├── research/   # Web-grounded market research
│   ├── regime/     # Market regime detection
│   ├── correlation/ # Cross-asset correlation analysis
│   ├── anomaly/    # Market anomaly detection
│   ├── consensus/  # Multi-model consensus engine
│   ├── momentum/   # Momentum scoring and ranking
│   └── portfolio/  # Portfolio-level intelligence (analysis, rebalancing, stress testing)
├── agents/         # Autonomous trading intelligence agents (incl. StrategyAdvisor)
├── types/          # Shared TypeScript types + Zod schemas
├── utils/          # Shared utilities (JSON parser, telemetry)
└── index.ts        # Public API exports
```

## Key Patterns

### Intent-Based Routing
Every request has an `intent` (reasoning, fast_analysis, research, sentiment, signal, risk). The router maps each intent to the optimal model provider with fallback chains.

### Adaptive Router
The `AdaptiveRouter` learns from execution history — tracking success rate, latency, and cost per (intent, provider) pair. It uses time-weighted decay and epsilon-greedy exploration to continuously optimize routing decisions. Weights can be exported/imported for persistence across restarts.

### Fallback Chains + Circuit Breaker
If a provider fails (timeout, rate limit, error), the system automatically falls through to the next provider. Transient errors trigger retries with exponential backoff (with jitter). A circuit breaker tracks provider health — after repeated failures, the circuit opens and the provider is deprioritized until it recovers. Providers are ranked by health state and latency for adaptive routing.

### Telemetry
The `Telemetry` system provides production-grade observability — recording all orchestration decisions, model calls, fallbacks, and capability executions as structured trace events. Supports querying by type/provider/intent/trace, real-time subscription, and summary statistics (error rate, fallback rate, p95 latency per provider).

### Structured Output
All capability outputs are validated with Zod schemas. The AI layer produces typed, parseable data — not free-form text. A robust JSON parser in `utils/json-parser.ts` handles multiple extraction patterns (raw JSON, markdown fences, embedded JSON) with clear error messages.

### Agent Pipeline
Agents (MarketAnalyst → RiskManager → StrategyAdvisor → TradeExecutor) chain together for full trading workflows. The StrategyAdvisor is a meta-agent that synthesizes intelligence from all capabilities into actionable portfolio strategy with scenario analysis.

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
