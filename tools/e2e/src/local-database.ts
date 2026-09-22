import { NodeServices } from "@effect/platform-node";
import { localDatabaseVariable } from "@repo/config/local-database-path";
import { Effect, FileSystem } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { failed, type JourneyFailure } from "./journey-failure.ts";
import { repositoryRoot, vitePlus } from "./repository.ts";

const databasePackage = "@repo/db-local";
const prefix = "template-e2e-";

type DatabaseEnvironment = {
  readonly [localDatabaseVariable]: string;
};

type IsolatedDatabase = {
  readonly directory: string;
  readonly environment: DatabaseEnvironment;
  readonly promoteToAdministrator: (email: string) => Effect.Effect<void, JourneyFailure>;
  readonly remove: Effect.Effect<void, JourneyFailure>;
};

const runVitePlus = (
  handedArguments: readonly string[],
  environment: DatabaseEnvironment,
): Effect.Effect<void, JourneyFailure, ChildProcessSpawner.ChildProcessSpawner> =>
  Effect.gen(function* runDatabaseCommand() {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const exitCode = yield* spawner
      .exitCode(
        ChildProcess.make(vitePlus, [...handedArguments], {
          cwd: repositoryRoot,
          env: environment,
          extendEnv: true,
          stderr: "inherit",
          stdin: "ignore",
          stdout: "inherit",
        }),
      )
      .pipe(Effect.mapError((cause) => failed("E2E_COMMAND_FAILED", cause)));
    if (exitCode !== 0) {
      return yield* failed("E2E_COMMAND_FAILED", exitCode);
    }
  });

const removeDirectory = (directory: string): Effect.Effect<void, JourneyFailure> =>
  Effect.gen(function* removeIsolatedDatabase() {
    const filesystem = yield* FileSystem.FileSystem;
    yield* filesystem
      .remove(directory, { force: true, recursive: true })
      .pipe(Effect.mapError((cause) => failed("E2E_DATABASE_NOT_REMOVED", cause)));
  }).pipe(Effect.provide(NodeServices.layer));

const startIsolatedDatabase = (): Effect.Effect<
  IsolatedDatabase,
  JourneyFailure,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem
> =>
  Effect.gen(function* isolateDatabase() {
    const filesystem = yield* FileSystem.FileSystem;
    const directory = yield* filesystem
      .makeTempDirectory({ prefix })
      .pipe(Effect.mapError((cause) => failed("E2E_DATABASE_DIRECTORY_UNAVAILABLE", cause)));
    const environment = { [localDatabaseVariable]: directory };
    yield* runVitePlus(["run", "--filter", databasePackage, "db:migrate:local"], environment);
    return {
      directory,
      environment,
      promoteToAdministrator: (email: string) =>
        runVitePlus(
          ["run", "--filter", databasePackage, "db:bootstrap:local", email],
          environment,
        ).pipe(Effect.provide(NodeServices.layer)),
      remove: removeDirectory(directory),
    };
  });

export { startIsolatedDatabase };
export type { DatabaseEnvironment, IsolatedDatabase };
