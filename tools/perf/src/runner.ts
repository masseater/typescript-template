import { Console, Effect, Option, Schema } from "effect";
import { collectRun, root } from "./collect.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { constants, hostname, tmpdir } from "node:os";
import { contextFileName, newSpanId, newTraceId, traceparent } from "./protocol.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { execFile, spawn } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import type { RootRun } from "./spans.ts";
import { instrumentationBundles } from "./bundle.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { pathToFileURL } from "node:url";
import { traces } from "./spans.ts";

class TraceFailure extends Schema.TaggedError<TraceFailure>()("TraceFailure", {
  reason: Schema.Literals(["command_missing", "spawn_failed"]),
}) {}

interface TraceSettings {
  readonly endpoint: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
}

interface TracedRun {
  readonly bundles: Awaited<ReturnType<typeof instrumentationBundles>>;
  readonly directory: string;
  readonly settings: TraceSettings;
  readonly spanId: string;
  readonly traceId: string;
}

const SIGNAL_EXIT_BASE = 128;
const RECEIVER_PROBE_MILLISECONDS = 1000;
const EXPORT_TIMEOUT_MILLISECONDS = 10_000;
const forwardedSignals: readonly NodeJS.Signals[] = ["SIGTERM", "SIGHUP"];

function report(event: Readonly<Record<string, unknown>>): Effect.Effect<void> {
  return Console.error(JSON.stringify(event));
}

function post(endpoint: string, body: string, timeout: number): Effect.Effect<string | undefined> {
  return Effect.tryPromise(async () =>
    fetch(`${endpoint}/v1/traces`, {
      body,
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(timeout),
    }),
  ).pipe(
    Effect.map((response) => (response.ok ? undefined : `status_${String(response.status)}`)),
    Effect.orElseSucceed(() => "unreachable"),
  );
}

function git(args: readonly string[]): Effect.Effect<string | undefined> {
  return Effect.callback<string | undefined>((resume) => {
    execFile("git", [...args], { cwd: root }, (failure, stdout) => {
      resume(Effect.succeed(failure === null ? stdout.trim() : undefined));
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
  return {
    "host.name": hostname(),
    "service.name": "vp",
    "vcs.ref.head.name": branch,
    "vcs.ref.head.revision": revision,
    "vcs.worktree.dirty": status === undefined ? undefined : status !== "",
  };
});

function signalExitCode(signal: NodeJS.Signals | null): number {
  return SIGNAL_EXIT_BASE + (signal === null ? 0 : constants.signals[signal]);
}

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
    for (const signal of forwardedSignals) {
      process.on(signal, forward);
    }
    child.once("error", () => {
      resume(Effect.fail(new TraceFailure({ reason: "spawn_failed" })));
    });
    child.once("exit", (code, signal) => {
      for (const forwarded of forwardedSignals) {
        process.off(forwarded, forward);
      }
      resume(Effect.succeed(code ?? signalExitCode(signal)));
    });
  });
}

const runDirectory = Effect.acquireRelease(
  Effect.promise(async () => mkdtemp(path.join(tmpdir(), "vp-otel-"))),
  (directory) => Effect.promise(async () => rm(directory, { force: true, recursive: true })),
);

function instrumentedEnvironment(run: TracedRun): TraceSettings["environment"] {
  const hook = pathToFileURL(run.bundles.hook);
  hook.searchParams.set("run", run.directory);
  hook.searchParams.set("endpoint", run.settings.endpoint);
  hook.searchParams.set("workerd", run.bundles.workerdSdk);
  const { environment } = run.settings;
  return {
    ...environment,
    NODE_OPTIONS: [environment["NODE_OPTIONS"], `--import=${hook.href}`].filter(Boolean).join(" "),
    TRACEPARENT: traceparent(run.traceId, run.spanId),
  };
}

const exportRun = Effect.fn("exportRun")(function* exportRun(
  run: TracedRun,
  measured: Omit<RootRun, "summary" | "unreadableProcesses">,
) {
  const collected = yield* collectRun(run.directory, measured.startMilliseconds);
  const body = traces({ ...measured, ...collected }, collected.records, collected.executables);
  const failure = yield* post(
    run.settings.endpoint,
    JSON.stringify(body),
    EXPORT_TIMEOUT_MILLISECONDS,
  );
  yield* report({
    event: failure === undefined ? "perf.trace_exported" : "perf.trace_export_failed",
    ok:
      failure === undefined &&
      collected.unreadableProcesses === 0 &&
      collected.summary.state !== "unreadable",
    processes: collected.records.length,
    reason: failure,
    summary: collected.summary.state,
    traceId: run.traceId,
    unreadableProcesses: collected.unreadableProcesses,
  });
});

const openRun = Effect.fn("openRun")(function* openRun(
  settings: TraceSettings,
  bundles: TracedRun["bundles"],
) {
  const directory = yield* runDirectory;
  const run: TracedRun = {
    bundles,
    directory,
    settings,
    spanId: newSpanId(),
    traceId: newTraceId(),
  };
  yield* Effect.promise(async () =>
    writeFile(
      path.join(directory, contextFileName(process.pid)),
      traceparent(run.traceId, run.spanId),
    ),
  );
  return run;
});

const traced = Effect.fn("traced")(function* traced(
  argv: readonly string[],
  settings: TraceSettings,
  bundles: TracedRun["bundles"],
) {
  const run = yield* openRun(settings, bundles);
  const attributes = yield* resource;
  const startMilliseconds = Date.now();
  const exitCode = yield* execute(argv, instrumentedEnvironment(run));
  yield* exportRun(run, {
    argv,
    cwd: process.cwd(),
    endMilliseconds: Date.now(),
    exitCode,
    resource: attributes,
    root,
    spanId: run.spanId,
    startMilliseconds,
    traceId: run.traceId,
  });
  return exitCode;
}, Effect.scoped);

const untraced = Effect.fn("untraced")(function* untraced(
  argv: readonly string[],
  settings: TraceSettings,
  reason: string,
) {
  yield* report({ endpoint: settings.endpoint, event: "perf.trace_skipped", ok: false, reason });
  return yield* execute(argv, settings.environment);
});

const traceCommand = Effect.fn("traceCommand")(function* traceCommand(
  argv: readonly string[],
  settings: TraceSettings,
) {
  const probe = yield* post(
    settings.endpoint,
    JSON.stringify({ resourceSpans: [] }),
    RECEIVER_PROBE_MILLISECONDS,
  );
  if (probe !== undefined) {
    return yield* untraced(argv, settings, `receiver_${probe}`);
  }
  const bundles = yield* Effect.tryPromise(async () =>
    instrumentationBundles(settings.endpoint),
  ).pipe(Effect.option);
  return yield* Option.match(bundles, {
    onNone: () => untraced(argv, settings, "instrumentation_unbuildable"),
    onSome: (built) => traced(argv, settings, built),
  });
}, Effect.uninterruptible);

export { traceCommand };
