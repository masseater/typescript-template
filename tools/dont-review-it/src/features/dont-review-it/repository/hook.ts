#!/usr/bin/env node
import * as NodeServices from "@effect/platform-node/NodeServices";
import { causeRecord, markFailed, runCli } from "@repo/cli";
import { Effect, Option, Path, Schema } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { pathExists } from "../platform/file-system.ts";
import { capturedProcess } from "./captured-process.ts";
import { hookFilters } from "./pr-affected-scope.ts";
import { repositoryRoot } from "./repository-root.ts";
import { workspacePackages } from "./workspace-packages.ts";

import type { lifecycles } from "@repo/vite-config";

const HookStage = Schema.Literals([
  "precommit",
  "prepush",
] as const satisfies readonly (typeof lifecycles)[number][]);
type HookStage = typeof HookStage.Type;

const git = (...handed: readonly string[]) =>
  capturedProcess(
    ChildProcess.make("git", [...handed], { cwd: repositoryRoot, stdin: "ignore" }),
  ).pipe(
    Effect.map((result) =>
      result.exitCode === 0 ? Option.some(result.stdout.trim()) : Option.none(),
    ),
  );

const lines = (output: Option.Option<string>): Option.Option<readonly string[]> =>
  Option.map(output, (text) => text.split("\n"));

const mergeInProgress = Effect.fn("mergeInProgress")(function* mergeInProgress() {
  const paths = yield* Path.Path;
  const gitDirectory = yield* git("rev-parse", "--git-dir");
  return Option.isSome(gitDirectory)
    ? yield* pathExists(paths.resolve(repositoryRoot, gitDirectory.value, "MERGE_HEAD"))
    : false;
});

const stagedFiles = Effect.fn("stagedFiles")(function* stagedFiles() {
  const merging = yield* mergeInProgress();
  return lines(
    yield* git("diff", "--cached", "--name-only", "--no-renames", merging ? "MERGE_HEAD" : "HEAD"),
  );
});

const pushedFiles = Effect.fn("pushedFiles")(function* pushedFiles() {
  const base = yield* git("merge-base", "origin/main", "HEAD");
  return Option.isNone(base)
    ? Option.none()
    : lines(yield* git("diff", "--name-only", "--no-renames", base.value, "HEAD"));
});

const stages = {
  precommit: { changedFiles: stagedFiles, concurrencyLimit: 2 },
  prepush: { changedFiles: pushedFiles, concurrencyLimit: 1 },
} as const satisfies Readonly<Record<HookStage, unknown>>;

runCli(
  Effect.gen(function* hook() {
    const stage = yield* Schema.decodeUnknownEffect(HookStage)(process.argv[2]);
    const files = yield* stages[stage].changedFiles();
    const filters = Option.isNone(files)
      ? ["-r"]
      : hookFilters(
          files.value.filter((file) => file !== ""),
          yield* workspacePackages,
        );
    if (filters.length === 0) {
      return;
    }
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const exitCode = yield* spawner.exitCode(
      ChildProcess.make(
        "vp",
        ["run", "--concurrency-limit", String(stages[stage].concurrencyLimit), ...filters, stage],
        { cwd: repositoryRoot, stderr: "inherit", stdin: "inherit", stdout: "inherit" },
      ),
    );
    if (exitCode !== 0) {
      yield* markFailed;
    }
  }).pipe(Effect.provide(NodeServices.layer)),
  (cause) => causeRecord("quality.hook_failed", { cause }),
);
