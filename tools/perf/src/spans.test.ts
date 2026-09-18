import { describe, expect, it } from "vite-plus/test";
import { Option } from "effect";
import type { ProcessRecord } from "./protocol.ts";
import type { RootRun } from "./spans.ts";
import { decodeSummary } from "./summary.ts";
import { traces } from "./spans.ts";

type ExportedSpan = ReturnType<
  typeof traces
>["resourceSpans"][number]["scopeSpans"][number]["spans"][number];

const ROOT = "/work/repo";
const TRACE_ID = "0af7651916cd43dd8448eb211c80319c";
const STATUS_ERROR = 2;
const tasks = Option.getOrThrow(
  decodeSummary(
    JSON.parse(`{
    "exit_code": 1,
    "tasks": [
      { "package_name": "repo", "task_name": "check", "command": "vp check", "cwd": "",
        "result": { "CacheHit": { "saved_duration_ms": 16198 } } },
      { "package_name": "repo", "task_name": "knip", "command": "knip --strict", "cwd": "",
        "result": { "Spawned": {
          "cache_status": { "Miss": { "InputChanged": { "kind": "ContentModified", "path": "knip.ts" } } },
          "outcome": { "Success": { "infra_error": null, "input_modified_path": "node_modules/.cache/knip", "tool_disabled_cache": false } }
        } } },
      { "package_name": "@repo/db", "task_name": "check", "command": "drizzle-kit check", "cwd": "libs/db",
        "result": { "Spawned": { "cache_status": "Disabled", "outcome": { "Failed": { "exit_code": 1 } } } } }
    ]
  }`),
  ),
);
const run: RootRun = {
  argv: ["vp", "run", "check"],
  cwd: ROOT,
  endMilliseconds: 1_700_000_010_000.5,
  exitCode: 1,
  resource: { "service.name": "vp", "vcs.worktree.dirty": false },
  root: ROOT,
  spanId: "b7ad6b7169203331",
  startMilliseconds: 1_700_000_000_000,
  summary: { state: "read", tasks },
  traceId: TRACE_ID,
  unreadableProcesses: 0,
};
const executables = new Map([
  [`${ROOT}/node_modules/vite-plus/bin/vp`, "vp"],
  [`${ROOT}/node_modules/.pnpm/knip@6/node_modules/knip/bin/knip.js`, "knip"],
  [`${ROOT}/libs/db/node_modules/drizzle-kit/bin.cjs`, "drizzle-kit"],
]);
const taskEvents = [
  {
    "vp.task": "repo#check",
    "vp.task.cache": "hit",
    "vp.task.cache.saved_ms": 16_198,
    "vp.task.command": "vp check",
    "vp.task.cwd": "",
  },
  {
    "vp.task": "repo#knip",
    "vp.task.cache": "miss",
    "vp.task.cache.miss_reason": "InputChanged",
    "vp.task.cache.update_skipped": "input_modified:node_modules/.cache/knip",
    "vp.task.command": "knip --strict",
    "vp.task.cwd": "",
    "vp.task.outcome": "Success",
  },
  {
    "vp.task": "@repo/db#check",
    "vp.task.cache": "disabled",
    "vp.task.command": "drizzle-kit check",
    "vp.task.cwd": "libs/db",
    "vp.task.outcome": "Failed",
  },
];

function processRecord(argv: readonly string[], overrides: Partial<ProcessRecord>): ProcessRecord {
  return {
    argv: ["/bin/node", ...argv],
    cpuSystemMilliseconds: 10,
    cpuUserMilliseconds: 20,
    cwd: ROOT,
    endMilliseconds: 1_700_000_002_000,
    exitCode: 0,
    maxRssKilobytes: 1024,
    parentSource: "process",
    parentSpanId: run.spanId,
    pid: 2,
    ppid: 1,
    spanId: "00f067aa0ba902b7",
    startMilliseconds: 1_700_000_001_000,
    traceId: TRACE_ID,
    ...overrides,
  };
}

const processes = [
  processRecord([`${ROOT}/node_modules/vite-plus/bin/vp`, "run", "check"], {}),
  processRecord([`${ROOT}/node_modules/.pnpm/knip@6/node_modules/knip/bin/knip.js`, "--strict"], {
    spanId: "1111111111111111",
  }),
  processRecord([`${ROOT}/libs/db/node_modules/drizzle-kit/bin.cjs`, "check"], {
    cwd: `${ROOT}/libs/db`,
    exitCode: 1,
    spanId: "2222222222222222",
  }),
  processRecord([`${ROOT}/node_modules/@effect/tsgo/dist/cli.cjs`], { spanId: "3333333333333333" }),
  processRecord([`${ROOT}/tools/quality/check-staged.ts`], { spanId: "4444444444444444" }),
];

function exported(records: readonly ProcessRecord[]): readonly ExportedSpan[] {
  return traces(run, records, executables).resourceSpans[0]?.scopeSpans[0]?.spans ?? [];
}

function attributeValue(value: ExportedSpan["attributes"][number]["value"]): unknown {
  return "arrayValue" in value
    ? value.arrayValue.values.map((item) => item.stringValue)
    : Object.values(value)[0];
}

function attributeMap(attributes: ExportedSpan["attributes"]): Readonly<Record<string, unknown>> {
  return Object.fromEntries(attributes.map(({ key, value }) => [key, attributeValue(value)]));
}

describe("otlp spans", () => {
  it("records every task outcome from the run summary on the root span", () => {
    expect.hasAssertions();
    const [rootSpan] = exported([]);
    expect(rootSpan).toMatchObject({
      endTimeUnixNano: "1700000010000500000",
      name: "vp run check",
      parentSpanId: "",
      startTimeUnixNano: "1700000000000000000",
      status: { code: STATUS_ERROR },
    });
    expect(rootSpan?.events.map((event) => attributeMap(event.attributes))).toStrictEqual(
      taskEvents,
    );
  });

  it("names process spans after the command and ties them to their task", () => {
    expect.hasAssertions();
    const spans = exported(processes).slice(1);
    expect(
      spans.map((span) => [span.name, span.status.code, attributeMap(span.attributes)["vp.task"]]),
    ).toStrictEqual([
      ["vp run", 0, undefined],
      ["knip", 0, "repo#knip"],
      ["drizzle-kit", STATUS_ERROR, "@repo/db#check"],
      ["@effect/tsgo", 0, undefined],
      ["tools/quality/check-staged.ts", 0, undefined],
    ]);
    expect(spans.map((span) => attributeMap(span.attributes))[2]).toMatchObject({
      "process.command_args": ["/bin/node", "libs/db/node_modules/drizzle-kit/bin.cjs", "check"],
      "process.cpu.user_ms": 20,
      "process.working_directory": "libs/db",
    });
  });
});

describe("run completeness", () => {
  it("counts processes whose parent never reported", () => {
    expect.hasAssertions();
    const spans = exported([
      processRecord([`${ROOT}/tools/quality/check-staged.ts`], {
        parentSpanId: "9999999999999999",
      }),
    ]);
    expect(spans.map((span) => attributeMap(span.attributes))[0]).toMatchObject({
      "perf.process.orphaned": 1,
      "perf.process.unreadable": 0,
      "perf.summary": "read",
    });
  });

  it("rejects a summary it cannot read", () => {
    expect.hasAssertions();
    expect(Option.isNone(decodeSummary({ tasks: "none" }))).toBe(true);
  });
});
