import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path, PlatformError } from "effect";

import { failure } from "./failure.ts";

import type { LocalCommandFailure } from "./failure.ts";

type DevServices = NodeServices.NodeServices;

const layer = NodeServices.layer;

function isSystemError(
  error: PlatformError.PlatformError,
  tag: PlatformError.SystemErrorTag,
): boolean {
  return error.reason instanceof PlatformError.SystemError && error.reason._tag === tag;
}

function isNotFound(error: PlatformError.PlatformError): boolean {
  return isSystemError(error, "NotFound");
}

function isAlreadyExists(error: PlatformError.PlatformError): boolean {
  return isSystemError(error, "AlreadyExists");
}

function mapFileError(): LocalCommandFailure {
  return failure("file_io_failed");
}

function withFileSystem<A>(
  operation: (fs: FileSystem.FileSystem) => Effect.Effect<A, PlatformError.PlatformError>,
): Effect.Effect<A, LocalCommandFailure, FileSystem.FileSystem> {
  return FileSystem.FileSystem.pipe(Effect.flatMap(operation), Effect.mapError(mapFileError));
}

function urlPath(url: URL): Effect.Effect<string, LocalCommandFailure, Path.Path> {
  return Path.Path.pipe(
    Effect.flatMap((path) => path.fromFileUrl(url)),
    Effect.mapError(mapFileError),
  );
}

export {
  type DevServices,
  isAlreadyExists,
  isNotFound,
  layer,
  urlPath,
  withFileSystem,
};
