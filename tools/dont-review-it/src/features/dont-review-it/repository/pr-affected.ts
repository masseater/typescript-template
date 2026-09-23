#!/usr/bin/env node
import { appendFileSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { affectedTests, shardDirectories, type WorkspacePackage } from "./pr-affected-scope.ts";
import { repositoryRoot } from "./repository-root.ts";
import { prCheckShardCount } from "./test-runtime.ts";

const workspaceRoots = ["apps", "libs", "infra", "tools"] as const;

const required = (name: "CHECK_SHARD" | "GITHUB_OUTPUT" | "PR_FILES_PATH"): string => {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`${name} is required`);
  }
  return value;
};

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

const outputLines = (): string => {
  const files = readFileSync(required("PR_FILES_PATH"), "utf8")
    .split("\n")
    .filter((line) => line !== "");
  const shard = Number(required("CHECK_SHARD"));
  const packages = workspacePackages();
  const affected = affectedTests(files, packages);
  const directories = shardDirectories(
    affected.kind === "all"
      ? packages.map((workspace) => workspace.directory)
      : affected.directories,
    shard,
    prCheckShardCount,
  );
  const names = directories.map((directory) => {
    const workspace = packages.find((item) => item.directory === directory);
    if (
      workspace === undefined ||
      !/^(?:apps|libs|infra|tools)\/[\w-]+$/u.test(directory) ||
      !/^@repo\/[\w-]+$/u.test(workspace.name)
    ) {
      throw new Error(`${directory} is not a workspace filter`);
    }
    return workspace.name;
  });
  return [
    `root=${String(shard === 1)}`,
    `filters=${names.map((name) => `--filter ${name}`).join(" ")}`,
    `paths=${affected.kind === "all" ? "" : directories.join(" ")}`,
    "",
  ].join("\n");
};

appendFileSync(required("GITHUB_OUTPUT"), outputLines());
