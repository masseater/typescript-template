// @effect-diagnostics-next-line nodeBuiltinImport:off
import { existsSync, lstatSync, realpathSync } from "node:fs";

import { inheritedEnvironment } from "@repo/config/process-environment";
import { attempt, memoize } from "es-toolkit";

import { measureStage } from "../../../lint-rule-authoring/index.ts";
import { path, relativePosixPath } from "../../../platform/path.ts";
import { gitOutput } from "./git-output.ts";
import { pathIsInside } from "./path-is-inside.ts";

const realPathOf = (filePath: string): string => {
  const [failure, realPath] = attempt(() => realpathSync.native(filePath));
  return failure === null && realPath !== null ? realPath : filePath;
};

const repositoryPathOf = (input: {
  readonly repositoryRoot: string;
  readonly realRepositoryRoot: string;
  readonly source: string;
}): string | null => {
  if (pathIsInside(input.repositoryRoot, input.source)) {
    return path.relative(input.repositoryRoot, input.source);
  }
  const realSource = realPathOf(input.source);
  return pathIsInside(input.realRepositoryRoot, realSource)
    ? path.relative(input.realRepositoryRoot, realSource)
    : null;
};

const firstSymbolicPath = (repositoryRoot: string, repositoryPath: string): string | null => {
  const segments = repositoryPath.split(path.sep);
  for (const index of segments.keys()) {
    const candidate = path.join(repositoryRoot, ...segments.slice(0, index + 1));
    const [failure, stats] = attempt(() => lstatSync(candidate));
    if (failure === null && stats?.isSymbolicLink() === true)
      return path.relative(repositoryRoot, candidate);
  }
  return null;
};

const repositoryTopLevel = (directory: string): string | null => {
  if (existsSync(path.join(directory, ".git"))) return directory;
  const parent = path.dirname(directory);
  return parent === directory ? null : repositoryTopLevel(parent);
};

const gitIgnoredPaths = (directory: string): ReadonlySet<string> => {
  const ignoredPathOutput = measureStage("canonical.scope.git", () =>
    gitOutput(["ls-files", "--others", "--ignored", "--exclude-standard", "--directory", "-z"], {
      cwd: directory,
      env: inheritedEnvironment(),
    }),
  );
  return ignoredPathOutput !== null
    ? new Set(ignoredPathOutput.split("\0").filter((filePath) => filePath !== ""))
    : new Set();
};

const topLevelIgnoredPaths = memoize(gitIgnoredPaths);

const isIgnoredDirectoryEntry = (ignoredPath: string, directoryPath: string): boolean =>
  ignoredPath.endsWith("/") && directoryPath.startsWith(ignoredPath);

const ignoredRepositoryPaths = (repositoryRoot: string): ReadonlySet<string> => {
  const topLevel = repositoryTopLevel(repositoryRoot);
  if (topLevel === null) return new Set();

  const topLevelPaths = topLevelIgnoredPaths(topLevel);
  if (topLevel === repositoryRoot) return topLevelPaths;

  const prefix = `${relativePosixPath(topLevel, repositoryRoot)}/`;
  if ([...topLevelPaths].some((ignoredPath) => isIgnoredDirectoryEntry(ignoredPath, prefix))) {
    return gitIgnoredPaths(repositoryRoot);
  }
  return new Set(
    [...topLevelPaths]
      .filter((ignoredPath) => ignoredPath.startsWith(prefix))
      .map((ignoredPath) => ignoredPath.slice(prefix.length)),
  );
};

const pathIsIgnored = (repositoryPath: string, ignoredPaths: ReadonlySet<string>): boolean =>
  ignoredPaths.has(repositoryPath) ||
  ignoredPaths.has(`${repositoryPath}/`) ||
  [...ignoredPaths].some((ignoredPath) => isIgnoredDirectoryEntry(ignoredPath, repositoryPath));

export type GitSourceScope = {
  readonly isIgnored: (sourcePath: string) => boolean;
};

export const warmGitSourceScope = (repositoryRoot: string): void => {
  ignoredRepositoryPaths(path.resolve(repositoryRoot));
};

export const readGitSourceScope = (repositoryRoot: string): GitSourceScope => {
  const root = path.resolve(repositoryRoot);
  const realRoot = realPathOf(root);
  const ignoredPaths = ignoredRepositoryPaths(root);
  return {
    isIgnored(sourcePath) {
      const source = path.resolve(root, sourcePath);
      const repositoryPath = repositoryPathOf({
        repositoryRoot: root,
        realRepositoryRoot: realRoot,
        source,
      });
      if (repositoryPath === null || repositoryPath === "") return false;
      return pathIsIgnored(firstSymbolicPath(root, repositoryPath) ?? repositoryPath, ignoredPaths);
    },
  };
};
