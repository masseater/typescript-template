import { Effect, FileSystem } from "effect";

import {
  ArtifactFailure,
  assertRealDirectory,
  fail,
  fileInfo,
  files,
  isSymlink,
  linkCount,
  sameContent,
} from "./artifact-io.ts";
import { layer, path } from "./platform.ts";

function ioFailed(): ArtifactFailure {
  return new ArtifactFailure({ code: "artifact_io_failed" });
}

const assertExistingStagedCopy = Effect.fn("assertExistingStagedCopy")(
  function* assertExistingStagedCopy(source: string, destination: string) {
    if (yield* isSymlink(destination)) {
      return yield* fail("artifact_staging_link_forbidden");
    }
    const existing = yield* fileInfo(destination);
    if (existing.type !== "File" || linkCount(existing) !== 1) {
      return yield* fail("artifact_staging_link_forbidden");
    }
    if (!(yield* sameContent(source, destination))) {
      return yield* fail("artifact_staging_contaminated");
    }
    return destination;
  },
);

const stageFile = Effect.fn("stageFile")(function* stageFile(source: string, destination: string) {
  const filesystem = yield* FileSystem.FileSystem;
  yield* filesystem
    .makeDirectory(path.dirname(destination), { recursive: true })
    .pipe(Effect.mapError(ioFailed));
  yield* assertRealDirectory(path.dirname(destination), "artifact_staging_symlink_forbidden");
  if (yield* filesystem.exists(destination).pipe(Effect.mapError(ioFailed))) {
    return yield* assertExistingStagedCopy(source, destination);
  }
  yield* filesystem.copyFile(source, destination).pipe(Effect.mapError(ioFailed));
  return destination;
});

const stageFiles = Effect.fn("stageFiles")(function* stageFiles(
  source: string,
  staging: string,
  sourceFiles: readonly string[],
) {
  const filesystem = yield* FileSystem.FileSystem;
  yield* filesystem.makeDirectory(staging, { recursive: true }).pipe(Effect.mapError(ioFailed));
  yield* assertRealDirectory(staging, "artifact_staging_symlink_forbidden");
  yield* Effect.forEach(
    sourceFiles,
    (file) => stageFile(file, path.join(staging, path.relative(source, file))),
    { concurrency: "unbounded", discard: true },
  );
  const stagedFiles = yield* files(staging);
  const unexpected = stagedFiles.some(
    (file) => !sourceFiles.includes(path.join(source, path.relative(staging, file))),
  );
  if (stagedFiles.length !== sourceFiles.length || unexpected) {
    return yield* fail("artifact_staging_contaminated");
  }
});

function stageFilesProvided(
  source: string,
  staging: string,
  sourceFiles: readonly string[],
): Effect.Effect<void, ArtifactFailure> {
  return stageFiles(source, staging, sourceFiles).pipe(Effect.provide(layer));
}

export { stageFilesProvided as stageFiles };
