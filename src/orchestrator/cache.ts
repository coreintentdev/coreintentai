/**
 * CoreIntent AI — Response Cache
 *
 * TTL-based in-memory cache for orchestrator responses. Prevents redundant
 * API calls for identical prompts within a configurable time window.
 *
 * Cache keys are derived from a hash of (intent + provider + prompt + systemPrompt).
 * Each entry has an independent TTL and the cache self-prunes on access.
 *
 * Why this matters for trading:
 *   - Sentiment for the same ticker doesn't change every second
 *   - Research queries are expensive (Perplexity web searches)
 *   - Consensus queries fire 2-3 models — caching one saves real money
 */

import type { OrchestrationResponse } from "../types/index.js";

export interface CacheConfig {
  /** Default TTL in milliseconds (default: 5 minutes) */
  defaultTtlMs: number;
  /** Maximum number of cached entries (default: 200) */
  maxEntries: number;
  /** Per-intent TTL overrides */
  intentTtls?: Record<string, number>;
}

interface CacheEntry {
  response: OrchestrationResponse;
  expiresAt: number;
  hits: number;
  createdAt: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  defaultTtlMs: 5 * 60 * 1000, // 5 minutes
  maxEntries: 200,
  intentTtls: {
    // Sentiment changes slowly — cache longer
    sentiment: 10 * 60 * 1000, // 10 minutes
    // Research is expensive — cache longer
    research: 15 * 60 * 1000, // 15 minutes
    // Signals should be fresher
    signal: 2 * 60 * 1000, // 2 minutes
    // Risk needs to be current
    risk: 2 * 60 * 1000, // 2 minutes
    // Fast analysis should be fast — short cache
    fast_analysis: 60 * 1000, // 1 minute
  },
};

export class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      intentTtls: {
        ...DEFAULT_CONFIG.intentTtls,
        ...config.intentTtls,
      },
    };
  }

  /**
   * Look up a cached response. Returns undefined on miss.
   */
  get(key: string): OrchestrationResponse | undefined {
    const entry = this.cache.get(key);

    if (!entry) return undefined;

    // Check TTL
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    entry.hits++;
    return entry.response;
  }

  /**
   * Store a response in the cache.
   */
  set(key: string, response: OrchestrationResponse, intent?: string): void {
    // Evict expired entries first
    this.prune();

    // Evict oldest if at capacity
    if (this.cache.size >= this.config.maxEntries) {
      this.evictOldest();
    }

    const ttl = intent
      ? (this.config.intentTtls?.[intent] ?? this.config.defaultTtlMs)
      : this.config.defaultTtlMs;

    this.cache.set(key, {
      response,
      expiresAt: Date.now() + ttl,
      hits: 0,
      createdAt: Date.now(),
    });
  }

  /**
   * Build a cache key from request parameters.
   * Uses a simple but effective string hash.
   */
  static buildKey(params: {
    intent: string;
    prompt: string;
    systemPrompt?: string;
    preferredProvider?: string;
  }): string {
    const raw = [
      params.intent,
      params.preferredProvider ?? "auto",
      params.systemPrompt ?? "",
      params.prompt,
    ].join("|");

    return fastHash(raw);
  }

  /**
   * Invalidate all entries matching a pattern (e.g., all sentiment cache).
   * Since keys are hashed, this clears ALL entries — use sparingly.
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics.
   */
  getStats(): {
    size: number;
    maxEntries: number;
    totalHits: number;
    oldestEntryAge: number;
  } {
    let totalHits = 0;
    let oldestCreatedAt = Date.now();

    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
      if (entry.createdAt < oldestCreatedAt) {
        oldestCreatedAt = entry.createdAt;
      }
    }

    return {
      size: this.cache.size,
      maxEntries: this.config.maxEntries,
      totalHits,
      oldestEntryAge: this.cache.size > 0 ? Date.now() - oldestCreatedAt : 0,
    };
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  private evictOldest(): void {
    // Evict the entry with the fewest hits (LFU-ish), breaking ties by age
    let evictKey: string | undefined;
    let evictHits = Infinity;
    let evictAge = Infinity;

    for (const [key, entry] of this.cache) {
      if (
        entry.hits < evictHits ||
        (entry.hits === evictHits && entry.createdAt < evictAge)
      ) {
        evictKey = key;
        evictHits = entry.hits;
        evictAge = entry.createdAt;
      }
    }

    if (evictKey) {
      this.cache.delete(evictKey);
    }
  }
}

/**
 * Fast string hash (djb2). Not cryptographic — just for cache key deduplication.
 */
function fastHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return hash.toString(36);
}
