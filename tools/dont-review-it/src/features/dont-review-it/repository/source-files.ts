import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { type Cause, Effect } from "effect";

const collectSourceFiles = (
  directory: string,
): Effect.Effect<readonly string[], Cause.UnknownError> =>
  Effect.gen(function* listSourceFiles() {
    const entries = yield* Effect.tryPromise(() => readdir(directory, { withFileTypes: true }));
    const nested = yield* Effect.forEach(
      entries,
      (entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          return collectSourceFiles(path);
        }
        if (entry.isFile() && /\.[cm]?[jt]sx?$/u.test(entry.name)) {
          return Effect.succeed([path] as const);
        }
        return Effect.succeed([] as const);
      },
      { concurrency: "unbounded" },
    );
    return nested.flat();
  });

export { collectSourceFiles };
