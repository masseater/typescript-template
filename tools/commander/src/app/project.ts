// oxlint-disable-next-line import/no-nodejs-modules
import { createHash } from "node:crypto";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { Effect, FileSystem } from "effect";

interface Project {
  readonly directory: string;
  readonly stateDirectory: string;
}

const stateKeyLength = 12;
const localState = path.join(import.meta.dirname, "../../../../.local/commander");

function repository(start: string): Effect.Effect<string, never, FileSystem.FileSystem> {
  return Effect.gen(function* search() {
    const files = yield* FileSystem.FileSystem;
    let candidate = start;
    while (!(yield* Effect.orDie(files.exists(path.join(candidate, ".git"))))) {
      const parent = path.dirname(candidate);
      if (parent === candidate) {
        return start;
      }
      candidate = parent;
    }
    return candidate;
  });
}

function resolveProject(
  requested: string | undefined,
  current: string,
): Effect.Effect<Project, never, FileSystem.FileSystem> {
  const located =
    requested === undefined
      ? repository(current)
      : Effect.succeed(path.resolve(current, requested));
  return located.pipe(
    Effect.map((directory) => {
      const key = createHash("sha256").update(directory).digest("hex").slice(0, stateKeyLength);
      const stateDirectory = path.join(localState, key);
      return { directory, stateDirectory };
    }),
  );
}

export { resolveProject };
