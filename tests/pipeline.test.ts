import { describe, it, expect } from "vitest";
import {
  PipelineComposer,
  PipelineGateError,
  parallel,
  conditional,
} from "../src/orchestrator/pipeline.js";

describe("PipelineComposer", () => {
  it("executes a single-stage pipeline", async () => {
    const pipeline = PipelineComposer.create<number>().pipe(
      "double",
      async (n) => n * 2
    );

    const result = await pipeline.execute(5);
    expect(result.output).toBe(10);
    expect(result.stages).toHaveLength(1);
    expect(result.stages[0].name).toBe("double");
    expect(result.stages[0].success).toBe(true);
  });

  it("chains multiple stages", async () => {
    const pipeline = PipelineComposer.create<number>()
      .pipe("double", async (n) => n * 2)
      .pipe("toString", async (n) => `result: ${n}`)
      .pipe("uppercase", async (s) => s.toUpperCase());

    const result = await pipeline.execute(5);
    expect(result.output).toBe("RESULT: 10");
    expect(result.stages).toHaveLength(3);
  });

  it("tracks latency per stage", async () => {
    const pipeline = PipelineComposer.create<string>()
      .pipe("slow", async (s) => {
        await new Promise((r) => setTimeout(r, 20));
        return s.toUpperCase();
      })
      .pipe("fast", async (s) => s + "!");

    const result = await pipeline.execute("hello");
    expect(result.output).toBe("HELLO!");
    expect(result.stages[0].latencyMs).toBeGreaterThanOrEqual(15);
    expect(result.totalLatencyMs).toBeGreaterThanOrEqual(15);
  });

  it("propagates errors with stage tracking", async () => {
    const pipeline = PipelineComposer.create<number>()
      .pipe("succeed", async (n) => n + 1)
      .pipe("fail", async () => {
        throw new Error("boom");
      });

    await expect(pipeline.execute(1)).rejects.toThrow("boom");
  });

  describe("gate", () => {
    it("passes gate when check returns true", async () => {
      const pipeline = PipelineComposer.create<number>()
        .pipe("compute", async (n) => n * 10)
        .gate((n) => n > 0)
        .pipe("format", async (n) => `${n}`);

      const result = await pipeline.execute(5);
      expect(result.output).toBe("50");
    });

    it("throws PipelineGateError when gate fails with message", async () => {
      const pipeline = PipelineComposer.create<number>()
        .pipe("compute", async (n) => n * 10)
        .gate((n) => n < 10, "Value too high")
        .pipe("never", async (n) => `${n}`);

      try {
        await pipeline.execute(5);
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(PipelineGateError);
        expect((err as PipelineGateError).stageName).toBe("compute");
        expect((err as PipelineGateError).stageOutput).toBe(50);
      }
    });

    it("stops pipeline when gate fails without message", async () => {
      const pipeline = PipelineComposer.create<number>()
        .pipe("first", async (n) => n)
        .gate((n) => n > 100)
        .pipe("second", async (n) => n * 2);

      const result = await pipeline.execute(5);
      // Pipeline stops after gate failure, output is the last stage output before the gate stopped
      expect(result.output).toBe(5);
      expect(result.stages).toHaveLength(2);
      expect(result.stages[1].name).toBe("first:gate");
      expect(result.stages[1].success).toBe(false);
    });
  });
});

describe("parallel", () => {
  it("runs stages concurrently and collects results", async () => {
    const fn = parallel([
      { name: "a", execute: async (n: number) => n + 1 },
      { name: "b", execute: async (n: number) => n + 2 },
      { name: "c", execute: async (n: number) => n + 3 },
    ]);

    const result = await fn(10);
    expect(result).toEqual([11, 12, 13]);
  });
});

describe("conditional", () => {
  it("takes the true branch when condition holds", async () => {
    const fn = conditional<number, string>(
      (n) => n > 0,
      async (n) => `positive: ${n}`,
      async (n) => `non-positive: ${n}`
    );

    expect(await fn(5)).toBe("positive: 5");
  });

  it("takes the false branch when condition fails", async () => {
    const fn = conditional<number, string>(
      (n) => n > 0,
      async (n) => `positive: ${n}`,
      async (n) => `non-positive: ${n}`
    );

    expect(await fn(-3)).toBe("non-positive: -3");
  });
});
