import { describe, it, expect } from "vitest";
import { AnomalyReportSchema } from "../src/types/index.js";
import {
  buildAnomalyDetectionPrompt,
  buildMultiAssetAnomalyScanPrompt,
  buildAnomalyContextPrompt,
} from "../src/capabilities/anomaly/prompts.js";

describe("Anomaly Detection", () => {
  describe("AnomalyReportSchema", () => {
    const validReport = {
      ticker: "AAPL",
      anomalies: [
        {
          type: "volume_spike",
          severity: 78,
          description: "Volume 3.2x average on no material news",
          evidence: [
            "Daily volume: 142M vs 44M 20-day average",
            "Volume spike concentrated in last 2 hours of trading",
          ],
          possibleCauses: [
            "Institutional accumulation ahead of earnings",
            "Index rebalancing flow",
            "Large block cross on dark pool",
          ],
          historicalPrecedent:
            "Similar pre-earnings volume spikes preceded 5%+ moves in 7 of last 10 instances",
          actionable: true,
          suggestedAction:
            "Monitor options flow for confirmation. Consider straddle if IV is not yet elevated.",
        },
        {
          type: "volatility_anomaly",
          severity: 62,
          description: "Implied volatility diverging from realized",
          evidence: [
            "30-day IV: 38% vs 30-day RV: 22%",
            "IV rank: 85th percentile",
          ],
          possibleCauses: [
            "Earnings anticipation premium",
            "Hedging demand from institutional holders",
          ],
          actionable: true,
          suggestedAction: "Consider selling premium if fundamentally neutral.",
        },
      ],
      overallAnomalyScore: 72,
      marketContext:
        "Broad market trending higher with low VIX. AAPL diverging from sector with unusual activity.",
      crossAssetSignals: [
        "AAPL supplier TSMC showing similar volume patterns",
        "Tech sector ETF XLK stable — anomaly is AAPL-specific",
      ],
      alertLevel: "alert",
      summary:
        "AAPL showing coordinated volume and volatility anomalies ahead of earnings. Pattern historically precedes large moves. Monitor for directional clues in options flow.",
      timestamp: "2026-04-26T10:00:00.000Z",
    };

    it("accepts valid anomaly report", () => {
      const result = AnomalyReportSchema.parse(validReport);
      expect(result.ticker).toBe("AAPL");
      expect(result.anomalies).toHaveLength(2);
      expect(result.overallAnomalyScore).toBe(72);
      expect(result.alertLevel).toBe("alert");
    });

    it("accepts all anomaly types", () => {
      const types = [
        "volume_spike",
        "price_dislocation",
        "volatility_anomaly",
        "correlation_break",
        "options_flow",
        "order_flow",
        "fundamental_divergence",
        "cross_asset_signal",
      ] as const;

      for (const type of types) {
        const report = {
          ...validReport,
          anomalies: [{ ...validReport.anomalies[0], type }],
        };
        const result = AnomalyReportSchema.parse(report);
        expect(result.anomalies[0].type).toBe(type);
      }
    });

    it("accepts all alert levels", () => {
      const levels = ["none", "watch", "alert", "critical"] as const;
      for (const level of levels) {
        const result = AnomalyReportSchema.parse({
          ...validReport,
          alertLevel: level,
        });
        expect(result.alertLevel).toBe(level);
      }
    });

    it("rejects severity out of range", () => {
      expect(() =>
        AnomalyReportSchema.parse({
          ...validReport,
          anomalies: [{ ...validReport.anomalies[0], severity: 150 }],
        })
      ).toThrow();
    });

    it("rejects negative severity", () => {
      expect(() =>
        AnomalyReportSchema.parse({
          ...validReport,
          anomalies: [{ ...validReport.anomalies[0], severity: -10 }],
        })
      ).toThrow();
    });

    it("rejects invalid anomaly type", () => {
      expect(() =>
        AnomalyReportSchema.parse({
          ...validReport,
          anomalies: [{ ...validReport.anomalies[0], type: "magic_signal" }],
        })
      ).toThrow();
    });

    it("rejects overall score out of range", () => {
      expect(() =>
        AnomalyReportSchema.parse({
          ...validReport,
          overallAnomalyScore: 120,
        })
      ).toThrow();
    });

    it("accepts empty anomalies array", () => {
      const result = AnomalyReportSchema.parse({
        ...validReport,
        anomalies: [],
      });
      expect(result.anomalies).toHaveLength(0);
    });

    it("accepts report without optional fields", () => {
      const minimal = {
        ...validReport,
        anomalies: [
          {
            type: "volume_spike",
            severity: 50,
            description: "Elevated volume",
            evidence: ["2x average"],
            possibleCauses: ["Unknown"],
            actionable: false,
          },
        ],
      };
      const result = AnomalyReportSchema.parse(minimal);
      expect(result.anomalies[0].historicalPrecedent).toBeUndefined();
      expect(result.anomalies[0].suggestedAction).toBeUndefined();
    });

    it("rejects missing required fields", () => {
      expect(() =>
        AnomalyReportSchema.parse({
          ticker: "AAPL",
          anomalies: [],
        })
      ).toThrow();
    });
  });

  describe("Anomaly Prompts", () => {
    it("builds basic anomaly detection prompt", () => {
      const prompt = buildAnomalyDetectionPrompt({
        ticker: "AAPL",
        currentPrice: 195.5,
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("$195.5");
      expect(prompt).toContain("anomalies");
    });

    it("includes price data when provided", () => {
      const prompt = buildAnomalyDetectionPrompt({
        ticker: "TSLA",
        currentPrice: 250,
        priceData: "5-day: +12%, 20-day: -3%",
      });
      expect(prompt).toContain("Price Data");
      expect(prompt).toContain("5-day: +12%");
    });

    it("includes volume data when provided", () => {
      const prompt = buildAnomalyDetectionPrompt({
        ticker: "NVDA",
        currentPrice: 900,
        volumeData: "Today: 85M, 20-day avg: 42M",
      });
      expect(prompt).toContain("Volume Data");
      expect(prompt).toContain("85M");
    });

    it("includes options data when provided", () => {
      const prompt = buildAnomalyDetectionPrompt({
        ticker: "AAPL",
        currentPrice: 195,
        optionsData: "Unusual call buying at $200 strike",
      });
      expect(prompt).toContain("Options Flow Data");
      expect(prompt).toContain("$200 strike");
    });

    it("includes news context when provided", () => {
      const prompt = buildAnomalyDetectionPrompt({
        ticker: "MSFT",
        currentPrice: 420,
        newsContext: "Azure growth exceeding expectations",
      });
      expect(prompt).toContain("Recent News/Events");
      expect(prompt).toContain("Azure");
    });

    it("builds multi-asset scan prompt", () => {
      const prompt = buildMultiAssetAnomalyScanPrompt({
        tickers: [
          { ticker: "AAPL", currentPrice: 195 },
          { ticker: "MSFT", currentPrice: 420 },
          { ticker: "GOOGL", currentPrice: 170 },
        ],
      });
      expect(prompt).toContain("AAPL");
      expect(prompt).toContain("MSFT");
      expect(prompt).toContain("GOOGL");
      expect(prompt).toContain("multi-asset");
    });

    it("multi-asset includes market and cross-asset data", () => {
      const prompt = buildMultiAssetAnomalyScanPrompt({
        tickers: [{ ticker: "SPY", currentPrice: 520 }],
        marketData: "VIX: 13.5, breadth positive",
        crossAssetData: "TLT down, DXY up, gold flat",
      });
      expect(prompt).toContain("VIX: 13.5");
      expect(prompt).toContain("TLT down");
    });

    it("builds anomaly context deep-dive prompt", () => {
      const prompt = buildAnomalyContextPrompt({
        ticker: "GME",
        anomalyType: "volume_spike",
        anomalyDescription: "Volume 15x average with no news catalyst",
      });
      expect(prompt).toContain("GME");
      expect(prompt).toContain("volume_spike");
      expect(prompt).toContain("z-score");
      expect(prompt).toContain("historical precedents");
    });

    it("deep-dive includes historical data", () => {
      const prompt = buildAnomalyContextPrompt({
        ticker: "AMC",
        anomalyType: "price_dislocation",
        anomalyDescription: "Gap up 25% on low float",
        historicalData: "Similar gap-ups in Jan 2021 resulted in 300%+ moves",
      });
      expect(prompt).toContain("Historical Context");
      expect(prompt).toContain("Jan 2021");
    });
  });
});
