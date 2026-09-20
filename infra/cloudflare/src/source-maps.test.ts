// oxlint-disable-next-line import/no-nodejs-modules
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { assert, it } from "@effect/vitest";
import { sourceMapDirectories } from "@repo/vite-config/source-maps";
import { Effect } from "effect";

import { archiveSourceMaps } from "./source-maps.ts";

const release = "0123456789abcdef";

const temporaryRoot = Effect.acquireRelease(
  Effect.promise(async () => mkdtemp(path.join(tmpdir(), "template-source-maps-"))),
  (root) => Effect.promise(async () => rm(root, { force: true, recursive: true })),
);

function archivedNames(root: string): Effect.Effect<string[]> {
  return Effect.promise(async () =>
    readdir(sourceMapDirectories(root, "service-member").releases).catch(() => []),
  );
}

it.effect("fails when the client source map directory is missing", () =>
  Effect.gen(function* program() {
    const root = yield* temporaryRoot;
    const failure = yield* archiveSourceMaps(root, "service-member", release).pipe(Effect.flip);
    assert.strictEqual(failure.code, "source_maps_missing");
    assert.deepStrictEqual(yield* archivedNames(root), []);
  }).pipe(Effect.scoped),
);

it.effect("fails when the client source map directory contains no maps", () =>
  Effect.gen(function* program() {
    const root = yield* temporaryRoot;
    const client = sourceMapDirectories(root, "service-member").client;
    yield* Effect.promise(async () => {
      await mkdir(client, { recursive: true });
      await writeFile(path.join(client, "notes.txt"), "not a map");
    });
    const failure = yield* archiveSourceMaps(root, "service-member", release).pipe(Effect.flip);
    assert.strictEqual(failure.code, "source_maps_missing");
    assert.deepStrictEqual(yield* archivedNames(root), []);
  }).pipe(Effect.scoped),
);
