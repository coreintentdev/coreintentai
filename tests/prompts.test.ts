import { describe, it, expect } from "vitest";
import {
  buildSentimentPrompt,
  buildNewsSentimentPrompt,
  buildEarningsSentimentPrompt,
} from "../src/capabilities/sentiment/prompts.js";
import {
  buildSignalPrompt,
  buildMultiSignalPrompt,
} from "../src/capabilities/signals/prompts.js";
import {
  buildPositionRiskPrompt,
  buildPortfolioRiskPrompt,
} from "../src/capabilities/risk/prompts.js";
import {
  buildResearchPrompt,
  buildCatalystResearchPrompt,
} from "../src/capabilities/research/prompts.js";

describe("Prompt Engineering", () => {
  describe("Sentiment Prompts", () => {
    it("builds basic sentiment prompt", () => {
      const prompt = buildSentimentPrompt({ ticker: "AAPL" });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("JSON");
    });

    it("includes time horizon when specified", () => {
      const prompt = buildSentimentPrompt({
        ticker: "AAPL",
        timeHorizon: "short_term",
      });
      expect(prompt).toContain("short_term");
    });

    it("includes context when provided", () => {
      const prompt = buildSentimentPrompt({
        ticker: "AAPL",
        context: "Just reported Q1 earnings",
      });
      expect(prompt).toContain("Q1 earnings");
    });

    it("includes data points when provided", () => {
      const prompt = buildSentimentPrompt({
        ticker: "AAPL",
        dataPoints: ["RSI at 72", "MACD bullish crossover"],
      });
      expect(prompt).toContain("RSI at 72");
      expect(prompt).toContain("MACD bullish crossover");
    });

    it("builds news sentiment prompt with headlines", () => {
      const prompt = buildNewsSentimentPrompt({
        ticker: "TSLA",
        headlines: [
          "Tesla beats Q1 delivery estimates",
          "New Gigafactory announced in Texas",
        ],
      });
      expect(prompt).toContain("TSLA");
      expect(prompt).toContain("Tesla beats");
      expect(prompt).toContain("Gigafactory");
    });

    it("builds earnings sentiment prompt", () => {
      const prompt = buildEarningsSentimentPrompt({
        ticker: "MSFT",
        epsActual: 3.15,
        epsEstimate: 3.0,
        revenueActual: 65.2,
        revenueEstimate: 64.0,
        guidance: "Raised full-year outlook",
      });
      expect(prompt).toContain("MSFT");
      expect(prompt).toContain("beat");
      expect(prompt).toContain("Raised full-year");
    });

    it("handles earnings miss correctly", () => {
      const prompt = buildEarningsSentimentPrompt({
        ticker: "META",
        epsActual: 2.8,
        epsEstimate: 3.1,
      });
      expect(prompt).toContain("missed");
    });
  });

  describe("Signal Prompts", () => {
    it("builds basic signal prompt", () => {
      const prompt = buildSignalPrompt({
        ticker: "NVDA",
        currentPrice: 950,
        timeframe: "swing",
      });
      expect(prompt).toContain("NVDA");
      expect(prompt).toContain("$950");
      expect(prompt).toContain("swing");
    });

    it("includes technical data", () => {
      const prompt = buildSignalPrompt({
        ticker: "NVDA",
        currentPrice: 950,
        timeframe: "day",
        technicalData: "RSI: 55, MACD: bullish",
      });
      expect(prompt).toContain("RSI: 55");
    });

    it("builds multi-ticker signal prompt", () => {
      const prompt = buildMultiSignalPrompt({
        tickers: [
          { ticker: "AAPL", currentPrice: 200 },
          { ticker: "GOOGL", currentPrice: 180 },
        ],
        timeframe: "swing",
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("GOOGL");
      expect(prompt).toContain("$200");
      expect(prompt).toContain("$180");
    });
  });

  describe("Risk Prompts", () => {
    it("builds position risk prompt with all parameters", () => {
      const prompt = buildPositionRiskPrompt({
        ticker: "AMZN",
        currentPrice: 185,
        positionSize: 18500,
        portfolioValue: 100000,
        stopLoss: 175,
        beta: 1.2,
        sector: "Technology",
      });
      expect(prompt).toContain("AMZN");
      expect(prompt).toContain("18.5%"); // position as pct
      expect(prompt).toContain("Beta: 1.2");
      expect(prompt).toContain("Technology");
    });

    it("builds portfolio risk prompt", () => {
      const prompt = buildPortfolioRiskPrompt({
        positions: [
          { ticker: "AAPL", value: 25000, pctOfPortfolio: 25 },
          { ticker: "GOOGL", value: 20000, pctOfPortfolio: 20 },
        ],
        totalValue: 100000,
        cashPct: 55,
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("GOOGL");
      expect(prompt).toContain("55.0%");
    });
  });

  describe("Research Prompts", () => {
    it("builds research prompt", () => {
      const prompt = buildResearchPrompt({
        query: "What are the latest AI chip developments?",
        ticker: "NVDA",
      });
      expect(prompt).toContain("NVDA");
      expect(prompt).toContain("AI chip");
    });

    it("adjusts for depth", () => {
      const quick = buildResearchPrompt({
        query: "Summary",
        depth: "quick",
      });
      const deep = buildResearchPrompt({
        query: "Summary",
        depth: "deep",
      });
      expect(quick).toContain("brief");
      expect(deep).toContain("comprehensive");
    });

    it("builds catalyst research prompt", () => {
      const prompt = buildCatalystResearchPrompt({
        ticker: "TSLA",
        timeHorizon: "near_term",
      });
      expect(prompt).toContain("TSLA");
      expect(prompt).toContain("1-4 weeks");
    });
  });
});
