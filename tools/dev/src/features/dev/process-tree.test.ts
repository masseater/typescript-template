import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { describe, expect, it } from "vite-plus/test";

import { layer } from "./platform.ts";
import { descendantPids, killQuietly, processRows } from "./process-tree.ts";

const idleScript = "setInterval(() => undefined, 1000);";

describe("reading the process table", () => {
  it("pairs each process with its parent and skips rows that are not processes", () => {
    expect(processRows("  PID  PPID\n  12     1\n  30    12\n   0     0\nnoise\n")).toStrictEqual([
      [1, 12],
      [12, 30],
    ]);
  });
});

describe("walking the descendants of a process", () => {
  it("collects children and grandchildren but not siblings of the root", () => {
    expect(
      descendantPids(10, [
        [1, 10],
        [10, 11],
        [10, 12],
        [11, 13],
        [1, 20],
        [20, 21],
      ]).toSorted((left, right) => left - right),
    ).toStrictEqual([11, 12, 13]);
  });

  it("visits a process listed twice only once", () => {
    expect(
      descendantPids(1, [
        [1, 2],
        [2, 3],
        [1, 3],
      ]).toSorted((left, right) => left - right),
    ).toStrictEqual([2, 3]);
  });

  it("finds nothing under a process without children", () => {
    expect(descendantPids(5, [[1, 5]])).toStrictEqual([]);
  });
});

describe("killing a process quietly", () => {
  it("stops a running process and ignores it once it is gone", () =>
    Effect.runPromise(
      Effect.gen(function* program() {
        expect.hasAssertions();
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const handle = yield* spawner.spawn(
          ChildProcess.make(process.execPath, ["-e", idleScript], {
            stderr: "ignore",
            stdin: "ignore",
            stdout: "ignore",
          }),
        );
        killQuietly(handle.pid);
        yield* handle.exitCode.pipe(Effect.ignore);
        expect(yield* handle.isRunning).toBe(false);
        expect(() => {
          killQuietly(handle.pid);
        }).not.toThrow();
      }).pipe(Effect.scoped, Effect.provide(layer)),
    ));

  it("rethrows a refusal other than a missing process", () => {
    expect(() => {
      killQuietly(Number.NaN);
    }).toThrow(TypeError);
  });
});
