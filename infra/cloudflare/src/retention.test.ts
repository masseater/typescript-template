// oxlint-disable-next-line import/no-nodejs-modules
import { chmod, mkdir, mkdtemp, readdir, realpath, rm, utimes } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { retainGenerations } from "./retention.ts";

const UNREADABLE_MODE = 0o000;
const READABLE_MODE = 0o700;
const NEWER_SECONDS = 1_700_000_000;
const OLDER_SECONDS = 1_600_000_000;
const KEPT_GENERATIONS = 2;

async function createTemporaryRoot(): Promise<string> {
  return realpath(await mkdtemp(path.join(tmpdir(), "template-retention-")));
}

const temporaryRoot = Effect.acquireRelease(Effect.promise(createTemporaryRoot), (root) =>
  Effect.promise(async () => {
    await chmod(root, READABLE_MODE).catch(() => undefined);
    return rm(root, { force: true, recursive: true });
  }),
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

it.effect("treats a parent directory that was never created as holding no generations", () =>
  Effect.gen(function* program() {
    const root = yield* temporaryRoot;
    yield* retainGenerations(path.join(root, "absent"), "current", 1);
  }).pipe(Effect.scoped),
);

it.effect("fails when the generations cannot be listed rather than deleting nothing", () =>
  Effect.gen(function* program() {
    const root = yield* temporaryRoot;
    const parent = path.join(root, "generations");
    yield* Effect.promise(async () => mkdir(path.join(parent, "old"), { recursive: true }));
    yield* Effect.promise(async () => chmod(parent, UNREADABLE_MODE));
    const failure = yield* retainGenerations(parent, "current", 1).pipe(Effect.flip);
    assert.strictEqual(failure.code, "artifact_io_failed");
    yield* Effect.promise(async () => chmod(parent, READABLE_MODE));
    assert.deepStrictEqual(yield* Effect.promise(async () => readdir(parent)), ["old"]);
  }).pipe(Effect.scoped),
);
