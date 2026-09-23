import { Effect, FileSystem, type PlatformError } from "effect";

import { failureCodeOf } from "../repository-checks/index.ts";
import { path } from "./path.ts";

const MISSING_PARENT_CODE = "ENOTDIR";

export const isMissingPath = (failure: PlatformError.PlatformError): boolean =>
  failure.reason._tag === "NotFound" ||
  (failure.reason._tag === "BadResource" &&
    failureCodeOf(failure.reason.cause) === MISSING_PARENT_CODE);

export const failureMessageOf = (failure: PlatformError.PlatformError): string =>
  failure.reason.cause instanceof Error ? failure.reason.cause.message : failure.message;

export const unlessMissing = <Read, Services>(
  read: Effect.Effect<Read, PlatformError.PlatformError, Services>,
): Effect.Effect<Read | null, PlatformError.PlatformError, Services> =>
  read.pipe(Effect.catchIf(isMissingPath, () => Effect.succeed(null)));

export const textOrNull = (
  filePath: string,
): Effect.Effect<string | null, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* textOrNull() {
    const filesystem = yield* FileSystem.FileSystem;
    return yield* unlessMissing(filesystem.readFileString(filePath));
  });

const entryTypeOf = (
  entryPath: string,
): Effect.Effect<FileSystem.File.Type | null, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* entryTypeOf() {
    const filesystem = yield* FileSystem.FileSystem;
    const info = yield* unlessMissing(filesystem.stat(entryPath));
    return info === null ? null : info.type;
  });

export const childDirectoryNamesIn = (
  parentPath: string,
): Effect.Effect<readonly string[], PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* childDirectoryNamesIn() {
    const filesystem = yield* FileSystem.FileSystem;
    const childNames = (yield* unlessMissing(filesystem.readDirectory(parentPath))) ?? [];
    const directoryNames = yield* Effect.filter(childNames, (childName) =>
      entryTypeOf(path.join(parentPath, childName)).pipe(
        Effect.map((entryType) => entryType === "Directory"),
      ),
    );
    return directoryNames.toSorted();
  });

export const filesUnder = ({
  directory,
  keeps,
}: {
  readonly directory: string;
  readonly keeps: (relativePath: string) => boolean;
}): Effect.Effect<readonly string[], PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* filesUnder() {
    const filesystem = yield* FileSystem.FileSystem;
    const listed =
      (yield* unlessMissing(filesystem.readDirectory(directory, { recursive: true }))) ?? [];
    const files = yield* Effect.filter(listed.filter(keeps), (relativePath) =>
      entryTypeOf(path.join(directory, relativePath)).pipe(
        Effect.map((entryType) => entryType === "File"),
      ),
    );
    return files.map((relativePath) => path.join(directory, relativePath)).toSorted();
  });
