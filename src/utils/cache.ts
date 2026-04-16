/**
 * CoreIntent AI — Response Cache
 *
 * In-memory TTL cache for AI responses. Identical prompts to the same provider
 * return cached results instead of burning API credits. Smart key hashing
 * normalizes whitespace and ignores non-semantic differences.
 *
 * Design decisions:
 * - In-memory only — no persistence. Cache dies with the process. This is
 *   intentional: market data changes fast, stale responses are dangerous.
 * - TTL-based eviction — configurable per-intent. Sentiment ages faster
 *   than research analysis.
 * - LRU eviction when capacity is reached — least-recently-used entries
 *   are evicted first.
 */

import { createHash } from "crypto";

export interface CacheConfig {
  /** Maximum number of entries before LRU eviction kicks in. Default: 500 */
  maxEntries: number;
  /** Default TTL in milliseconds. Default: 5 minutes */
  defaultTtlMs: number;
  /** Per-intent TTL overrides in milliseconds */
  ttlByIntent?: Record<string, number>;
  /** Whether caching is enabled. Default: true */
  enabled: boolean;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessedAt: number;
  hits: number;
  key: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  maxEntries: 500,
  defaultTtlMs: 5 * 60 * 1000, // 5 minutes
  ttlByIntent: {
    sentiment: 2 * 60 * 1000,      // 2 min — sentiment changes fast
    fast_analysis: 1 * 60 * 1000,  // 1 min — speed-critical, data moves fast
    research: 15 * 60 * 1000,      // 15 min — research ages slowly
    reasoning: 10 * 60 * 1000,     // 10 min — deep analysis is stable
    signal: 3 * 60 * 1000,         // 3 min — signals need freshness
    risk: 5 * 60 * 1000,           // 5 min — risk doesn't change every second
  },
  enabled: true,
};

export class ResponseCache<T = string> {
  private cache = new Map<string, CacheEntry<T>>();
  private config: CacheConfig;
  private stats = { hits: 0, misses: 0, evictions: 0 };

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get a cached response. Returns undefined on miss or expiry.
   */
  get(key: string): T | undefined {
    if (!this.config.enabled) return undefined;

    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }

    entry.lastAccessedAt = Date.now();
    entry.hits++;
    this.stats.hits++;
    return entry.value;
  }

  /**
   * Store a response in cache with optional intent-specific TTL.
   */
  set(key: string, value: T, intent?: string): void {
    if (!this.config.enabled) return;

    // Evict LRU if at capacity
    if (this.cache.size >= this.config.maxEntries && !this.cache.has(key)) {
      this.evictLRU();
    }

    const ttl = this.getTtl(intent);
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      lastAccessedAt: Date.now(),
      hits: 0,
      key,
    });
  }

  /**
   * Build a deterministic cache key from request parameters.
   * Normalizes whitespace and sorts context keys so semantically
   * identical requests always produce the same key.
   */
  static buildKey(params: {
    provider?: string;
    intent?: string;
    prompt: string;
    systemPrompt?: string;
  }): string {
    const normalized = [
      params.provider ?? "",
      params.intent ?? "",
      normalizePrompt(params.systemPrompt ?? ""),
      normalizePrompt(params.prompt),
    ].join("|");

    return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
  }

  /**
   * Invalidate all entries matching a pattern (e.g., clear all sentiment cache).
   */
  invalidateByPrefix(keyPrefix: string): number {
    let count = 0;
    for (const [key] of this.cache) {
      if (key.startsWith(keyPrefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear entire cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache performance statistics.
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  private getTtl(intent?: string): number {
    if (intent && this.config.ttlByIntent?.[intent]) {
      return this.config.ttlByIntent[intent];
    }
    return this.config.defaultTtlMs;
  }

  private evictLRU(): void {
    let oldest: CacheEntry<T> | undefined;

    for (const entry of this.cache.values()) {
      if (!oldest || entry.lastAccessedAt < oldest.lastAccessedAt) {
        oldest = entry;
      }
    }

    if (oldest) {
      this.cache.delete(oldest.key);
      this.stats.evictions++;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizePrompt(prompt: string): string {
  return prompt.replace(/\s+/g, " ").trim().toLowerCase();
}
