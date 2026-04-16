import { describe, it, expect } from "vitest";
import {
  kellyFraction,
  positionSize,
  historicalVaR,
  parametricVaR,
  conditionalVaR,
  sharpeRatio,
  sortinoRatio,
  maxDrawdown,
  calmarRatio,
  correlation,
  correlationMatrix,
  beta,
  annualizedVolatility,
  standardDeviation,
  sma,
  ema,
  riskRewardRatio,
  expectedValue,
  profitFactor,
  portfolioVariance,
  portfolioVolatility,
  concentrationHHI,
  effectivePositions,
} from "../src/utils/quant.js";

// ---------------------------------------------------------------------------
// Position Sizing
// ---------------------------------------------------------------------------

describe("kellyFraction", () => {
  it("returns correct half-Kelly for positive edge", () => {
    // 60% win rate, 2:1 win/loss ratio → full Kelly = (2*0.6 - 0.4)/2 = 0.4
    // Half Kelly = 0.2
    const result = kellyFraction({ winProbability: 0.6, winLossRatio: 2 });
    expect(result).toBeCloseTo(0.2, 4);
  });

  it("returns 0 for negative edge (no bet)", () => {
    // 30% win rate, 1:1 → full Kelly = (1*0.3 - 0.7)/1 = -0.4
    const result = kellyFraction({ winProbability: 0.3, winLossRatio: 1 });
    expect(result).toBe(0);
  });

  it("returns 0 for coin-flip with 1:1 ratio", () => {
    const result = kellyFraction({ winProbability: 0.5, winLossRatio: 1 });
    expect(result).toBe(0);
  });

  it("respects custom fraction parameter", () => {
    // Full Kelly for 60% win rate, 2:1 = 0.4
    const full = kellyFraction({ winProbability: 0.6, winLossRatio: 2, fraction: 1.0 });
    const quarter = kellyFraction({ winProbability: 0.6, winLossRatio: 2, fraction: 0.25 });
    expect(full).toBeCloseTo(0.4, 4);
    expect(quarter).toBeCloseTo(0.1, 4);
  });

  it("returns 0 for edge-case probabilities", () => {
    expect(kellyFraction({ winProbability: 0, winLossRatio: 2 })).toBe(0);
    expect(kellyFraction({ winProbability: 1, winLossRatio: 2 })).toBe(0);
    expect(kellyFraction({ winProbability: 0.5, winLossRatio: 0 })).toBe(0);
  });

  it("caps at 1.0", () => {
    // Very high edge → Kelly would exceed 1
    const result = kellyFraction({ winProbability: 0.99, winLossRatio: 100, fraction: 1.0 });
    expect(result).toBeLessThanOrEqual(1);
  });
});

describe("positionSize", () => {
  it("calculates correct position size from risk parameters", () => {
    const result = positionSize({
      portfolioValue: 100_000,
      riskPct: 1, // risk 1% = $1000
      entryPrice: 100,
      stopLoss: 95, // $5 risk per share
    });
    expect(result.shares).toBe(200); // $1000 / $5 = 200 shares
    expect(result.dollarAmount).toBe(20_000); // 200 * $100
    expect(result.riskDollars).toBe(1_000);
  });

  it("returns 0 for invalid inputs", () => {
    const result = positionSize({
      portfolioValue: 0,
      riskPct: 1,
      entryPrice: 100,
      stopLoss: 95,
    });
    expect(result.shares).toBe(0);
  });

  it("returns 0 when entry equals stop", () => {
    const result = positionSize({
      portfolioValue: 100_000,
      riskPct: 1,
      entryPrice: 100,
      stopLoss: 100,
    });
    expect(result.shares).toBe(0);
  });

  it("floors share count to whole number", () => {
    const result = positionSize({
      portfolioValue: 100_000,
      riskPct: 1,
      entryPrice: 100,
      stopLoss: 97, // $3 risk per share → 1000/3 = 333.33 → 333
    });
    expect(result.shares).toBe(333);
  });
});

// ---------------------------------------------------------------------------
// Risk Metrics
// ---------------------------------------------------------------------------

