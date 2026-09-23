import { Effect, type FileSystem, type PlatformError } from "effect";
import { uniq } from "es-toolkit";

import { readJsonFile } from "../lint/oxlint/lib/canonical-values/read-json-file.ts";
import { NEGATION_PREFIX } from "../lint/oxlint/lib/tracked-paths/ignore-listing.ts";
import { childDirectoryNamesIn } from "../platform/file-system.ts";
import { path } from "../platform/path.ts";

import type { DependencyCatalogChecksConfig } from "./config.ts";

export type WorkspaceManifest = {
  readonly relativePath: string;
  readonly manifest: unknown;
};

const SINGLE_LEVEL_PATTERN_SUFFIX = "/*";

export const directoriesMatching = ({
  repositoryRoot,
  pattern,
}: {
  readonly repositoryRoot: string;
  readonly pattern: string;
}): Effect.Effect<readonly string[], PlatformError.PlatformError, FileSystem.FileSystem> => {
  if (pattern.startsWith(NEGATION_PREFIX)) return Effect.succeed([]);
  if (!pattern.endsWith(SINGLE_LEVEL_PATTERN_SUFFIX)) return Effect.succeed([pattern]);

  const parentDirectory = pattern.slice(0, -SINGLE_LEVEL_PATTERN_SUFFIX.length);
  return childDirectoryNamesIn(path.join(repositoryRoot, parentDirectory)).pipe(
    Effect.map((childNames) => childNames.map((childName) => `${parentDirectory}/${childName}`)),
  );
};

export const readWorkspaceManifests = ({
  repositoryRoot,
  packagePatterns,
  config,
}: {
  readonly repositoryRoot: string;
  readonly packagePatterns: readonly string[];
  readonly config: DependencyCatalogChecksConfig;
}): Effect.Effect<
  readonly WorkspaceManifest[],
  PlatformError.PlatformError,
  FileSystem.FileSystem
> =>
  Effect.gen(function* readWorkspaceManifests() {
    const directories = yield* Effect.forEach(packagePatterns, (pattern) =>
      directoriesMatching({ repositoryRoot, pattern }),
    );
    const workspaceManifestPaths = uniq(
      directories
        .flat()
        .map((directory) => path.normalize(`${directory}/${config.manifestFileName}`)),
    )
      .toSorted()
      .filter((relativePath) => relativePath !== config.manifestFileName);
    const manifestPaths = [config.manifestFileName, ...workspaceManifestPaths];

    return manifestPaths.flatMap((relativePath) => {
      const manifest = readJsonFile(path.join(repositoryRoot, relativePath));
      return manifest === null ? [] : [{ relativePath, manifest }];
    });
  });
