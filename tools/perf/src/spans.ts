import { Option, Schema } from "effect";
import type { ProcessRecord } from "./protocol.ts";

type AttributeValue = boolean | number | string | readonly string[];
type Attributes = Readonly<Record<string, AttributeValue | undefined>>;

interface OtlpKeyValue {
  readonly key: string;
  readonly value:
    | { readonly arrayValue: { readonly values: readonly { readonly stringValue: string }[] } }
    | { readonly boolValue: boolean }
    | { readonly doubleValue: number }
    | { readonly stringValue: string };
}
interface OtlpEvent {
  readonly attributes: readonly OtlpKeyValue[];
  readonly name: string;
  readonly timeUnixNano: string;
}
interface OtlpSpan {
  readonly attributes: readonly OtlpKeyValue[];
  readonly endTimeUnixNano: string;
  readonly events: readonly OtlpEvent[];
  readonly kind: number;
  readonly name: string;
  readonly parentSpanId: string;
  readonly spanId: string;
  readonly startTimeUnixNano: string;
  readonly status: { readonly code: number };
  readonly traceId: string;
}
interface OtlpTraces {
  readonly resourceSpans: readonly {
    readonly resource: { readonly attributes: readonly OtlpKeyValue[] };
    readonly scopeSpans: readonly {
      readonly scope: { readonly name: string };
      readonly spans: readonly OtlpSpan[];
    }[];
  }[];
}

interface RootRun {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly endMilliseconds: number;
  readonly exitCode: number;
  readonly resource: Attributes;
  readonly root: string;
  readonly spanId: string;
  readonly startMilliseconds: number;
  readonly traceId: string;
}

const CacheMiss = Schema.Struct({ Miss: Schema.Unknown });
const SpawnedCacheStatus = Schema.Union([Schema.Literal("Disabled"), CacheMiss]);
const SpawnedResult = Schema.Struct({
  Spawned: Schema.Struct({ cache_status: SpawnedCacheStatus, outcome: Schema.Unknown }),
});
const CacheHitResult = Schema.Struct({
  CacheHit: Schema.Struct({ saved_duration_ms: Schema.Number }),
});
const TaskSummary = Schema.Struct({
  command: Schema.String,
  cwd: Schema.String,
  package_name: Schema.String,
  result: Schema.Unknown,
  task_name: Schema.String,
});
const RunSummary = Schema.Struct({ tasks: Schema.Array(TaskSummary) });
type Task = typeof TaskSummary.Type;

const ModifiedPath = Schema.NullOr(Schema.String);
const SuccessDetails = Schema.Struct({
  infra_error: Schema.optionalKey(Schema.Unknown),
  input_modified_path: Schema.optionalKey(ModifiedPath),
  tool_disabled_cache: Schema.optionalKey(Schema.Boolean),
  tracking_incomplete: Schema.optionalKey(Schema.Boolean),
});
const SuccessOutcome = Schema.Struct({ Success: SuccessDetails });

const microsecondsPerMillisecond = 1000;
const nanosecondsPerMicrosecond = 1000n;
const spanKindInternal = 1;
const statusUnset = 0;
const statusError = 2;
const packageMarker = "/node_modules/";
const FIRST_ARGUMENT_INDEX = 2;
const scopeName = "@template/perf";

function variantName(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return typeof value === "object" && value !== null ? (Object.keys(value)[0] ?? "") : "";
}

function skippedReason(details: typeof SuccessDetails.Type): string | undefined {
  const modified = details.input_modified_path;
  const infraError = details.infra_error;
  return [
    typeof modified === "string" ? `input_modified:${modified}` : undefined,
    details.tool_disabled_cache === true ? "tool_disabled_cache" : undefined,
    details.tracking_incomplete === true ? "tracking_incomplete" : undefined,
    infraError === undefined || infraError === null
      ? undefined
      : `infra_error:${variantName(infraError)}`,
  ].find((reason) => reason !== undefined);
}

function cacheUpdateSkipped(outcome: unknown): string | undefined {
  return Option.getOrUndefined(
    Option.map(Schema.decodeUnknownOption(SuccessOutcome)(outcome), ({ Success }) =>
      skippedReason(Success),
    ),
  );
}

function taskAttributes(task: Task): Attributes {
  const identity = {
    "vp.task": `${task.package_name}#${task.task_name}`,
    "vp.task.command": task.command,
    "vp.task.cwd": task.cwd,
  };
  const hit = Schema.decodeUnknownOption(CacheHitResult)(task.result);
  if (Option.isSome(hit)) {
    return {
      ...identity,
      "vp.task.cache": "hit",
      "vp.task.cache.saved_ms": hit.value.CacheHit.saved_duration_ms,
    };
  }
  const spawned = Schema.decodeUnknownOption(SpawnedResult)(task.result);
  if (Option.isNone(spawned)) {
    return { ...identity, "vp.task.cache": variantName(task.result) };
  }
  const { cache_status: status, outcome } = spawned.value.Spawned;
  return {
    ...identity,
    "vp.task.cache": status === "Disabled" ? "disabled" : "miss",
    "vp.task.cache.miss_reason": status === "Disabled" ? undefined : variantName(status.Miss),
    "vp.task.cache.update_skipped": cacheUpdateSkipped(outcome),
    "vp.task.outcome": variantName(outcome),
  };
}

