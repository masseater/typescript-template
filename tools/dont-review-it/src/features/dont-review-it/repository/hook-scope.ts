#!/usr/bin/env node
import { NodeServices } from "@effect/platform-node";
import { causeRecord, runCli } from "@repo/cli";
import { Console, Effect, FileSystem, Option, Path, Schema } from "effect";
import { ChildProcess } from "effect/unstable/process";

import { capturedProcess } from "./captured-process.ts";
import { hookFilters } from "./pr-affected-scope.ts";
import { repositoryRoot } from "./repository-root.ts";
import { workspacePackages } from "./workspace-packages.ts";

class NotAHookStage extends Schema.TaggedError<NotAHookStage>()("NotAHookStage", {
  stage: Schema.String,
}) {
  public override get message(): string {
    return `${this.stage} is not a hook stage`;
  }
}

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

const changedFiles = Effect.fn("changedFiles")(function* changedFiles(stage: string) {
  if (stage === "precommit") {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const gitDirectory = yield* git("rev-parse", "--git-dir");
    const merging = Option.isSome(gitDirectory)
      ? yield* filesystem.exists(paths.resolve(repositoryRoot, gitDirectory.value, "MERGE_HEAD"))
      : false;
    return lines(
      yield* git(
        "diff",
        "--cached",
        "--name-only",
        "--no-renames",
        merging ? "MERGE_HEAD" : "HEAD",
      ),
    );
  }
  if (stage === "prepush") {
    const base = yield* git("merge-base", "origin/main", "HEAD");
    return Option.isNone(base)
      ? Option.none()
      : lines(yield* git("diff", "--name-only", "--no-renames", base.value, "HEAD"));
  }
  return yield* new NotAHookStage({ stage });
});

runCli(
  Effect.gen(function* hookScope() {
    const files = yield* changedFiles(process.argv[2] ?? "");
    const filters = Option.isNone(files)
      ? ["-r"]
      : hookFilters(
          files.value.filter((file) => file !== ""),
          yield* workspacePackages,
        );
    yield* Console.log(filters.join(" "));
  }).pipe(Effect.provide(NodeServices.layer)),
  (cause) => causeRecord("quality.hook_scope_failed", { cause }),
);
