#!/usr/bin/env node
// oxlint-disable-next-line import/no-nodejs-modules
import { spawn } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";

import { causeRecord, markFailed, runCli } from "@repo/cli";
import { Effect } from "effect";

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const configPath = "tools/dont-review-it/src/repository/dependency-cruiser.ts";

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
  return Effect.callback((resume) => {
    const child = spawn(
      "depcruise",
      ["--config", configPath, "--output-type", "err-long", workspace],
      { cwd: repositoryRoot, stdio: "inherit" },
    );
    child.once("error", (error) => {
      resume(Effect.die(error));
    });
    child.once("close", (code, signal) => {
      if (signal !== null) {
        resume(Effect.die(new Error(`depcruise exited from signal ${signal}`)));
        return;
      }
      resume(Effect.succeed(code ?? 1));
    });
  });
}

runCli(
  Effect.gen(function* run() {
    const workspace = process.argv[2] ?? workspaceFromCwd();
    const code = yield* depcruise(workspace);
    if (code !== 0) {
      yield* markFailed;
    }
  }),
  (cause) => causeRecord("quality.imports_failed", { cause }),
);
