#!/usr/bin/env node
import path from "node:path";

import { Cause, Console, Effect, Result, Schema } from "effect";
import { createServer } from "vite-plus";

import { ApplicationName, applicationReadyPaths, loopbackAddress } from "./applications.ts";
import { reportFailed, runCli } from "./cli.ts";

class DevStartFailure extends Schema.TaggedError<DevStartFailure>()("DevStartFailure", {
  reason: Schema.String,
}) {}

const describe = (failure: unknown): string =>
  failure instanceof Error ? failure.message : String(failure);

const devServer = Effect.acquireRelease(
  Effect.tryPromise({
    catch: (failure) => new DevStartFailure({ reason: `failed to start: ${describe(failure)}` }),
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
      catch: (failure) => new DevStartFailure({ reason: `failed to listen: ${describe(failure)}` }),
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

const successStatus = 200;
const requestTimeoutMilliseconds = 120_000;

const probe = (origin: string, pathname: string): Effect.Effect<number, DevStartFailure> =>
  Effect.tryPromise({
    catch: (failure) =>
      new DevStartFailure({ reason: `${pathname} did not answer: ${describe(failure)}` }),
    try: async () => {
      const answered = await fetch(new URL(pathname, origin), {
        redirect: "manual",
        signal: AbortSignal.timeout(requestTimeoutMilliseconds),
      });
      await answered.body?.cancel();
      return answered.status;
    },
  }).pipe(
    Effect.flatMap((responseStatus) =>
      responseStatus === successStatus
        ? Effect.succeed(responseStatus)
        : Effect.fail(new DevStartFailure({ reason: `${pathname} responded ${responseStatus}` })),
    ),
  );

const line = { app: path.basename(process.cwd()), event: "quality.dev_start" };

const failed = (...reasons: readonly string[]): Readonly<Record<string, unknown>> => ({
  ...line,
  ok: false,
  reasons,
});

const report = (reasons: readonly string[]): Effect.Effect<void> =>
  reasons.length === 0
    ? Console.log(JSON.stringify({ ...line, ok: true }))
    : reportFailed(failed(...reasons));

const startTimeout = "5 minutes";

const program = Effect.gen(function* program() {
  const app = yield* Schema.decodeUnknownEffect(ApplicationName)(path.basename(process.cwd())).pipe(
    Effect.mapError(() => new DevStartFailure({ reason: "not an application workspace" })),
  );
  const origin = yield* listeningOrigin;
  const paths = [...new Set(["/api/health", applicationReadyPaths[app]])];
  const probed = yield* Effect.all(
    paths.map((pathname) => probe(origin, pathname)),
    { concurrency: "unbounded", mode: "result" },
  );
  const reasons = probed.flatMap((answered) =>
    Result.isFailure(answered) ? [answered.failure.reason] : [],
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
