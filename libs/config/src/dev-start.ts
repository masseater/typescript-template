#!/usr/bin/env node
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { NodeRuntime } from "@effect/platform-node";
import { Cause, Console, Effect, Result, Schema } from "effect";
import { createServer } from "vite-plus";

import { applicationReadyPaths, applications } from "./applications.ts";
import { reportFailed } from "./cli.ts";

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
        server: { host: "127.0.0.1", port: 0, strictPort: false },
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

function report(
  app: string,
  record: Readonly<{ ok: boolean; reasons?: readonly string[] }>,
): Effect.Effect<void> {
  const line = { app, event: "quality.dev_start", ...record };
  return record.ok ? Console.log(JSON.stringify(line)) : reportFailed(line);
}

const program = Effect.gen(function* program() {
  const app = yield* Schema.decodeUnknownEffect(Application)(path.basename(process.cwd())).pipe(
    Effect.mapError(() => new DevStartFailure({ reason: "not an application workspace" })),
  );
  const origin = yield* listeningOrigin;
  const paths = [...new Set(["/api/health", applicationReadyPaths[app]])];
  const results = yield* Effect.all(
    paths.map((pathname) => probe(origin, pathname)),
    { mode: "result" },
  );
  const reasons = results.flatMap((result) =>
    Result.isFailure(result) ? [result.failure.reason] : [],
  );
  yield* report(app, reasons.length === 0 ? { ok: true } : { ok: false, reasons });
}).pipe(
  Effect.scoped,
  Effect.timeoutOrElse({
    duration: startTimeout,
    orElse: () =>
      Effect.fail(new DevStartFailure({ reason: `did not finish within ${startTimeout}` })),
  }),
);

NodeRuntime.runMain(
  program.pipe(
    Effect.catchTag("DevStartFailure", (failure) =>
      report(path.basename(process.cwd()), { ok: false, reasons: [failure.reason] }),
    ),
    Effect.catchCause((cause) =>
      report(path.basename(process.cwd()), { ok: false, reasons: [Cause.pretty(cause)] }),
    ),
  ),
  { disableErrorReporting: true },
);
