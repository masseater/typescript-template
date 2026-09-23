#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { hookFilters } from "./pr-affected-scope.ts";
import { repositoryRoot } from "./repository-root.ts";
import { workspacePackages } from "./workspace-packages.ts";

const git = (...handed: readonly string[]): string | undefined => {
  const result = spawnSync("git", handed, { cwd: repositoryRoot, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : undefined;
};

const changedFiles = (stage: string | undefined): readonly string[] | undefined => {
  if (stage === "precommit") {
    const gitDirectory = git("rev-parse", "--git-dir");
    const base =
      gitDirectory !== undefined &&
      existsSync(path.resolve(repositoryRoot, gitDirectory, "MERGE_HEAD"))
        ? "MERGE_HEAD"
        : "HEAD";
    return git("diff", "--cached", "--name-only", "--no-renames", base)?.split("\n");
  }
  if (stage === "prepush") {
    const base = git("merge-base", "origin/main", "HEAD");
    return base === undefined
      ? undefined
      : git("diff", "--name-only", "--no-renames", base, "HEAD")?.split("\n");
  }
  throw new Error(`${String(stage)} is not a hook stage`);
};

const files = changedFiles(process.argv[2]);
process.stdout.write(
  `${(files === undefined
    ? ["-r"]
    : hookFilters(
        files.filter((file) => file !== ""),
        workspacePackages(),
      )
  ).join(" ")}\n`,
);
