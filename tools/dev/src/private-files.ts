// oxlint-disable-next-line import/no-nodejs-modules
import { chmod, open, readFile, stat } from "node:fs/promises";
import { failure, fileIo } from "./failure.ts";
import { Effect } from "effect";
// oxlint-disable-next-line import/no-nodejs-modules
import type { FileHandle } from "node:fs/promises";
import type { LocalCommandFailure } from "./failure.ts";

type FileLocation = Readonly<URL>;

const privateFileMode = 0o600;
const privateDirectoryMode = 0o700;
const groupAndOtherPermissions = 0o077;

function isErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function closeFile(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  file: FileHandle,
): Effect.Effect<void, LocalCommandFailure> {
  return fileIo(async () => file.close());
}

const assertOwnerOnly = Effect.fn("assertOwnerOnly")(function* assertOwnerOnly(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  location: FileLocation,
) {
  const entry = yield* fileIo(async () => stat(location));
  // oxlint-disable-next-line no-bitwise
  if ((entry.mode & groupAndOtherPermissions) !== 0) {
    return yield* failure("credentials_permissions_invalid");
  }
  return entry;
});

const replacePrivateFile = Effect.fn("replacePrivateFile")(function* replacePrivateFile(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  location: FileLocation,
  content: string,
) {
  yield* Effect.acquireUseRelease(
    fileIo(async () => open(location, "w", privateFileMode)),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    (file) => fileIo(async () => file.writeFile(content)),
    closeFile,
  );
  yield* fileIo(async () => chmod(location, privateFileMode));
});

const writePrivateFile = Effect.fn("writePrivateFile")(function* writePrivateFile(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  location: FileLocation,
  content: string,
) {
  yield* Effect.acquireUseRelease(
    Effect.tryPromise({
      catch: (error) =>
        failure(isErrorCode(error, "EEXIST") ? "configuration_exists" : "file_io_failed"),
      try: async () => open(location, "wx", privateFileMode),
    }),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    (file) => fileIo(async () => file.writeFile(content)),
    closeFile,
  ).pipe(
    Effect.catchIf(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
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
