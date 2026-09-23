import { env as processEnvironment } from "node:process";

import { NodeServices } from "@effect/platform-node";
import { assert, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";

import { localDatabaseDirectory, localDatabaseVariable } from "./local-database-path.ts";

it.effect("reads the persist directory from the environment at call time", () =>
  Effect.gen(function* program() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const directory = yield* filesystem.makeTempDirectoryScoped({
      prefix: "template-local-database-path-",
    });
    const previous = processEnvironment[localDatabaseVariable];
    processEnvironment[localDatabaseVariable] = directory;
    try {
      assert.strictEqual(localDatabaseDirectory(), paths.resolve(directory));
    } finally {
      if (previous === undefined) {
        delete processEnvironment[localDatabaseVariable];
      } else {
        processEnvironment[localDatabaseVariable] = previous;
      }
    }
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);
