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
      defaultTtlMs: 200, // Short TTL for tests
      maxEntries: 5,
    });
  });

  describe("basic operations", () => {
    it("stores and retrieves a response", () => {
      const response = makeResponse("test content");
      cache.set("key1", response);

      const cached = cache.get("key1");
      expect(cached).toBeDefined();
      expect(cached!.content).toBe("test content");
    });

    it("returns undefined for cache miss", () => {
      expect(cache.get("nonexistent")).toBeUndefined();
    });
  });

  describe("TTL expiration", () => {
    it("expires entries after TTL", async () => {
      cache.set("key1", makeResponse("test"));

      // Should exist immediately
      expect(cache.get("key1")).toBeDefined();

      // Wait for TTL
      await new Promise((r) => setTimeout(r, 250));

      expect(cache.get("key1")).toBeUndefined();
    });

    it("uses intent-specific TTL when provided", () => {
      const longCache = new ResponseCache({
        defaultTtlMs: 50,
        maxEntries: 10,
        intentTtls: { research: 5000 },
      });

      longCache.set("key1", makeResponse("research"), "research");
      longCache.set("key2", makeResponse("general"));

      // Both should exist initially
      expect(longCache.get("key1")).toBeDefined();
      expect(longCache.get("key2")).toBeDefined();
    });
  });

  describe("capacity management", () => {
    it("evicts entries when at capacity", () => {
      for (let i = 0; i < 6; i++) {
        cache.set(`key${i}`, makeResponse(`content ${i}`));
      }

      // Should have at most maxEntries
      const stats = cache.getStats();
      expect(stats.size).toBeLessThanOrEqual(5);
    });

    it("evicts least-hit entries first", () => {
      // Fill cache
      for (let i = 0; i < 5; i++) {
        cache.set(`key${i}`, makeResponse(`content ${i}`));
      }

      // Access some entries to increase their hit count
      cache.get("key3");
      cache.get("key3");
      cache.get("key4");
      cache.get("key4");

      // Add one more — should evict a low-hit entry
      cache.set("key5", makeResponse("new content"));

      // High-hit entries should survive
      expect(cache.get("key3")).toBeDefined();
      expect(cache.get("key4")).toBeDefined();
    });
  });

  describe("buildKey", () => {
    it("produces consistent keys for same inputs", () => {
      const key1 = ResponseCache.buildKey({
        intent: "sentiment",
        prompt: "Analyze AAPL",
        systemPrompt: "You are...",
      });
      const key2 = ResponseCache.buildKey({
        intent: "sentiment",
        prompt: "Analyze AAPL",
        systemPrompt: "You are...",
      });
      expect(key1).toBe(key2);
    });

    it("produces different keys for different inputs", () => {
      const key1 = ResponseCache.buildKey({
        intent: "sentiment",
        prompt: "Analyze AAPL",
      });
      const key2 = ResponseCache.buildKey({
        intent: "sentiment",
        prompt: "Analyze TSLA",
      });
      expect(key1).not.toBe(key2);
    });

    it("differentiates by intent", () => {
      const key1 = ResponseCache.buildKey({
        intent: "sentiment",
        prompt: "Analyze AAPL",
      });
      const key2 = ResponseCache.buildKey({
        intent: "signal",
        prompt: "Analyze AAPL",
      });
      expect(key1).not.toBe(key2);
    });

    it("differentiates by preferred provider", () => {
      const key1 = ResponseCache.buildKey({
        intent: "sentiment",
        prompt: "Analyze AAPL",
        preferredProvider: "claude",
      });
      const key2 = ResponseCache.buildKey({
        intent: "sentiment",
        prompt: "Analyze AAPL",
        preferredProvider: "grok",
      });
      expect(key1).not.toBe(key2);
    });
  });

  describe("invalidateAll", () => {
    it("clears all entries", () => {
      cache.set("key1", makeResponse("a"));
      cache.set("key2", makeResponse("b"));

      cache.invalidateAll();

      expect(cache.get("key1")).toBeUndefined();
      expect(cache.get("key2")).toBeUndefined();
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe("stats", () => {
    it("tracks hit count", () => {
      cache.set("key1", makeResponse("test"));
      cache.get("key1");
      cache.get("key1");

      const stats = cache.getStats();
      expect(stats.totalHits).toBe(2);
    });

    it("reports correct size", () => {
      cache.set("key1", makeResponse("a"));
      cache.set("key2", makeResponse("b"));

      expect(cache.getStats().size).toBe(2);
    });
  });
});
