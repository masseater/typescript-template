import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

import { Effect } from "effect";

import { io } from "./artifact-io.ts";

import type { Dirent } from "node:fs";
import type { ArtifactFailure } from "./artifact-io.ts";

type Generation = {
  readonly modified: number;
  readonly name: string;
};

const newestFirst = (left: Generation, right: Generation): number => {
  return right.modified - left.modified;
};

type GenerationEntry = Readonly<Pick<Dirent, "isDirectory" | "name">>;

const generations = Effect.fn("generations")(function* generations(parent: string) {
  const entries = yield* io(async () => readdir(parent, { withFileTypes: true })).pipe(
    Effect.orElseSucceed((): GenerationEntry[] => []),
  );
  return yield* Effect.all(
    entries
      .filter((entry: GenerationEntry) => entry.isDirectory())
      .map((entry: GenerationEntry) =>
        io(async () => stat(path.join(parent, entry.name))).pipe(
          Effect.map((information): Generation => ({
            modified: information.mtimeMs,
            name: entry.name,
          })),
        ),
      ),
    { concurrency: "unbounded" },
  );
});

const retainGenerations = (
  parent: string,
  pinned: string,
  kept: number,
): Effect.Effect<void, ArtifactFailure> => {
  return generations(parent).pipe(
    Effect.flatMap((found) => {
      const retained = new Set([
        pinned,
        ...found
          .filter((generation) => generation.name !== pinned)
          .toSorted(newestFirst)
          .slice(0, Math.max(kept - 1, 0))
          .map((generation) => generation.name),
      ]);
      return Effect.all(
        found
          .filter((generation) => !retained.has(generation.name))
          .map((generation) =>
            io(async () => rm(path.join(parent, generation.name), { recursive: true })),
          ),
        { concurrency: "unbounded", discard: true },
      );
    }),
  );
};

export { retainGenerations };
