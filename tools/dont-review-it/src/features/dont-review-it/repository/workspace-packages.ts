import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { repositoryRoot } from "./repository-root.ts";

import type { WorkspacePackage } from "./pr-affected-scope.ts";

const workspaceRoots = ["apps", "libs", "infra", "tools"] as const;

const dependencyFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

type PackageManifest = Readonly<{
  dependencies?: Readonly<Record<string, string>>;
  devDependencies?: Readonly<Record<string, string>>;
  name?: string;
  optionalDependencies?: Readonly<Record<string, string>>;
  peerDependencies?: Readonly<Record<string, string>>;
}>;

const dependencyNames = (manifest: PackageManifest): readonly string[] =>
  dependencyFields.flatMap((field) => {
    const declared = manifest[field];
    if (declared === undefined) {
      return [];
    }
    return Object.entries(declared).flatMap(([name, version]) =>
      version.startsWith("workspace:") ? [name] : [],
    );
  });

const workspacePackages = (): readonly WorkspacePackage[] =>
  workspaceRoots.flatMap((root) =>
    readdirSync(path.join(repositoryRoot, root), { withFileTypes: true }).flatMap((entry) => {
      if (!entry.isDirectory()) {
        return [];
      }
      const manifest = JSON.parse(
        readFileSync(path.join(repositoryRoot, root, entry.name, "package.json"), "utf8"),
      ) as PackageManifest;
      if (manifest.name === undefined) {
        throw new Error(`${root}/${entry.name} is missing a package name`);
      }
      return [
        {
          dependencies: dependencyNames(manifest),
          directory: `${root}/${entry.name}`,
          name: manifest.name,
        },
      ];
    }),
  );

export { workspacePackages };
