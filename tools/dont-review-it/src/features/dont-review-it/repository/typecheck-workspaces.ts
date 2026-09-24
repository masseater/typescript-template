#!/usr/bin/env node
import * as NodeServices from "@effect/platform-node/NodeServices";
import { causeRecord, cliStderr, markFailed, runCli } from "@repo/cli";
import { Effect, Path, Schema } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { capturedProcess } from "./captured-process.ts";
import { repositoryRoot } from "./repository-root.ts";
import { typecheckProjects } from "./typecheck-projects.ts";

class TypecheckUnstarted extends Schema.TaggedError<TypecheckUnstarted>()("TypecheckUnstarted", {
  cause: Schema.Defect(),
  project: Schema.String,
}) {
  public override get message(): string {
    return `typecheck could not start for ${this.project}`;
  }
}

const typecheckWorkspaces = Effect.gen(function* typecheckWorkspaces() {
  const paths = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const effectTsgoCli = paths.join(
    paths.dirname(
      yield* paths.fromFileUrl(new URL(import.meta.resolve("@effect/tsgo/package.json"))),
    ),
    "dist",
    "effect-tsgo.cjs",
  );

  const resolved = yield* capturedProcess(
    ChildProcess.make(process.execPath, [effectTsgoCli, "get-exe-path"], {
      cwd: repositoryRoot,
    }),
  );
  if (resolved.exitCode !== 0) {
    yield* Effect.sync(() => cliStderr.write(resolved.stderr));
    return yield* markFailed;
  }

  const effectTsc = resolved.stdout.trim();
  const projects = yield* typecheckProjects(repositoryRoot);
  const exitCodes = yield* Effect.forEach(projects, (project) =>
    spawner
      .exitCode(
        ChildProcess.make(effectTsc, ["--pretty", "false", "--noEmit", "-p", project], {
          cwd: repositoryRoot,
          stderr: "inherit",
          stdin: "inherit",
          stdout: "inherit",
        }),
      )
      .pipe(Effect.mapError((cause) => new TypecheckUnstarted({ cause, project }))),
  );
  if (exitCodes.some((exitCode) => exitCode !== 0)) {
    yield* markFailed;
  }
});

runCli(typecheckWorkspaces.pipe(Effect.provide(NodeServices.layer)), (cause) =>
  causeRecord("quality.typecheck_failed", { cause }),
);
