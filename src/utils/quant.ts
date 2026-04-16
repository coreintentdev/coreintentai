/**
 * CoreIntent AI — Quantitative Computation Engine
 *
 * Real math for trading decisions. LLMs are great for qualitative reasoning,
 * but position sizing, risk metrics, and statistical measures need deterministic
 * computation — not probabilistic text generation.
 *
 * This module provides the quantitative backbone that makes CoreIntent's
 * AI-driven decisions auditable and mathematically sound.
 */

// ---------------------------------------------------------------------------
// Position Sizing
// ---------------------------------------------------------------------------

/**
 * Kelly Criterion — optimal fraction of capital to risk on a bet.
 *
 * f* = (bp - q) / b
 * where:
 *   b = ratio of win to loss (win_amount / loss_amount)
 *   p = probability of winning
 *   q = probability of losing (1 - p)
 *
 * Returns fractional Kelly (scaled by `fraction` param, default 0.5 for half-Kelly).
 * Full Kelly is mathematically optimal but volatile in practice. Half-Kelly
 * achieves ~75% of the growth rate with far less variance.
 */
export function kellyFraction(params: {
  winProbability: number;
  winLossRatio: number;
  fraction?: number;
}): number {
  const { winProbability, winLossRatio, fraction = 0.5 } = params;

  if (winProbability <= 0 || winProbability >= 1) return 0;
  if (winLossRatio <= 0) return 0;

  const q = 1 - winProbability;
  const fullKelly = (winLossRatio * winProbability - q) / winLossRatio;

  // Negative Kelly means negative edge — don't bet
  if (fullKelly <= 0) return 0;

  return Math.min(fullKelly * fraction, 1);
}

/**
 * Position size in dollars given risk parameters.
 *
 * Calculates maximum position size such that if stop-loss is hit,
 * the loss equals `riskPct` of portfolio value.
 */
export function positionSize(params: {
  portfolioValue: number;
  riskPct: number;
  entryPrice: number;
  stopLoss: number;
}): { shares: number; dollarAmount: number; riskDollars: number } {
  const { portfolioValue, riskPct, entryPrice, stopLoss } = params;

  if (entryPrice <= 0 || stopLoss <= 0 || portfolioValue <= 0) {
    return { shares: 0, dollarAmount: 0, riskDollars: 0 };
  }

  const riskPerShare = Math.abs(entryPrice - stopLoss);
  if (riskPerShare === 0) {
    return { shares: 0, dollarAmount: 0, riskDollars: 0 };
  }

  const riskDollars = portfolioValue * (riskPct / 100);
  const shares = Math.floor(riskDollars / riskPerShare);
  const dollarAmount = shares * entryPrice;

  return { shares, dollarAmount, riskDollars };
}

// ---------------------------------------------------------------------------
// Risk Metrics
// ---------------------------------------------------------------------------

/**
 * Historical Value at Risk (VaR) using the percentile method.
 *
 * Given an array of historical returns, calculates the loss that will not
 * be exceeded with (1 - confidence) probability over one period.
 *
 * @param returns - Array of period returns (e.g., daily returns as decimals)
 * @param confidence - Confidence level (e.g., 0.95 for 95% VaR)
 * @param portfolioValue - Current portfolio value in dollars
 * @returns VaR as a positive dollar amount (the potential loss)
 */
export function historicalVaR(
  returns: number[],
  confidence: number,
  portfolioValue: number
): number {
  if (returns.length === 0) return 0;

  const sorted = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidence) * sorted.length);
  const varReturn = sorted[Math.max(index, 0)];

  // VaR is expressed as a positive number (the loss)
  return Math.abs(varReturn) * portfolioValue;
}

/**
 * Parametric VaR assuming normal distribution.
 *
 * VaR = μ - z * σ (for portfolio value)
 */
export function parametricVaR(params: {
  meanReturn: number;
  stdDev: number;
  confidence: number;
  portfolioValue: number;
  holdingPeriodDays?: number;
}): number {
  const {
    meanReturn,
    stdDev,
    confidence,
    portfolioValue,
    holdingPeriodDays = 1,
  } = params;

  // Z-scores for common confidence levels
  const zScore = normalInvCDF(confidence);
  const scaledStd = stdDev * Math.sqrt(holdingPeriodDays);
  const scaledMean = meanReturn * holdingPeriodDays;

  const varReturn = scaledMean - zScore * scaledStd;

  return Math.abs(Math.min(varReturn, 0)) * portfolioValue;
}

/**
 * Conditional VaR (Expected Shortfall / CVaR).
 *
 * Average of losses exceeding the VaR threshold. Captures tail risk
 * better than VaR alone — answers "when things go bad, how bad?"
 */
export function conditionalVaR(
  returns: number[],
  confidence: number,
  portfolioValue: number
): number {
  if (returns.length === 0) return 0;

  const sorted = [...returns].sort((a, b) => a - b);
  const cutoffIndex = Math.floor((1 - confidence) * sorted.length);
  const tailReturns = sorted.slice(0, Math.max(cutoffIndex, 1));

  const avgTailReturn =
    tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;

  return Math.abs(avgTailReturn) * portfolioValue;
}

