// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import { mkdir, mkdtemp, readdir, realpath, rm, utimes, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import { tmpdir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import path from "node:path";

import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { retainGenerations } from "./retention.ts";

const NEWER_SECONDS = 1_700_000_000;
const OLDER_SECONDS = 1_600_000_000;
const KEPT_GENERATIONS = 2;

async function createTemporaryRoot(): Promise<string> {
  return realpath(await mkdtemp(path.join(tmpdir(), "template-retention-")));
}

const temporaryRoot = Effect.acquireRelease(Effect.promise(createTemporaryRoot), (root) =>
  Effect.promise(async () => rm(root, { force: true, recursive: true })),
);

it.effect("keeps the pinned generation and the newest of the rest", () =>
  Effect.gen(function* program() {
    const root = yield* temporaryRoot;
    const parent = path.join(root, "generations");
    yield* Effect.promise(async () => {
      await Promise.all(
        ["current", "newer", "older"].map(async (name) =>
          mkdir(path.join(parent, name), { recursive: true }),
        ),
      );
      await utimes(path.join(parent, "newer"), NEWER_SECONDS, NEWER_SECONDS);
      return utimes(path.join(parent, "older"), OLDER_SECONDS, OLDER_SECONDS);
    });
    yield* retainGenerations(parent, "current", KEPT_GENERATIONS);
    assert.deepStrictEqual((yield* Effect.promise(async () => readdir(parent))).toSorted(), [
      "current",
      "newer",
    ]);
  }).pipe(Effect.scoped),
);

it.effect("fails when the parent directory was never created rather than retaining nothing", () =>
  Effect.gen(function* program() {
    const root = yield* temporaryRoot;
    const failure = yield* retainGenerations(path.join(root, "absent"), "current", 1).pipe(
      Effect.flip,
    );
    assert.strictEqual(failure.code, "generations_missing");
  }).pipe(Effect.scoped),
);

it.effect("fails when the generations cannot be listed rather than deleting nothing", () =>
  Effect.gen(function* program() {
    const root = yield* temporaryRoot;
    const parent = path.join(root, "generations");
    yield* Effect.promise(async () => writeFile(parent, ""));
    const failure = yield* retainGenerations(parent, "current", 1).pipe(Effect.flip);
    assert.strictEqual(failure.code, "artifact_io_failed");
  }).pipe(Effect.scoped),
);
