import { Effect, FileSystem, Path, Schema } from "effect";

import { directoryEntries } from "../platform/directory-entries.ts";
import { repositoryRoot } from "./repository-root.ts";

import type { WorkspacePackage } from "./pr-affected-scope.ts";

const workspaceRoots = ["apps", "libs", "infra", "tools"] as const;

const dependencyFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

const DeclaredDependencies = Schema.optionalKey(Schema.Record(Schema.String, Schema.String));

const PackageManifest = Schema.fromJsonString(
  Schema.Struct({
    dependencies: DeclaredDependencies,
    devDependencies: DeclaredDependencies,
    name: Schema.optionalKey(Schema.String),
    optionalDependencies: DeclaredDependencies,
    peerDependencies: DeclaredDependencies,
  }),
);

class UnnamedWorkspace extends Schema.TaggedError<UnnamedWorkspace>()("UnnamedWorkspace", {
  directory: Schema.String,
}) {
  public override get message(): string {
    return `${this.directory} is missing a package name`;
  }
}

const dependencyNames = (manifest: typeof PackageManifest.Type): readonly string[] =>
  dependencyFields.flatMap((field) => {
    const declared = manifest[field];
    if (declared === undefined) {
      return [];
    }
    return Object.entries(declared).flatMap(([name, version]) =>
      version.startsWith("workspace:") ? [name] : [],
    );
  });

const workspacePackages = Effect.gen(function* workspacePackages() {
  const filesystem = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  const grouped = yield* Effect.forEach(workspaceRoots, (root) =>
    Effect.gen(function* workspacesUnder() {
      const entries = yield* directoryEntries(paths.join(repositoryRoot, root));
      const directories = entries.filter((entry) => entry.kind === "directory");
      return yield* Effect.forEach(directories, (entry) =>
        Effect.gen(function* workspacePackage() {
          const directory = `${root}/${entry.name}`;
          const manifest = yield* Schema.decodeEffect(PackageManifest)(
            yield* filesystem.readFileString(
              paths.join(repositoryRoot, root, entry.name, "package.json"),
            ),
          );
          if (manifest.name === undefined) {
            return yield* new UnnamedWorkspace({ directory });
          }
          const workspace: WorkspacePackage = {
            dependencies: dependencyNames(manifest),
            directory,
            name: manifest.name,
          };
          return workspace;
        }),
      );
    }),
  );
  return grouped.flat();
});

export { workspacePackages };
