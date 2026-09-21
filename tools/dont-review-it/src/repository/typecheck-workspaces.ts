#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

import { repositoryRoot } from "./repository-root.ts";
import { typecheckProjects } from "./typecheck-projects.ts";

const require = createRequire(import.meta.url);
const tsc = path.join(path.dirname(require.resolve("typescript/package.json")), "bin", "tsc");
const failed = typecheckProjects(repositoryRoot).filter((project) => {
  const result = spawnSync(
    process.execPath,
    [tsc, "-p", project, "--noEmit", "--pretty", "false"],
    { cwd: repositoryRoot, stdio: "inherit" },
  );
  return result.status !== 0;
});

if (failed.length > 0) {
  process.exitCode = 1;
}
