#!/usr/bin/env node
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { Cause, Console, Effect, Result, Schema } from "effect";
import { createServer } from "vite-plus";

import { applicationReadyPaths, applications, loopbackAddress } from "./applications.ts";
import { reportFailed, runCli } from "./cli.ts";

class DevStartFailure extends Schema.TaggedError<DevStartFailure>()("DevStartFailure", {
  reason: Schema.String,
}) {}

const Application = Schema.Literals(applications);
const successStatus = 200;
const requestTimeoutMilliseconds = 120_000;
const startTimeout = "5 minutes";

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const devServer = Effect.acquireRelease(
  Effect.tryPromise({
    catch: (error) => new DevStartFailure({ reason: `failed to start: ${describe(error)}` }),
    try: async () =>
      createServer({
        logLevel: "silent",
        server: { host: loopbackAddress, port: 0, strictPort: false },
      }),
  }),
  (server) => Effect.promise(async () => server.close()),
);

const listeningOrigin = devServer.pipe(
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
  return Effect.tryPromise({
    catch: (error) =>
      new DevStartFailure({ reason: `${pathname} did not answer: ${describe(error)}` }),
    try: async () => {
      const response = await fetch(new URL(pathname, origin), {
        redirect: "manual",
        signal: AbortSignal.timeout(requestTimeoutMilliseconds),
      });
      await response.body?.cancel();
      return response.status;
    },
  }).pipe(
    Effect.flatMap((status) =>
      status === successStatus
        ? Effect.succeed(status)
        : Effect.fail(new DevStartFailure({ reason: `${pathname} responded ${status}` })),
    ),
  );
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
