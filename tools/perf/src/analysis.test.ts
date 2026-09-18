import { Effect, Schema } from "effect";
import { TempoTrace, measure, summarize } from "./analysis.ts";
import { assert, it } from "@effect/vitest";
import type { ProcessRecord } from "./protocol.ts";
import type { RunMeasurement } from "./analysis.ts";
import { traces } from "./spans.ts";

const ROOT = "/work/repo";
const TRACE_ID = "0af7651916cd43dd8448eb211c80319c";
const START = 1_700_000_000_000;
const RUN_MILLISECONDS = 20_000;
const VP_START = 100;
const VP_END = 19_900;
const FIRST_TASK_START = 13_100;
const FIRST_TASK_END = 15_100;
const SECOND_TASK_START = 14_100;
const SECOND_TASK_END = 17_100;
const VP_WINDOW = [VP_START, VP_END] as const;
const FIRST_TASK = [FIRST_TASK_START, FIRST_TASK_END] as const;
const SECOND_TASK = [SECOND_TASK_START, SECOND_TASK_END] as const;
const SECOND = 1000;
const RUN_COUNT = 3;
const REPEATS = Array.from({ length: RUN_COUNT }, (_value, index) => index + 1);
const VP = [`${ROOT}/node_modules/vite-plus/bin/vp`, "run", "check"];
const KNIP = [`${ROOT}/node_modules/knip/bin/knip.js`];

interface Process {
  readonly argv: readonly string[];
  readonly parentSpanId: string;
  readonly spanId: string;
  readonly window: readonly [number, number];
}

function processRecord({ argv, parentSpanId, spanId, window }: Process): ProcessRecord {
  return {
    argv: ["/bin/node", ...argv],
    cpuSystemMilliseconds: 100,
    cpuUserMilliseconds: 400,
    cwd: ROOT,
    endMilliseconds: START + window[1],
    exitCode: 0,
    maxRssKilobytes: 1,
    parentSpanId,
    pid: 1,
    ppid: 1,
    spanId,
    startMilliseconds: START + window[0],
    traceId: TRACE_ID,
  };
}

function tempoTrace(
  revision: string,
  processes: readonly Process[],
): Effect.Effect<typeof TempoTrace.Type, Schema.SchemaError> {
  const exported = traces(
    {
      argv: ["vp", "run", "check"],
      cwd: ROOT,
      endMilliseconds: START + RUN_MILLISECONDS,
      exitCode: 0,
      resource: {
        "service.name": "vp",
        "vcs.ref.head.revision": revision,
        "vcs.worktree.dirty": true,
      },
      root: ROOT,
      spanId: "aaaaaaaaaaaaaaaa",
      startMilliseconds: START,
      traceId: TRACE_ID,
    },
    processes.map((entry) => processRecord(entry)),
    [],
  );
  return Schema.decodeUnknownEffect(TempoTrace)({ trace: exported });
}

function measured(trace: typeof TempoTrace.Type): readonly RunMeasurement[] {
  const run = measure(TRACE_ID, trace);
  return run === undefined ? [] : [run];
}

it.effect("separates the time vp spends before and between its tasks", () =>
  Effect.gen(function* program() {
    const trace = yield* tempoTrace("f3bb7f4f776104b32bc9ae7ff3a566177bcfb597", [
      { argv: VP, parentSpanId: "aaaaaaaaaaaaaaaa", spanId: "bbbbbbbbbbbbbbbb", window: VP_WINDOW },
      {
        argv: KNIP,
        parentSpanId: "bbbbbbbbbbbbbbbb",
        spanId: "cccccccccccccccc",
        window: FIRST_TASK,
      },
      {
        argv: KNIP,
        parentSpanId: "bbbbbbbbbbbbbbbb",
        spanId: "dddddddddddddddd",
        window: SECOND_TASK,
      },
    ]);
    assert.deepStrictEqual(measured(trace), [
      {
        command: "vp run check",
        cpuMilliseconds: { "vp:knip": 1000, "vp:vp run": 500 },
        durationMilliseconds: RUN_MILLISECONDS,
        exitCode: 0,
        revision: "f3bb7f4f7761+dirty",
        selfMilliseconds: { "vp:vp run": 15_800 },
        startupMilliseconds: { "vp:vp run": 13_000 },
        traceId: TRACE_ID,
        wallMilliseconds: { "vp:knip": 5000, "vp:vp run": 19_800 },
      },
    ]);
  }),
);

it.effect("groups runs by command and revision into distributions", () =>
  Effect.gen(function* program() {
    const runs = yield* Effect.forEach(REPEATS, (seconds) =>
      tempoTrace("0123456789abcdef", [
        {
          argv: VP,
          parentSpanId: "aaaaaaaaaaaaaaaa",
          spanId: "bbbbbbbbbbbbbbbb",
          window: [0, seconds * SECOND],
        },
      ]),
    );
    assert.deepInclude(summarize(runs.flatMap((trace) => measured(trace)))[0], {
      command: "vp run check",
      revision: "0123456789ab+dirty",
      runs: REPEATS.length,
      spans: [
        {
          cpu: { max: 500, median: 500, min: 500, p95: 500 },
          name: "vp:vp run",
          self: undefined,
          startup: undefined,
          wall: { max: 3000, median: 2000, min: 1000, p95: 3000 },
        },
      ],
    });
  }),
);
