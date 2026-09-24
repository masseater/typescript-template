// @effect-diagnostics-next-line nodeBuiltinImport:off
import { readdirSync } from "node:fs";

import { memoize } from "es-toolkit";

import { readUnlessMissing } from "../../../../platform/path-failure.ts";
import { path } from "../../../../platform/path.ts";
import { readGitSourceScope, type GitSourceScope } from "../git-ignored-source.ts";
import { toPosixPath } from "../posix-path.ts";

import type { Context } from "@oxlint/plugins";

export const UNSCANNED_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  ".cache",
  ".git",
  "coverage",
  "dist",
  "dist-ssr",
  "node_modules",
]);

export const unscannedDirectoryNamesFrom = (
  ruleOptions: Context["options"],
): ReadonlySet<string> => {
  const declared = ((ruleOptions[0] ?? {}) as { readonly unscannedDirectories?: readonly string[] })
    .unscannedDirectories;
  return declared === undefined ? UNSCANNED_DIRECTORY_NAMES : new Set(declared);
};

export type Worktree = {
  readonly root: string;
  readonly unscannedDirectoryNames: ReadonlySet<string>;
};

const filePathsUnder = (
  worktree: Worktree,
  sourceScope: GitSourceScope,
  directory: string,
): readonly string[] => {
  const directoryChildren = readUnlessMissing(() =>
    readdirSync(directory, { withFileTypes: true }),
  );
  if (directoryChildren === null) return [];

  return directoryChildren.flatMap((directoryChild) => {
    const filePath = path.join(directory, directoryChild.name);
    if (sourceScope.isIgnored(filePath)) return [];
    if (directoryChild.isDirectory()) {
      return worktree.unscannedDirectoryNames.has(directoryChild.name)
        ? []
        : filePathsUnder(worktree, sourceScope, filePath);
    }
    return directoryChild.isFile() ? [toPosixPath(path.relative(worktree.root, filePath))] : [];
  });
};

const worktreeKeyOf = (worktree: Worktree): string =>
  [worktree.root, ...[...worktree.unscannedDirectoryNames].toSorted()].join("\n");

const scannedFilePathsUnder = memoize(
  (worktree: Worktree): readonly string[] =>
    filePathsUnder(worktree, readGitSourceScope(worktree.root), worktree.root).toSorted(),
  { getCacheKey: worktreeKeyOf },
);

export const worktreeFilePathsUnder = (asked: Worktree): readonly string[] =>
  scannedFilePathsUnder({
    root: path.resolve(asked.root),
    unscannedDirectoryNames: asked.unscannedDirectoryNames,
  });
