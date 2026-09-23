#!/usr/bin/env node
import { appendFileSync, readFileSync } from "node:fs";

import { affectedTests, shardDirectories } from "./pr-affected-scope.ts";
import { prCheckShardCount } from "./test-runtime.ts";
import { workspacePackages } from "./workspace-packages.ts";

const required = (name: "CHECK_SHARD" | "GITHUB_OUTPUT" | "PR_FILES_PATH"): string => {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`${name} is required`);
  }
  return value;
};

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
