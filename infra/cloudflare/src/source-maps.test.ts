import { tmpdir } from "node:os";

import { assert, it } from "@effect/vitest";
import { sourceMapDirectories } from "@repo/vite-config/source-maps";
import { Effect, FileSystem } from "effect";

import { layer, path } from "./platform.ts";
import { archiveSourceMaps } from "./source-maps.ts";

import type { Scope } from "effect";

const release = "0123456789abcdef";

function temporaryRoot(): Effect.Effect<string, never, Scope.Scope> {
  return Effect.gen(function* makeTemporary() {
    const filesystem = yield* FileSystem.FileSystem;
    const directory = yield* filesystem.makeTempDirectoryScoped({
      directory: tmpdir(),
      prefix: "template-source-maps-",
    });
    return yield* filesystem.realPath(directory);
  }).pipe(Effect.orDie, Effect.provide(layer));
}

function archivedNames(root: string): Effect.Effect<string[]> {
  return Effect.gen(function* listArchived() {
    const filesystem = yield* FileSystem.FileSystem;
    return yield* filesystem
      .readDirectory(sourceMapDirectories(root, "service-member").releases)
      .pipe(Effect.orElseSucceed(() => []));
  }).pipe(Effect.provide(layer));
}

it.effect("fails when the client source map directory is missing", () =>
  Effect.gen(function* program() {
    const root = yield* temporaryRoot();
    const failure = yield* archiveSourceMaps(root, "service-member", release).pipe(Effect.flip);
    assert.strictEqual(failure.code, "source_maps_missing");
    assert.deepStrictEqual(yield* archivedNames(root), []);
  }).pipe(Effect.scoped),
);

it.effect("fails when the client source map directory contains no maps", () =>
  Effect.gen(function* program() {
    const root = yield* temporaryRoot();
    const client = sourceMapDirectories(root, "service-member").client;
    yield* Effect.gen(function* seedClient() {
      const filesystem = yield* FileSystem.FileSystem;
      yield* filesystem.makeDirectory(client, { recursive: true });
      yield* filesystem.writeFileString(path.join(client, "notes.txt"), "not a map");
    }).pipe(Effect.orDie, Effect.provide(layer));
    const failure = yield* archiveSourceMaps(root, "service-member", release).pipe(Effect.flip);
    assert.strictEqual(failure.code, "source_maps_missing");
    assert.deepStrictEqual(yield* archivedNames(root), []);
  }).pipe(Effect.scoped),
);

it.effect("fails when client maps exist but server maps are missing", () =>
  Effect.gen(function* program() {
    const root = yield* temporaryRoot();
    const client = sourceMapDirectories(root, "service-member").client;
    yield* Effect.gen(function* seedClient() {
      const filesystem = yield* FileSystem.FileSystem;
      yield* filesystem.makeDirectory(client, { recursive: true });
      yield* filesystem.writeFileString(path.join(client, "index.js.map"), "{}");
    }).pipe(Effect.orDie, Effect.provide(layer));
    const failure = yield* archiveSourceMaps(root, "service-member", release).pipe(Effect.flip);
    assert.strictEqual(failure.code, "source_maps_missing");
    assert.deepStrictEqual(yield* archivedNames(root), []);
  }).pipe(Effect.scoped),
);

it.effect("archives client and server maps together", () =>
  Effect.gen(function* program() {
    const root = yield* temporaryRoot();
    const client = sourceMapDirectories(root, "service-member").client;
    const server = path.join(root, "apps", "service-member", "dist", "server");
    yield* Effect.gen(function* seedMaps() {
      const filesystem = yield* FileSystem.FileSystem;
      yield* filesystem.makeDirectory(client, { recursive: true });
      yield* filesystem.makeDirectory(server, { recursive: true });
      yield* filesystem.writeFileString(path.join(client, "index.js.map"), "{}");
      yield* filesystem.writeFileString(path.join(server, "index.js.map"), "{}");
    }).pipe(Effect.orDie, Effect.provide(layer));
    assert.deepStrictEqual(yield* archiveSourceMaps(root, "service-member", release), {
      client: 1,
      server: 1,
    });
    assert.deepStrictEqual(yield* archivedNames(root), [release]);
  }).pipe(Effect.scoped),
);
