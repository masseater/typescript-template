import { Effect, Path } from "effect";

import { directoryEntries, type TreeScan } from "../platform/directory-entries.ts";

const sourceSuffix = /\.[cm]?[jt]sx?$/u;

const collectSourceFiles = (directory: string): TreeScan<readonly string[]> =>
  Effect.gen(function* listSourceFiles() {
    const paths = yield* Path.Path;
    const entries = yield* directoryEntries(directory);
    const nested = yield* Effect.forEach(
      entries,
      (entry): TreeScan<readonly string[]> => {
        const entryPath = paths.join(directory, entry.name);
        if (entry.kind === "directory") {
          return collectSourceFiles(entryPath);
        }
        if (entry.kind === "file" && sourceSuffix.test(entry.name)) {
          return Effect.succeed([entryPath]);
        }
        return Effect.succeed([]);
      },
      { concurrency: "unbounded" },
    );
    return nested.flat();
  });

export { collectSourceFiles };
