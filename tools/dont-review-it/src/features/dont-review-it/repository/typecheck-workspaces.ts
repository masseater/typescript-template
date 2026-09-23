#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

import { repositoryRoot } from "./repository-root.ts";
import { typecheckProjects } from "./typecheck-projects.ts";

const require = createRequire(import.meta.url);
const effectTsgoCli = path.join(
  path.dirname(require.resolve("@effect/tsgo/package.json")),
  "dist",
  "effect-tsgo.cjs",
);

const resolved = spawnSync(process.execPath, [effectTsgoCli, "get-exe-path"], {
  cwd: repositoryRoot,
  encoding: "utf8",
});

if (resolved.status !== 0) {
  process.stderr.write(resolved.stderr);
  process.exitCode = 1;
} else {
  const effectTsc = resolved.stdout.trim();
  const failed = typecheckProjects(repositoryRoot).filter((project) => {
    const result = spawnSync(effectTsc, ["--pretty", "false", "--noEmit", "-p", project], {
      cwd: repositoryRoot,
      stdio: "inherit",
    });
    return result.status !== 0;
  });

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}
