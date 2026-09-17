import { assert, it } from "@effect/vitest";
// oxlint-disable-next-line import/no-nodejs-modules
import { chmod, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { prepareStateDirectory, readCredentials, writeCredentials } from "./credentials.ts";
import { Effect } from "effect";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";

const HEX_ID_LENGTH = 32;
const SECRET_LENGTH = 64;
const PERMISSION_BITS = 0o777;
const OWNER_ONLY_FILE_MODE = 0o600;
const OWNER_ONLY_DIRECTORY_MODE = 0o700;
const WORLD_READABLE_FILE_MODE = 0o644;

const credentials = {
  accessKeyId: "b".repeat(HEX_ID_LENGTH),
  accountId: "a".repeat(HEX_ID_LENGTH),
  bucket: "test-state",
  secretAccessKey: "c".repeat(SECRET_LENGTH),
};

async function createTemporaryRoot(): Promise<string> {
  const prefix = path.join(tmpdir(), "state-credentials-");
  return realpath(await mkdtemp(prefix));
}

function permissions(target: string): Effect.Effect<number> {
  return Effect.promise(async () => stat(target)).pipe(
    // oxlint-disable-next-line no-bitwise, typescript/prefer-readonly-parameter-types
    Effect.map((info) => info.mode & PERMISSION_BITS),
  );
}

const temporaryRoot = Effect.acquireRelease(Effect.promise(createTemporaryRoot), (root) =>
  Effect.promise(async () => rm(root, { force: true, recursive: true })),
);

it.effect("stores credentials atomically with owner-only permissions", () =>
  Effect.gen(function* program() {
    const root = yield* temporaryRoot;
    const filename = path.join(root, "state", "r2.json");
    assert.isUndefined(yield* readCredentials(filename));
    yield* writeCredentials(filename, credentials);
    assert.deepStrictEqual(yield* readCredentials(filename), credentials);
    assert.strictEqual(yield* permissions(filename), OWNER_ONLY_FILE_MODE);
    assert.strictEqual(yield* permissions(path.dirname(filename)), OWNER_ONLY_DIRECTORY_MODE);
    yield* Effect.promise(async () => chmod(filename, WORLD_READABLE_FILE_MODE));
    const failure = yield* readCredentials(filename).pipe(Effect.flip);
    assert.strictEqual(failure.code, "state_credentials_unreadable");
  }).pipe(Effect.scoped),
);

const symlinkedCredentials = Effect.fn("symlinkedCredentials")(function* symlinkedCredentials(
  root: string,
) {
  const outside = path.join(root, "protected");
  const filename = path.join(root, "r2.json");
  yield* Effect.promise(async () =>
    writeFile(outside, "protected content", { mode: OWNER_ONLY_FILE_MODE }),
  );
  yield* Effect.promise(async () => symlink(outside, filename));
  return { filename, outside };
});

it.effect("refuses credential symlink reads and never overwrites their target", () =>
  Effect.gen(function* program() {
    const root = yield* temporaryRoot;
    const { filename, outside } = yield* symlinkedCredentials(root);
    const unreadable = yield* readCredentials(filename).pipe(Effect.flip);
    assert.strictEqual(unreadable.code, "state_credentials_unreadable");
    yield* writeCredentials(filename, credentials);
    assert.strictEqual(
      yield* Effect.promise(async () => readFile(outside, "utf-8")),
      "protected content",
    );
    assert.deepStrictEqual(yield* readCredentials(filename), credentials);
  }).pipe(Effect.scoped),
);

it.effect("refuses a symlinked state directory", () =>
  Effect.gen(function* program() {
    const root = yield* temporaryRoot;
    yield* Effect.promise(async () => symlink(root, path.join(root, "alias")));
    const forbidden = yield* prepareStateDirectory(path.join(root, "alias")).pipe(Effect.flip);
    assert.strictEqual(forbidden.code, "state_directory_symlink_forbidden");
  }).pipe(Effect.scoped),
);
