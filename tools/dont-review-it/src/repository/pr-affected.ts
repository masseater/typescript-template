#!/usr/bin/env node
import { appendFileSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { affectedTests, type WorkspacePackage } from "./pr-affected-scope.ts";
import { repositoryRoot } from "./repository-root.ts";

const workspaceRoots = ["apps", "libs", "infra", "tools"] as const;

const required = (name: "GITHUB_OUTPUT" | "PR_FILES_PATH"): string => {
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
  const packages = workspacePackages();
  const affected = affectedTests(files, packages);
  if (affected.kind === "all") {
    return "scope=all\n";
  }
  const names = affected.directories.map((directory) => {
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
  if (names.length === 0) {
    throw new Error("affected scope is empty");
  }
  return `scope=subset\npaths=${affected.directories.join(" ")}\nfilters=${names.map((name) => `--filter ${name}`).join(" ")}\n`;
};

appendFileSync(required("GITHUB_OUTPUT"), outputLines());