describe("historicalVaR", () => {
  it("calculates 95% VaR correctly", () => {
    // 100 returns, 5% worst = bottom 5
    const returns = Array.from({ length: 100 }, (_, i) => (i - 50) / 100);
    // Sorted: -0.50, -0.49, ..., 0.49 — bottom 5% index = 5 → value = -0.45
    const var95 = historicalVaR(returns, 0.95, 100_000);
    expect(var95).toBeGreaterThan(0);
    expect(var95).toBeLessThan(100_000);
  });

  it("returns 0 for empty returns", () => {
    expect(historicalVaR([], 0.95, 100_000)).toBe(0);
  });

  it("returns 0 when all returns are positive (no loss risk)", () => {
    const allPositive = Array.from({ length: 100 }, (_, i) => 0.01 + i * 0.001);
    expect(historicalVaR(allPositive, 0.95, 100_000)).toBe(0);
  });
});

describe("conditionalVaR", () => {
  it("returns 0 when all returns are positive (no loss risk)", () => {
    const allPositive = Array.from({ length: 100 }, (_, i) => 0.01 + i * 0.001);
    expect(conditionalVaR(allPositive, 0.95, 100_000)).toBe(0);
  });
});

describe("parametricVaR", () => {
  it("calculates VaR assuming normal distribution", () => {
    const var95 = parametricVaR({
      meanReturn: 0.0005,
      stdDev: 0.02,
      confidence: 0.95,
      portfolioValue: 100_000,
    });
    // 95% VaR ≈ mean - 1.645 * std → 0.0005 - 1.645*0.02 = -0.0324 → $3,240
    expect(var95).toBeGreaterThan(2_500);
    expect(var95).toBeLessThan(4_000);
  });

  it("scales with holding period", () => {
    const var1d = parametricVaR({
      meanReturn: 0.0005,
      stdDev: 0.02,
      confidence: 0.95,
      portfolioValue: 100_000,
      holdingPeriodDays: 1,
    });
    const var10d = parametricVaR({
      meanReturn: 0.0005,
      stdDev: 0.02,
      confidence: 0.95,
      portfolioValue: 100_000,
      holdingPeriodDays: 10,
    });
    // 10-day VaR should be larger than 1-day VaR
    expect(var10d).toBeGreaterThan(var1d);
  });
});

describe("conditionalVaR", () => {
  it("is greater than or equal to VaR", () => {
    const returns = Array.from({ length: 200 }, () => Math.random() * 0.1 - 0.05);
    const var95 = historicalVaR(returns, 0.95, 100_000);
    const cvar95 = conditionalVaR(returns, 0.95, 100_000);
    expect(cvar95).toBeGreaterThanOrEqual(var95 * 0.99); // allow tiny float error
  });
});

// ---------------------------------------------------------------------------
// Performance Metrics
// ---------------------------------------------------------------------------

describe("sharpeRatio", () => {
  it("returns positive Sharpe for consistently positive returns", () => {
    const returns = Array.from({ length: 252 }, () => 0.001); // ~25% annualized
    const sharpe = sharpeRatio({ returns });
    expect(sharpe).toBeGreaterThan(0);
  });

  it("returns negative Sharpe for consistently negative returns", () => {
    const returns = Array.from({ length: 252 }, () => -0.001);
    const sharpe = sharpeRatio({ returns });
    expect(sharpe).toBeLessThan(0);
  });

  it("returns 0 for insufficient data", () => {
    expect(sharpeRatio({ returns: [0.01] })).toBe(0);
    expect(sharpeRatio({ returns: [] })).toBe(0);
  });

  it("returns 0 for zero volatility", () => {
    // All returns are identical
    const returns = Array.from({ length: 100 }, () => 0);
    expect(sharpeRatio({ returns })).toBe(0);
  });
});

describe("sortinoRatio", () => {
  it("returns higher than Sharpe when upside volatility exceeds downside", () => {
    // Returns that are positive with occasional small negatives
    const returns = [0.02, 0.03, 0.01, -0.005, 0.04, 0.02, -0.003, 0.03, 0.01, 0.02];
    const sharpe = sharpeRatio({ returns, periodsPerYear: 252 });
    const sortino = sortinoRatio({ returns, periodsPerYear: 252 });
    expect(sortino).toBeGreaterThan(sharpe);
  });
});

