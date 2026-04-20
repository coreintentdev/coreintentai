import { describe, it, expect, vi } from "vitest";
import { StrategySynthesizerAgent } from "../src/agents/strategy-synthesizer.js";
import { createAgentTeam } from "../src/agents/index.js";
import { Orchestrator } from "../src/orchestrator/index.js";

describe("Strategy Synthesizer Agent", () => {
  describe("construction", () => {
    it("creates agent with correct config", () => {
      const agent = new StrategySynthesizerAgent();
      expect(agent.name).toBe("StrategySynthesizer");
      expect(agent.role).toContain("Synthesizes");
    });

    it("accepts custom orchestrator", () => {
      const orch = new Orchestrator({ maxRetries: 1 });
      const agent = new StrategySynthesizerAgent(orch);
      expect(agent.name).toBe("StrategySynthesizer");
    });
  });

  describe("createAgentTeam", () => {
    it("includes strategist in the team", () => {
      const team = createAgentTeam();
      expect(team.strategist).toBeInstanceOf(StrategySynthesizerAgent);
      expect(team.analyst).toBeDefined();
      expect(team.riskManager).toBeDefined();
      expect(team.executor).toBeDefined();
    });

    it("shares orchestrator across all agents", () => {
      const orch = new Orchestrator();
      const team = createAgentTeam(orch);
      expect(team.strategist).toBeDefined();
      expect(team.analyst).toBeDefined();
    });
  });

  describe("execute (mocked)", () => {
    it("calls orchestrator with strategy system prompt", async () => {
      const mockExecute = vi.fn().mockResolvedValue({
        content: "Strategy synthesis complete",
        provider: "claude",
        model: "claude-sonnet-4-20250514",
        latencyMs: 3000,
        tokenUsage: { inputTokens: 500, outputTokens: 1000, totalTokens: 1500 },
        fallbackUsed: false,
      });

      const orch = new Orchestrator();
      vi.spyOn(orch, "execute").mockImplementation(mockExecute);

      const agent = new StrategySynthesizerAgent(orch);
      const result = await agent.execute("Analyze AAPL for swing trade entry", {
        sentiment: "Bullish sentiment, score 0.65",
        risk: "Moderate risk, score 45",
        regime: "Trending up, normal volatility",
      });

      expect(result.agentName).toBe("StrategySynthesizer");
      expect(result.output).toBeDefined();
      expect(result.turnsUsed).toBeGreaterThan(0);
      expect(result.totalLatencyMs).toBeGreaterThanOrEqual(0);
      expect(mockExecute).toHaveBeenCalled();

      const firstCall = mockExecute.mock.calls[0][0];
      expect(firstCall.systemPrompt).toContain("Strategy Synthesizer");
      expect(firstCall.prompt).toContain("AAPL");
      expect(firstCall.prompt).toContain("Bullish sentiment");
      expect(firstCall.prompt).toContain("Moderate risk");
      expect(firstCall.prompt).toContain("Trending up");
    });

    it("handles execution without capability data", async () => {
      const mockExecute = vi.fn().mockResolvedValue({
        content: "Strategy without pre-computed data",
        provider: "claude",
        model: "claude-sonnet-4-20250514",
        latencyMs: 2000,
        tokenUsage: { inputTokens: 300, outputTokens: 800, totalTokens: 1100 },
        fallbackUsed: false,
      });

      const orch = new Orchestrator();
      vi.spyOn(orch, "execute").mockImplementation(mockExecute);

      const agent = new StrategySynthesizerAgent(orch);
      const result = await agent.execute("Should I buy TSLA at $250?");

      expect(result.agentName).toBe("StrategySynthesizer");
      expect(result.output).toBeDefined();

      const firstCall = mockExecute.mock.calls[0][0];
      expect(firstCall.prompt).toContain("No pre-computed capability data");
    });

    it("performs multi-step reasoning (synthesis → validation → final)", async () => {
      const calls: string[] = [];
      const mockExecute = vi.fn().mockImplementation(async (req) => {
        calls.push(req.prompt.slice(0, 50));
        return {
          content: `Step ${calls.length} result`,
          provider: "claude",
          model: "claude-sonnet-4-20250514",
          latencyMs: 1000,
          tokenUsage: { inputTokens: 200, outputTokens: 500, totalTokens: 700 },
          fallbackUsed: false,
        };
      });

      const orch = new Orchestrator();
      vi.spyOn(orch, "execute").mockImplementation(mockExecute);

      const agent = new StrategySynthesizerAgent(orch);
      await agent.execute("Analyze NVDA", {
        sentiment: "Bullish",
        signals: "Buy signal at $950",
      });

      expect(mockExecute).toHaveBeenCalledTimes(3);
    });

    it("accumulates token usage across steps", async () => {
      const mockExecute = vi.fn().mockResolvedValue({
        content: "Step result",
        provider: "claude",
        model: "claude-sonnet-4-20250514",
        latencyMs: 1000,
        tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        fallbackUsed: false,
      });

      const orch = new Orchestrator();
      vi.spyOn(orch, "execute").mockImplementation(mockExecute);

      const agent = new StrategySynthesizerAgent(orch);
      const result = await agent.execute("Analyze SPY");

      expect(result.tokenUsage.totalTokens).toBe(900);
    });
  });
});
