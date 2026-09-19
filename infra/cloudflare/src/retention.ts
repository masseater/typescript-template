// oxlint-disable-next-line import/no-nodejs-modules
import { readdir, rm, stat } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { Effect } from "effect";

import { io, isMissing } from "./artifact-io.ts";

// oxlint-disable-next-line import/no-nodejs-modules
import type { Dirent } from "node:fs";
import type { ArtifactFailure } from "./artifact-io.ts";

type GenerationEntry = Readonly<Pick<Dirent, "isDirectory" | "name">>;

interface Generation {
  readonly modified: number;
  readonly name: string;
}

function newestFirst(left: Generation, right: Generation): number {
  return right.modified - left.modified;
}

const generations = Effect.fn("generations")(function* generations(parent: string) {
  const entries = yield* io(async (): Promise<readonly GenerationEntry[]> => {
    try {
      return await readdir(parent, { withFileTypes: true });
    } catch (cause) {
      if (isMissing(cause)) {
        return [];
      }
      throw cause;
    }
  });
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

function retainGenerations(
  parent: string,
  pinned: string,
  kept: number,
): Effect.Effect<void, ArtifactFailure> {
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
}

export { retainGenerations };
