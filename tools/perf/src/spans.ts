import type { Attributes, ProcessRecord } from "./protocol.ts";
import type { Task } from "./summary.ts";
import { taskAttributes } from "./summary.ts";

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
  readonly summary: {
    readonly state: "absent" | "read" | "unreadable";
    readonly tasks: readonly Task[];
  };
  readonly traceId: string;
  readonly unreadableProcesses: number;
}

type Executables = ReadonlyMap<string, string>;

interface SpanContext {
  readonly executables: Executables;
  readonly run: RootRun;
}

const microsecondsPerMillisecond = 1000;
const nanosecondsPerMicrosecond = 1000n;
const spanKindInternal = 1;
const statusUnset = 0;
const statusError = 2;
const packageMarker = "/node_modules/";
const FIRST_ARGUMENT_INDEX = 2;
const scopeName = "@template/perf";

function relative(root: string, target: string): string {
  if (target === root) {
    return "";
  }
  return target.startsWith(`${root}/`) ? target.slice(root.length + 1) : target;
}

function packageName(script: string): string | undefined {
  const packageIndex = script.lastIndexOf(packageMarker);
  if (packageIndex === -1) {
    return undefined;
  }
  const [first = "", second = ""] = script.slice(packageIndex + packageMarker.length).split("/");
  return first.startsWith("@") ? `${first}/${second}` : first;
}

function executable(argv: readonly string[], context: SpanContext): readonly string[] {
  const [, script] = argv;
  if (script === undefined) {
    return ["node"];
  }
  const name = context.executables.get(script) ?? packageName(script);
  return name === undefined ? ["node", relative(context.run.root, script)] : [name];
}

function commandLine(argv: readonly string[], context: SpanContext): string {
  return [...executable(argv, context), ...argv.slice(FIRST_ARGUMENT_INDEX)].join(" ");
}

function spanName(argv: readonly string[], context: SpanContext): string {
  const [name = "node", ...rest] = executable(argv, context);
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

function taskForProcess(record: ProcessRecord, context: SpanContext): Task | undefined {
  const line = commandLine(record.argv, context);
  const cwd = relative(context.run.root, record.cwd);
  return context.run.summary.tasks.find((task) => task.cwd === cwd && task.command === line);
}

function processSpan(record: ProcessRecord, context: SpanContext): OtlpSpan {
  const { run } = context;
  const task = taskForProcess(record, context);
  return {
    attributes: keyValues({
      "perf.parent_source": record.parentSource,
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
    name: spanName(record.argv, context),
    parentSpanId: record.parentSpanId,
    spanId: record.spanId,
    startTimeUnixNano: nanoseconds(record.startMilliseconds),
    status: { code: record.exitCode === 0 ? statusUnset : statusError },
    traceId: record.traceId,
  };
}

function orphanedProcesses(run: RootRun, records: readonly ProcessRecord[]): number {
  const spanIds = new Set([run.spanId, ...records.map((record) => record.spanId)]);
  return records.filter((record) => !spanIds.has(record.parentSpanId)).length;
}

function rootSpan(run: RootRun, records: readonly ProcessRecord[]): OtlpSpan {
  const end = nanoseconds(run.endMilliseconds);
  return {
    attributes: keyValues({
      "perf.process.orphaned": orphanedProcesses(run, records),
      "perf.process.unreadable": run.unreadableProcesses,
      "perf.summary": run.summary.state,
      "process.command_args": run.argv,
      "process.exit.code": run.exitCode,
      "process.working_directory": relative(run.root, run.cwd),
    }),
    endTimeUnixNano: end,
    events: run.summary.tasks.map((task) => ({
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
  executables: Executables,
): OtlpTraces {
  const context: SpanContext = { executables, run };
  return {
    resourceSpans: [
      {
        resource: { attributes: keyValues(run.resource) },
        scopeSpans: [
          {
            scope: { name: scopeName },
            spans: [
              rootSpan(run, records),
              ...records.map((record) => processSpan(record, context)),
            ],
          },
        ],
      },
    ],
  };
}

export { traces };
export type { Executables, RootRun };
