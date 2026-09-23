import { sourceMapDirectories, sourceMapManifest } from "@repo/vite-config/source-maps";
import { Effect, FileSystem, Path, Schema } from "effect";

import { ArtifactFailure, fail } from "./artifact-io.ts";
import { isNotFound, layer, path } from "./platform.ts";
import { retainGenerations } from "./retention.ts";

import type { Application } from "@repo/config";

const OWNER_ONLY_DIRECTORY_MODE = 0o700;
const OWNER_ONLY_FILE_MODE = 0o600;
const ARCHIVED_RELEASES_KEPT = 5;

function ioFailed(): ArtifactFailure {
  return new ArtifactFailure({ code: "artifact_io_failed" });
}

function directoryExists(source: string): Effect.Effect<boolean, ArtifactFailure> {
  return Effect.gen(function* checkDirectory() {
    const filesystem = yield* FileSystem.FileSystem;
    const linked = yield* filesystem.readLink(source).pipe(
      Effect.as("link" as const),
      Effect.catch((error) =>
        Effect.succeed(isNotFound(error) ? ("missing" as const) : ("other" as const)),
      ),
    );
    if (linked === "link") {
      return yield* fail("source_map_directory_invalid");
    }
    if (linked === "missing") {
      return false;
    }
    const information = yield* filesystem.stat(source).pipe(Effect.mapError(ioFailed));
    return information.type === "Directory" ? true : yield* fail("source_map_directory_invalid");
  }).pipe(Effect.provide(layer));
}

function copyMap(
  from: string,
  destination: string,
  to: string,
): Effect.Effect<number, ArtifactFailure> {
  return Effect.gen(function* copyOneMap() {
    const filesystem = yield* FileSystem.FileSystem;
    yield* filesystem
      .makeDirectory(destination, { mode: OWNER_ONLY_DIRECTORY_MODE, recursive: true })
      .pipe(Effect.mapError(ioFailed));
    yield* filesystem.copyFile(from, to).pipe(Effect.mapError(ioFailed));
    yield* filesystem.chmod(to, OWNER_ONLY_FILE_MODE).pipe(Effect.mapError(ioFailed));
    return 1;
  }).pipe(Effect.provide(layer));
}

function copyMaps(source: string, destination: string): Effect.Effect<number, ArtifactFailure> {
  return Effect.gen(function* copyMapTree() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    if (!(yield* directoryExists(source))) {
      return 0;
    }
    const names = yield* filesystem.readDirectory(source).pipe(Effect.mapError(ioFailed));
    const copied = yield* Effect.forEach(
      names,
      (name) => {
        const from = paths.join(source, name);
        const to = paths.join(destination, name);
        return Effect.gen(function* copyEntry() {
          const linked = yield* filesystem.readLink(from).pipe(
            Effect.as(true),
            Effect.catch((error) =>
              isNotFound(error) ? fail("artifact_io_failed") : Effect.succeed(false),
            ),
          );
          if (linked) {
            return yield* fail("source_map_symlink_forbidden");
          }
          const info = yield* filesystem.stat(from).pipe(Effect.mapError(ioFailed));
          if (info.type === "Directory") {
            return yield* copyMaps(from, to);
          }
          return info.type === "File" && name.endsWith(".map")
            ? yield* copyMap(from, destination, to)
            : 0;
        });
      },
      { concurrency: "unbounded" },
    );
    return copied.reduce((total, count) => total + count, 0);
  }).pipe(Effect.provide(layer));
}

function fileExists(file: string): Effect.Effect<boolean> {
  return Effect.gen(function* checkFile() {
    const filesystem = yield* FileSystem.FileSystem;
    return yield* filesystem.exists(file).pipe(Effect.orElseSucceed(() => false));
  }).pipe(Effect.provide(layer));
}

const EmittedMaps = Schema.fromJsonString(Schema.Array(Schema.String).check(Schema.isMinLength(1)));

const requireClientSourceMaps = Effect.fn("requireClientSourceMaps")(
  function* requireClientSourceMaps(repositoryRoot: string, target: Application) {
    const filesystem = yield* FileSystem.FileSystem;
    const { client } = sourceMapDirectories(repositoryRoot, target);
    const declared = yield* filesystem
      .readFileString(sourceMapManifest(repositoryRoot, target))
      .pipe(
        Effect.flatMap(Schema.decodeEffect(EmittedMaps)),
        Effect.mapError(() => new ArtifactFailure({ code: "source_maps_missing" })),
      );
    const present = yield* Effect.forEach(declared, (file) => fileExists(path.join(client, file)), {
      concurrency: "unbounded",
    });
    if (present.includes(false)) {
      return yield* fail("source_maps_missing");
    }
  },
);

function requireClientSourceMapsProvided(
  repositoryRoot: string,
  target: Application,
): Effect.Effect<void, ArtifactFailure> {
  return requireClientSourceMaps(repositoryRoot, target).pipe(Effect.provide(layer));
}

const archiveSourceMaps = Effect.fn("archiveSourceMaps")(function* archiveSourceMaps(
  repositoryRoot: string,
  target: Application,
  release: string,
) {
  const directories = sourceMapDirectories(repositoryRoot, target);
  const destination = path.join(directories.releases, release);
  const client = yield* copyMaps(directories.client, path.join(destination, "client"));
  if (client === 0) {
    return yield* fail("source_maps_missing");
  }
  const server = yield* copyMaps(
    path.join(repositoryRoot, "apps", target, "dist", "server"),
    path.join(destination, "server"),
  );
  if (server === 0) {
    yield* Effect.gen(function* removeIncomplete() {
      const filesystem = yield* FileSystem.FileSystem;
      yield* filesystem.remove(destination, { recursive: true }).pipe(Effect.mapError(ioFailed));
    }).pipe(Effect.provide(layer));
    return yield* fail("source_maps_missing");
  }
  return { client, server };
});

function retainArchivedSourceMaps(
  repositoryRoot: string,
  target: Application,
  release: string,
): Effect.Effect<void, ArtifactFailure> {
  return retainGenerations(
    sourceMapDirectories(repositoryRoot, target).releases,
    release,
    ARCHIVED_RELEASES_KEPT,
  );
}

export {
  archiveSourceMaps,
  requireClientSourceMapsProvided as requireClientSourceMaps,
  retainArchivedSourceMaps,
};
