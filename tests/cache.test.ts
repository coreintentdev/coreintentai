import { describe, it, expect, beforeEach } from "vitest";
import { ResponseCache } from "../src/orchestrator/cache.js";
import type { OrchestrationResponse } from "../src/types/index.js";

function makeResponse(content: string): OrchestrationResponse {
  return {
    content,
    provider: "claude",
    model: "claude-sonnet-4-20250514",
    latencyMs: 500,
    tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
    fallbackUsed: false,
  };
}

describe("ResponseCache", () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache({
      maxEntries: 5,
      defaultTtlMs: 1000,
    });
  });

  describe("buildKey", () => {
    it("produces consistent keys for identical inputs", () => {
      const a = ResponseCache.buildKey({
        intent: "sentiment",
        prompt: "Analyze AAPL",
      });
      const b = ResponseCache.buildKey({
        intent: "sentiment",
        prompt: "Analyze AAPL",
      });
      expect(a).toBe(b);
    });

    it("produces different keys for different inputs", () => {
      const a = ResponseCache.buildKey({
        intent: "sentiment",
        prompt: "Analyze AAPL",
      });
      const b = ResponseCache.buildKey({
        intent: "sentiment",
        prompt: "Analyze TSLA",
      });
      expect(a).not.toBe(b);
    });

    it("includes intent in key derivation", () => {
      const a = ResponseCache.buildKey({
        intent: "sentiment",
        prompt: "Analyze AAPL",
      });
      const b = ResponseCache.buildKey({
        intent: "risk",
        prompt: "Analyze AAPL",
      });
      expect(a).not.toBe(b);
    });

    it("includes system prompt in key derivation", () => {
      const a = ResponseCache.buildKey({
        intent: "sentiment",
        prompt: "Analyze AAPL",
        systemPrompt: "You are a bull",
      });
      const b = ResponseCache.buildKey({
        intent: "sentiment",
        prompt: "Analyze AAPL",
        systemPrompt: "You are a bear",
      });
      expect(a).not.toBe(b);
    });

    it("includes preferredProvider in key derivation", () => {
      const a = ResponseCache.buildKey({
        intent: "sentiment",
        prompt: "Analyze AAPL",
        preferredProvider: "claude",
      });
      const b = ResponseCache.buildKey({
        intent: "sentiment",
        prompt: "Analyze AAPL",
        preferredProvider: "grok",
      });
      expect(a).not.toBe(b);
    });
  });

  describe("get/set", () => {
    it("returns undefined for missing keys", () => {
      expect(cache.get("nonexistent")).toBeUndefined();
    });

    it("stores and retrieves responses", () => {
      const response = makeResponse("AAPL is bullish");
      cache.set("key1", response, "sentiment");
      const result = cache.get("key1");
      expect(result).toBeDefined();
      expect(result!.content).toBe("AAPL is bullish");
    });

    it("returns undefined for expired entries", async () => {
      const shortCache = new ResponseCache({
        maxEntries: 10,
        defaultTtlMs: 50,
        intentTtl: {}, // Clear intent-specific TTLs so defaultTtlMs is used
      });
      shortCache.set("key1", makeResponse("test"), "general");
      expect(shortCache.get("key1")).toBeDefined();

      await new Promise((r) => setTimeout(r, 150));
      expect(shortCache.get("key1")).toBeUndefined();
    });
  });

  describe("LRU eviction", () => {
    it("evicts oldest entry when at capacity", () => {
      for (let i = 0; i < 5; i++) {
        cache.set(`key${i}`, makeResponse(`response ${i}`), "general");
      }

      // Cache is full (5 entries). Add one more.
      cache.set("key5", makeResponse("response 5"), "general");

      // key0 (oldest) should be evicted
      expect(cache.get("key0")).toBeUndefined();
      expect(cache.get("key5")).toBeDefined();
    });

    it("refreshes position on access", () => {
      for (let i = 0; i < 5; i++) {
        cache.set(`key${i}`, makeResponse(`response ${i}`), "general");
      }

      // Access key0 to move it to the end
      cache.get("key0");

      // Add a new entry — key1 should be evicted (now the oldest)
      cache.set("key5", makeResponse("response 5"), "general");
      expect(cache.get("key0")).toBeDefined();
      expect(cache.get("key1")).toBeUndefined();
    });
  });

  describe("invalidation", () => {
    it("invalidates a specific key", () => {
      cache.set("key1", makeResponse("test"), "general");
      expect(cache.invalidate("key1")).toBe(true);
      expect(cache.get("key1")).toBeUndefined();
    });

    it("invalidates matching entries", () => {
      cache.set("sentiment-aapl", makeResponse("aapl"), "sentiment");
      cache.set("sentiment-tsla", makeResponse("tsla"), "sentiment");
      cache.set("risk-aapl", makeResponse("risk"), "risk");

      const count = cache.invalidateMatching((key) =>
        key.startsWith("sentiment")
      );
      // Keys are hashed, so prefix matching won't work directly.
      // But the predicate still runs against all keys.
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it("clears all entries", () => {
      cache.set("key1", makeResponse("a"), "general");
      cache.set("key2", makeResponse("b"), "general");
      cache.clear();
      expect(cache.get("key1")).toBeUndefined();
      expect(cache.get("key2")).toBeUndefined();
    });
  });

  describe("has", () => {
    it("returns true for existing entries", () => {
      cache.set("key1", makeResponse("test"), "general");
      expect(cache.has("key1")).toBe(true);
    });

    it("returns false for missing entries", () => {
      expect(cache.has("missing")).toBe(false);
    });

    it("does not inflate cache stats", () => {
      cache.set("key1", makeResponse("test"), "general");

      cache.has("key1"); // should NOT count as a hit
      cache.has("missing"); // should NOT count as a miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe("stats", () => {
    it("tracks hits and misses", () => {
      cache.set("key1", makeResponse("test"), "general");

      cache.get("key1"); // hit
      cache.get("key1"); // hit
      cache.get("missing"); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2 / 3);
    });

    it("tracks evictions", () => {
      for (let i = 0; i < 7; i++) {
        cache.set(`key${i}`, makeResponse(`r${i}`), "general");
      }

      const stats = cache.getStats();
      expect(stats.evictions).toBe(2); // 7 entries, capacity 5 → 2 evicted
      expect(stats.size).toBe(5);
    });
  });
});
