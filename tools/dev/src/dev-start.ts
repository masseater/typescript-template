#!/usr/bin/env node
import { reportFailed, runCli } from "@repo/cli";
import {
  applicationReadyPaths,
  applications,
  loopbackAddress,
  waitUntilResponds,
} from "@repo/config";
import { localDatabaseVariable } from "@repo/config/local-database-path";
import { repositoryRoot } from "@repo/config/repository-root";
import { Cause, Console, Effect, FileSystem, Path, Result, Schema } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { createServer } from "vite-plus";

import { layer } from "./platform.ts";

class DevStartFailure extends Schema.TaggedError<DevStartFailure>()("DevStartFailure", {
  reason: Schema.String,
}) {}

const Application = Schema.Literals(applications);
const successStatus = 200;
const requestTimeoutMilliseconds = 120_000;
const startTimeout = "5 minutes";
const closeTimeoutMilliseconds = 30_000;
const databasePrefix = "template-check-dev-";

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function workspaceName(): string {
  const cwd = process.cwd();
  const separator = cwd.lastIndexOf("/");
  return separator === -1 ? cwd : cwd.slice(separator + 1);
}

function migrateDatabase(
  vp: string,
): Effect.Effect<void, DevStartFailure, ChildProcessSpawner.ChildProcessSpawner> {
  return Effect.gen(function* migrate() {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const handle = yield* spawner
      .spawn(
        ChildProcess.make(vp, ["run", "--filter", "@repo/db-local", "db:migrate:local"], {
          cwd: repositoryRoot,
          extendEnv: true,
          stderr: "inherit",
          stdin: "ignore",
          stdout: "inherit",
        }),
      )
      .pipe(
        Effect.mapError(
          (error) =>
            new DevStartFailure({
              reason: `failed to prepare database: ${describe(error)}`,
            }),
        ),
      );
    const exitCode = yield* handle.exitCode.pipe(
      Effect.mapError(
        (error) =>
          new DevStartFailure({
            reason: `failed to prepare database: ${describe(error)}`,
          }),
      ),
    );
    if (exitCode !== 0) {
      return yield* Effect.fail(
        new DevStartFailure({ reason: "failed to prepare database: migration failed" }),
      );
    }
  }).pipe(Effect.scoped);
}

const isolatedDatabase = Effect.acquireRelease(
  Effect.gen(function* prepareDatabase() {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const directory = yield* fs.makeTempDirectory({ prefix: databasePrefix }).pipe(
      Effect.mapError(
        (error) =>
          new DevStartFailure({
            reason: `failed to prepare database: ${describe(error)}`,
          }),
      ),
    );
    // oxlint-disable-next-line node/no-process-env -- this statement reads or writes process.env at the Node process boundary
    process.env[localDatabaseVariable] = directory;
    yield* migrateDatabase(path.join(repositoryRoot, "node_modules/.bin/vp"));
    return directory;
  }),
  (directory) =>
    Effect.gen(function* cleanupDatabase() {
      // oxlint-disable-next-line node/no-process-env -- this statement reads or writes process.env at the Node process boundary
      delete process.env[localDatabaseVariable];
      const fs = yield* FileSystem.FileSystem;
      yield* fs.remove(directory, { force: true, recursive: true }).pipe(Effect.ignore);
    }),
);

const devServer = Effect.acquireRelease(
  Effect.tryPromise({
    catch: (error) => new DevStartFailure({ reason: `failed to start: ${describe(error)}` }),
    try: async () =>
      createServer({
        logLevel: "silent",
        server: { host: loopbackAddress, port: 0, strictPort: false },
      }),
  }),
  (server) =>
    stopDescendants.pipe(
      Effect.orDie,
      Effect.andThen(
        Effect.promise(async () => {
          let timer: ReturnType<typeof setTimeout> | undefined;
          await Promise.race([
            server.close().then(
              () => undefined,
              () => undefined,
            ),
            new Promise<void>((resolve) => {
              timer = setTimeout(resolve, closeTimeoutMilliseconds);
            }),
          ]);
          if (timer !== undefined) {
            clearTimeout(timer);
          }
        }),
      ),
    ),
);

const listeningOrigin = isolatedDatabase.pipe(
  Effect.flatMap(() => devServer),
  Effect.flatMap((server) =>
    Effect.tryPromise({
      catch: (error) => new DevStartFailure({ reason: `failed to listen: ${describe(error)}` }),
      try: async () => server.listen(),
    }),
  ),
  Effect.flatMap((server) => {
    const [origin] = server.resolvedUrls?.local ?? [];
    return origin === undefined
      ? Effect.fail(new DevStartFailure({ reason: "did not listen" }))
      : Effect.succeed(origin);
  }),
);

