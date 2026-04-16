/**
 * CoreIntent AI — Model Factory
 *
 * Creates and caches model adapters by provider name.
 */

import type { ModelProvider } from "../types/index.js";
import { getModelConfig } from "../config/models.js";
import { BaseModelAdapter } from "./base.js";
import { ClaudeAdapter } from "./claude.js";
import { GrokAdapter } from "./grok.js";
import { PerplexityAdapter } from "./perplexity.js";

const adapterCache = new Map<ModelProvider, BaseModelAdapter>();

export function getAdapter(provider: ModelProvider): BaseModelAdapter {
  const cached = adapterCache.get(provider);
  if (cached) return cached;

  const config = getModelConfig(provider);
  let adapter: BaseModelAdapter;

  switch (provider) {
    case "claude":
      adapter = new ClaudeAdapter(config);
      break;
    case "grok":
      adapter = new GrokAdapter(config);
      break;
    case "perplexity":
      adapter = new PerplexityAdapter(config);
      break;
  }

  adapterCache.set(provider, adapter);
  return adapter;
}

export function clearAdapterCache(): void {
  adapterCache.clear();
}

export { BaseModelAdapter } from "./base.js";
export { ClaudeAdapter } from "./claude.js";
export { GrokAdapter } from "./grok.js";
export { PerplexityAdapter } from "./perplexity.js";
