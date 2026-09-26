import { NodeServices } from "@effect/platform-node";
import { assert, it } from "@effect/vitest";
import { Effect, Path } from "effect";

import { localDatabaseDirectory } from "./local-database-path.ts";

it.effect("reads the persist directory the environment names", () =>
  Effect.gen(function* program() {
    const paths = yield* Path.Path;
    assert.strictEqual(localDatabaseDirectory(), paths.resolve(".local/d1-probe"));
  }).pipe(Effect.provide(NodeServices.layer)),
);
