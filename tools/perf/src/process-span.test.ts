import { assert, it } from "@effect/vitest";
import { beginProcessSpan, endProcessSpan } from "./process-span.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { mkdtemp, rm } from "node:fs/promises";
import { Effect } from "effect";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";

const ROOT_TRACEPARENT = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01";
const PID = 11;

async function begin(directory: string): ReturnType<typeof beginProcessSpan> {
  return beginProcessSpan({ directory, inherited: ROOT_TRACEPARENT, pid: PID, ppid: PID - 1 });
}

it.effect("leaves a process untraced once its run has ended", () =>
  Effect.gen(function* program() {
    const directory = path.join(tmpdir(), "perf-span-test-ended");
    assert.isUndefined(yield* Effect.promise(async () => begin(directory)));
  }),
);

it.effect("keeps the exit code of a process that outlives its run", () =>
  Effect.gen(function* program() {
    const directory = yield* Effect.promise(async () =>
      mkdtemp(path.join(tmpdir(), "perf-span-test-")),
    );
    const span = yield* Effect.promise(async () => begin(directory));
    assert.isDefined(span);
    yield* Effect.promise(async () => rm(directory, { force: true, recursive: true }));
    assert.doesNotThrow(() => {
      endProcessSpan(span, {
        argv: [],
        cpuSystemMilliseconds: 0,
        cpuUserMilliseconds: 0,
        cwd: directory,
        endMilliseconds: 1,
        exitCode: 0,
        maxRssKilobytes: 0,
        startMilliseconds: 0,
      });
    });
  }),
);
