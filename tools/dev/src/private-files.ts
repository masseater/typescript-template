import { chmod, open, readFile, stat } from "node:fs/promises";

import { Effect, Predicate } from "effect";

import { failure, fileIo } from "./failure.ts";

import type { FileHandle } from "node:fs/promises";
import type { LocalCommandFailure } from "./failure.ts";

type FileLocation = Readonly<URL>;

const privateFileMode = 0o600;
const privateDirectoryMode = 0o700;
const groupAndOtherPermissions = 0o077;

function isErrorCode(error: unknown, code: string): boolean {
  return Predicate.isObject(error) && "code" in error && error.code === code;
}

function closeFile(file: FileHandle): Effect.Effect<void, LocalCommandFailure> {
  return fileIo(async () => file.close());
}

const assertOwnerOnly = Effect.fn("assertOwnerOnly")(function* assertOwnerOnly(
  location: FileLocation,
) {
  const entry = yield* fileIo(async () => stat(location));
  // oxlint-disable-next-line no-bitwise -- group and other permission bits are masked out of the file mode to refuse a credentials file others can read
  if ((entry.mode & groupAndOtherPermissions) !== 0) {
    return yield* failure("credentials_permissions_invalid");
  }
  return entry;
});

function unchangedPrivateFile(
  location: FileLocation,
  content: string,
): Effect.Effect<boolean, never> {
  return assertOwnerOnly(location).pipe(
    Effect.flatMap(() => fileIo(async () => readFile(location, "utf-8"))),
    Effect.map((existing) => existing === content),
    Effect.catch(() => Effect.succeed(false)),
  );
}

const replacePrivateFile = Effect.fn("replacePrivateFile")(function* replacePrivateFile(
  location: FileLocation,
  content: string,
) {
  if (yield* unchangedPrivateFile(location, content)) {
    return;
  }
  yield* Effect.acquireUseRelease(
    fileIo(async () => open(location, "w", privateFileMode)),
    (file) => fileIo(async () => file.writeFile(content)),
    closeFile,
  );
  yield* fileIo(async () => chmod(location, privateFileMode));
});

const writePrivateFile = Effect.fn("writePrivateFile")(function* writePrivateFile(
  location: FileLocation,
  content: string,
) {
  yield* Effect.acquireUseRelease(
    Effect.tryPromise({
      catch: (error) =>
        failure(isErrorCode(error, "EEXIST") ? "configuration_exists" : "file_io_failed"),
      try: async () => open(location, "wx", privateFileMode),
    }),
    (file) => fileIo(async () => file.writeFile(content)),
    closeFile,
  ).pipe(
    Effect.catchIf(
      (error) => error.reason === "configuration_exists",
      () =>
        fileIo(async () => readFile(location, "utf-8")).pipe(
          Effect.flatMap((existing) =>
            existing === content ? Effect.void : Effect.fail(failure("configuration_differs")),
          ),
        ),
    ),
  );
  yield* assertOwnerOnly(location);
});

export {
  assertOwnerOnly,
  isErrorCode,
  privateDirectoryMode,
  privateFileMode,
  replacePrivateFile,
  writePrivateFile,
};
