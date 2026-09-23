import { Effect, FileSystem, type PlatformError } from "effect";

import { isMissingPath } from "./path-failure.ts";

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

const resolvedTypeAt = (
  targetPath: string,
): Effect.Effect<FileSystem.File.Type | null, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* resolvedTypeAt() {
    const filesystem = yield* FileSystem.FileSystem;
    const info = yield* unlessMissing(filesystem.stat(targetPath));
    return info === null ? null : info.type;
  });

export const pathExists = (
  targetPath: string,
): Effect.Effect<boolean, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.map(resolvedTypeAt(targetPath), (resolved) => resolved !== null);

export const isDirectoryAt = (
  targetPath: string,
): Effect.Effect<boolean, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.map(resolvedTypeAt(targetPath), (resolved) => resolved === "Directory");

export const isFileAt = (
  targetPath: string,
): Effect.Effect<boolean, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.map(resolvedTypeAt(targetPath), (resolved) => resolved === "File");