describe("maxDrawdown", () => {
  it("calculates correct max drawdown", () => {
    const curve = [100, 110, 105, 120, 90, 95, 130];
    // Peak at 120, trough at 90 → drawdown = (120-90)/120 = 25%
    const dd = maxDrawdown(curve);
    expect(dd.maxDrawdownPct).toBeCloseTo(0.25, 4);
    expect(dd.peakIndex).toBe(3);  // index of 120
    expect(dd.troughIndex).toBe(4); // index of 90
  });

  it("returns 0 for monotonically increasing curve", () => {
    const curve = [100, 110, 120, 130, 140];
    const dd = maxDrawdown(curve);
    expect(dd.maxDrawdownPct).toBe(0);
    expect(dd.currentDrawdownPct).toBe(0);
  });

  it("handles single-element curve", () => {
    const dd = maxDrawdown([100]);
    expect(dd.maxDrawdownPct).toBe(0);
  });

  it("tracks current drawdown from peak", () => {
    const curve = [100, 120, 110]; // peak=120, current=110 → 8.33%
    const dd = maxDrawdown(curve);
    expect(dd.currentDrawdownPct).toBeCloseTo(10 / 120, 4);
  });
});

describe("calmarRatio", () => {
  it("calculates ratio correctly", () => {
    expect(calmarRatio({ annualizedReturn: 0.20, maxDrawdownPct: 0.10 })).toBe(2);
  });

  it("returns Infinity for zero drawdown", () => {
    expect(calmarRatio({ annualizedReturn: 0.10, maxDrawdownPct: 0 })).toBe(Infinity);
  });
});

// ---------------------------------------------------------------------------
// Statistical Utilities
// ---------------------------------------------------------------------------

describe("correlation", () => {
  it("returns 1.0 for perfectly correlated series", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [2, 4, 6, 8, 10];
    expect(correlation(a, b)).toBeCloseTo(1.0, 6);
  });

  it("returns -1.0 for perfectly inverse series", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [5, 4, 3, 2, 1];
    expect(correlation(a, b)).toBeCloseTo(-1.0, 6);
  });

  it("returns ~0 for uncorrelated series", () => {
    // Large sample of random data should have low correlation
    const a = Array.from({ length: 1000 }, (_, i) => Math.sin(i));
    const b = Array.from({ length: 1000 }, (_, i) => Math.cos(i * 1.7));
    const corr = correlation(a, b);
    expect(Math.abs(corr)).toBeLessThan(0.1);
  });

  it("returns 0 for insufficient data", () => {
    expect(correlation([1], [2])).toBe(0);
  });
});

describe("correlationMatrix", () => {
  it("produces symmetric matrix with 1s on diagonal", () => {
    const series = {
      AAPL: [1, 2, 3, 4, 5],
      MSFT: [2, 4, 6, 8, 10],
      GOOG: [5, 4, 3, 2, 1],
    };
    const matrix = correlationMatrix(series);
    expect(matrix.AAPL.AAPL).toBe(1);
    expect(matrix.MSFT.MSFT).toBe(1);
    expect(matrix.AAPL.MSFT).toBeCloseTo(matrix.MSFT.AAPL, 6);
    expect(matrix.AAPL.GOOG).toBeCloseTo(-1.0, 6);
  });
});

describe("beta", () => {
  it("returns 1.0 when asset matches market", () => {
    const market = [0.01, -0.02, 0.03, -0.01, 0.02];
    const asset = market; // same series → beta = 1
    expect(beta(asset, market)).toBeCloseTo(1.0, 6);
  });

  it("returns 2.0 for double-leveraged asset", () => {
    const market = [0.01, -0.02, 0.03, -0.01, 0.02];
    const asset = market.map((r) => r * 2);
    expect(beta(asset, market)).toBeCloseTo(2.0, 6);
  });

  it("returns 1.0 for insufficient data", () => {
    expect(beta([0.01], [0.01])).toBe(1);
  });
});

describe("annualizedVolatility", () => {
  it("annualizes daily returns correctly", () => {
    const dailyReturns = Array.from({ length: 252 }, () => 0.01);
    const vol = annualizedVolatility(dailyReturns);
    // std of constant returns ≈ 0 (floating point noise)
    expect(vol).toBeCloseTo(0, 10);
  });

  it("produces reasonable volatility for random returns", () => {
    // Daily returns with ~1% std → annualized ~16%
    const returns = Array.from({ length: 252 }, () => (Math.random() - 0.5) * 0.02);
    const vol = annualizedVolatility(returns);
    expect(vol).toBeGreaterThan(0.05);
    expect(vol).toBeLessThan(0.50);
  });
});

describe("standardDeviation", () => {
  it("computes sample standard deviation", () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    // mean = 5, sample std ≈ 2.14
    const std = standardDeviation(values);
    expect(std).toBeCloseTo(2.138, 2);
  });

  it("returns 0 for insufficient data", () => {
    expect(standardDeviation([])).toBe(0);
    expect(standardDeviation([5])).toBe(0);
  });
});

