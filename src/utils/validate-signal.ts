/**
 * CoreIntent AI — Signal Validation
 *
 * Post-parse validation of trading signals to catch financial constraint
 * violations that Zod schemas alone cannot express (cross-field rules).
 *
 * These are warnings, not hard rejections — the signal is still returned
 * but flagged so downstream consumers can decide how to handle it.
 */

import type { TradingSignal } from "../types/index.js";

export interface SignalWarning {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
}

export interface ValidatedSignal {
  signal: TradingSignal;
  valid: boolean;
  warnings: SignalWarning[];
}

/**
 * Validate financial constraints on a trading signal.
 * Returns the signal with any warnings attached.
 */
export function validateSignalConstraints(
  signal: TradingSignal
): ValidatedSignal {
  const warnings: SignalWarning[] = [];

  const isBuy = signal.action === "buy" || signal.action === "strong_buy";
  const isSell = signal.action === "sell" || signal.action === "strong_sell";

  // --- Stop-loss direction check ---
  if (signal.entryPrice != null && signal.stopLoss != null) {
    if (isBuy && signal.stopLoss >= signal.entryPrice) {
      warnings.push({
        code: "STOP_ABOVE_ENTRY",
        message: `Buy signal has stop-loss ($${signal.stopLoss}) at or above entry ($${signal.entryPrice})`,
        severity: "error",
      });
    }

    if (isSell && signal.stopLoss <= signal.entryPrice) {
      warnings.push({
        code: "STOP_BELOW_ENTRY",
        message: `Sell signal has stop-loss ($${signal.stopLoss}) at or below entry ($${signal.entryPrice})`,
        severity: "error",
      });
    }
  }

  // --- Take-profit direction check ---
  if (
    signal.entryPrice != null &&
    signal.takeProfit != null &&
    signal.takeProfit.length > 0
  ) {
    for (const tp of signal.takeProfit) {
      if (isBuy && tp <= signal.entryPrice) {
        warnings.push({
          code: "TP_BELOW_ENTRY",
          message: `Buy signal has take-profit ($${tp}) at or below entry ($${signal.entryPrice})`,
          severity: "error",
        });
      }
      if (isSell && tp >= signal.entryPrice) {
        warnings.push({
          code: "TP_ABOVE_ENTRY",
          message: `Sell signal has take-profit ($${tp}) at or above entry ($${signal.entryPrice})`,
          severity: "error",
        });
      }
    }

    // Take-profit ordering (ascending for buys, descending for sells)
    if (signal.takeProfit.length >= 2) {
      const sorted = [...signal.takeProfit].sort((a, b) => a - b);
      const isAscending = signal.takeProfit.every(
        (v, i) => v === sorted[i]
      );
      const isDescending = signal.takeProfit.every(
        (v, i) => v === sorted[sorted.length - 1 - i]
      );

      if (isBuy && !isAscending) {
        warnings.push({
          code: "TP_ORDER",
          message: "Buy signal take-profit targets should be in ascending order",
          severity: "warning",
        });
      }
      if (isSell && !isDescending) {
        warnings.push({
          code: "TP_ORDER",
          message: "Sell signal take-profit targets should be in descending order",
          severity: "warning",
        });
      }
    }
  }

  // --- Risk/reward sanity ---
  if (signal.riskRewardRatio != null && signal.riskRewardRatio < 1) {
    warnings.push({
      code: "LOW_RR",
      message: `Risk/reward ratio (${signal.riskRewardRatio.toFixed(2)}) is below 1:1`,
      severity: "warning",
    });
  }

  // --- Confidence vs action coherence ---
  if (signal.confidence < 0.3 && (isBuy || isSell)) {
    warnings.push({
      code: "LOW_CONFIDENCE_ACTION",
      message: `Directional signal (${signal.action}) with low confidence (${signal.confidence})`,
      severity: "warning",
    });
  }

  // --- Stop-loss distance sanity (> 20% is unusual for non-position trades) ---
  if (signal.entryPrice != null && signal.stopLoss != null) {
    const stopDistance =
      Math.abs(signal.entryPrice - signal.stopLoss) / signal.entryPrice;
    if (stopDistance > 0.2 && signal.timeframe !== "position") {
      warnings.push({
        code: "WIDE_STOP",
        message: `Stop-loss is ${(stopDistance * 100).toFixed(1)}% from entry — unusually wide for ${signal.timeframe} timeframe`,
        severity: "warning",
      });
    }
  }

  const hasErrors = warnings.some((w) => w.severity === "error");

  return {
    signal,
    valid: !hasErrors,
    warnings,
  };
}
