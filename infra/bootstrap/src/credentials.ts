import { BootstrapFailure, fail, parseCredentials } from "./config.ts";
import { Effect, Schema } from "effect";
// oxlint-disable-next-line import/no-nodejs-modules
import { chmod, mkdir, open, realpath, rename, unlink } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import type { FileHandle } from "node:fs/promises";
import type { StateCredentials } from "./config.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { constants } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { randomUUID } from "node:crypto";

const OWNER_ONLY_DIRECTORY_MODE = 0o700;
const OWNER_ONLY_FILE_MODE = 0o600;
const GROUP_AND_OTHER_PERMISSIONS = 0o077;

class CredentialsAbsent extends Schema.TaggedError<CredentialsAbsent>()("CredentialsAbsent", {}) {}

function failure(code: BootstrapFailure["code"]): () => BootstrapFailure {
  return () => new BootstrapFailure({ code });
}

const prepareStateDirectory = Effect.fn("prepareStateDirectory")(function* prepareStateDirectory(
  directory: string,
) {
  const unavailable = failure("state_directory_unavailable");
  yield* Effect.tryPromise({
    catch: unavailable,
    try: async () => mkdir(directory, { mode: OWNER_ONLY_DIRECTORY_MODE, recursive: true }),
  });
  const resolved = yield* Effect.tryPromise({
    catch: unavailable,
    try: async () => realpath(directory),
  });
  if (resolved !== path.resolve(directory)) {
    return yield* fail("state_directory_symlink_forbidden");
  }
  yield* Effect.tryPromise({
    catch: unavailable,
    try: async () => chmod(directory, OWNER_ONLY_DIRECTORY_MODE),
  });
});

function readable<Value>(
  run: () => Promise<Value>,
): Effect.Effect<Value, BootstrapFailure | CredentialsAbsent> {
  return Effect.tryPromise({
    catch: (error) =>
      error instanceof Error && "code" in error && error.code === "ENOENT"
        ? new CredentialsAbsent()
        : new BootstrapFailure({ code: "state_credentials_unreadable" }),
    try: run,
  });
}

const readOwnerOnlyFile = Effect.fn("readOwnerOnlyFile")(function* readOwnerOnlyFile(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  handle: FileHandle,
) {
  const metadata = yield* readable(async () => handle.stat());
  const exposed =
    // oxlint-disable-next-line no-bitwise
    (metadata.mode & GROUP_AND_OTHER_PERMISSIONS) !== 0;
  if (!metadata.isFile() || metadata.nlink !== 1 || exposed) {
    return yield* fail("state_credentials_unreadable");
  }
  const text = yield* readable(async () => handle.readFile("utf-8"));
  const input = yield* Effect.try({
    catch: failure("state_credentials_unreadable"),
    try: (): unknown => JSON.parse(text),
  });
  return yield* parseCredentials(input).pipe(
    Effect.mapError(failure("state_credentials_unreadable")),
  );
});

function closeHandle(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  handle: FileHandle,
): Effect.Effect<void> {
  return Effect.tryPromise(async () => handle.close()).pipe(Effect.ignore);
}

const readCredentials = Effect.fn("readCredentials")(
  function* readCredentialsFile(filename: string) {
    const directory = path.dirname(filename);
    if ((yield* readable(async () => realpath(directory))) !== path.resolve(directory)) {
      return yield* fail("state_credentials_unreadable");
    }
    const credentials: StateCredentials = yield* Effect.acquireUseRelease(
      // oxlint-disable-next-line no-bitwise
      readable(async () => open(filename, constants.O_RDONLY | constants.O_NOFOLLOW)),
      readOwnerOnlyFile,
      closeHandle,
    );
    return credentials;
  },
  Effect.catchTag("CredentialsAbsent", () => Effect.undefined),
);

const writeCredentials = Effect.fn("writeCredentials")(function* writeCredentials(
  filename: string,
  input: unknown,
) {
  const writeFailed = failure("state_credentials_write_failed");
  const credentials = yield* parseCredentials(input);
  yield* prepareStateDirectory(path.dirname(filename));
  const temporary = `${filename}.${randomUUID()}.tmp`;
  yield* Effect.acquireUseRelease(
    Effect.tryPromise({
      catch: writeFailed,
      try: async () =>
        open(
          temporary,
          // oxlint-disable-next-line no-bitwise
          constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
          OWNER_ONLY_FILE_MODE,
        ),
    }),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    (handle) =>
      Effect.tryPromise({
        catch: writeFailed,
        try: async () => {
          await handle.writeFile(JSON.stringify(credentials));
          await handle.sync();
        },
      }),
    closeHandle,
  );
  yield* Effect.tryPromise({
    catch: writeFailed,
    try: async () => rename(temporary, filename),
  }).pipe(
    Effect.tapError(() => Effect.tryPromise(async () => unlink(temporary)).pipe(Effect.ignore)),
  );
});

export { prepareStateDirectory, readCredentials, writeCredentials };
