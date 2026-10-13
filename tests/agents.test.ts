import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MarketAnalystAgent } from "../src/agents/market-analyst.js";
import { RiskManagerAgent } from "../src/agents/risk-manager.js";
import { TradeExecutorAgent } from "../src/agents/trade-executor.js";
import { StrategyAdvisorAgent } from "../src/agents/strategy-advisor.js";
import { createAgentTeam, runTradingPipeline } from "../src/agents/index.js";
import { Orchestrator } from "../src/orchestrator/index.js";
import * as modelsModule from "../src/models/index.js";
import type { CompletionResponse } from "../src/models/base.js";

function mockResponse(
  content: string,
  provider: "claude" | "grok" | "perplexity" = "claude"
): CompletionResponse {
  return {
    content,
    provider,
    model: `mock-${provider}`,
    tokenUsage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
    latencyMs: 25,
    finishReason: "end_turn",
  };
}

describe("Agent System", () => {
  let mockAdapter: {
    complete: ReturnType<typeof vi.fn>;
    ping: ReturnType<typeof vi.fn>;
    provider: string;
    model: string;
  };

  beforeEach(() => {
    mockAdapter = {
      complete: vi.fn().mockResolvedValue(mockResponse("Agent response")),
      ping: vi.fn().mockResolvedValue(true),
      provider: "claude",
      model: "mock-claude",
    };
    vi.spyOn(modelsModule, "getAdapter").mockReturnValue(mockAdapter as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("MarketAnalystAgent", () => {
    it("executes multi-step analysis pipeline", async () => {
      let callCount = 0;
      mockAdapter.complete.mockImplementation(() => {
        callCount++;
        if (callCount === 1)
          return Promise.resolve(
            mockResponse("Research data: AAPL up 3% on earnings beat", "perplexity")
          );
        if (callCount === 2)
          return Promise.resolve(
            mockResponse("Sentiment: 0.7, bullish drivers: earnings, guidance", "grok")
          );
        return Promise.resolve(
          mockResponse("Full synthesis: AAPL is bullish with target $200")
        );
      });

      const agent = new MarketAnalystAgent();
      const result = await agent.execute("Analyze AAPL");

      expect(result.agentName).toBe("MarketAnalyst");
      expect(result.turnsUsed).toBe(3);
      expect(result.output).toContain("Full synthesis");
      expect(result.tokenUsage.totalTokens).toBeGreaterThan(0);
      expect(result.totalLatencyMs).toBeGreaterThan(0);
    });

    it("respects max turn limit", async () => {
      const agent = new MarketAnalystAgent();
      const result = await agent.execute("Analyze MSFT");

      expect(result.turnsUsed).toBeLessThanOrEqual(5);
    });

    it("accumulates messages across turns", async () => {
      const agent = new MarketAnalystAgent();
      const result = await agent.execute("Analyze GOOGL");

      expect(result.messages.length).toBeGreaterThanOrEqual(2);
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[1].role).toBe("assistant");
    });

    it("accumulates token usage", async () => {
      const agent = new MarketAnalystAgent();
      const result = await agent.execute("Analyze TSLA");

      expect(result.tokenUsage.inputTokens).toBe(50 * result.turnsUsed);
      expect(result.tokenUsage.outputTokens).toBe(100 * result.turnsUsed);
    });
  });

  describe("RiskManagerAgent", () => {
    it("executes three-step risk pipeline", async () => {
      let callCount = 0;
      mockAdapter.complete.mockImplementation(() => {
        callCount++;
        if (callCount === 1)
          return Promise.resolve(mockResponse("Initial risk assessment: moderate"));
        if (callCount === 2)
          return Promise.resolve(mockResponse("Deep eval: tail risk at 5%, max drawdown 8%"));
        return Promise.resolve(
          mockResponse("Final risk report: Score 45/100, reduce position to 2%")
        );
      });

      const agent = new RiskManagerAgent();
      const result = await agent.execute("Evaluate AAPL portfolio risk", {
        portfolioValue: 100_000,
      });

      expect(result.agentName).toBe("RiskManager");
      expect(result.turnsUsed).toBe(3);
      expect(result.output).toContain("Final risk report");
    });

    it("passes context to analysis", async () => {
      const agent = new RiskManagerAgent();
      await agent.execute("Evaluate risk", { portfolioValue: 50_000 });

      const firstCall = mockAdapter.complete.mock.calls[0][0];
      expect(firstCall.prompt).toContain("portfolioValue");
    });
  });

  describe("TradeExecutorAgent", () => {
    it("generates three-step execution plan", async () => {
      let callCount = 0;
      mockAdapter.complete.mockImplementation(() => {
        callCount++;
        if (callCount === 1)
          return Promise.resolve(mockResponse("Setup: Bullish flag breakout above $150"));
        if (callCount === 2)
          return Promise.resolve(
            mockResponse("Plan: Limit buy at $149, SL at $145, TP at $160/$170")
          );
        return Promise.resolve(
          mockResponse(
            "Orders: 1) Limit buy 100 AAPL @ $149 GTC 2) Stop $145 3) Limit sell 50 @ $160"
          )
        );
      });

      const agent = new TradeExecutorAgent();
      const result = await agent.execute("Execute AAPL long", {
        portfolioValue: 100_000,
        riskTolerancePct: 1,
      });

      expect(result.agentName).toBe("TradeExecutor");
      expect(result.turnsUsed).toBe(3);
      expect(result.output).toContain("Orders");
    });

    it("uses portfolio context for position sizing", async () => {
      const agent = new TradeExecutorAgent();
      await agent.execute("Buy AAPL", {
        portfolioValue: 200_000,
        riskTolerancePct: 0.5,
      });

      const firstCall = mockAdapter.complete.mock.calls[0][0];
      expect(firstCall.prompt).toContain("200,000");
      expect(firstCall.prompt).toContain("0.5%");
    });
  });

  describe("StrategyAdvisorAgent", () => {
    it("executes synthesis pipeline", async () => {
      let callCount = 0;
      mockAdapter.complete.mockImplementation(() => {
        callCount++;
        if (callCount <= 2)
          return Promise.resolve(mockResponse("Signal data"));
        if (callCount === 3)
          return Promise.resolve(mockResponse("Strategy synthesis"));
        return Promise.resolve(mockResponse("Stress-tested final strategy"));
      });

      const agent = new StrategyAdvisorAgent();
      const result = await agent.execute("Strategy for AAPL");

      expect(result.agentName).toBe("StrategyAdvisor");
      expect(result.output).toBeDefined();
      expect(result.turnsUsed).toBeGreaterThanOrEqual(2);
    });

    it("advises on specific trades", async () => {
      const agent = new StrategyAdvisorAgent();
      const result = await agent.adviseOnTrade({
        ticker: "NVDA",
        proposedAction: "buy",
        analysis: "Bullish momentum, earnings beat",
        riskAssessment: "Moderate risk, volatility elevated",
        portfolioContext: "Portfolio: $500k, 2% in tech",
      });

      expect(result.agentName).toBe("StrategyAdvisor");
      expect(result.turnsUsed).toBe(1);
      const call = mockAdapter.complete.mock.calls[0][0];
      expect(call.prompt).toContain("NVDA");
      expect(call.prompt).toContain("buy");
    });
  });

  describe("createAgentTeam", () => {
    it("creates all four agents with shared orchestrator", () => {
      const orchestrator = new Orchestrator();
      const team = createAgentTeam(orchestrator);

      expect(team.analyst).toBeInstanceOf(MarketAnalystAgent);
      expect(team.riskManager).toBeInstanceOf(RiskManagerAgent);
      expect(team.executor).toBeInstanceOf(TradeExecutorAgent);
      expect(team.strategist).toBeInstanceOf(StrategyAdvisorAgent);
    });

    it("creates agents with default orchestrator when none provided", () => {
      const team = createAgentTeam();

      expect(team.analyst).toBeDefined();
      expect(team.riskManager).toBeDefined();
      expect(team.executor).toBeDefined();
      expect(team.strategist).toBeDefined();
    });
  });

  describe("runTradingPipeline", () => {
    it("chains all agents in correct order", async () => {
      const callOrder: string[] = [];
      mockAdapter.complete.mockImplementation((req: { prompt: string }) => {
        if (req.prompt.includes("Gather the latest"))
          callOrder.push("analyst-research");
        else if (req.prompt.includes("quick sentiment"))
          callOrder.push("analyst-sentiment");
        else if (req.prompt.includes("Synthesize a comprehensive"))
          callOrder.push("analyst-synthesis");
        else if (req.prompt.includes("Analyze the following for risk"))
          callOrder.push("risk-analysis");
        else if (req.prompt.includes("deeper evaluation"))
          callOrder.push("risk-deep");
        else if (req.prompt.includes("final risk report"))
          callOrder.push("risk-final");
        else if (req.prompt.includes("proposed"))
          callOrder.push("strategy");
        else if (req.prompt.includes("Analyze this trade setup"))
          callOrder.push("exec-setup");
        else if (req.prompt.includes("complete trade execution"))
          callOrder.push("exec-plan");
        else if (req.prompt.includes("Convert this execution plan"))
          callOrder.push("exec-orders");
        else callOrder.push("other");

        return Promise.resolve(mockResponse("Pipeline output"));
      });

      const result = await runTradingPipeline({
        input: "Evaluate AAPL long position",
        portfolioValue: 100_000,
        riskTolerancePct: 1,
      });

      expect(result.analysis).toBeDefined();
      expect(result.riskAssessment).toBeDefined();
      expect(result.strategy).toBeDefined();
      expect(result.executionPlan).toBeDefined();
      expect(result.totalLatencyMs).toBeGreaterThanOrEqual(0);

      expect(callOrder.indexOf("analyst-research")).toBeLessThan(
        callOrder.indexOf("risk-analysis")
      );
    });

    it("passes analysis output to risk manager", async () => {
      let analysisOutput = "";
      let riskInput = "";
      let callCount = 0;

      mockAdapter.complete.mockImplementation((req: { prompt: string }) => {
        callCount++;
        if (callCount === 3) {
          analysisOutput = "Comprehensive analysis output";
          return Promise.resolve(mockResponse(analysisOutput));
        }
        if (callCount === 4) {
          riskInput = req.prompt;
        }
        return Promise.resolve(mockResponse("Step output"));
      });

      await runTradingPipeline({ input: "Evaluate TSLA" });

      expect(riskInput).toContain("Comprehensive analysis output");
    });
  });
});
