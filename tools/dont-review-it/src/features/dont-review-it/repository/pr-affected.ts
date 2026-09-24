#!/usr/bin/env node
import * as NodeServices from "@effect/platform-node/NodeServices";
import { causeRecord, runCli } from "@repo/cli";
import { Config, Effect, FileSystem, Schema } from "effect";
import { ChildProcess } from "effect/unstable/process";

import { matchesAnchoredGlobPath } from "../lint/oxlint/lib/glob-path-match.ts";
import { capturedProcess } from "./captured-process.ts";
import { shardOutput } from "./pr-check-shard.ts";
import { repositoryRoot } from "./repository-root.ts";
import { devServerTests } from "./test-runtime.ts";
import { rootNodeTestIncludes } from "./tool-test-projects.ts";
import { workspacePackages } from "./workspace-packages.ts";

class TrackedFilesUnreadable extends Schema.TaggedError<TrackedFilesUnreadable>()(
  "TrackedFilesUnreadable",
  { stderr: Schema.String },
) {
  public override get message(): string {
    return `git ls-files failed: ${this.stderr}`;
  }
}

const rootTestFiles = Effect.gen(function* rootTestFiles() {
  const listed = yield* capturedProcess(
    ChildProcess.make("git", ["ls-files", "-z"], { cwd: repositoryRoot, stdin: "ignore" }),
  );
  if (listed.exitCode !== 0) {
    return yield* new TrackedFilesUnreadable({ stderr: listed.stderr });
  }
  return listed.stdout
    .split("\0")
    .filter(
      (file) =>
        rootNodeTestIncludes.some((pattern) =>
          matchesAnchoredGlobPath({ relativePath: file, pattern }),
        ) && !matchesAnchoredGlobPath({ relativePath: file, pattern: devServerTests }),
    );
});

runCli(
  Effect.gen(function* prAffected() {
    const filesystem = yield* FileSystem.FileSystem;
    const files = (yield* filesystem.readFileString(yield* Config.String("PR_FILES_PATH")))
      .split("\n")
      .filter((line) => line !== "");
    const output = yield* shardOutput(yield* Config.String("CHECK_SHARD"), {
      files,
      packages: yield* workspacePackages,
      rootTestFiles: yield* rootTestFiles,
    });
    yield* filesystem.writeFileString(yield* Config.String("GITHUB_OUTPUT"), output, { flag: "a" });
  }).pipe(Effect.provide(NodeServices.layer)),
  (cause) => causeRecord("quality.pr_affected_failed", { cause }),
);
