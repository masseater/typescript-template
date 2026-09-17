import { chmod, mkdir, readdir, realpath, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeRuntime } from "@effect/platform-node";
import { Effect, Schema } from "effect";

class PrivateMapsFailure extends Schema.TaggedError<PrivateMapsFailure>()("PrivateMapsFailure", {
  reason: Schema.Literals([
    "audience_invalid",
    "file_io_failed",
    "directory_alias_forbidden",
    "symlink_forbidden",
    "private_directory_alias_forbidden",
  ]),
}) {}

const fileIo = <A>(operation: () => Promise<A>) =>
  Effect.tryPromise({
    try: operation,
    catch: () => new PrivateMapsFailure({ reason: "file_io_failed" }),
  });

const root = fileURLToPath(new URL("../../../", import.meta.url));

const moveMaps: (
  directory: string,
  source: string,
  destination: string,
) => Effect.Effect<number, PrivateMapsFailure> = Effect.fn("moveMaps")(function* (
  directory: string,
  source: string,
  destination: string,
) {
  if ((yield* fileIo(() => realpath(directory))) !== directory)
    return yield* new PrivateMapsFailure({ reason: "directory_alias_forbidden" });
  let moved = 0;
  for (const entry of yield* fileIo(() => readdir(directory, { withFileTypes: true }))) {
    if (entry.isSymbolicLink())
      return yield* new PrivateMapsFailure({ reason: "symlink_forbidden" });
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) moved += yield* moveMaps(file, source, destination);
    else if (entry.isFile() && entry.name.endsWith(".map")) {
      const target = path.join(destination, path.relative(source, file));
      yield* fileIo(() => mkdir(path.dirname(target), { recursive: true, mode: 0o700 }));
      if ((yield* fileIo(() => realpath(path.dirname(target)))) !== path.dirname(target))
        return yield* new PrivateMapsFailure({ reason: "private_directory_alias_forbidden" });
      yield* fileIo(() => rename(file, target));
      yield* fileIo(() => chmod(target, 0o600));
      moved += 1;
    }
  }
  return moved;
});

NodeRuntime.runMain(
  Effect.gen(function* () {
    const audience = yield* Schema.decodeUnknownEffect(Schema.Literals(["user", "admin", "wiki"]))(
      process.argv[2],
    ).pipe(Effect.mapError(() => new PrivateMapsFailure({ reason: "audience_invalid" })));
    const source = path.join(root, "apps", audience, "dist/client");
    const destination = path.join(root, ".local", "source-maps", audience, "client");
    const moved = yield* moveMaps(source, source, destination);
    console.log(JSON.stringify({ event: "build.source_maps_private", audience, moved }));
  }).pipe(
    Effect.catchCause(() =>
      Effect.sync(() => {
        console.error(JSON.stringify({ event: "build.source_maps_private_failed" }));
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
