// @effect-diagnostics-next-line nodeBuiltinImport:off
import { existsSync, lstatSync, realpathSync } from "node:fs";

import { attempt } from "es-toolkit";

import { measureStage } from "../../../lint-rule-authoring/index.ts";
import { path } from "../../../platform/path.ts";
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

const carriesRepositoryLink = (directory: string): boolean => {
  if (existsSync(path.join(directory, ".git"))) return true;
  const parent = path.dirname(directory);
  return parent !== directory && carriesRepositoryLink(parent);
};

const ignoredRepositoryPaths = (repositoryRoot: string): ReadonlySet<string> => {
  if (!carriesRepositoryLink(repositoryRoot)) return new Set();

  const ignoredPathOutput = measureStage("canonical.scope.git", () =>
    gitOutput(["ls-files", "--others", "--ignored", "--exclude-standard", "--directory", "-z"], {
      cwd: repositoryRoot,
      env: process.env,
    }),
  );
  return ignoredPathOutput !== null
    ? new Set(ignoredPathOutput.split("\0").filter((filePath) => filePath !== ""))
    : new Set();
};

const pathIsIgnored = (repositoryPath: string, ignoredPaths: ReadonlySet<string>): boolean =>
  ignoredPaths.has(repositoryPath) ||
  [...ignoredPaths].some(
    (ignoredPath) => ignoredPath.endsWith("/") && repositoryPath.startsWith(ignoredPath),
  );

export type GitSourceScope = {
  readonly isIgnored: (sourcePath: string) => boolean;
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
