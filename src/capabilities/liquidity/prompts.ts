export const LIQUIDITY_SYSTEM_PROMPT = `You are CoreIntent AI — a sovereign market liquidity intelligence engine.

ROLE: Assess how easily positions can be entered or exited without significantly moving the market price. Provide execution intelligence that helps traders minimize slippage, avoid liquidity traps, and time their entries/exits optimally.

LIQUIDITY DIMENSIONS:
- Depth: Order book thickness — how much size sits at each price level. Deeper books absorb large orders with less impact.
- Breadth: Number of active participants — more participants mean more natural counterparties and tighter markets.
- Immediacy: Speed of execution — how quickly a given size can be filled at acceptable prices.
- Resiliency: How fast the order book refills after a large trade — resilient markets recover quickly, fragile markets gap.

LIQUIDITY REGIMES:
- abundant: Tight spreads, deep books, fast fills. Execution risk minimal. Typical of high-cap liquid names in normal markets.
- normal: Adequate liquidity for standard position sizes. Some spread widening on larger orders. Execution manageable with basic algorithms.
- thin: Wide spreads, shallow books, potential for slippage. Requires careful execution — TWAP/VWAP preferred. Size must be worked over time.
- crisis: One-sided markets, gap risk, potential for flash crashes. Liquidity disappears when you need it most. Only patient limit orders or dark pools viable.

KEY SIGNALS:
- Bid-ask spread behavior: Persistent widening signals deteriorating liquidity. Intraday spread patterns reveal optimal execution windows.
- Volume profile: Intraday volume concentration, average daily volume (ADV), volume trend. Position size relative to ADV is the primary liquidity constraint.
- Dark pool activity: Percentage of volume executing in dark venues. High dark pool % may indicate institutional accumulation/distribution.
- Market maker positioning: Quote stability, depth refresh rate, withdrawal signals. When market makers step back, crashes follow.
- Time-of-day effects: Liquidity concentrates around open/close. Midday is typically thinnest. Pre-market/after-hours are dangerous.
- Event proximity: Earnings, FOMC, economic data releases create liquidity vacuums before and volatility after.

EXECUTION RISK FACTORS:
- Position size relative to ADV (>1% ADV = significant market impact)
- Time of day (open/close best, midday worst for most names)
- Event calendar (liquidity evaporates pre-event)
- Market regime (crisis/volatile = liquidity holes)
- Sector stress (sector-wide selling = correlated liquidity withdrawal)
- Options expiration effects (gamma exposure can amplify moves)

LIQUIDITY TRAP DETECTION:
A liquidity trap occurs when a market APPEARS liquid but is actually fragile:
- Displayed depth that is mostly algorithmic and will be pulled on any real flow
- Quote stuffing masking thin real liquidity
- Calm surface with underlying fragility (low vol but shallow books)
- Crowded positioning that will create one-sided flow when triggered
- Dark pool liquidity that disappears during stress

OUTPUT FORMAT: Respond ONLY with valid JSON matching the requested schema.`;

export function buildLiquidityAssessmentPrompt(params: {
  ticker: string;
  currentPrice?: number;
  volumeData?: string;
  spreadData?: string;
  orderBookData?: string;
  marketConditions?: string;
}): string {
  let prompt = `Assess current liquidity conditions for ${params.ticker}`;
  if (params.currentPrice) {
    prompt += ` at $${params.currentPrice}`;
  }
  prompt += `.`;

  if (params.volumeData) {
    prompt += `\n\nVolume Data:\n${params.volumeData}`;
  }

  if (params.spreadData) {
    prompt += `\n\nSpread Data:\n${params.spreadData}`;
  }

  if (params.orderBookData) {
    prompt += `\n\nOrder Book Data:\n${params.orderBookData}`;
  }

  if (params.marketConditions) {
    prompt += `\n\nMarket Conditions:\n${params.marketConditions}`;
  }

  prompt += `\n\nProvide a complete liquidity assessment covering: regime classification, depth score, spread in basis points, average daily volume, relative liquidity, time-of-day effects, event proximity, dark pool percentage, optimal execution windows, and key risks. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildExecutionRiskPrompt(params: {
  ticker: string;
  action: "buy" | "sell";
  quantity: number;
  urgency: string;
  currentPrice?: number;
  volumeData?: string;
  orderBookData?: string;
  marketConditions?: string;
}): string {
  let prompt = `Evaluate execution risk for ${params.action}ing ${params.quantity} shares of ${params.ticker}`;
  if (params.currentPrice) {
    prompt += ` at approximately $${params.currentPrice}`;
  }
  prompt += `. Urgency: ${params.urgency}.`;

  if (params.volumeData) {
    prompt += `\n\nVolume Data:\n${params.volumeData}`;
  }

  if (params.orderBookData) {
    prompt += `\n\nOrder Book Data:\n${params.orderBookData}`;
  }

  if (params.marketConditions) {
    prompt += `\n\nMarket Conditions:\n${params.marketConditions}`;
  }

  prompt += `\n\nDevelop an optimal execution plan covering: algorithm selection (TWAP/VWAP/IS/Iceberg/Block), expected slippage in basis points, optimal timing, split strategy with tranches, dark pool recommendation, risks, and contingencies. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildLiquidityTrapPrompt(params: {
  ticker: string;
  currentPrice?: number;
  orderBookData?: string;
  volumeData?: string;
  positioningData?: string;
  optionsData?: string;
}): string {
  let prompt = `Analyze ${params.ticker} for potential liquidity traps`;
  if (params.currentPrice) {
    prompt += ` (current price: $${params.currentPrice})`;
  }
  prompt += `.`;

  if (params.orderBookData) {
    prompt += `\n\nOrder Book Data:\n${params.orderBookData}`;
  }

  if (params.volumeData) {
    prompt += `\n\nVolume Data:\n${params.volumeData}`;
  }

  if (params.positioningData) {
    prompt += `\n\nPositioning Data:\n${params.positioningData}`;
  }

  if (params.optionsData) {
    prompt += `\n\nOptions/Gamma Data:\n${params.optionsData}`;
  }

  prompt += `\n\nDetect any liquidity traps: markets that appear liquid but are actually fragile. Look for algorithmic depth that will be pulled, quote stuffing, crowded positioning, dark pool fragility, and calm-surface/thin-depth divergences. Provide a full liquidity assessment with trap-specific risks highlighted. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}

export function buildMarketMicrostructurePrompt(params: {
  ticker: string;
  currentPrice?: number;
  orderBookData?: string;
  tradeData?: string;
  spreadHistory?: string;
  darkPoolData?: string;
}): string {
  let prompt = `Deep microstructure analysis for ${params.ticker}`;
  if (params.currentPrice) {
    prompt += ` at $${params.currentPrice}`;
  }
  prompt += `.`;

  if (params.orderBookData) {
    prompt += `\n\nOrder Book Snapshots:\n${params.orderBookData}`;
  }

  if (params.tradeData) {
    prompt += `\n\nTrade-by-Trade Data:\n${params.tradeData}`;
  }

  if (params.spreadHistory) {
    prompt += `\n\nSpread History:\n${params.spreadHistory}`;
  }

  if (params.darkPoolData) {
    prompt += `\n\nDark Pool / Off-Exchange Data:\n${params.darkPoolData}`;
  }

  prompt += `\n\nAnalyze the microstructure: bid-ask dynamics, order flow toxicity, market maker behavior, hidden liquidity, information asymmetry signals, and execution environment quality. Provide a comprehensive liquidity assessment. Set the timestamp to "${new Date().toISOString()}".`;

  return prompt;
}
