import { Effect, Schema } from "effect";
// oxlint-disable-next-line import/no-nodejs-modules
import { chmod, mkdir, readdir, realpath, rename } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import type { Dirent } from "node:fs";
import { NodeRuntime } from "@effect/platform-node";
import { applications } from "@repo/config";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

class PrivateMapsFailure extends Schema.TaggedError<PrivateMapsFailure>()("PrivateMapsFailure", {
  reason: Schema.Literals([
    "file_io_failed",
    "directory_alias_forbidden",
    "symlink_forbidden",
    "private_directory_alias_forbidden",
  ]),
}) {}

type MapEntry = Readonly<Pick<Dirent, "isDirectory" | "isFile" | "isSymbolicLink" | "name">>;

interface MapMove {
  readonly destination: string;
  readonly source: string;
}

const PRIVATE_FILE_MODE = 0o600;
const PRIVATE_DIRECTORY_MODE = 0o700;

const root = fileURLToPath(new URL("../../../", import.meta.url));

function fileIo<Value>(operation: () => Promise<Value>): Effect.Effect<Value, PrivateMapsFailure> {
  return Effect.tryPromise({
    catch: () => new PrivateMapsFailure({ reason: "file_io_failed" }),
    try: operation,
  });
}

function fail(reason: PrivateMapsFailure["reason"]): Effect.Effect<never, PrivateMapsFailure> {
  return Effect.fail(new PrivateMapsFailure({ reason }));
}

const moveMap = Effect.fn("moveMap")(function* moveMap(file: string, move: MapMove) {
  const target = path.join(move.destination, path.relative(move.source, file));
  const directory = path.dirname(target);
  yield* fileIo(async () => mkdir(directory, { mode: PRIVATE_DIRECTORY_MODE, recursive: true }));
  if ((yield* fileIo(async () => realpath(directory))) !== directory) {
    return yield* fail("private_directory_alias_forbidden");
  }
  yield* fileIo(async () => rename(file, target));
  yield* fileIo(async () => chmod(target, PRIVATE_FILE_MODE));
  return 1;
});

function moveEntry(
  directory: string,
  entry: MapEntry,
  move: MapMove,
): Effect.Effect<number, PrivateMapsFailure> {
  if (entry.isSymbolicLink()) {
    return fail("symlink_forbidden");
  }
  const file = path.join(directory, entry.name);
  if (entry.isDirectory()) {
    // oxlint-disable-next-line typescript/no-use-before-define
    return moveMaps(file, move);
  }
  return entry.isFile() && entry.name.endsWith(".map") ? moveMap(file, move) : Effect.succeed(0);
}

function moveMaps(directory: string, move: MapMove): Effect.Effect<number, PrivateMapsFailure> {
  return fileIo(async () => realpath(directory)).pipe(
    Effect.flatMap((resolved) =>
      resolved === directory
        ? fileIo(async () => readdir(directory, { withFileTypes: true }))
        : fail("directory_alias_forbidden"),
    ),
    Effect.flatMap((entries) =>
      Effect.forEach(entries, (entry: MapEntry) => moveEntry(directory, entry, move)),
    ),
    Effect.map((moved) => moved.reduce((total, count) => total + count, 0)),
  );
}

function moveApplicationMaps(application: string): Effect.Effect<void, PrivateMapsFailure> {
  const source = path.join(root, "apps", application, "dist/client");
  const destination = path.join(root, ".local", "source-maps", application, "client");
  return moveMaps(source, { destination, source }).pipe(
    Effect.flatMap((moved) =>
      Effect.sync(() => {
        process.stdout.write(
          `${JSON.stringify({ audience: application, event: "build.source_maps_private", moved })}\n`,
        );
      }),
    ),
  );
}

NodeRuntime.runMain(
  Effect.forEach(applications, moveApplicationMaps, { discard: true }).pipe(
    Effect.catchCause(() =>
      Effect.sync(() => {
        process.stderr.write(`${JSON.stringify({ event: "build.source_maps_private_failed" })}\n`);
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
