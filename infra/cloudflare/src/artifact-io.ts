import { Effect, FileSystem, Option, Path, PlatformError, Schema } from "effect";

import { isNotFound, layer } from "./platform.ts";

class ArtifactFailure extends Schema.TaggedError<ArtifactFailure>()("ArtifactFailure", {
  code: Schema.Literals([
    "artifact_io_failed",
    "artifact_symlink_forbidden",
    "artifact_file_type_invalid",
    "artifact_directory_symlink_forbidden",
    "private_client_artifact",
    "server_only_code_in_client",
    "client_artifacts_empty",
    "worker_entry_missing_index_js",
    "worker_entry_empty",
    "worker_module_type_unsupported",
    "server_css_without_public_asset",
    "artifact_staging_symlink_forbidden",
    "artifact_staging_link_forbidden",
    "artifact_staging_contaminated",
    "source_map_directory_invalid",
    "source_maps_missing",
    "source_map_symlink_forbidden",
    "budget_worker_artifact_empty",
    "error_worker_artifact_empty",
    "health_worker_artifact_empty",
    "generations_missing",
  ]),
}) {}

function fail(code: ArtifactFailure["code"]): Effect.Effect<never, ArtifactFailure> {
  return new ArtifactFailure({ code });
}

function ioFailed(): ArtifactFailure {
  return new ArtifactFailure({ code: "artifact_io_failed" });
}

function isMissing(cause: unknown): boolean {
  return cause instanceof PlatformError.PlatformError && isNotFound(cause);
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((byte, index) => byte === right[index]);
}

function files(directory: string): Effect.Effect<string[], ArtifactFailure> {
  return Effect.gen(function* listFiles() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const names = yield* filesystem.readDirectory(directory).pipe(Effect.mapError(ioFailed));
    const nested = yield* Effect.forEach(
      names,
      (name) => {
        const filename = paths.join(directory, name);
        return Effect.gen(function* classifyEntry() {
          const linked = yield* filesystem.readLink(filename).pipe(
            Effect.as(true),
            Effect.catch((error) =>
              isNotFound(error) ? fail("artifact_io_failed") : Effect.succeed(false),
            ),
          );
          if (linked) {
            return yield* fail("artifact_symlink_forbidden");
          }
          const info = yield* filesystem.stat(filename).pipe(Effect.mapError(ioFailed));
          if (info.type === "Directory") {
            return yield* files(filename);
          }
          return info.type === "File" ? [filename] : yield* fail("artifact_file_type_invalid");
        });
      },
      { concurrency: "unbounded" },
    );
    return nested.flat().toSorted();
  }).pipe(Effect.provide(layer));
}

function sha256Hex(content: Uint8Array): Effect.Effect<string, ArtifactFailure> {
  return Effect.tryPromise({
    catch: ioFailed,
    try: () => crypto.subtle.digest("SHA-256", Uint8Array.from(content)),
  }).pipe(Effect.map((digest) => Buffer.from(digest).toString("hex")));
}

function fileSha256(file: string): Effect.Effect<string, ArtifactFailure> {
  return Effect.gen(function* hashFile() {
    const filesystem = yield* FileSystem.FileSystem;
    return yield* filesystem
      .readFile(file)
      .pipe(Effect.mapError(ioFailed), Effect.flatMap(sha256Hex));
  }).pipe(Effect.provide(layer));
}

function jsonSha256(value: unknown): Effect.Effect<string, ArtifactFailure> {
  return sha256Hex(new TextEncoder().encode(JSON.stringify(value)));
}

function sameContent(left: string, right: string): Effect.Effect<boolean, ArtifactFailure> {
  return Effect.gen(function* compareFiles() {
    const filesystem = yield* FileSystem.FileSystem;
    const [leftContent, rightContent] = yield* Effect.all(
      [filesystem.readFile(left), filesystem.readFile(right)],
      { concurrency: 2 },
    ).pipe(Effect.mapError(ioFailed));
    return equalBytes(leftContent, rightContent);
  }).pipe(Effect.provide(layer));
}

function assertRealDirectory(
  directory: string,
  code: ArtifactFailure["code"],
): Effect.Effect<void, ArtifactFailure> {
  return Effect.gen(function* checkRealDirectory() {
    const filesystem = yield* FileSystem.FileSystem;
    const resolved = yield* filesystem.realPath(directory).pipe(Effect.mapError(ioFailed));
    if (resolved !== directory) {
      return yield* fail(code);
    }
  }).pipe(Effect.provide(layer));
}

function readFileString(file: string): Effect.Effect<string, ArtifactFailure> {
  return Effect.gen(function* readString() {
    const filesystem = yield* FileSystem.FileSystem;
    return yield* filesystem.readFileString(file).pipe(Effect.mapError(ioFailed));
  }).pipe(Effect.provide(layer));
}

function fileSize(file: string): Effect.Effect<number, ArtifactFailure> {
  return Effect.gen(function* readSize() {
    const filesystem = yield* FileSystem.FileSystem;
    const info = yield* filesystem.stat(file).pipe(Effect.mapError(ioFailed));
    return Number(info.size);
  }).pipe(Effect.provide(layer));
}

function isSymlink(location: string): Effect.Effect<boolean, ArtifactFailure> {
  return Effect.gen(function* checkLink() {
    const filesystem = yield* FileSystem.FileSystem;
    return yield* filesystem.readLink(location).pipe(
      Effect.as(true),
      Effect.catch((error) =>
        isNotFound(error) ? fail("artifact_io_failed") : Effect.succeed(false),
      ),
    );
  }).pipe(Effect.provide(layer));
}

function fileInfo(location: string): Effect.Effect<FileSystem.File.Info, ArtifactFailure> {
  return Effect.gen(function* readInfo() {
    const filesystem = yield* FileSystem.FileSystem;
    return yield* filesystem.stat(location).pipe(Effect.mapError(ioFailed));
  }).pipe(Effect.provide(layer));
}

function linkCount(info: FileSystem.File.Info): number {
  return Option.getOrElse(info.nlink, () => 0);
}

export {
  ArtifactFailure,
  assertRealDirectory,
  fail,
  fileInfo,
  fileSha256,
  fileSize,
  files,
  isMissing,
  isSymlink,
  jsonSha256,
  linkCount,
  readFileString,
  sameContent,
};
