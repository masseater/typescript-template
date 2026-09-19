// oxlint-disable-next-line import/no-nodejs-modules
import { access, chmod, copyFile, lstat, mkdir, readFile, readdir } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { sourceMapDirectories, sourceMapManifest } from "@repo/config/source-maps";
import { Effect, Schema } from "effect";

import { ArtifactFailure, fail, io, isMissing } from "./artifact-io.ts";
import { retainGenerations } from "./retention.ts";

// oxlint-disable-next-line import/no-nodejs-modules
import type { Dirent } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules
import type { Application } from "@repo/config";

const OWNER_ONLY_DIRECTORY_MODE = 0o700;
const OWNER_ONLY_FILE_MODE = 0o600;
const ARCHIVED_RELEASES_KEPT = 5;

type MapEntry = Readonly<Pick<Dirent, "isDirectory" | "isFile" | "isSymbolicLink" | "name">>;

function directoryExists(source: string): Effect.Effect<boolean, ArtifactFailure> {
  return Effect.tryPromise({
    catch: (cause) => ({ cause }),
    try: async () => lstat(source),
  }).pipe(
    Effect.matchEffect({
      onFailure: ({ cause }) =>
        isMissing(cause) ? Effect.succeed(false) : fail("artifact_io_failed"),
      onSuccess: (information) =>
        information.isDirectory() ? Effect.succeed(true) : fail("source_map_directory_invalid"),
    }),
  );
}

function copyMap(
  from: string,
  destination: string,
  to: string,
): Effect.Effect<number, ArtifactFailure> {
  return io(async () => {
    await mkdir(destination, { mode: OWNER_ONLY_DIRECTORY_MODE, recursive: true });
    await copyFile(from, to);
    await chmod(to, OWNER_ONLY_FILE_MODE);
    return 1;
  });
}

function copyEntry(
  entry: MapEntry,
  source: string,
  destination: string,
): Effect.Effect<number, ArtifactFailure> {
  if (entry.isSymbolicLink()) {
    return fail("source_map_symlink_forbidden");
  }
  const from = path.join(source, entry.name);
  const to = path.join(destination, entry.name);
  if (entry.isDirectory()) {
    // oxlint-disable-next-line typescript/no-use-before-define
    return copyMaps(from, to);
  }
  return entry.isFile() && entry.name.endsWith(".map")
    ? copyMap(from, destination, to)
    : Effect.succeed(0);
}

function copyMaps(source: string, destination: string): Effect.Effect<number, ArtifactFailure> {
  return directoryExists(source).pipe(
    Effect.flatMap((exists) =>
      exists
        ? io(async () => readdir(source, { withFileTypes: true })).pipe(
            Effect.flatMap((entries) =>
              Effect.all(entries.map((entry: MapEntry) => copyEntry(entry, source, destination))),
            ),
            Effect.map((copied) => copied.reduce((total, count) => total + count, 0)),
          )
        : Effect.succeed(0),
    ),
  );
}

function fileExists(file: string): Effect.Effect<boolean> {
  return Effect.tryPromise(async () => access(file)).pipe(
    Effect.match({ onFailure: () => false, onSuccess: () => true }),
  );
}

const EmittedMaps = Schema.fromJsonString(Schema.Array(Schema.String).check(Schema.isMinLength(1)));

const requireClientSourceMaps = Effect.fn("requireClientSourceMaps")(
  function* requireClientSourceMaps(repositoryRoot: string, target: Application) {
    const { client } = sourceMapDirectories(repositoryRoot, target);
    const declared = yield* io(async () =>
      readFile(sourceMapManifest(repositoryRoot, target), "utf-8"),
    ).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(EmittedMaps)),
      Effect.mapError(() => new ArtifactFailure({ code: "source_maps_missing" })),
    );
    const present = yield* Effect.all(
      declared.map((file) => fileExists(path.join(client, file))),
      { concurrency: "unbounded" },
    );
    if (present.includes(false)) {
      return yield* fail("source_maps_missing");
    }
  },
);

const archiveSourceMaps = Effect.fn("archiveSourceMaps")(function* archiveSourceMaps(
  repositoryRoot: string,
  target: Application,
  release: string,
) {
  const directories = sourceMapDirectories(repositoryRoot, target);
  const destination = path.join(directories.releases, release);
  return {
    client: yield* copyMaps(directories.client, path.join(destination, "client")),
    server: yield* copyMaps(
      path.join(repositoryRoot, "apps", target, "dist", "server"),
      path.join(destination, "server"),
    ),
  };
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

export { archiveSourceMaps, requireClientSourceMaps, retainArchivedSourceMaps };
