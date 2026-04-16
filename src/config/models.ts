/**
 * CoreIntent AI — Model Configuration
 *
 * Centralized model config with environment-driven overrides.
 * Each provider is tuned for its strength in the trading intelligence stack.
 */

import type { ModelConfig, ModelProvider } from "../types/index.js";

function env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  return raw ? parseInt(raw, 10) : fallback;
}

// ---------------------------------------------------------------------------
// Provider Configs
// ---------------------------------------------------------------------------

export const CLAUDE_CONFIG: ModelConfig = {
  provider: "claude",
  model: env("CLAUDE_MODEL", "claude-sonnet-4-20250514"),
  apiKey: env("ANTHROPIC_API_KEY", ""),
  maxTokens: 4096,
  temperature: 0.3,
  timeoutMs: envInt("AI_DEFAULT_TIMEOUT_MS", 30_000),
};

export const GROK_CONFIG: ModelConfig = {
  provider: "grok",
  model: env("GROK_MODEL", "grok-3"),
  apiKey: env("XAI_API_KEY", ""),
  baseUrl: env("XAI_BASE_URL", "https://api.x.ai/v1"),
  maxTokens: 4096,
  temperature: 0.2,
  timeoutMs: envInt("AI_DEFAULT_TIMEOUT_MS", 30_000),
};

export const PERPLEXITY_CONFIG: ModelConfig = {
  provider: "perplexity",
  model: env("PERPLEXITY_MODEL", "sonar-pro"),
  apiKey: env("PERPLEXITY_API_KEY", ""),
  baseUrl: env("PERPLEXITY_BASE_URL", "https://api.perplexity.ai"),
  maxTokens: 4096,
  temperature: 0.1,
  timeoutMs: envInt("AI_DEFAULT_TIMEOUT_MS", 30_000),
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const MODEL_REGISTRY: Record<ModelProvider, ModelConfig> = {
  claude: CLAUDE_CONFIG,
  grok: GROK_CONFIG,
  perplexity: PERPLEXITY_CONFIG,
};

export function getModelConfig(provider: ModelProvider): ModelConfig {
  return MODEL_REGISTRY[provider];
}

export function getAllConfigs(): Record<ModelProvider, ModelConfig> {
  return { ...MODEL_REGISTRY };
}

/**
 * Validate that required API keys are set for a given provider.
 * Returns an array of missing keys (empty = all good).
 */
export function validateProviderKeys(
  ...providers: ModelProvider[]
): string[] {
  const missing: string[] = [];
  for (const p of providers) {
    const cfg = MODEL_REGISTRY[p];
    if (!cfg.apiKey) {
      const keyName =
        p === "claude"
          ? "ANTHROPIC_API_KEY"
          : p === "grok"
            ? "XAI_API_KEY"
            : "PERPLEXITY_API_KEY";
      missing.push(keyName);
    }
  }
  return missing;
}
