#!/usr/bin/env node
import * as NodeServices from "@effect/platform-node/NodeServices";
import { causeRecord, markFailed, runCli } from "@repo/cli";
import { cruise, format } from "dependency-cruiser";
import { Console, Effect, Path, Schema } from "effect";

import configuration from "./dependency-cruiser.ts";
import { repositoryRoot } from "./repository-root.ts";

class OutsideRepository extends Schema.TaggedError<OutsideRepository>()("OutsideRepository", {
  cwd: Schema.String,
}) {
  public override get message(): string {
    return `workspace check:imports must run inside the repository (cwd=${this.cwd})`;
  }
}

class CruiseFailed extends Schema.TaggedError<CruiseFailed>()("CruiseFailed", {
  cause: Schema.Defect(),
}) {}

const workspaceFromCwd = Effect.gen(function* workspaceFromCwd() {
  const paths = yield* Path.Path;
  const cwd = process.cwd();
  const relative = paths.relative(repositoryRoot, cwd);
  if (relative === "" || relative.startsWith("..") || paths.isAbsolute(relative)) {
    return yield* OutsideRepository.make({ cwd });
  }
  return relative;
});

const cruiseFailed = (cause: unknown): CruiseFailed => CruiseFailed.make({ cause });

const depcruise = (workspace: string): Effect.Effect<number, CruiseFailed> =>
  Effect.gen(function* run() {
    const { output } = yield* Effect.tryPromise({
      catch: cruiseFailed,
      try: () =>
        cruise(
          [workspace],
          {
            ...configuration.options,
            baseDir: repositoryRoot,
            ruleSet: { forbidden: configuration.forbidden },
            validate: true,
          },
          configuration.options.enhancedResolveOptions,
        ),
    });
    if (typeof output === "string") {
      yield* Console.error(output);
      return 1;
    }
    const formatted = yield* Effect.tryPromise({
      catch: cruiseFailed,
      try: () => format(output, { outputType: "err-long" }),
    });
    if (typeof formatted.output === "string" && formatted.output.length > 0) {
      yield* Console.error(formatted.output);
    }
    return formatted.exitCode;
  });

runCli(
  Effect.gen(function* run() {
    const workspace = yield* workspaceFromCwd;
    const code = yield* depcruise(workspace);
    if (code !== 0) {
      yield* markFailed;
    }
  }).pipe(Effect.provide(NodeServices.layer)),
  (cause) => causeRecord("quality.imports_failed", { cause }),
);
