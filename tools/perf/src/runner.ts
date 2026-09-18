import type { Attributes, RootRun } from "./spans.ts";
import { Effect, Schema } from "effect";
import { contextFileName, processRecordSuffix, spanIdBytes, traceIdBytes } from "./protocol.ts";
import { decodeSummary, traces } from "./spans.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { execFile, spawn } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { hostname, tmpdir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import type { ProcessRecord } from "./protocol.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { randomBytes } from "node:crypto";

class TraceFailure extends Schema.TaggedError<TraceFailure>()("TraceFailure", {
  reason: Schema.Literals(["command_missing", "spawn_failed"]),
}) {}

interface TraceSettings {
  readonly endpoint: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
}

interface RunFiles {
  readonly directory: string;
  readonly spanId: string;
  readonly traceId: string;
  readonly traceparent: string;
}

const SIGNAL_EXIT_BASE = 128;
const RECEIVER_PROBE_MILLISECONDS = 1000;
const EXPORT_TIMEOUT_MILLISECONDS = 10_000;
const signalNumbers: Readonly<Record<string, number>> = { SIGINT: 2, SIGTERM: 15 };
const root = path.resolve(import.meta.dirname, "../../..");
const summaryDirectory = path.join(root, "node_modules/.vite/task-cache");
const ProcessRecordJson = Schema.fromJsonString(
  Schema.Struct({
    argv: Schema.Array(Schema.String),
    cpuSystemMilliseconds: Schema.Number,
    cpuUserMilliseconds: Schema.Number,
    cwd: Schema.String,
    endMilliseconds: Schema.Number,
    exitCode: Schema.Number,
    maxRssKilobytes: Schema.Number,
    parentSpanId: Schema.String,
    pid: Schema.Number,
    ppid: Schema.Number,
    spanId: Schema.String,
    startMilliseconds: Schema.Number,
    traceId: Schema.String,
  }),
);
const UnknownJson = Schema.fromJsonString(Schema.Unknown);

function report(event: Readonly<Record<string, unknown>>): Effect.Effect<void> {
  return Effect.sync(() => {
    process.stderr.write(`${JSON.stringify(event)}\n`);
  });
}

function post(endpoint: string, body: string, timeout: number): Effect.Effect<boolean> {
  return Effect.tryPromise(async () =>
    fetch(`${endpoint.replace(/\/$/u, "")}/v1/traces`, {
      body,
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(timeout),
    }),
  ).pipe(
    Effect.map((response) => response.ok),
    Effect.orElseSucceed(() => false),
  );
}

function git(args: readonly string[]): Effect.Effect<string> {
  return Effect.callback<string>((resume) => {
    execFile("git", [...args], { cwd: root }, (failure, stdout) => {
      resume(Effect.succeed(failure === null ? stdout.trim() : ""));
    });
  });
}

const resource = Effect.gen(function* resource() {
  const [branch, revision, status] = yield* Effect.all(
    [
      git(["branch", "--show-current"]),
      git(["rev-parse", "HEAD"]),
      git(["status", "--porcelain", "--untracked-files=no"]),
    ],
    { concurrency: "unbounded" },
  );
  const attributes: Attributes = {
    "host.name": hostname(),
    "service.name": "vp",
    "vcs.ref.head.name": branch,
    "vcs.ref.head.revision": revision,
    "vcs.worktree.dirty": status !== "",
  };
  return attributes;
});

function execute(
  argv: readonly string[],
  environment: TraceSettings["environment"],
): Effect.Effect<number, TraceFailure> {
  const [command, ...args] = argv;
  if (command === undefined) {
    return Effect.fail(new TraceFailure({ reason: "command_missing" }));
  }
  return Effect.callback<number, TraceFailure>((resume) => {
    const child = spawn(command, args, { env: environment, stdio: "inherit" });
    function forward(signal: NodeJS.Signals): void {
      child.kill(signal);
    }
    process.on("SIGINT", forward);
    process.on("SIGTERM", forward);
    child.once("error", () => {
      resume(Effect.fail(new TraceFailure({ reason: "spawn_failed" })));
    });
    child.once("exit", (code, signal) => {
      process.off("SIGINT", forward);
      process.off("SIGTERM", forward);
      resume(Effect.succeed(code ?? SIGNAL_EXIT_BASE + (signalNumbers[signal ?? ""] ?? 0)));
    });
  });
}

function readJson<Decoded>(
  schema: Schema.Codec<Decoded, string>,
  file: string,
): Effect.Effect<readonly Decoded[]> {
  return Effect.tryPromise(async () => readFile(file, "utf-8")).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(schema)),
    Effect.map((decoded) => [decoded]),
    Effect.orElseSucceed((): readonly Decoded[] => []),
  );
}

