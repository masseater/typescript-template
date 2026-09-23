import { Effect, type FileSystem, Schema } from "effect";
import { uniq } from "es-toolkit";

import { NEGATION_PREFIX } from "../lint/oxlint/lib/tracked-paths/ignore-listing.ts";
import { childDirectoryNamesIn, type TreeFailure } from "../platform/directory-entries.ts";
import { textOrNull } from "../platform/file-system.ts";
import { path, posixPath } from "../platform/path.ts";

import type { DependencyCatalogChecksConfig } from "./config.ts";

export type WorkspaceManifest = {
  readonly relativePath: string;
  readonly manifest: unknown;
};

class ManifestUnparsable extends Schema.TaggedError<ManifestUnparsable>()("ManifestUnparsable", {
  file: Schema.String,
  cause: Schema.Defect(),
}) {
  override get message(): string {
    return `${this.file} exists but does not parse as JSON, so the dependencies it declares cannot be checked.`;
  }
}

export type ManifestReadFailure = TreeFailure | ManifestUnparsable;

const decodeManifest = Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown));

const manifestAt = (
  file: string,
): Effect.Effect<unknown, ManifestReadFailure, FileSystem.FileSystem> =>
  Effect.gen(function* manifestAt() {
    const text = yield* textOrNull(file);
    if (text === null) return null;
    return yield* decodeManifest(text).pipe(
      Effect.mapError((unparsable) => new ManifestUnparsable({ file, cause: unparsable })),
    );
  });

const SINGLE_LEVEL_PATTERN_SUFFIX = "/*";

export const directoriesMatching = ({
  repositoryRoot,
  pattern,
}: {
  readonly repositoryRoot: string;
  readonly pattern: string;
}): Effect.Effect<readonly string[], TreeFailure, FileSystem.FileSystem> => {
  if (pattern.startsWith(NEGATION_PREFIX)) return Effect.succeed([]);
  if (!pattern.endsWith(SINGLE_LEVEL_PATTERN_SUFFIX)) return Effect.succeed([pattern]);

  const parentDirectory = pattern.slice(0, -SINGLE_LEVEL_PATTERN_SUFFIX.length);
  return childDirectoryNamesIn(path.join(repositoryRoot, parentDirectory)).pipe(
    Effect.map((childNames) =>
      childNames === null ? [] : childNames.map((childName) => `${parentDirectory}/${childName}`),
    ),
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
}): Effect.Effect<readonly WorkspaceManifest[], ManifestReadFailure, FileSystem.FileSystem> =>
  Effect.gen(function* readWorkspaceManifests() {
    const directories = yield* Effect.forEach(packagePatterns, (pattern) =>
      directoriesMatching({ repositoryRoot, pattern }),
    );
    const workspaceManifestPaths = uniq(
      directories
        .flat()
        .map((directory) => posixPath.normalize(`${directory}/${config.manifestFileName}`)),
    )
      .toSorted()
      .filter((relativePath) => relativePath !== config.manifestFileName);
    const manifestPaths = [config.manifestFileName, ...workspaceManifestPaths];

    const manifests = yield* Effect.forEach(manifestPaths, (relativePath) =>
      Effect.map(manifestAt(path.join(repositoryRoot, relativePath)), (manifest) =>
        manifest === null ? [] : [{ relativePath, manifest }],
      ),
    );
    return manifests.flat();
  });
