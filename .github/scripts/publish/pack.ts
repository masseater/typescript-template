import { mkdirSync } from "node:fs";
import path from "node:path";

import { run } from "../../actions/shared/runner.ts";
import { packagesFromEnv, tarballOf } from "./packages.ts";

for (const directory of packagesFromEnv()) {
  const tarball = tarballOf(directory);
  mkdirSync(path.dirname(tarball), { recursive: true });
  run("vp", ["pm", "pack", "--out", tarball], { cwd: directory });
}
