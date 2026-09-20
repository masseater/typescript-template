#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { reportFailed, runCli } from "@repo/cli";
import {
  applicationReadyPaths,
  applications,
  loopbackAddress,
  waitUntilResponds,
} from "@repo/config";
import { localDatabaseVariable } from "@repo/config/local-database-path";
import { repositoryRoot } from "@repo/config/repository-root";
import { Cause, Console, Effect, Result, Schema } from "effect";
import { createServer } from "vite-plus";

class DevStartFailure extends Schema.TaggedError<DevStartFailure>()("DevStartFailure", {
  reason: Schema.String,
}) {}

const Application = Schema.Literals(applications);
const successStatus = 200;
const requestTimeoutMilliseconds = 120_000;
const startTimeout = "5 minutes";
const closeTimeout = "30 seconds";
const databasePrefix = "template-check-dev-";
const runFile = promisify(execFile);

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const isolatedDatabase = Effect.acquireRelease(
  Effect.tryPromise({
    catch: (error) =>
      new DevStartFailure({ reason: `failed to prepare database: ${describe(error)}` }),
    try: async () => {
      const directory = await mkdtemp(path.join(tmpdir(), databasePrefix));
      process.env[localDatabaseVariable] = directory;
      await runFile(
        path.join(repositoryRoot, "node_modules/.bin/vp"),
        ["run", "--filter", "@repo/db-local", "db:migrate:local"],
        {
          cwd: repositoryRoot,
          env: process.env,
        },
      );
      return directory;
    },
  }),
  (directory) =>
    Effect.promise(async () => {
      delete process.env[localDatabaseVariable];
      await rm(directory, { force: true, recursive: true });
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
    Effect.ignore(
      Effect.timeout(
        Effect.promise(async () => server.close()),
        closeTimeout,
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

const line = { app: path.basename(process.cwd()), event: "quality.dev_start" };

function failed(...reasons: readonly string[]): Readonly<Record<string, unknown>> {
  return { ...line, ok: false, reasons };
}

function report(reasons: readonly string[]): Effect.Effect<void> {
  return reasons.length === 0
    ? Console.log(JSON.stringify({ ...line, ok: true }))
    : reportFailed(failed(...reasons));
}

const program = Effect.gen(function* program() {
  const app = yield* Schema.decodeUnknownEffect(Application)(path.basename(process.cwd())).pipe(
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
  yield* report(reasons);
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
    Effect.catchTag("DevStartFailure", (failure) => reportFailed(failed(failure.reason))),
  ),
  (cause) => failed(Cause.pretty(cause)),
);
