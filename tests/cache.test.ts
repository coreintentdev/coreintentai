import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ResponseCache } from "../src/utils/cache.js";

describe("ResponseCache", () => {
  let cache: ResponseCache<string>;

  beforeEach(() => {
    cache = new ResponseCache<string>({
      maxEntries: 10,
      defaultTtlMs: 5000,
      enabled: true,
    });
  });

  describe("basic operations", () => {
    it("stores and retrieves values", () => {
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");
    });

    it("returns undefined for missing keys", () => {
      expect(cache.get("nonexistent")).toBeUndefined();
    });

    it("overwrites existing entries", () => {
      cache.set("key1", "first");
      cache.set("key1", "second");
      expect(cache.get("key1")).toBe("second");
    });

    it("clears all entries", () => {
      cache.set("a", "1");
      cache.set("b", "2");
      cache.clear();
      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toBeUndefined();
    });
  });

  describe("TTL expiry", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("expires entries after TTL", () => {
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");

      vi.advanceTimersByTime(6000); // past 5s TTL
      expect(cache.get("key1")).toBeUndefined();
    });

    it("uses intent-specific TTL", () => {
      cache = new ResponseCache<string>({
        maxEntries: 10,
        defaultTtlMs: 10_000,
        ttlByIntent: { sentiment: 1_000 },
        enabled: true,
      });

      cache.set("fast", "data", "sentiment");
      cache.set("slow", "data"); // default 10s TTL

      vi.advanceTimersByTime(2_000);
      expect(cache.get("fast")).toBeUndefined(); // expired
      expect(cache.get("slow")).toBe("data");    // still alive
    });
  });

  describe("LRU eviction", () => {
    it("evicts least recently used when at capacity", () => {
      vi.useFakeTimers();

      // Fill cache to capacity, with distinct timestamps
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, `value${i}`);
        vi.advanceTimersByTime(10); // ensure distinct lastAccessedAt
      }

      // Access key0 to make it "recently used" — bumps its lastAccessedAt
      vi.advanceTimersByTime(10);
      cache.get("key0");

      // Add one more — should evict key1 (oldest lastAccessedAt after key0 was refreshed)
      vi.advanceTimersByTime(10);
      cache.set("key10", "value10");

      expect(cache.get("key0")).toBe("value0");    // still here (recently accessed)
      expect(cache.get("key10")).toBe("value10");   // just added
      expect(cache.getStats().evictions).toBe(1);

      vi.useRealTimers();
    });
  });

  describe("cache statistics", () => {
    it("tracks hits and misses", () => {
      cache.set("key1", "value1");
      cache.get("key1");       // hit
      cache.get("key1");       // hit
      cache.get("nonexistent"); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2 / 3, 4);
    });

    it("tracks cache size", () => {
      cache.set("a", "1");
      cache.set("b", "2");
      expect(cache.getStats().size).toBe(2);
    });
  });

  describe("disabled cache", () => {
    it("returns undefined when disabled", () => {
      cache = new ResponseCache<string>({ enabled: false, maxEntries: 10, defaultTtlMs: 5000 });
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBeUndefined();
    });
  });

  describe("key building", () => {
    it("produces deterministic keys", () => {
      const key1 = ResponseCache.buildKey({
        provider: "claude",
        intent: "sentiment",
        prompt: "Analyze AAPL",
      });
      const key2 = ResponseCache.buildKey({
        provider: "claude",
        intent: "sentiment",
        prompt: "Analyze AAPL",
      });
      expect(key1).toBe(key2);
    });

    it("normalizes whitespace", () => {
      const key1 = ResponseCache.buildKey({ prompt: "Analyze  AAPL" });
      const key2 = ResponseCache.buildKey({ prompt: "Analyze AAPL" });
      expect(key1).toBe(key2);
    });

    it("produces different keys for different prompts", () => {
      const key1 = ResponseCache.buildKey({ prompt: "Analyze AAPL" });
      const key2 = ResponseCache.buildKey({ prompt: "Analyze TSLA" });
      expect(key1).not.toBe(key2);
    });

    it("produces different keys for different providers", () => {
      const key1 = ResponseCache.buildKey({ provider: "claude", prompt: "test" });
      const key2 = ResponseCache.buildKey({ provider: "grok", prompt: "test" });
      expect(key1).not.toBe(key2);
    });
  });

  describe("invalidateByPrefix", () => {
    it("removes matching entries and returns count", () => {
      cache.set("sent_1", "a");
      cache.set("sent_2", "b");
      cache.set("risk_1", "c");

      const removed = cache.invalidateByPrefix("sent_");
      expect(removed).toBe(2);
      expect(cache.get("sent_1")).toBeUndefined();
      expect(cache.get("risk_1")).toBe("c");
    });
  });
});
