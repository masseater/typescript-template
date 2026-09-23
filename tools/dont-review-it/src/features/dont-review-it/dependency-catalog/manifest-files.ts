import { Effect, type FileSystem, Schema } from "effect";
import { uniq } from "es-toolkit";

import { type TreeFailure } from "../platform/directory-entries.ts";
import { textOrNull } from "../platform/file-system.ts";
import { path, posixPath } from "../platform/path.ts";
import { directoriesMatching } from "../platform/workspace-patterns.ts";

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