function probe(origin: string, pathname: string): Effect.Effect<number, DevStartFailure> {
  return waitUntilResponds({
    accept: (status) => status === successStatus,
    method: "GET",
    onStatus: (status) => new DevStartFailure({ reason: `${pathname} responded ${status}` }),
    onUnreachable: (error) =>
      new DevStartFailure({ reason: `${pathname} did not answer: ${describe(error)}` }),
    timeoutMilliseconds: requestTimeoutMilliseconds,
    url: new URL(pathname, origin).href,
  });
}

function processRows(table: string): ReadonlyArray<readonly [number, number]> {
  return table.split("\n").flatMap((row) => {
    const [pidText, parentText] = row.trim().split(/\s+/u);
    const pid = Number(pidText);
    const parent = Number(parentText);
    return Number.isInteger(pid) && Number.isInteger(parent) && pid > 0
      ? [[parent, pid] as const]
      : [];
  });
}

function descendantPids(root: number, rows: ReadonlyArray<readonly [number, number]>): number[] {
  const children = new Map<number, number[]>();
  for (const [parent, pid] of rows) {
    const list = children.get(parent);
    if (list === undefined) {
      children.set(parent, [pid]);
    } else {
      list.push(pid);
    }
  }
  const found: number[] = [];
  const pending = [...(children.get(root) ?? [])];
  const seen = new Set<number>();
  while (pending.length > 0) {
    const pid = pending.pop();
    if (pid === undefined || seen.has(pid)) {
      continue;
    }
    seen.add(pid);
    found.push(pid);
    pending.push(...(children.get(pid) ?? []));
  }
  return found;
}

function killQuietly(pid: number): void {
  try {
    process.kill(pid, "SIGKILL");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ESRCH") {
      return;
    }
    throw error;
  }
}

const stopDescendants: Effect.Effect<
  void,
  DevStartFailure,
  ChildProcessSpawner.ChildProcessSpawner
> = Effect.gen(function* stopDescendantsProgram() {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const table = yield* spawner
    .string(
      ChildProcess.make("ps", ["-ax", "-o", "pid=", "-o", "ppid="], {
        stderr: "ignore",
        stdin: "ignore",
        stdout: "pipe",
      }),
    )
    .pipe(
      Effect.mapError(
        (error) => new DevStartFailure({ reason: `failed to list processes: ${describe(error)}` }),
      ),
    );
  for (const pid of descendantPids(process.pid, processRows(table))) {
    killQuietly(pid);
  }
});

const leave = stopDescendants.pipe(
  Effect.catch(() =>
    Effect.sync(() => {
      process.exitCode = 1;
    }),
  ),
  Effect.andThen(
    Effect.sync(() => {
      process.exit(process.exitCode ?? 0);
    }),
  ),
);

function failed(app: string, ...reasons: readonly string[]): Readonly<Record<string, unknown>> {
  return { app, event: "quality.dev_start", ok: false, reasons };
}

function report(app: string, reasons: readonly string[]): Effect.Effect<void> {
  return reasons.length === 0
    ? Console.log(JSON.stringify({ app, event: "quality.dev_start", ok: true }))
    : reportFailed(failed(app, ...reasons));
}

const program = Effect.gen(function* program() {
  const app = yield* Schema.decodeUnknownEffect(Application)(workspaceName()).pipe(
    Effect.mapError(() => new DevStartFailure({ reason: "not an application workspace" })),
  );
  const origin = yield* listeningOrigin;
  const paths = [...new Set(["/api/health", applicationReadyPaths[app]])];
  const results = yield* Effect.all(
    paths.map((pathname) => probe(origin, pathname)),
    { concurrency: "unbounded", mode: "result" },
  );
  const reasons = results.flatMap((result) =>
    Result.isFailure(result) ? [result.failure.reason] : [],
  );
  yield* report(workspaceName(), reasons);
}).pipe(
  Effect.scoped,
  Effect.timeoutOrElse({
    duration: startTimeout,
    orElse: () =>
      Effect.fail(new DevStartFailure({ reason: `did not finish within ${startTimeout}` })),
  }),
);

runCli(
  program.pipe(
    Effect.catchTag("DevStartFailure", (failure) =>
      reportFailed(failed(workspaceName(), failure.reason)),
    ),
    Effect.andThen(() => leave),
    Effect.provide(layer),
  ),
  (cause) => failed(workspaceName(), Cause.pretty(cause)),
);