describe("sma", () => {
  it("calculates simple moving average", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = sma(values, 3);
    expect(result).toHaveLength(8);
    expect(result[0]).toBeCloseTo(2, 6);   // (1+2+3)/3
    expect(result[1]).toBeCloseTo(3, 6);   // (2+3+4)/3
    expect(result[7]).toBeCloseTo(9, 6);   // (8+9+10)/3
  });

  it("returns empty for period larger than data", () => {
    expect(sma([1, 2], 5)).toEqual([]);
  });
});

describe("ema", () => {
  it("starts with first value and converges", () => {
    const values = [10, 10, 10, 10, 10];
    const result = ema(values, 3);
    // For constant values, EMA should equal the value
    expect(result[4]).toBeCloseTo(10, 6);
  });

  it("returns empty for empty input", () => {
    expect(ema([], 3)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Risk-Reward
// ---------------------------------------------------------------------------

describe("riskRewardRatio", () => {
  it("calculates correct ratio", () => {
    expect(riskRewardRatio({ entryPrice: 100, stopLoss: 95, takeProfit: 115 })).toBe(3);
  });

  it("returns Infinity when stop equals entry", () => {
    expect(riskRewardRatio({ entryPrice: 100, stopLoss: 100, takeProfit: 110 })).toBe(Infinity);
  });
});

describe("expectedValue", () => {
  it("returns positive EV for positive-edge system", () => {
    // 60% win rate, avg win $200, avg loss $100
    const ev = expectedValue({ winRate: 0.6, avgWin: 200, avgLoss: 100 });
    expect(ev).toBe(80); // 0.6*200 - 0.4*100
  });

  it("returns negative EV for negative-edge system", () => {
    const ev = expectedValue({ winRate: 0.3, avgWin: 100, avgLoss: 100 });
    expect(ev).toBe(-40); // 0.3*100 - 0.7*100
  });
});

describe("profitFactor", () => {
  it("calculates gross profit / gross loss", () => {
    const wins = [100, 200, 150];
    const losses = [50, 75, 100];
    expect(profitFactor(wins, losses)).toBe(2); // 450/225
  });

  it("returns Infinity for no losses", () => {
    expect(profitFactor([100], [])).toBe(Infinity);
  });
});

// ---------------------------------------------------------------------------
// Portfolio Metrics
// ---------------------------------------------------------------------------

describe("portfolioVariance", () => {
  it("calculates variance for uncorrelated assets", () => {
    // Two equal-weight assets with zero correlation
    const variance = portfolioVariance({
      weights: [0.5, 0.5],
      volatilities: [0.2, 0.2],
      correlations: [
        [1, 0],
        [0, 1],
      ],
    });
    // σ² = 0.5²*0.2² + 0.5²*0.2² = 0.02
    expect(variance).toBeCloseTo(0.02, 6);
  });

  it("equals single asset variance for 100% weight", () => {
    const variance = portfolioVariance({
      weights: [1.0],
      volatilities: [0.25],
      correlations: [[1]],
    });
    expect(variance).toBeCloseTo(0.0625, 6); // 0.25²
  });
});

describe("portfolioVolatility", () => {
  it("is square root of variance", () => {
    const params = {
      weights: [0.5, 0.5],
      volatilities: [0.2, 0.2],
      correlations: [
        [1, 0],
        [0, 1],
      ],
    };
    const vol = portfolioVolatility(params);
    const variance = portfolioVariance(params);
    expect(vol).toBeCloseTo(Math.sqrt(variance), 6);
  });
});

describe("concentrationHHI", () => {
  it("returns 1 for single position", () => {
    expect(concentrationHHI([1.0])).toBe(1);
  });

  it("returns 1/n for equal weights", () => {
    const weights = [0.25, 0.25, 0.25, 0.25];
    expect(concentrationHHI(weights)).toBeCloseTo(0.25, 6);
  });

  it("returns higher value for concentrated portfolio", () => {
    const diversified = concentrationHHI([0.2, 0.2, 0.2, 0.2, 0.2]);
    const concentrated = concentrationHHI([0.8, 0.05, 0.05, 0.05, 0.05]);
    expect(concentrated).toBeGreaterThan(diversified);
  });
});

describe("effectivePositions", () => {
  it("returns n for equally weighted portfolio", () => {
    expect(effectivePositions([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(4, 6);
    expect(effectivePositions([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1])).toBeCloseTo(10, 6);
  });

  it("returns 1 for single position", () => {
    expect(effectivePositions([1.0])).toBe(1);
  });
});
