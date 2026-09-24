#!/usr/bin/env node
import * as NodeServices from "@effect/platform-node/NodeServices";
import { causeRecord, runCli } from "@repo/cli";
import { Config, Effect, FileSystem } from "effect";

import { shardOutput } from "./pr-check-shard.ts";
import { workspacePackages } from "./workspace-packages.ts";

runCli(
  Effect.gen(function* prAffected() {
    const filesystem = yield* FileSystem.FileSystem;
    const files = (yield* filesystem.readFileString(yield* Config.String("PR_FILES_PATH")))
      .split("\n")
      .filter((line) => line !== "");
    const output = yield* shardOutput(
      yield* Config.String("CHECK_SHARD"),
      files,
      yield* workspacePackages,
    );
    yield* filesystem.writeFileString(yield* Config.String("GITHUB_OUTPUT"), output, { flag: "a" });
  }).pipe(Effect.provide(NodeServices.layer)),
  (cause) => causeRecord("quality.pr_affected_failed", { cause }),
);
