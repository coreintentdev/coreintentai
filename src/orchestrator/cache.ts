/**
 * CoreIntent AI — Response Cache
 *
 * LRU cache with TTL for AI completions. Avoids redundant API calls
 * when the same analysis is requested multiple times within a window.
 *
 * Cache keys are derived from the request content (system prompt + prompt + intent),
 * not from object identity. Two identical requests will hit the same cache entry.
 *
 * Why this matters for trading:
 *   - Sentiment analysis for the same ticker within a 5-minute window
 *     doesn't need a fresh API call. Markets don't move that fast.
 *   - Saves money, reduces latency, and stays within rate limits.
 *   - Cache is local (in-memory) — no external dependencies.
 */

import type {
  ModelProvider,
  OrchestrationResponse,
  TaskIntent,
} from "../types/index.js";

export interface CacheConfig {
  /** Maximum number of entries. Oldest entries evicted when exceeded. Default: 200 */
  maxEntries: number;
  /** Default TTL in ms for cached responses. Default: 300_000 (5 min) */
  defaultTtlMs: number;
  /** Per-intent TTL overrides. E.g., fast_analysis might have shorter TTL. */
  intentTtl?: Partial<Record<TaskIntent, number>>;
}

interface CacheEntry {
  response: OrchestrationResponse;
  createdAt: number;
  ttlMs: number;
  hits: number;
  key: string;
}

const DEFAULT_CONFIG: CacheConfig = {
  maxEntries: 200,
  defaultTtlMs: 300_000, // 5 minutes
  intentTtl: {
    fast_analysis: 60_000,   // 1 min — speed-critical, stale faster
    sentiment: 180_000,      // 3 min — sentiment shifts slowly
    research: 600_000,       // 10 min — web research is expensive
    reasoning: 300_000,      // 5 min — deep analysis holds value
    signal: 120_000,         // 2 min — signals age quickly
    risk: 300_000,           // 5 min — risk profiles are stable
    general: 300_000,        // 5 min
  },
};

export class ResponseCache {
  private entries = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private stats = { hits: 0, misses: 0, evictions: 0 };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      intentTtl:
        "intentTtl" in config
          ? config.intentTtl
          : DEFAULT_CONFIG.intentTtl,
    };
  }

  /**
   * Generate a cache key from request parameters.
   * Deterministic: same inputs always produce the same key.
   */
  static buildKey(params: {
    intent: TaskIntent;
    prompt: string;
    systemPrompt?: string;
    preferredProvider?: ModelProvider;
  }): string {
    // Simple but effective: hash the concatenated content
    const raw = `${params.intent}|${params.systemPrompt ?? ""}|${params.prompt}|${params.preferredProvider ?? ""}`;
    return fastHash(raw);
  }

  /**
   * Get a cached response, or undefined if not found / expired.
   */
  get(key: string): OrchestrationResponse | undefined {
    const entry = this.entries.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check TTL
    if (Date.now() - entry.createdAt > entry.ttlMs) {
      this.entries.delete(key);
      this.stats.misses++;
      return undefined;
    }

    entry.hits++;
    this.stats.hits++;

    // Move to end (most recently used) by reinserting
    this.entries.delete(key);
    this.entries.set(key, entry);

    return entry.response;
  }

  /**
   * Store a response in the cache.
   */
  set(
    key: string,
    response: OrchestrationResponse,
    intent: TaskIntent
  ): void {
    // Evict oldest if at capacity
    if (this.entries.size >= this.config.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) {
        this.entries.delete(oldest);
        this.stats.evictions++;
      }
    }

    const ttlMs =
      this.config.intentTtl?.[intent] ?? this.config.defaultTtlMs;

    this.entries.set(key, {
      response,
      createdAt: Date.now(),
      ttlMs,
      hits: 0,
      key,
    });
  }

  /**
   * Check if a key exists and is not expired.
   */
  has(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;

    if (Date.now() - entry.createdAt > entry.ttlMs) {
      this.entries.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Invalidate a specific cache entry.
   */
  invalidate(key: string): boolean {
    return this.entries.delete(key);
  }

  /**
   * Invalidate all entries matching a predicate on the key.
   */
  invalidateMatching(predicate: (key: string) => boolean): number {
    let count = 0;
    for (const key of this.entries.keys()) {
      if (predicate(key)) {
        this.entries.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Get cache statistics for observability.
   */
  getStats(): {
    size: number;
    maxEntries: number;
    hits: number;
    misses: number;
    evictions: number;
    hitRate: number;
  } {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.entries.size,
      maxEntries: this.config.maxEntries,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }
}

/**
 * Fast, non-cryptographic hash for cache keys.
 * FNV-1a variant — deterministic, collision-resistant enough for caching.
 */
function fastHash(str: string): string {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0; // FNV prime, keep as uint32
  }
  return hash.toString(36);
}
