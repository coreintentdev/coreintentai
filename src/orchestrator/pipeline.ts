import type { PipelineResult } from "../types/index.js";

export type StageFunction<TIn, TOut> = (input: TIn) => Promise<TOut>;

interface StageEntry {
  name: string;
  execute: (input: unknown) => Promise<unknown>;
}

export class PipelineComposer<TFirst, TLast> {
  private stages: StageEntry[] = [];
  private gateChecks: Map<number, (output: unknown) => boolean> = new Map();

  private constructor() {}

  static create<TInput>(): PipelineComposer<TInput, TInput> {
    return new PipelineComposer();
  }

  pipe<TOut>(
    name: string,
    execute: StageFunction<TLast, TOut>
  ): PipelineComposer<TFirst, TOut> {
    const next = new PipelineComposer<TFirst, TOut>();
    next.stages = [...this.stages, { name, execute: execute as (input: unknown) => Promise<unknown> }];
    next.gateChecks = new Map(this.gateChecks);
    return next;
  }

  gate(
    check: (output: TLast) => boolean,
    failureMessage?: string
  ): PipelineComposer<TFirst, TLast> {
    const idx = this.stages.length - 1;
    if (idx < 0) throw new Error("Cannot add gate before any stages");

    const next = new PipelineComposer<TFirst, TLast>();
    next.stages = [...this.stages];
    next.gateChecks = new Map(this.gateChecks);
    next.gateChecks.set(idx, (output) => {
      const pass = (check as (output: unknown) => boolean)(output);
      if (!pass && failureMessage) {
        throw new PipelineGateError(failureMessage, this.stages[idx].name, output);
      }
      return pass;
    });
    return next;
  }

  async execute(input: TFirst): Promise<PipelineResult<TLast>> {
    const stageResults: Array<{ name: string; latencyMs: number; success: boolean }> = [];
    let current: unknown = input;
    const pipelineStart = performance.now();

    for (let i = 0; i < this.stages.length; i++) {
      const stage = this.stages[i];
      const stageStart = performance.now();

      try {
        current = await stage.execute(current);

        stageResults.push({
          name: stage.name,
          latencyMs: Math.round(performance.now() - stageStart),
          success: true,
        });

        const gateCheck = this.gateChecks.get(i);
        if (gateCheck && !gateCheck(current)) {
          stageResults.push({
            name: `${stage.name}:gate`,
            latencyMs: 0,
            success: false,
          });
          break;
        }
      } catch (err) {
        stageResults.push({
          name: stage.name,
          latencyMs: Math.round(performance.now() - stageStart),
          success: false,
        });
        throw err;
      }
    }

    return {
      output: current as TLast,
      stages: stageResults,
      totalLatencyMs: Math.round(performance.now() - pipelineStart),
    };
  }
}

export class PipelineGateError extends Error {
  constructor(
    message: string,
    public readonly stageName: string,
    public readonly stageOutput: unknown,
  ) {
    super(message);
    this.name = "PipelineGateError";
  }
}

export function parallel<TIn, TOut>(
  stages: Array<{ name: string; execute: StageFunction<TIn, TOut> }>
): StageFunction<TIn, TOut[]> {
  return async (input: TIn) => {
    return Promise.all(stages.map((s) => s.execute(input)));
  };
}

export function conditional<TIn, TOut>(
  condition: (input: TIn) => boolean,
  ifTrue: StageFunction<TIn, TOut>,
  ifFalse: StageFunction<TIn, TOut>
): StageFunction<TIn, TOut> {
  return async (input: TIn) => {
    if (condition(input)) {
      return ifTrue(input);
    }
    return ifFalse(input);
  };
}
