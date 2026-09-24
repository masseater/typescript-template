import { Effect, type FileSystem, Path } from "effect";

import { directoryEntries, type TreeFailure } from "../platform/directory-entries.ts";
import { pathExists } from "../platform/file-system.ts";
import { workspaceRoots } from "./workspace-layout.ts";

const skippedDirectoryNames = new Set([
  ".git",
  ".local",
  ".paraglide",
  ".wrangler",
  "coverage",
  "dist",
  "node_modules",
]);

type ProjectDiscovery<Discovered> = Effect.Effect<
  Discovered,
  TreeFailure,
  FileSystem.FileSystem | Path.Path
>;

const tsconfigFilesUnder = (root: string, directory: string): ProjectDiscovery<readonly string[]> =>
  Effect.gen(function* listTsconfigFiles() {
    const paths = yield* Path.Path;
    const entries = yield* directoryEntries(paths.join(root, directory));
    const nested = yield* Effect.forEach(entries, (entry) => {
      const relative = paths.join(directory, entry.name);
      if (entry.kind === "directory") {
        return skippedDirectoryNames.has(entry.name)
          ? Effect.succeed([])
          : tsconfigFilesUnder(root, relative);
      }
      return Effect.succeed(
        entry.kind === "file" && entry.name === "tsconfig.json"
          ? [relative.split(paths.sep).join("/")]
          : [],
      );
    });
    return nested.flat();
  });

const typecheckProjects = (root: string): ProjectDiscovery<readonly string[]> =>
  Effect.gen(function* typecheckProjects() {
    const paths = yield* Path.Path;
    const nested = yield* Effect.forEach(workspaceRoots, (group) =>
      Effect.flatMap(pathExists(paths.join(root, group)), (present) =>
        present ? tsconfigFilesUnder(root, group) : Effect.succeed([]),
      ),
    );
    const candidates = ["tsconfig.json", ...nested.flat()];
    const present = yield* Effect.filter(candidates, (project) =>
      pathExists(paths.join(root, project)),
    );
    return present.toSorted();
  });

export { typecheckProjects };
export type { ProjectDiscovery };
