import { describe, it, expect } from "vitest";
import { resolveRoute, getProviderChain } from "../src/orchestrator/router.js";

describe("Intent Router", () => {
  describe("resolveRoute", () => {
    it("routes reasoning tasks to Claude", () => {
      const route = resolveRoute("reasoning");
      expect(route.primary).toBe("claude");
      expect(route.fallbacks).toContain("grok");
    });

    it("routes fast_analysis to Grok", () => {
      const route = resolveRoute("fast_analysis");
      expect(route.primary).toBe("grok");
      expect(route.fallbacks).toContain("claude");
    });

    it("routes research to Perplexity", () => {
      const route = resolveRoute("research");
      expect(route.primary).toBe("perplexity");
      expect(route.fallbacks).toContain("grok");
      expect(route.fallbacks).toContain("claude");
    });

    it("routes sentiment to Grok primary", () => {
      const route = resolveRoute("sentiment");
      expect(route.primary).toBe("grok");
    });

    it("routes signal generation to Claude", () => {
      const route = resolveRoute("signal");
      expect(route.primary).toBe("claude");
    });

    it("routes risk assessment to Claude", () => {
      const route = resolveRoute("risk");
      expect(route.primary).toBe("claude");
    });

    it("routes portfolio optimization to Claude", () => {
      const route = resolveRoute("portfolio");
      expect(route.primary).toBe("claude");
      expect(route.fallbacks).toContain("grok");
    });

    it("routes volatility analysis to Claude with Perplexity fallback", () => {
      const route = resolveRoute("volatility");
      expect(route.primary).toBe("claude");
      expect(route.fallbacks).toContain("grok");
      expect(route.fallbacks).toContain("perplexity");
    });

    it("uses Claude as default for general tasks", () => {
      const route = resolveRoute("general");
      expect(route.primary).toBe("claude");
    });
  });

  describe("resolveRoute with preferred provider", () => {
    it("overrides primary when preferred provider differs", () => {
      const route = resolveRoute("reasoning", "grok");
      expect(route.primary).toBe("grok");
      expect(route.fallbacks).toContain("claude");
      expect(route.fallbacks).not.toContain("grok");
    });

    it("keeps original route when preferred matches primary", () => {
      const route = resolveRoute("reasoning", "claude");
      expect(route.primary).toBe("claude");
    });

    it("deduplicates providers in fallback chain", () => {
      const route = resolveRoute("research", "claude");
      expect(route.primary).toBe("claude");
      const providers = [route.primary, ...route.fallbacks];
      const unique = new Set(providers);
      expect(providers.length).toBe(unique.size);
    });
  });

  describe("getProviderChain", () => {
    it("returns all providers in priority order", () => {
      const chain = getProviderChain("reasoning");
      expect(chain[0]).toBe("claude");
      expect(chain.length).toBeGreaterThan(1);
    });

    it("respects preferred provider override", () => {
      const chain = getProviderChain("reasoning", "perplexity");
      expect(chain[0]).toBe("perplexity");
    });

    it("has no duplicate providers", () => {
      const chain = getProviderChain("general", "grok");
      const unique = new Set(chain);
      expect(chain.length).toBe(unique.size);
    });
  });
});
