import { tmpdir } from "node:os";

import { assert, it } from "@effect/vitest";
import { Effect, FileSystem } from "effect";

import { layer, path } from "./platform.ts";
import { retainGenerations } from "./retention.ts";

import type { Scope } from "effect";

const NEWER_SECONDS = 1_700_000_000;
const OLDER_SECONDS = 1_600_000_000;
const KEPT_GENERATIONS = 2;

function temporaryRoot(): Effect.Effect<string, never, Scope.Scope> {
  return Effect.gen(function* makeTemporary() {
    const filesystem = yield* FileSystem.FileSystem;
    const directory = yield* filesystem.makeTempDirectoryScoped({
      directory: tmpdir(),
      prefix: "template-retention-",
    });
    return yield* filesystem.realPath(directory);
  }).pipe(Effect.orDie, Effect.provide(layer));
}

it.effect("keeps the pinned generation and the newest of the rest", () =>
  Effect.gen(function* program() {
    const root = yield* temporaryRoot();
    const parent = path.join(root, "generations");
    yield* Effect.gen(function* seedGenerations() {
      const filesystem = yield* FileSystem.FileSystem;
      yield* Effect.forEach(
        ["current", "newer", "older"],
        (name) => filesystem.makeDirectory(path.join(parent, name), { recursive: true }),
        { concurrency: "unbounded" },
      );
      yield* filesystem.utimes(path.join(parent, "newer"), NEWER_SECONDS, NEWER_SECONDS);
      yield* filesystem.utimes(path.join(parent, "older"), OLDER_SECONDS, OLDER_SECONDS);
    }).pipe(Effect.orDie, Effect.provide(layer));
    yield* retainGenerations(parent, "current", KEPT_GENERATIONS);
    const names = yield* Effect.gen(function* listGenerations() {
      const filesystem = yield* FileSystem.FileSystem;
      return yield* filesystem.readDirectory(parent);
    }).pipe(Effect.orDie, Effect.provide(layer));
    assert.deepStrictEqual(names.toSorted(), ["current", "newer"]);
  }).pipe(Effect.scoped),
);

it.effect("fails when the parent directory was never created rather than retaining nothing", () =>
  Effect.gen(function* program() {
    const root = yield* temporaryRoot();
    const failure = yield* retainGenerations(path.join(root, "absent"), "current", 1).pipe(
      Effect.flip,
    );
    assert.strictEqual(failure.code, "generations_missing");
  }).pipe(Effect.scoped),
);

it.effect("fails when the generations cannot be listed rather than deleting nothing", () =>
  Effect.gen(function* program() {
    const root = yield* temporaryRoot();
    const parent = path.join(root, "generations");
    yield* Effect.gen(function* writeFile() {
      const filesystem = yield* FileSystem.FileSystem;
      yield* filesystem.writeFileString(parent, "");
    }).pipe(Effect.orDie, Effect.provide(layer));
    const failure = yield* retainGenerations(parent, "current", 1).pipe(Effect.flip);
    assert.strictEqual(failure.code, "artifact_io_failed");
  }).pipe(Effect.scoped),
);
