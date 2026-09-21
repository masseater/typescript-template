import { NodeServices } from "@effect/platform-node";
import { Effect, Exit, FileSystem, Path, Scope, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { healthReport, logTail, servingHealth, unavailable } from "./app-health.ts";
import { failed, type JourneyFailure } from "./journey-failure.ts";
import { loopback, loopbackOrigin } from "./ports.ts";
import { stopGroup } from "./process-group.ts";
import { applicationRoot, vitePlus } from "./repository.ts";
import { deadlineIn, until } from "./waiting.ts";

import type { Application } from "@repo/config";
import type { Disposer } from "./disposers.ts";
import type { DatabaseEnvironment } from "./local-database.ts";

const readyTimeout = 300_000;

const probeApplication = (served: {
  readonly handle: ChildProcessSpawner.ChildProcessHandle;
  readonly origin: string;
}): Effect.Effect<true | undefined, JourneyFailure> =>
  Effect.gen(function* probeRunningApplication() {
    const running = yield* served.handle.isRunning.pipe(Effect.orDie);
    if (!running) {
      return yield* failed("E2E_APPLICATION_STOPPED");
    }
    const report = yield* healthReport(served.origin);
    return report === servingHealth ? true : undefined;
  });

const explainUnavailable = (
  served: { readonly log: string },
  cause: unknown,
): Effect.Effect<never, JourneyFailure, FileSystem.FileSystem> =>
  Effect.gen(function* readFailureLog() {
    const tail = yield* logTail(served.log);
    return yield* unavailable(cause, tail);
  });

const reachHealth = (served: {
  readonly handle: ChildProcessSpawner.ChildProcessHandle;
  readonly log: string;
  readonly origin: string;
}): Effect.Effect<void, JourneyFailure, FileSystem.FileSystem> =>
  until({
    attempt: () => probeApplication(served),
    deadline: deadlineIn(readyTimeout),
    reason: "E2E_APPLICATION_NOT_READY",
  }).pipe(
    Effect.matchEffect({
      onFailure: (cause) => explainUnavailable(served, cause),
      onSuccess: (ready) => Effect.succeed(ready),
    }),
  );

type ApplicationServer = {
  readonly application: Application;
  readonly environment: DatabaseEnvironment;
  readonly logDirectory: string;
  readonly port: number;
};

const devCommand = (port: number): readonly string[] => [
  "dev",
  "--host",
  loopback,
  "--port",
  String(port),
  "--strictPort",
];

const startApplication = (
  server: ApplicationServer,
): Effect.Effect<
  { readonly stop: Disposer; readonly waitUntilReady: Effect.Effect<void, JourneyFailure> },
  JourneyFailure,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* launchApplication() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const scope = yield* Scope.make();
    const log = paths.join(server.logDirectory, `${server.application}.log`);
    const handle = yield* spawner
      .spawn(
        ChildProcess.make(vitePlus, [...devCommand(server.port)], {
          cwd: applicationRoot(server.application),
          detached: true,
          env: server.environment,
          extendEnv: true,
          stderr: "pipe",
          stdin: "ignore",
          stdout: "pipe",
        }),
      )
      .pipe(
        Scope.provide(scope),
        Effect.mapError((cause) => failed("E2E_APPLICATION_NOT_STARTED", cause)),
      );
    yield* Stream.run(
      Stream.merge(handle.stdout, handle.stderr),
      filesystem.sink(log, { flag: "a" }),
    ).pipe(Effect.ignore, Effect.forkIn(scope));
    const origin = loopbackOrigin(server.port);
    return {
      stop: stopGroup(handle).pipe(
        Effect.andThen(Scope.close(scope, Exit.succeed(undefined))),
        Effect.provide(NodeServices.layer),
      ),
      waitUntilReady: reachHealth({ handle, log, origin }).pipe(Effect.provide(NodeServices.layer)),
    };
  });

const waitOrStop = (running: {
  readonly stop: Effect.Effect<void, JourneyFailure>;
  readonly waitUntilReady: Effect.Effect<void, JourneyFailure>;
}): Effect.Effect<{ readonly stop: Disposer }, JourneyFailure> =>
  running.waitUntilReady.pipe(
    Effect.as(running),
    Effect.tapError(() => running.stop),
  );

const startAttempts = 3;

const serveAttempt = (
  server: ApplicationServer,
  attempt: number,
): Effect.Effect<
  { readonly stop: Disposer },
  JourneyFailure,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> =>
  Effect.matchEffect(startApplication(server).pipe(Effect.flatMap(waitOrStop)), {
    onFailure: (unready) =>
      attempt + 1 >= startAttempts ? Effect.fail(unready) : serveAttempt(server, attempt + 1),
    onSuccess: (running) => Effect.succeed(running),
  });

const serveApplication = (
  server: ApplicationServer,
): Effect.Effect<
  { readonly stop: Disposer },
  JourneyFailure,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> => serveAttempt(server, 1);

export { serveApplication };
