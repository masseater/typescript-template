// oxlint-disable-next-line import/no-nodejs-modules
import type { Dirent } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules
import { chmod, copyFile, lstat, mkdir, readdir } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { Effect } from "effect";

import type { Application } from "@repo/config";

import { fail, io } from "./artifact-io.ts";
import type { ArtifactFailure } from "./artifact-io.ts";

const OWNER_ONLY_DIRECTORY_MODE = 0o700;
const OWNER_ONLY_FILE_MODE = 0o600;

type MapEntry = Readonly<Pick<Dirent, "isDirectory" | "isFile" | "isSymbolicLink" | "name">>;

function isMissing(cause: unknown): boolean {
  return cause instanceof Error && "code" in cause && cause.code === "ENOENT";
}

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

const archiveSourceMaps = Effect.fn("archiveSourceMaps")(function* archiveSourceMaps(
  repositoryRoot: string,
  target: Application,
  release: string,
) {
  const privateMaps = path.join(repositoryRoot, ".local", "source-maps", target);
  const destination = path.join(privateMaps, "releases", release);
  return {
    client: yield* copyMaps(path.join(privateMaps, "client"), path.join(destination, "client")),
    server: yield* copyMaps(
      path.join(repositoryRoot, "apps", target, "dist", "server"),
      path.join(destination, "server"),
    ),
  };
});

export { archiveSourceMaps };
