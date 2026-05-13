const TICKER_PATTERN = /^[A-Z]{1,5}$/;

export class InputValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string
  ) {
    super(`Validation failed for '${field}': ${message}`);
    this.name = "InputValidationError";
  }
}

export function validateTicker(ticker: string): string {
  const cleaned = ticker.trim().toUpperCase();
  if (!cleaned) {
    throw new InputValidationError("ticker", "Ticker symbol is required");
  }
  if (!TICKER_PATTERN.test(cleaned)) {
    throw new InputValidationError("ticker", `Invalid ticker format: '${cleaned}'. Expected 1-5 uppercase letters.`);
  }
  return cleaned;
}

export function validatePrice(price: number, field: string): number {
  if (!Number.isFinite(price) || price <= 0) {
    throw new InputValidationError(field, `Must be a positive number, got ${price}`);
  }
  return price;
}

export function validatePercentage(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new InputValidationError(field, `Must be between 0 and 100, got ${value}`);
  }
  return value;
}

export function validateConfidence(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new InputValidationError(field, `Must be between 0 and 1, got ${value}`);
  }
  return value;
}

export function validatePortfolioValue(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new InputValidationError("portfolioValue", `Must be a positive number, got ${value}`);
  }
  return value;
}

export function validateStopLoss(stopLoss: number, entryPrice: number, action: "buy" | "sell"): number {
  validatePrice(stopLoss, "stopLoss");
  if (action === "buy" && stopLoss >= entryPrice) {
    throw new InputValidationError("stopLoss", `Stop-loss ($${stopLoss}) must be below entry price ($${entryPrice}) for a buy`);
  }
  if (action === "sell" && stopLoss <= entryPrice) {
    throw new InputValidationError("stopLoss", `Stop-loss ($${stopLoss}) must be above entry price ($${entryPrice}) for a sell/short`);
  }
  return stopLoss;
}

export function validateTakeProfitLevels(levels: number[], entryPrice: number, action: "buy" | "sell"): number[] {
  for (let i = 0; i < levels.length; i++) {
    validatePrice(levels[i], `takeProfit[${i}]`);
    if (action === "buy" && levels[i] <= entryPrice) {
      throw new InputValidationError(`takeProfit[${i}]`, `Take-profit ($${levels[i]}) must be above entry ($${entryPrice}) for a buy`);
    }
    if (action === "sell" && levels[i] >= entryPrice) {
      throw new InputValidationError(`takeProfit[${i}]`, `Take-profit ($${levels[i]}) must be below entry ($${entryPrice}) for a sell/short`);
    }
  }
  const sorted = [...levels].sort((a, b) => action === "buy" ? a - b : b - a);
  return sorted;
}

export function sanitizePromptInput(input: string): string {
  return input
    .replace(/[<>]/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim()
    .slice(0, 10_000);
}

export function validatePortfolioPositions(
  positions: Array<{ ticker: string; value: number; pctOfPortfolio: number }>
): void {
  if (positions.length === 0) {
    throw new InputValidationError("positions", "Portfolio must have at least one position");
  }
  const totalPct = positions.reduce((sum, p) => sum + p.pctOfPortfolio, 0);
  if (totalPct > 105) {
    throw new InputValidationError("positions", `Position weights sum to ${totalPct.toFixed(1)}%, which exceeds 100% (with 5% tolerance)`);
  }
  for (const p of positions) {
    validateTicker(p.ticker);
    validatePrice(p.value, `position[${p.ticker}].value`);
  }
}
