import { Effect, FileSystem, Option, Path } from "effect";

import { ArtifactFailure, isMissing } from "./artifact-io.ts";
import { layer } from "./platform.ts";

interface Generation {
  readonly modified: number;
  readonly name: string;
}

function newestFirst(left: Generation, right: Generation): number {
  return right.modified - left.modified;
}

function ioFailed(): ArtifactFailure {
  return new ArtifactFailure({ code: "artifact_io_failed" });
}

const generations = Effect.fn("generations")(function* generations(parent: string) {
  const filesystem = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  const names = yield* filesystem
    .readDirectory(parent)
    .pipe(
      Effect.mapError((cause) =>
        isMissing(cause) ? new ArtifactFailure({ code: "generations_missing" }) : ioFailed(),
      ),
    );
  const listed = yield* Effect.forEach(
    names,
    (name) =>
      filesystem.stat(paths.join(parent, name)).pipe(
        Effect.mapError(ioFailed),
        Effect.map((information) =>
          information.type === "Directory"
            ? ({
                modified: Option.match(information.mtime, {
                  onNone: () => 0,
                  onSome: (mtime) => mtime.getTime(),
                }),
                name,
              } satisfies Generation)
            : undefined,
        ),
      ),
    { concurrency: "unbounded" },
  );
  return listed.filter((generation) => generation !== undefined);
});

function retainGenerations(
  parent: string,
  pinned: string,
  kept: number,
): Effect.Effect<void, ArtifactFailure> {
  return Effect.gen(function* retain() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const found = yield* generations(parent);
    const retained = new Set([
      pinned,
      ...found
        .filter((generation) => generation.name !== pinned)
        .toSorted(newestFirst)
        .slice(0, Math.max(kept - 1, 0))
        .map((generation) => generation.name),
    ]);
    yield* Effect.forEach(
      found.filter((generation) => !retained.has(generation.name)),
      (generation) =>
        filesystem
          .remove(paths.join(parent, generation.name), { recursive: true })
          .pipe(Effect.mapError(ioFailed)),
      { concurrency: "unbounded", discard: true },
    );
  }).pipe(Effect.provide(layer));
}

export { retainGenerations };
