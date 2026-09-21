import { Effect, FileSystem, Path, PlatformError, Predicate, Result } from "effect";

import { failure } from "./failure.ts";
import { isAlreadyExists, urlPath, withFileSystem } from "./platform.ts";

type FileLocation = Readonly<URL>;

const privateFileMode = 0o600;
const privateDirectoryMode = 0o700;
const groupAndOtherPermissions = 0o077;
const textEncoder = new TextEncoder();

function isErrorCode(error: unknown, code: string): boolean {
  return Predicate.isObject(error) && "code" in error && error.code === code;
}

function withFileSystemError<A, R = never>(
  operation: (fs: FileSystem.FileSystem) => Effect.Effect<A, PlatformError.PlatformError, R>,
): Effect.Effect<A, PlatformError.PlatformError, FileSystem.FileSystem | R> {
  return FileSystem.FileSystem.pipe(Effect.flatMap(operation));
}

const assertOwnerOnly = Effect.fn("assertOwnerOnly")(function* assertOwnerOnly(
  location: FileLocation,
) {
  const path = yield* urlPath(location);
  const entry = yield* withFileSystem((fs) => fs.stat(path));
  // oxlint-disable-next-line no-bitwise
  if ((entry.mode & groupAndOtherPermissions) !== 0) {
    return yield* failure("credentials_permissions_invalid");
  }
  return entry;
});

function unchangedPrivateFile(
  location: FileLocation,
  content: string,
): Effect.Effect<boolean, never, FileSystem.FileSystem | Path.Path> {
  return assertOwnerOnly(location).pipe(
    Effect.flatMap(() =>
      urlPath(location).pipe(
        Effect.flatMap((path) => withFileSystem((fs) => fs.readFileString(path))),
      ),
    ),
    Effect.map((existing) => existing === content),
    Effect.catch(() => Effect.succeed(false)),
  );
}

const replacePrivateFile = Effect.fn("replacePrivateFile")(function* replacePrivateFile(
  location: FileLocation,
  content: string,
) {
  const path = yield* urlPath(location);
  if (yield* unchangedPrivateFile(location, content)) {
    return;
  }
  yield* Effect.scoped(
    withFileSystem((fs) =>
      fs
        .open(path, { flag: "w", mode: privateFileMode })
        .pipe(Effect.flatMap((file) => file.writeAll(textEncoder.encode(content)))),
    ),
  );
  yield* withFileSystem((fs) => fs.chmod(path, privateFileMode));
});

const writePrivateFile = Effect.fn("writePrivateFile")(function* writePrivateFile(
  location: FileLocation,
  content: string,
) {
  const path = yield* urlPath(location);
  const written = yield* Effect.result(
    Effect.scoped(
      withFileSystemError((fs) =>
        fs
          .open(path, { flag: "wx", mode: privateFileMode })
          .pipe(Effect.flatMap((file) => file.writeAll(textEncoder.encode(content)))),
      ),
    ),
  );
  if (Result.isFailure(written)) {
    if (!isAlreadyExists(written.failure)) {
      return yield* failure("file_io_failed");
    }
    const existing = yield* withFileSystem((fs) => fs.readFileString(path));
    if (existing !== content) {
      return yield* failure("configuration_differs");
    }
  }
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
