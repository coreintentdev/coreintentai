import { createHash } from "crypto";
import type { ModelProvider, TaskIntent } from "../types/index.js";

interface CacheEntry {
  content: string;
  provider: ModelProvider;
  model: string;
  cachedAt: number;
  ttlMs: number;
  hits: number;
}

export interface ResponseCacheOptions {
  defaultTtlMs: number;
  maxEntries: number;
  intentTtls?: Partial<Record<TaskIntent, number>>;
}

const DEFAULTS: ResponseCacheOptions = {
  defaultTtlMs: 60_000,
  maxEntries: 500,
  intentTtls: {
    research: 300_000,
    sentiment: 30_000,
    fast_analysis: 15_000,
    signal: 30_000,
    risk: 120_000,
    reasoning: 60_000,
    general: 60_000,
  },
};

export class ResponseCache {
  private cache = new Map<string, CacheEntry>();
  private options: ResponseCacheOptions;

  constructor(options?: Partial<ResponseCacheOptions>) {
    this.options = { ...DEFAULTS, ...options };
  }

  private buildKey(
    intent: TaskIntent,
    prompt: string,
    systemPrompt?: string,
    provider?: ModelProvider
  ): string {
    const hash = createHash("sha256");
    hash.update(intent);
    hash.update(prompt);
    if (systemPrompt) hash.update(systemPrompt);
    if (provider) hash.update(provider);
    return hash.digest("hex").slice(0, 32);
  }

  private getTtl(intent: TaskIntent): number {
    return this.options.intentTtls?.[intent] ?? this.options.defaultTtlMs;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.cachedAt > entry.ttlMs) {
        this.cache.delete(key);
      }
    }
  }

  private evictLRU(): void {
    if (this.cache.size < this.options.maxEntries) return;

    const entries = [...this.cache.entries()].sort(
      (a, b) => a[1].cachedAt - b[1].cachedAt
    );

    const toRemove = entries.length - this.options.maxEntries + 1;
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  get(
    intent: TaskIntent,
    prompt: string,
    systemPrompt?: string,
    provider?: ModelProvider
  ): CacheEntry | null {
    const key = this.buildKey(intent, prompt, systemPrompt, provider);
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() - entry.cachedAt > entry.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry;
  }

  set(params: {
    intent: TaskIntent;
    prompt: string;
    systemPrompt?: string;
    preferredProvider?: ModelProvider;
    provider: ModelProvider;
    model: string;
    content: string;
  }): void {
    this.evictExpired();
    this.evictLRU();

    const key = this.buildKey(
      params.intent,
      params.prompt,
      params.systemPrompt,
      params.preferredProvider
    );

    this.cache.set(key, {
      content: params.content,
      provider: params.provider,
      model: params.model,
      cachedAt: Date.now(),
      ttlMs: this.getTtl(params.intent),
      hits: 0,
    });
  }

  invalidate(intent?: TaskIntent): void {
    if (!intent) {
      this.cache.clear();
      return;
    }

    for (const [key, entry] of this.cache) {
      void entry;
      if (key.startsWith(intent)) {
        this.cache.delete(key);
      }
    }
  }

  getStats(): {
    size: number;
    maxEntries: number;
    totalHits: number;
    hitRate: number;
  } {
    let totalHits = 0;
    let totalEntries = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
      totalEntries++;
    }

    return {
      size: this.cache.size,
      maxEntries: this.options.maxEntries,
      totalHits,
      hitRate: totalEntries > 0 ? totalHits / (totalHits + totalEntries) : 0,
    };
  }

  clear(): void {
    this.cache.clear();
  }
}