// ---------------------------------------------------------------------------
// Performance Metrics
// ---------------------------------------------------------------------------

/**
 * Sharpe Ratio — risk-adjusted return measure.
 *
 * Sharpe = (mean_return - risk_free_rate) / std_dev
 *
 * Annualized by default (assumes daily returns input, 252 trading days).
 */
export function sharpeRatio(params: {
  returns: number[];
  riskFreeRate?: number;
  periodsPerYear?: number;
}): number {
  const { returns, riskFreeRate = 0, periodsPerYear = 252 } = params;

  if (returns.length < 2) return 0;

  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const std = standardDeviation(returns);

  if (std === 0) return 0;

  const excessReturn = mean - riskFreeRate / periodsPerYear;
  return (excessReturn / std) * Math.sqrt(periodsPerYear);
}

/**
 * Sortino Ratio — like Sharpe but only penalizes downside volatility.
 *
 * Sortino = (mean_return - risk_free_rate) / downside_deviation
 */
export function sortinoRatio(params: {
  returns: number[];
  riskFreeRate?: number;
  periodsPerYear?: number;
}): number {
  const { returns, riskFreeRate = 0, periodsPerYear = 252 } = params;

  if (returns.length < 2) return 0;

  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const mar = riskFreeRate / periodsPerYear; // minimum acceptable return per period
  const downsideReturns = returns.filter((r) => r < mar);

  if (downsideReturns.length === 0) return Infinity;

  const downsideDev = Math.sqrt(
    downsideReturns.reduce((sum, r) => sum + (r - mar) ** 2, 0) /
      downsideReturns.length
  );

  if (downsideDev === 0) return Infinity;

  return ((mean - mar) / downsideDev) * Math.sqrt(periodsPerYear);
}

/**
 * Maximum drawdown — largest peak-to-trough decline.
 *
 * Returns both the max drawdown percentage and the recovery info.
 */
export function maxDrawdown(equityCurve: number[]): {
  maxDrawdownPct: number;
  peakIndex: number;
  troughIndex: number;
  currentDrawdownPct: number;
} {
  if (equityCurve.length < 2) {
    return { maxDrawdownPct: 0, peakIndex: 0, troughIndex: 0, currentDrawdownPct: 0 };
  }

  let peak = equityCurve[0];
  let peakIndex = 0;
  let maxDd = 0;
  let maxDdPeakIndex = 0;
  let maxDdTroughIndex = 0;

  for (let i = 1; i < equityCurve.length; i++) {
    if (equityCurve[i] > peak) {
      peak = equityCurve[i];
      peakIndex = i;
    }

    const dd = (peak - equityCurve[i]) / peak;
    if (dd > maxDd) {
      maxDd = dd;
      maxDdPeakIndex = peakIndex;
      maxDdTroughIndex = i;
    }
  }

  // Current drawdown from most recent peak
  const currentPeak = Math.max(...equityCurve);
  const currentValue = equityCurve[equityCurve.length - 1];
  const currentDrawdownPct = (currentPeak - currentValue) / currentPeak;

  return {
    maxDrawdownPct: maxDd,
    peakIndex: maxDdPeakIndex,
    troughIndex: maxDdTroughIndex,
    currentDrawdownPct,
  };
}

/**
 * Calmar Ratio — annualized return / max drawdown.
 * Higher is better. Measures return relative to worst-case risk.
 */
export function calmarRatio(params: {
  annualizedReturn: number;
  maxDrawdownPct: number;
}): number {
  if (params.maxDrawdownPct === 0) return Infinity;
  return params.annualizedReturn / params.maxDrawdownPct;
}

// ---------------------------------------------------------------------------
// Statistical Utilities
// ---------------------------------------------------------------------------

/**
 * Pearson correlation coefficient between two return series.
 * Measures linear correlation between -1 (inverse) and +1 (perfect).
 */
export function correlation(seriesA: number[], seriesB: number[]): number {
  const n = Math.min(seriesA.length, seriesB.length);
  if (n < 2) return 0;

  const a = seriesA.slice(0, n);
  const b = seriesB.slice(0, n);

  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;

  let cov = 0;
  let varA = 0;
  let varB = 0;

  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }

  const denom = Math.sqrt(varA * varB);
  if (denom === 0) return 0;

  return cov / denom;
}

/**
 * Correlation matrix for multiple return series.
 */
export function correlationMatrix(
  series: Record<string, number[]>
): Record<string, Record<string, number>> {
  const tickers = Object.keys(series);
  const matrix: Record<string, Record<string, number>> = {};

  for (const a of tickers) {
    matrix[a] = {};
    for (const b of tickers) {
      matrix[a][b] = a === b ? 1 : correlation(series[a], series[b]);
    }
  }

  return matrix;
}

/**
 * Beta — sensitivity of asset returns to market returns.
 *
 * β = Cov(asset, market) / Var(market)
 */
