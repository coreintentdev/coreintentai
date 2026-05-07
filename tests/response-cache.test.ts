import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ResponseCache } from "../src/orchestrator/response-cache.js";

describe("ResponseCache", () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache({ defaultTtlMs: 5000, maxEntries: 10 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("get/set", () => {
    it("returns null for a cache miss", () => {
      const result = cache.get("sentiment", "test prompt");
      expect(result).toBeNull();
    });

    it("returns cached entry on hit", () => {
      cache.set({
        intent: "sentiment",
        prompt: "Analyze AAPL",
        provider: "grok",
        model: "grok-3",
        content: '{"sentiment": "bullish"}',
      });

      const result = cache.get("sentiment", "Analyze AAPL");
      expect(result).not.toBeNull();
      expect(result!.content).toBe('{"sentiment": "bullish"}');
      expect(result!.provider).toBe("grok");
      expect(result!.model).toBe("grok-3");
    });

    it("differentiates by system prompt", () => {
      cache.set({
        intent: "reasoning",
        prompt: "test",
        systemPrompt: "system A",
        provider: "claude",
        model: "claude-sonnet-4-6",
        content: "response A",
      });
      cache.set({
        intent: "reasoning",
        prompt: "test",
        systemPrompt: "system B",
        provider: "claude",
        model: "claude-sonnet-4-6",
        content: "response B",
      });

      expect(cache.get("reasoning", "test", "system A")!.content).toBe("response A");
      expect(cache.get("reasoning", "test", "system B")!.content).toBe("response B");
    });

    it("differentiates by preferred provider", () => {
      cache.set({
        intent: "sentiment",
        prompt: "test",
        preferredProvider: "grok",
        provider: "grok",
        model: "grok-3",
        content: "grok response",
      });
      cache.set({
        intent: "sentiment",
        prompt: "test",
        preferredProvider: "claude",
        provider: "claude",
        model: "claude-sonnet-4-6",
        content: "claude response",
      });

      expect(cache.get("sentiment", "test", undefined, "grok")!.content).toBe("grok response");
      expect(cache.get("sentiment", "test", undefined, "claude")!.content).toBe("claude response");
    });

    it("increments hit count", () => {
      cache.set({
        intent: "general",
        prompt: "test",
        provider: "claude",
        model: "claude-sonnet-4-6",
        content: "cached",
      });

      cache.get("general", "test");
      cache.get("general", "test");
      const entry = cache.get("general", "test");
      expect(entry!.hits).toBe(3);
    });
  });

  describe("TTL expiration", () => {
    it("expires entries after TTL", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);

      cache.set({
        intent: "fast_analysis",
        prompt: "test",
        provider: "grok",
        model: "grok-3",
        content: "fast result",
      });

      expect(cache.get("fast_analysis", "test")).not.toBeNull();

      vi.spyOn(Date, "now").mockReturnValue(now + 20_000);
      expect(cache.get("fast_analysis", "test")).toBeNull();
    });

    it("uses intent-specific TTLs", () => {
      const customCache = new ResponseCache({
        defaultTtlMs: 60_000,
        intentTtls: {
          fast_analysis: 1000,
          research: 300_000,
        },
      });

      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);

      customCache.set({
        intent: "fast_analysis",
        prompt: "test",
        provider: "grok",
        model: "grok-3",
        content: "fast",
      });
      customCache.set({
        intent: "research",
        prompt: "test",
        provider: "perplexity",
        model: "sonar-pro",
        content: "research",
      });

      vi.spyOn(Date, "now").mockReturnValue(now + 2000);
      expect(customCache.get("fast_analysis", "test")).toBeNull();
      expect(customCache.get("research", "test")).not.toBeNull();
    });
  });

  describe("eviction", () => {
    it("evicts oldest entries when max size exceeded", () => {
      for (let i = 0; i < 12; i++) {
        cache.set({
          intent: "general",
          prompt: `prompt-${i}`,
          provider: "claude",
          model: "claude-sonnet-4-6",
          content: `response-${i}`,
        });
      }

      const stats = cache.getStats();
      expect(stats.size).toBeLessThanOrEqual(10);
    });
  });

  describe("invalidate", () => {
    it("clears all entries when called without argument", () => {
      cache.set({ intent: "sentiment", prompt: "a", provider: "grok", model: "grok-3", content: "a" });
      cache.set({ intent: "signal", prompt: "b", provider: "claude", model: "claude-sonnet-4-6", content: "b" });

      cache.invalidate();
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe("getStats", () => {
    it("reports cache statistics", () => {
      cache.set({ intent: "general", prompt: "test", provider: "claude", model: "claude-sonnet-4-6", content: "cached" });
      cache.get("general", "test");
      cache.get("general", "test");

      const stats = cache.getStats();
      expect(stats.size).toBe(1);
      expect(stats.totalHits).toBe(2);
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    it("reports zero stats when empty", () => {
      const stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.totalHits).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe("clear", () => {
    it("removes all entries", () => {
      cache.set({ intent: "general", prompt: "test", provider: "claude", model: "claude-sonnet-4-6", content: "test" });
      cache.clear();
      expect(cache.getStats().size).toBe(0);
    });
  });
});