function processRecords(directory: string): Effect.Effect<readonly ProcessRecord[]> {
  return Effect.promise(async () => readdir(directory)).pipe(
    Effect.flatMap((names) =>
      Effect.all(
        names
          .filter((name) => name.endsWith(processRecordSuffix))
          .map((name) => readJson(ProcessRecordJson, path.join(directory, name))),
      ),
    ),
    Effect.map((records) => records.flat()),
  );
}

function modifiedAt(file: string): Effect.Effect<number> {
  return Effect.tryPromise(async () => stat(file)).pipe(
    Effect.map((stats) => stats.mtimeMs),
    Effect.orElseSucceed(() => 0),
  );
}

function runSummary(since: number): Effect.Effect<unknown> {
  return Effect.tryPromise(async () => readdir(summaryDirectory)).pipe(
    Effect.orElseSucceed((): readonly string[] => []),
    Effect.map((versions) =>
      versions.map((version) => path.join(summaryDirectory, version, "last-summary.json")),
    ),
    Effect.flatMap((files) =>
      Effect.forEach(files, (file) =>
        Effect.map(modifiedAt(file), (modified) => ({ file, modified })),
      ),
    ),
    Effect.map((candidates) =>
      candidates
        .filter((candidate) => candidate.modified >= since)
        .toSorted((left, right) => right.modified - left.modified),
    ),
    Effect.flatMap(([latest]) =>
      latest === undefined ? Effect.succeed([]) : readJson(UnknownJson, latest.file),
    ),
    Effect.map(([summary]) => summary),
  );
}

const prepareRun = Effect.gen(function* prepareRun() {
  const directory = yield* Effect.promise(async () => mkdtemp(path.join(tmpdir(), "vp-otel-")));
  const traceId = randomBytes(traceIdBytes).toString("hex");
  const spanId = randomBytes(spanIdBytes).toString("hex");
  const traceparent = `00-${traceId}-${spanId}-01`;
  yield* Effect.promise(async () =>
    writeFile(path.join(directory, contextFileName(process.pid)), traceparent),
  );
  const files: RunFiles = { directory, spanId, traceId, traceparent };
  return files;
});

function instrumentedEnvironment(
  files: RunFiles,
  settings: TraceSettings,
): TraceSettings["environment"] {
  const hook = new URL("hook.ts", import.meta.url);
  hook.searchParams.set("run", files.directory);
  hook.searchParams.set("endpoint", settings.endpoint);
  const nodeOptions = [settings.environment["NODE_OPTIONS"], `--import=${hook.href}`]
    .filter(Boolean)
    .join(" ");
  return { ...settings.environment, NODE_OPTIONS: nodeOptions, TRACEPARENT: files.traceparent };
}

const exportRun = Effect.fn("exportRun")(function* exportRun(
  run: RootRun,
  settings: TraceSettings,
  files: RunFiles,
) {
  const [records, summary] = yield* Effect.all([
    processRecords(files.directory),
    runSummary(run.startMilliseconds),
  ]);
  const body = JSON.stringify(traces(run, records, decodeSummary(summary)));
  const exported = yield* post(settings.endpoint, body, EXPORT_TIMEOUT_MILLISECONDS);
  yield* report(
    exported
      ? { event: "perf.trace_exported", ok: true, processes: records.length, traceId: run.traceId }
      : {
          endpoint: settings.endpoint,
          event: "perf.trace_export_failed",
          ok: false,
          traceId: run.traceId,
        },
  );
});

const traced = Effect.fn("traced")(function* traced(
  argv: readonly string[],
  settings: TraceSettings,
) {
  const files = yield* prepareRun;
  const attributes = yield* resource;
  const startMilliseconds = Date.now();
  const exitCode = yield* execute(argv, instrumentedEnvironment(files, settings));
  const run: RootRun = {
    argv,
    cwd: process.cwd(),
    endMilliseconds: Date.now(),
    exitCode,
    resource: attributes,
    root,
    spanId: files.spanId,
    startMilliseconds,
    traceId: files.traceId,
  };
  yield* exportRun(run, settings, files);
  yield* Effect.promise(async () => rm(files.directory, { force: true, recursive: true }));
  return exitCode;
});

const traceCommand = Effect.fn("traceCommand")(function* traceCommand(
  argv: readonly string[],
  settings: TraceSettings,
) {
  const probe = JSON.stringify({ resourceSpans: [] });
  if (yield* post(settings.endpoint, probe, RECEIVER_PROBE_MILLISECONDS)) {
    return yield* traced(argv, settings);
  }
  yield* report({
    endpoint: settings.endpoint,
    event: "perf.trace_skipped",
    ok: false,
    reason: "receiver_unreachable",
  });
  return yield* execute(argv, settings.environment);
});

export { traceCommand };