export function beta(assetReturns: number[], marketReturns: number[]): number {
  const n = Math.min(assetReturns.length, marketReturns.length);
  if (n < 2) return 1; // default to market beta

  const a = assetReturns.slice(0, n);
  const m = marketReturns.slice(0, n);

  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanM = m.reduce((s, v) => s + v, 0) / n;

  let cov = 0;
  let varM = 0;

  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const dm = m[i] - meanM;
    cov += da * dm;
    varM += dm * dm;
  }

  if (varM === 0) return 1;

  return cov / varM;
}

/**
 * Annualized volatility from period returns.
 */
export function annualizedVolatility(
  returns: number[],
  periodsPerYear: number = 252
): number {
  return standardDeviation(returns) * Math.sqrt(periodsPerYear);
}

/**
 * Standard deviation of a number array.
 */
export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const squaredDiffs = values.reduce((s, v) => s + (v - mean) ** 2, 0);

  return Math.sqrt(squaredDiffs / (values.length - 1)); // sample std dev
}

/**
 * Simple moving average.
 */
export function sma(values: number[], period: number): number[] {
  if (values.length < period) return [];

  const result: number[] = [];
  let sum = 0;

  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  result.push(sum / period);

  for (let i = period; i < values.length; i++) {
    sum += values[i] - values[i - period];
    result.push(sum / period);
  }

  return result;
}

/**
 * Exponential moving average.
 */
export function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];

  const k = 2 / (period + 1); // smoothing factor
  const result: number[] = [values[0]];

  for (let i = 1; i < values.length; i++) {
    result.push(values[i] * k + result[i - 1] * (1 - k));
  }

  return result;
}

// ---------------------------------------------------------------------------
// Risk-Reward Analysis
// ---------------------------------------------------------------------------

/**
 * Calculate risk-reward ratio for a trade.
 */
export function riskRewardRatio(params: {
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
}): number {
  const { entryPrice, stopLoss, takeProfit } = params;
  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(takeProfit - entryPrice);

  if (risk === 0) return Infinity;
  return reward / risk;
}

/**
 * Expected value of a trade given win rate and risk-reward.
 *
 * EV = (winRate * avgWin) - (lossRate * avgLoss)
 * Positive EV = profitable system over many trades.
 */
export function expectedValue(params: {
  winRate: number;
  avgWin: number;
  avgLoss: number;
}): number {
  const { winRate, avgWin, avgLoss } = params;
  return winRate * avgWin - (1 - winRate) * avgLoss;
}

/**
 * Profit factor — gross profits / gross losses.
 * > 1.0 = profitable, > 2.0 = strong, > 3.0 = excellent.
 */
export function profitFactor(wins: number[], losses: number[]): number {
  const grossProfit = wins.reduce((s, w) => s + Math.abs(w), 0);
  const grossLoss = losses.reduce((s, l) => s + Math.abs(l), 0);

  if (grossLoss === 0) return Infinity;
  return grossProfit / grossLoss;
}

// ---------------------------------------------------------------------------
// Portfolio-Level Metrics
// ---------------------------------------------------------------------------

/**
 * Portfolio variance given weights, volatilities, and correlation matrix.
 *
 * σ²_p = Σᵢ Σⱼ wᵢwⱼσᵢσⱼρᵢⱼ
 */
export function portfolioVariance(params: {
  weights: number[];
  volatilities: number[];
  correlations: number[][];
}): number {
  const { weights, volatilities, correlations } = params;
  const n = weights.length;
  let variance = 0;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      variance +=
        weights[i] *
        weights[j] *
        volatilities[i] *
        volatilities[j] *
        correlations[i][j];
    }
  }

  return variance;
}

/**
 * Portfolio volatility (square root of portfolio variance).
 */
export function portfolioVolatility(params: {
  weights: number[];
  volatilities: number[];
  correlations: number[][];
}): number {
  return Math.sqrt(portfolioVariance(params));
}

/**
 * Concentration risk — Herfindahl-Hirschman Index of position weights.
 *
 * HHI ranges from 1/n (perfectly diversified) to 1 (single position).
 * Higher = more concentrated = more risky.
 */
export function concentrationHHI(weights: number[]): number {
  return weights.reduce((sum, w) => sum + w * w, 0);
}

/**
 * Effective number of positions (inverse of HHI).
 * A portfolio with HHI = 0.25 has an effective 4 positions.
 */
export function effectivePositions(weights: number[]): number {
  const hhi = concentrationHHI(weights);
  if (hhi === 0) return 0;
  return 1 / hhi;
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/**
 * Approximate inverse of the standard normal CDF (Beasley-Springer-Moro algorithm).
 * Used for parametric VaR z-score lookups.
 */
function normalInvCDF(p: number): number {
  // Rational approximation for the inverse normal CDF
  // Abramowitz and Stegun approximation 26.2.23
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0,
    -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0,
    3.754408661907416e0,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number;
  let r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q +
          c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
      )
    );
  }
}
