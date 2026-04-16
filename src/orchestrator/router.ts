/**
 * CoreIntent AI — Intent Router
 *
 * Maps task intents to optimal model providers. This is the strategic layer
 * that ensures each query hits the model best suited for the job.
 *
 * Routing Philosophy:
 *   - Claude: Deep reasoning, structured analysis, complex generation
 *   - Grok: Speed, real-time data, fast sentiment reads
 *   - Perplexity: Web-grounded research, news, fact-checking with citations
 */

import type { ModelProvider, TaskIntent } from "../types/index.js";

export interface RouteConfig {
  primary: ModelProvider;
  fallbacks: ModelProvider[];
}

/**
 * Static routing table — maps each intent to a primary provider + fallback chain.
 */
const ROUTE_TABLE: Record<TaskIntent, RouteConfig> = {
  reasoning: {
    primary: "claude",
    fallbacks: ["grok"],
  },
  fast_analysis: {
    primary: "grok",
    fallbacks: ["claude"],
  },
  research: {
    primary: "perplexity",
    fallbacks: ["grok", "claude"],
  },
  sentiment: {
    primary: "grok",
    fallbacks: ["claude", "perplexity"],
  },
  signal: {
    primary: "claude",
    fallbacks: ["grok"],
  },
  risk: {
    primary: "claude",
    fallbacks: ["grok"],
  },
  anomaly: {
    primary: "claude",
    fallbacks: ["grok", "perplexity"],
  },
  general: {
    primary: "claude",
    fallbacks: ["grok", "perplexity"],
  },
};

/**
 * Resolve the routing chain for a given intent.
 * If a preferred provider is specified, it becomes primary and the
 * original chain is reordered behind it (deduped).
 */
export function resolveRoute(
  intent: TaskIntent,
  preferredProvider?: ModelProvider
): RouteConfig {
  const base = ROUTE_TABLE[intent];

  if (!preferredProvider || preferredProvider === base.primary) {
    return base;
  }

  // Move preferred to front, keep original chain behind it (deduped)
  const chain = [base.primary, ...base.fallbacks].filter(
    (p) => p !== preferredProvider
  );

  return {
    primary: preferredProvider,
    fallbacks: chain,
  };
}

/**
 * Get all providers in priority order for a given intent.
 */
export function getProviderChain(
  intent: TaskIntent,
  preferredProvider?: ModelProvider
): ModelProvider[] {
  const route = resolveRoute(intent, preferredProvider);
  return [route.primary, ...route.fallbacks];
}
