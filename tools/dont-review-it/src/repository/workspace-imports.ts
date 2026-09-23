#!/usr/bin/env node
import path from "node:path";

import { causeRecord, markFailed, runCli } from "@repo/cli";
import { cruise, format } from "dependency-cruiser";
import { Effect } from "effect";

import configuration from "./dependency-cruiser.ts";
import { repositoryRoot } from "./repository-root.ts";

function workspaceFromCwd(): string {
  const relative = path.relative(repositoryRoot, process.cwd());
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `workspace check:imports must run inside the repository (cwd=${process.cwd()})`,
    );
  }
  return relative;
}

function depcruise(workspace: string): Effect.Effect<number> {
  return Effect.gen(function* run() {
    const { output } = yield* Effect.tryPromise(() =>
      cruise(
        [workspace],
        {
          ...configuration.options,
          baseDir: repositoryRoot,
          ruleSet: { forbidden: configuration.forbidden },
          validate: true,
        },
        configuration.options?.enhancedResolveOptions,
      ),
    );
    if (typeof output === "string") {
      console.error(output);
      return 1;
    }
    const formatted = yield* Effect.tryPromise(() => format(output, { outputType: "err-long" }));
    if (typeof formatted.output === "string" && formatted.output.length > 0) {
      console.error(formatted.output);
    }
    return formatted.exitCode;
  });
}

runCli(
  Effect.gen(function* run() {
    const workspace = workspaceFromCwd();
    const code = yield* depcruise(workspace);
    if (code !== 0) {
      yield* markFailed;
    }
  }),
  (cause) => causeRecord("quality.imports_failed", { cause }),
);
