import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { env, field, stringField } from "../../actions/shared/runner.ts";

const ROOTS = ["apps", "libs", "tools", "infra"];
const MANIFEST = "package.json";

const manifestOf = (directory: string): unknown =>
  JSON.parse(readFileSync(path.join(directory, MANIFEST), "utf8"));

const isPublished = (directory: string): boolean => {
  const manifest = manifestOf(directory);
  return field(manifest, "private") !== true && field(manifest, "publishConfig") !== undefined;
};

const workspacesIn = (root: string): readonly string[] => {
  if (!existsSync(root)) {
    return [];
  }
  return readdirSync(root)
    .toSorted()
    .map((name) => path.join(root, name))
    .filter((directory) => existsSync(path.join(directory, MANIFEST)));
};

export const publishedPackages = (): readonly string[] =>
  ROOTS.flatMap((root) => workspacesIn(root)).filter((directory) => isPublished(directory));

export const versionOf = (directory: string): string =>
  stringField(manifestOf(directory), "version");

export const nameOf = (directory: string): string => stringField(manifestOf(directory), "name");

export const tarballOf = (directory: string): string =>
  path.join(env("RUNNER_TEMP"), "packages", `${path.basename(directory)}.tgz`);

export const packagesFromEnv = (): readonly string[] =>
  env("PACKAGES")
    .split(" ")
    .filter((directory) => directory !== "");
