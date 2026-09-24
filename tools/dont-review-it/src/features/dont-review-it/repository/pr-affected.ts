#!/usr/bin/env node
import { NodeServices } from "@effect/platform-node";
import { causeRecord, runCli } from "@repo/cli";
import { Config, Effect, FileSystem, Schema } from "effect";

import { affectedTests, shardDirectories } from "./pr-affected-scope.ts";
import { prCheckShardCount } from "./test-runtime.ts";
import { workspacePackages } from "./workspace-packages.ts";

class NotAWorkspaceFilter extends Schema.TaggedError<NotAWorkspaceFilter>()("NotAWorkspaceFilter", {
  directory: Schema.String,
}) {
  public override get message(): string {
    return `${this.directory} is not a workspace filter`;
  }
}

const outputLines = Effect.gen(function* outputLines() {
  const filesystem = yield* FileSystem.FileSystem;
  const prFilesPath = yield* Config.String("PR_FILES_PATH");
  const files = (yield* filesystem.readFileString(prFilesPath))
    .split("\n")
    .filter((line) => line !== "");
  const shard = Number(yield* Config.String("CHECK_SHARD"));
  const packages = yield* workspacePackages;
  const affected = affectedTests(files, packages);
  const directories = shardDirectories(
    affected.kind === "all"
      ? packages.map((workspace) => workspace.directory)
      : affected.directories,
    shard,
    prCheckShardCount,
  );
  const names = yield* Effect.forEach(directories, (directory) => {
    const workspace = packages.find((item) => item.directory === directory);
    if (
      workspace === undefined ||
      !/^(?:apps|libs|infra|tools)\/[\w-]+$/u.test(directory) ||
      !/^@repo\/[\w-]+$/u.test(workspace.name)
    ) {
      return Effect.fail(new NotAWorkspaceFilter({ directory }));
    }
    return Effect.succeed(workspace.name);
  });
  return [
    `root=${String(shard === 1)}`,
    `filters=${names.map((name) => `--filter ${name}`).join(" ")}`,
    `paths=${affected.kind === "all" ? "" : directories.join(" ")}`,
    "",
  ].join("\n");
});

runCli(
  Effect.gen(function* prAffected() {
    const filesystem = yield* FileSystem.FileSystem;
    const githubOutput = yield* Config.String("GITHUB_OUTPUT");
    yield* filesystem.writeFileString(githubOutput, yield* outputLines, { flag: "a" });
  }).pipe(Effect.provide(NodeServices.layer)),
  (cause) => causeRecord("quality.pr_affected_failed", { cause }),
);