function decodeSummary(json: unknown): readonly Task[] {
  return Option.match(Schema.decodeUnknownOption(RunSummary)(json), {
    onNone: () => [],
    onSome: (summary) => summary.tasks,
  });
}

function relative(root: string, target: string): string {
  if (target === root) {
    return "";
  }
  return target.startsWith(`${root}/`) ? target.slice(root.length + 1) : target;
}

function executable(argv: readonly string[], root: string): readonly string[] {
  const [, script] = argv;
  if (script === undefined) {
    return ["node"];
  }
  const packageIndex = script.lastIndexOf(packageMarker);
  if (packageIndex === -1) {
    return ["node", relative(root, script)];
  }
  const [first = "", second = ""] = script.slice(packageIndex + packageMarker.length).split("/");
  const name = first.startsWith("@") ? `${first}/${second}` : first;
  return [name === "vite-plus" ? "vp" : name];
}

function commandLine(argv: readonly string[], root: string): string {
  return [...executable(argv, root), ...argv.slice(FIRST_ARGUMENT_INDEX)].join(" ");
}

function spanName(argv: readonly string[], root: string): string {
  const [name = "node", ...rest] = executable(argv, root);
  if (name === "vp") {
    return ["vp", argv[FIRST_ARGUMENT_INDEX] ?? ""].join(" ").trim();
  }
  return name === "node" ? (rest[0] ?? name) : name;
}

function nanoseconds(milliseconds: number): string {
  return (
    BigInt(Math.round(milliseconds * microsecondsPerMillisecond)) * nanosecondsPerMicrosecond
  ).toString();
}

function keyValues(attributes: Attributes): readonly OtlpKeyValue[] {
  return Object.entries(attributes).flatMap(([key, value]): readonly OtlpKeyValue[] => {
    if (value === undefined) {
      return [];
    }
    if (typeof value === "string") {
      return [{ key, value: { stringValue: value } }];
    }
    if (typeof value === "number") {
      return [{ key, value: { doubleValue: value } }];
    }
    if (typeof value === "boolean") {
      return [{ key, value: { boolValue: value } }];
    }
    return [
      { key, value: { arrayValue: { values: value.map((item) => ({ stringValue: item })) } } },
    ];
  });
}

function taskForProcess(
  record: ProcessRecord,
  run: RootRun,
  tasks: readonly Task[],
): Task | undefined {
  const line = commandLine(record.argv, run.root);
  const cwd = relative(run.root, record.cwd);
  return tasks.find((task) => task.cwd === cwd && task.command === line);
}

function processSpan(record: ProcessRecord, run: RootRun, tasks: readonly Task[]): OtlpSpan {
  const task = taskForProcess(record, run, tasks);
  return {
    attributes: keyValues({
      "process.command_args": record.argv.map((argument) => relative(run.root, argument)),
      "process.cpu.system_ms": record.cpuSystemMilliseconds,
      "process.cpu.user_ms": record.cpuUserMilliseconds,
      "process.exit.code": record.exitCode,
      "process.memory.max_rss_kb": record.maxRssKilobytes,
      "process.parent_pid": record.ppid,
      "process.pid": record.pid,
      "process.working_directory": relative(run.root, record.cwd),
      ...(task === undefined ? {} : taskAttributes(task)),
    }),
    endTimeUnixNano: nanoseconds(record.endMilliseconds),
    events: [],
    kind: spanKindInternal,
    name: spanName(record.argv, run.root),
    parentSpanId: record.parentSpanId,
    spanId: record.spanId,
    startTimeUnixNano: nanoseconds(record.startMilliseconds),
    status: { code: record.exitCode === 0 ? statusUnset : statusError },
    traceId: record.traceId,
  };
}

function rootSpan(run: RootRun, tasks: readonly Task[]): OtlpSpan {
  const end = nanoseconds(run.endMilliseconds);
  return {
    attributes: keyValues({
      "process.command_args": run.argv,
      "process.exit.code": run.exitCode,
      "process.working_directory": relative(run.root, run.cwd),
    }),
    endTimeUnixNano: end,
    events: tasks.map((task) => ({
      attributes: keyValues(taskAttributes(task)),
      name: "vp.task",
      timeUnixNano: end,
    })),
    kind: spanKindInternal,
    name: run.argv.join(" "),
    parentSpanId: "",
    spanId: run.spanId,
    startTimeUnixNano: nanoseconds(run.startMilliseconds),
    status: { code: run.exitCode === 0 ? statusUnset : statusError },
    traceId: run.traceId,
  };
}

function traces(
  run: RootRun,
  records: readonly ProcessRecord[],
  summary: readonly Task[],
): OtlpTraces {
  return {
    resourceSpans: [
      {
        resource: { attributes: keyValues(run.resource) },
        scopeSpans: [
          {
            scope: { name: scopeName },
            spans: [
              rootSpan(run, summary),
              ...records.map((record) => processSpan(record, run, summary)),
            ],
          },
        ],
      },
    ],
  };
}

export { decodeSummary, traces };
export type { Attributes, RootRun };
