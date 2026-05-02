import { describe, it, expect, vi, beforeEach } from "vitest";
import { MarketAnalystAgent } from "../src/agents/market-analyst.js";
import { RiskManagerAgent } from "../src/agents/risk-manager.js";
import { TradeExecutorAgent } from "../src/agents/trade-executor.js";
import { StrategyAdvisorAgent } from "../src/agents/strategy-advisor.js";
import { createAgentTeam } from "../src/agents/index.js";
import { Orchestrator } from "../src/orchestrator/index.js";

function createMockOrchestrator(): Orchestrator {
  const orchestrator = new Orchestrator();
  vi.spyOn(orchestrator, "execute").mockResolvedValue({
    content: "Mock AI response for testing purposes.",
    provider: "claude",
    model: "claude-sonnet-4-20250514",
    latencyMs: 150,
    tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    fallbackUsed: false,
  });
  return orchestrator;
}

describe("Agent System", () => {
  describe("MarketAnalystAgent", () => {
    let agent: MarketAnalystAgent;
    let orchestrator: Orchestrator;

    beforeEach(() => {
      orchestrator = createMockOrchestrator();
      agent = new MarketAnalystAgent(orchestrator);
    });

    it("has correct name and role", () => {
      expect(agent.name).toBe("MarketAnalyst");
      expect(agent.role).toBe("Comprehensive market analysis agent");
    });

    it("executes multi-step analysis pipeline", async () => {
      const result = await agent.execute("Analyze AAPL");
      expect(result.agentName).toBe("MarketAnalyst");
      expect(result.output).toBeDefined();
      expect(result.turnsUsed).toBeGreaterThanOrEqual(1);
      expect(result.totalLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it("tracks token usage across steps", async () => {
      const result = await agent.execute("Analyze TSLA");
      expect(result.tokenUsage.inputTokens).toBeGreaterThan(0);
      expect(result.tokenUsage.outputTokens).toBeGreaterThan(0);
      expect(result.tokenUsage.totalTokens).toBe(
        result.tokenUsage.inputTokens + result.tokenUsage.outputTokens
      );
    });

    it("accumulates messages across steps", async () => {
      const result = await agent.execute("Analyze NVDA");
      expect(result.messages.length).toBeGreaterThanOrEqual(2);
      const userMessages = result.messages.filter((m) => m.role === "user");
      const assistantMessages = result.messages.filter((m) => m.role === "assistant");
      expect(userMessages.length).toBe(assistantMessages.length);
    });

    it("calls orchestrator with correct intents", async () => {
      await agent.execute("Analyze MSFT");
      const executeSpy = orchestrator.execute as ReturnType<typeof vi.fn>;
      const calls = executeSpy.mock.calls;
      expect(calls.some((c: [{ intent: string }]) => c[0].intent === "research")).toBe(true);
      expect(calls.some((c: [{ intent: string }]) => c[0].intent === "fast_analysis")).toBe(true);
      expect(calls.some((c: [{ intent: string }]) => c[0].intent === "reasoning")).toBe(true);
    });

    it("resets state between executions", async () => {
      await agent.execute("Analyze AAPL");
      const result2 = await agent.execute("Analyze MSFT");
      expect(result2.messages[0].content).toContain("MSFT");
    });

    it("includes context in analysis when provided", async () => {
      await agent.execute("Analyze GOOGL", { sector: "Tech", marketCap: "2T" });
      const executeSpy = orchestrator.execute as ReturnType<typeof vi.fn>;
      const calls = executeSpy.mock.calls;
      const synthesisCall = calls.find(
        (c: [{ intent: string }]) => c[0].intent === "reasoning"
      );
      expect(synthesisCall).toBeDefined();
      expect(synthesisCall![0].prompt).toContain("Tech");
    });
  });

  describe("RiskManagerAgent", () => {
    let agent: RiskManagerAgent;
    let orchestrator: Orchestrator;

    beforeEach(() => {
      orchestrator = createMockOrchestrator();
      agent = new RiskManagerAgent(orchestrator);
    });

    it("has correct name and role", () => {
      expect(agent.name).toBe("RiskManager");
      expect(agent.role).toBe("Portfolio risk management agent");
    });

    it("executes three-step risk pipeline", async () => {
      const result = await agent.execute("Evaluate portfolio risk");
      expect(result.agentName).toBe("RiskManager");
      expect(result.turnsUsed).toBe(3);
    });

    it("accumulates token usage across all steps", async () => {
      const result = await agent.execute("Check risk for TSLA position");
      expect(result.tokenUsage.inputTokens).toBe(300);
      expect(result.tokenUsage.outputTokens).toBe(150);
      expect(result.tokenUsage.totalTokens).toBe(450);
    });

    it("passes context to initial analysis", async () => {
      await agent.execute("Evaluate risk", { portfolioValue: 500000 });
      const executeSpy = orchestrator.execute as ReturnType<typeof vi.fn>;
      const firstCall = executeSpy.mock.calls[0];
      expect(firstCall[0].prompt).toContain("500000");
    });

    it("messages have valid timestamps", async () => {
      const result = await agent.execute("Assess risk");
      for (const msg of result.messages) {
        expect(msg.timestamp).toBeDefined();
        expect(() => new Date(msg.timestamp)).not.toThrow();
      }
    });
  });

  describe("TradeExecutorAgent", () => {
    let agent: TradeExecutorAgent;
    let orchestrator: Orchestrator;

    beforeEach(() => {
      orchestrator = createMockOrchestrator();
      agent = new TradeExecutorAgent(orchestrator);
    });

    it("has correct name and role", () => {
      expect(agent.name).toBe("TradeExecutor");
      expect(agent.role).toBe("Trade execution planning agent");
    });

    it("executes three-step execution pipeline", async () => {
      const result = await agent.execute("Execute buy on AAPL");
      expect(result.agentName).toBe("TradeExecutor");
      expect(result.turnsUsed).toBe(3);
    });

    it("uses default portfolio value when not specified", async () => {
      await agent.execute("Execute trade");
      const executeSpy = orchestrator.execute as ReturnType<typeof vi.fn>;
      const firstCall = executeSpy.mock.calls[0];
      expect(firstCall[0].prompt).toContain("$100,000");
    });

    it("uses custom portfolio value from context", async () => {
      await agent.execute("Execute trade", { portfolioValue: 500000, riskTolerancePct: 2 });
      const executeSpy = orchestrator.execute as ReturnType<typeof vi.fn>;
      const firstCall = executeSpy.mock.calls[0];
      expect(firstCall[0].prompt).toContain("$500,000");
      expect(firstCall[0].prompt).toContain("2%");
    });

    it("measures total latency", async () => {
      const result = await agent.execute("Execute trade");
      expect(result.totalLatencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("StrategyAdvisorAgent", () => {
    let agent: StrategyAdvisorAgent;
    let orchestrator: Orchestrator;

    beforeEach(() => {
      orchestrator = createMockOrchestrator();
      agent = new StrategyAdvisorAgent(orchestrator);
    });

    it("has correct name and role", () => {
      expect(agent.name).toBe("StrategyAdvisor");
      expect(agent.role).toBe("Meta-strategy synthesis agent");
    });

    it("executes full strategy pipeline", async () => {
      const result = await agent.execute("Develop strategy for tech sector");
      expect(result.agentName).toBe("StrategyAdvisor");
      expect(result.output).toBeDefined();
      expect(result.turnsUsed).toBeGreaterThanOrEqual(2);
    });

    it("adviseOnTrade produces structured output", async () => {
      const result = await agent.adviseOnTrade({
        ticker: "AAPL",
        proposedAction: "buy",
        analysis: "Strong technicals, bullish sentiment",
        riskAssessment: "Moderate risk, 1.5% portfolio allocation",
        portfolioContext: "Portfolio value: $100,000",
      });
      expect(result.agentName).toBe("StrategyAdvisor");
      expect(result.output).toBeDefined();
    });

    it("adviseOnTrade includes all inputs in prompt", async () => {
      await agent.adviseOnTrade({
        ticker: "TSLA",
        proposedAction: "sell",
        analysis: "Weakening momentum",
        riskAssessment: "High volatility exposure",
      });
      const executeSpy = orchestrator.execute as ReturnType<typeof vi.fn>;
      const call = executeSpy.mock.calls[0];
      expect(call[0].prompt).toContain("TSLA");
      expect(call[0].prompt).toContain("sell");
      expect(call[0].prompt).toContain("Weakening momentum");
      expect(call[0].prompt).toContain("High volatility exposure");
    });

    it("runs sentiment and regime analysis in parallel", async () => {
      const executeSpy = orchestrator.execute as ReturnType<typeof vi.fn>;
      await agent.execute("Analyze NVDA");
      const calls = executeSpy.mock.calls;
      const fastCalls = calls.filter(
        (c: [{ intent: string }]) => c[0].intent === "fast_analysis"
      );
      const reasoningCalls = calls.filter(
        (c: [{ intent: string }]) => c[0].intent === "reasoning"
      );
      expect(fastCalls.length).toBeGreaterThanOrEqual(1);
      expect(reasoningCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Agent Team", () => {
    it("creates all agents with shared orchestrator", () => {
      const orchestrator = createMockOrchestrator();
      const team = createAgentTeam(orchestrator);
      expect(team.analyst).toBeInstanceOf(MarketAnalystAgent);
      expect(team.riskManager).toBeInstanceOf(RiskManagerAgent);
      expect(team.executor).toBeInstanceOf(TradeExecutorAgent);
      expect(team.strategist).toBeInstanceOf(StrategyAdvisorAgent);
    });

    it("creates team without explicit orchestrator", () => {
      const team = createAgentTeam();
      expect(team.analyst.name).toBe("MarketAnalyst");
      expect(team.riskManager.name).toBe("RiskManager");
      expect(team.executor.name).toBe("TradeExecutor");
      expect(team.strategist.name).toBe("StrategyAdvisor");
    });
  });

  describe("Agent Message Tracking", () => {
    it("messages alternate user/assistant", async () => {
      const orchestrator = createMockOrchestrator();
      const agent = new MarketAnalystAgent(orchestrator);
      const result = await agent.execute("Analyze AAPL");

      for (let i = 0; i < result.messages.length; i++) {
        const expectedRole = i % 2 === 0 ? "user" : "assistant";
        expect(result.messages[i].role).toBe(expectedRole);
      }
    });

    it("each message has ISO timestamp", async () => {
      const orchestrator = createMockOrchestrator();
      const agent = new RiskManagerAgent(orchestrator);
      const result = await agent.execute("Assess portfolio");

      for (const msg of result.messages) {
        expect(msg.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
    });
  });

  describe("Agent Latency Tracking", () => {
    it("totalLatencyMs reflects actual execution time", async () => {
      const orchestrator = createMockOrchestrator();
      const agent = new MarketAnalystAgent(orchestrator);
      const start = performance.now();
      const result = await agent.execute("Analyze AAPL");
      const elapsed = performance.now() - start;

      expect(result.totalLatencyMs).toBeLessThanOrEqual(Math.ceil(elapsed) + 1);
      expect(result.totalLatencyMs).toBeGreaterThanOrEqual(0);
    });
  });
});
