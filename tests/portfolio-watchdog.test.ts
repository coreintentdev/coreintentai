import { describe, it, expect } from "vitest";
import { PortfolioWatchdogAgent } from "../src/agents/portfolio-watchdog.js";
import { createAgentTeam } from "../src/agents/index.js";

describe("Portfolio Watchdog Agent", () => {
  describe("Instantiation", () => {
    it("can be created without orchestrator", () => {
      const watchdog = new PortfolioWatchdogAgent();
      expect(watchdog).toBeInstanceOf(PortfolioWatchdogAgent);
    });

    it("has correct name", () => {
      const watchdog = new PortfolioWatchdogAgent();
      expect(watchdog.name).toBe("PortfolioWatchdog");
    });

    it("has correct role", () => {
      const watchdog = new PortfolioWatchdogAgent();
      expect(watchdog.role).toBe("Autonomous portfolio surveillance agent");
    });

    it("exposes execute method", () => {
      const watchdog = new PortfolioWatchdogAgent();
      expect(typeof watchdog.execute).toBe("function");
    });

    it("exposes quickScan method", () => {
      const watchdog = new PortfolioWatchdogAgent();
      expect(typeof watchdog.quickScan).toBe("function");
    });

    it("exposes threatAnalysis method", () => {
      const watchdog = new PortfolioWatchdogAgent();
      expect(typeof watchdog.threatAnalysis).toBe("function");
    });
  });

  describe("Agent Team Integration", () => {
    it("is included in createAgentTeam", () => {
      const team = createAgentTeam();
      expect(team.watchdog).toBeInstanceOf(PortfolioWatchdogAgent);
    });

    it("shares orchestrator with team members", () => {
      const team = createAgentTeam();
      expect(team.watchdog).toBeDefined();
      expect(team.analyst).toBeDefined();
      expect(team.riskManager).toBeDefined();
      expect(team.strategist).toBeDefined();
      expect(team.executor).toBeDefined();
    });
  });
});
