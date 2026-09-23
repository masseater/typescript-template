import { Effect, FileSystem, type PlatformError } from "effect";
import { parseTree } from "jsonc-parser";

import { propertyValueOf, type PublishedManifest } from "../intent-skills/manifest.ts";
import { listRepositoryFiles } from "../lint/oxlint/lib/canonical-values/source-files.ts";

export type ShippableWorkspace = {
  readonly manifest: PublishedManifest;
  readonly packageName: string;
  readonly withheld: boolean;
};

export const readShippableWorkspaces = (
  repositoryRoot: string,
): Effect.Effect<
  readonly ShippableWorkspace[],
  PlatformError.PlatformError,
  FileSystem.FileSystem
> =>
  Effect.gen(function* readShippableWorkspaces() {
    const filesystem = yield* FileSystem.FileSystem;
    const workspaces = yield* Effect.forEach(
      listRepositoryFiles(repositoryRoot).manifests,
      (file) =>
        filesystem.readFileString(file.absolutePath).pipe(
          Effect.map((source): readonly ShippableWorkspace[] => {
            const root = parseTree(source);
            if (root === undefined) return [];

            const packageName = propertyValueOf(root, "name");
            if (typeof packageName !== "string") return [];

            return [
              {
                manifest: { file, source, root },
                packageName,
                withheld: propertyValueOf(root, "private") === true,
              },
            ];
          }),
        ),
    );
    return workspaces.flat();
  });
