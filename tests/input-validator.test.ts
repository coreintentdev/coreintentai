import { describe, it, expect } from "vitest";
import {
  validateTicker,
  validatePrice,
  validatePercentage,
  validateConfidence,
  validatePortfolioValue,
  validateStopLoss,
  validateTakeProfitLevels,
  sanitizePromptInput,
  validatePortfolioPositions,
  InputValidationError,
} from "../src/utils/input-validator.js";

describe("Input Validator", () => {
  describe("validateTicker", () => {
    it("accepts valid tickers", () => {
      expect(validateTicker("AAPL")).toBe("AAPL");
      expect(validateTicker("MSFT")).toBe("MSFT");
      expect(validateTicker("A")).toBe("A");
    });

    it("normalizes to uppercase", () => {
      expect(validateTicker("aapl")).toBe("AAPL");
      expect(validateTicker("  msft  ")).toBe("MSFT");
    });

    it("rejects empty ticker", () => {
      expect(() => validateTicker("")).toThrow(InputValidationError);
      expect(() => validateTicker("   ")).toThrow(InputValidationError);
    });

    it("rejects invalid ticker format", () => {
      expect(() => validateTicker("TOOLONG")).toThrow(InputValidationError);
      expect(() => validateTicker("AA1")).toThrow(InputValidationError);
      expect(() => validateTicker("A-B")).toThrow(InputValidationError);
    });
  });

  describe("validatePrice", () => {
    it("accepts positive prices", () => {
      expect(validatePrice(100, "price")).toBe(100);
      expect(validatePrice(0.01, "price")).toBe(0.01);
    });

    it("rejects non-positive prices", () => {
      expect(() => validatePrice(0, "price")).toThrow(InputValidationError);
      expect(() => validatePrice(-10, "price")).toThrow(InputValidationError);
      expect(() => validatePrice(NaN, "price")).toThrow(InputValidationError);
      expect(() => validatePrice(Infinity, "price")).toThrow(InputValidationError);
    });
  });

  describe("validatePercentage", () => {
    it("accepts valid percentages", () => {
      expect(validatePercentage(0, "pct")).toBe(0);
      expect(validatePercentage(50, "pct")).toBe(50);
      expect(validatePercentage(100, "pct")).toBe(100);
    });

    it("rejects out-of-range percentages", () => {
      expect(() => validatePercentage(-1, "pct")).toThrow(InputValidationError);
      expect(() => validatePercentage(101, "pct")).toThrow(InputValidationError);
    });
  });

  describe("validateConfidence", () => {
    it("accepts values 0-1", () => {
      expect(validateConfidence(0, "conf")).toBe(0);
      expect(validateConfidence(0.75, "conf")).toBe(0.75);
      expect(validateConfidence(1, "conf")).toBe(1);
    });

    it("rejects out-of-range", () => {
      expect(() => validateConfidence(-0.1, "conf")).toThrow(InputValidationError);
      expect(() => validateConfidence(1.1, "conf")).toThrow(InputValidationError);
    });
  });

  describe("validateStopLoss", () => {
    it("validates buy stop-loss below entry", () => {
      expect(validateStopLoss(95, 100, "buy")).toBe(95);
    });

    it("rejects buy stop-loss above entry", () => {
      expect(() => validateStopLoss(105, 100, "buy")).toThrow(InputValidationError);
    });

    it("validates sell stop-loss above entry", () => {
      expect(validateStopLoss(105, 100, "sell")).toBe(105);
    });

    it("rejects sell stop-loss below entry", () => {
      expect(() => validateStopLoss(95, 100, "sell")).toThrow(InputValidationError);
    });
  });

  describe("validateTakeProfitLevels", () => {
    it("validates and sorts buy take-profit levels", () => {
      const result = validateTakeProfitLevels([120, 110, 130], 100, "buy");
      expect(result).toEqual([110, 120, 130]);
    });

    it("rejects buy take-profit below entry", () => {
      expect(() => validateTakeProfitLevels([95, 110], 100, "buy")).toThrow(InputValidationError);
    });

    it("validates and sorts sell take-profit levels", () => {
      const result = validateTakeProfitLevels([80, 90, 70], 100, "sell");
      expect(result).toEqual([90, 80, 70]);
    });

    it("rejects sell take-profit above entry", () => {
      expect(() => validateTakeProfitLevels([105, 90], 100, "sell")).toThrow(InputValidationError);
    });
  });

  describe("sanitizePromptInput", () => {
    it("strips angle brackets", () => {
      expect(sanitizePromptInput("<script>alert(1)</script>")).toBe("scriptalert(1)/script");
    });

    it("strips control characters", () => {
      expect(sanitizePromptInput("hello\x00world")).toBe("helloworld");
    });

    it("trims whitespace", () => {
      expect(sanitizePromptInput("  hello  ")).toBe("hello");
    });

    it("truncates long input", () => {
      const long = "a".repeat(20000);
      expect(sanitizePromptInput(long).length).toBe(10000);
    });
  });

  describe("validatePortfolioPositions", () => {
    it("accepts valid positions", () => {
      expect(() =>
        validatePortfolioPositions([
          { ticker: "AAPL", value: 10000, pctOfPortfolio: 50 },
          { ticker: "MSFT", value: 10000, pctOfPortfolio: 50 },
        ])
      ).not.toThrow();
    });

    it("rejects empty portfolio", () => {
      expect(() => validatePortfolioPositions([])).toThrow(InputValidationError);
    });

    it("rejects positions summing over 105%", () => {
      expect(() =>
        validatePortfolioPositions([
          { ticker: "AAPL", value: 10000, pctOfPortfolio: 60 },
          { ticker: "MSFT", value: 10000, pctOfPortfolio: 50 },
        ])
      ).toThrow(InputValidationError);
    });

    it("allows slight over-allocation up to 105%", () => {
      expect(() =>
        validatePortfolioPositions([
          { ticker: "AAPL", value: 10000, pctOfPortfolio: 52 },
          { ticker: "MSFT", value: 10000, pctOfPortfolio: 52 },
        ])
      ).not.toThrow();
    });
  });
});
