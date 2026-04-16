import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("Model Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("loads default configurations", async () => {
    const { getAllConfigs } = await import("../src/config/models.js");
    const configs = getAllConfigs();

    expect(configs.claude.provider).toBe("claude");
    expect(configs.grok.provider).toBe("grok");
    expect(configs.perplexity.provider).toBe("perplexity");
  });

  it("uses environment overrides for model names", async () => {
    process.env.CLAUDE_MODEL = "claude-opus-4-20250514";
    process.env.GROK_MODEL = "grok-3-mini";

    const { getModelConfig } = await import("../src/config/models.js");
    const claude = getModelConfig("claude");
    const grok = getModelConfig("grok");

    expect(claude.model).toBe("claude-opus-4-20250514");
    expect(grok.model).toBe("grok-3-mini");
  });

  it("validates missing API keys", async () => {
    process.env.ANTHROPIC_API_KEY = "";
    process.env.XAI_API_KEY = "";

    const { validateProviderKeys } = await import("../src/config/models.js");
    const missing = validateProviderKeys("claude", "grok");

    expect(missing).toContain("ANTHROPIC_API_KEY");
    expect(missing).toContain("XAI_API_KEY");
  });

  it("returns no missing keys when all are set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    process.env.XAI_API_KEY = "xai-test";
    process.env.PERPLEXITY_API_KEY = "pplx-test";

    const { validateProviderKeys } = await import("../src/config/models.js");
    const missing = validateProviderKeys("claude", "grok", "perplexity");

    expect(missing).toHaveLength(0);
  });
});
