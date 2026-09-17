import { chmod, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { prepareStateDirectory, readCredentials, writeCredentials } from "./credentials.ts";

const credentials = {
  accountId: "a".repeat(32),
  bucket: "test-state",
  accessKeyId: "b".repeat(32),
  secretAccessKey: "c".repeat(64),
};

const temporaryRoot = Effect.acquireRelease(
  Effect.promise(async () => realpath(await mkdtemp(path.join(tmpdir(), "state-credentials-")))),
  (root) => Effect.promise(() => rm(root, { recursive: true, force: true })),
);

it.effect("stores credentials atomically with owner-only permissions", () =>
  Effect.gen(function* () {
    const root = yield* temporaryRoot;
    const filename = path.join(root, "state", "r2.json");
    assert.isUndefined(yield* readCredentials(filename));
    yield* writeCredentials(filename, credentials);
    assert.deepStrictEqual(yield* readCredentials(filename), credentials);
    assert.strictEqual((yield* Effect.promise(() => stat(filename))).mode & 0o777, 0o600);
    assert.strictEqual(
      (yield* Effect.promise(() => stat(path.dirname(filename)))).mode & 0o777,
      0o700,
    );
    yield* Effect.promise(() => chmod(filename, 0o644));
    const failure = yield* readCredentials(filename).pipe(Effect.flip);
    assert.strictEqual(failure.code, "state_credentials_unreadable");
  }).pipe(Effect.scoped),
);

it.effect("refuses credential symlink reads and never overwrites their target", () =>
  Effect.gen(function* () {
    const root = yield* temporaryRoot;
    const outside = path.join(root, "protected");
    const filename = path.join(root, "r2.json");
    yield* Effect.promise(() => writeFile(outside, "protected content", { mode: 0o600 }));
    yield* Effect.promise(() => symlink(outside, filename));
    const unreadable = yield* readCredentials(filename).pipe(Effect.flip);
    assert.strictEqual(unreadable.code, "state_credentials_unreadable");
    yield* writeCredentials(filename, credentials);
    assert.strictEqual(yield* Effect.promise(() => readFile(outside, "utf8")), "protected content");
    assert.deepStrictEqual(yield* readCredentials(filename), credentials);
    yield* Effect.promise(() => symlink(root, path.join(root, "alias")));
    const forbidden = yield* prepareStateDirectory(path.join(root, "alias")).pipe(Effect.flip);
    assert.strictEqual(forbidden.code, "state_directory_symlink_forbidden");
  }).pipe(Effect.scoped),
);
