import { assert, it } from "@effect/vitest";
import { beginProcessSpan, endProcessSpan } from "./process-span.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { Effect } from "effect";
import type { Scope } from "effect";
import { contextFileName } from "./protocol.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";

type OpenProcessSpan = Awaited<ReturnType<typeof beginProcessSpan>>;
type ProcessMeasurement = Parameters<typeof endProcessSpan>[1];

const TRACE_ID = "0af7651916cd43dd8448eb211c80319c";
const ROOT_SPAN_ID = "b7ad6b7169203331";
const ROOT_TRACEPARENT = `00-${TRACE_ID}-${ROOT_SPAN_ID}-01`;
const RUNNER_PID = 10;
const CHILD_PID = 11;
const GRANDCHILD_PID = 12;
const FAILED_EXIT = 3;

const runDirectory: Effect.Effect<string, never, Scope.Scope> = Effect.acquireRelease(
  Effect.promise(async () => mkdtemp(path.join(tmpdir(), "perf-span-test-"))),
  (directory) => Effect.promise(async () => rm(directory, { force: true, recursive: true })),
);

function begin(directory: string, pid: number, inherited?: string): Effect.Effect<OpenProcessSpan> {
  return Effect.promise(async () => beginProcessSpan({ directory, inherited, pid, ppid: pid - 1 }));
}

function text(file: string): Effect.Effect<string> {
  return Effect.promise(async () => readFile(file, "utf-8"));
}

function measurement(exitCode: number): ProcessMeasurement {
  return {
    argv: ["/bin/node", "script.ts"],
    cpuSystemMilliseconds: 1,
    cpuUserMilliseconds: 2,
    cwd: "/work",
    endMilliseconds: 2,
    exitCode,
    maxRssKilobytes: 3,
    startMilliseconds: 1,
  };
}

it.effect("links each process to the process that spawned it", () =>
  Effect.gen(function* program() {
    const directory = yield* runDirectory;
    yield* Effect.promise(async () =>
      writeFile(path.join(directory, contextFileName(RUNNER_PID)), ROOT_TRACEPARENT),
    );
    const child = yield* begin(directory, CHILD_PID);
    const grandchild = yield* begin(directory, GRANDCHILD_PID);
    assert.strictEqual(child?.parent.spanId, ROOT_SPAN_ID);
    assert.strictEqual(grandchild?.parent.spanId, child?.spanId);
    assert.strictEqual(grandchild?.parent.traceId, TRACE_ID);
    const childContext = path.join(directory, contextFileName(CHILD_PID));
    assert.strictEqual(yield* text(childContext), child?.traceparent);
  }),
);

it.effect("falls back to the inherited context when the parent process is not traced", () =>
  Effect.gen(function* program() {
    const directory = yield* runDirectory;
    const span = yield* begin(directory, CHILD_PID, ROOT_TRACEPARENT);
    assert.deepStrictEqual(span?.parent, { spanId: ROOT_SPAN_ID, traceId: TRACE_ID });
  }),
);

it.effect("stays silent without a trace context", () =>
  Effect.gen(function* program() {
    const directory = yield* runDirectory;
    assert.isUndefined(yield* begin(directory, CHILD_PID, "not-a-traceparent"));
    assert.deepStrictEqual(yield* Effect.promise(async () => readdir(directory)), []);
  }),
);

it.effect("writes the finished process as a record of its span", () =>
  Effect.gen(function* program() {
    const directory = yield* runDirectory;
    const span = yield* begin(directory, CHILD_PID, ROOT_TRACEPARENT);
    assert.isDefined(span);
    endProcessSpan(span, measurement(FAILED_EXIT));
    const names = yield* Effect.promise(async () => readdir(directory));
    const recordName = names.find((name) => name.startsWith(span.spanId));
    const recordFile = path.join(directory, String(recordName));
    const record: unknown = JSON.parse(yield* text(recordFile));
    assert.deepStrictEqual(record, {
      ...measurement(FAILED_EXIT),
      parentSpanId: ROOT_SPAN_ID,
      pid: CHILD_PID,
      ppid: CHILD_PID - 1,
      spanId: span.spanId,
      traceId: TRACE_ID,
    });
  }),
);
