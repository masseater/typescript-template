import path from "node:path";

import { env, run } from "../../actions/shared/runner.ts";
import { nameOf, packagesFromEnv, tarballOf, versionOf } from "./packages.ts";

const isPublished = (spec: string): boolean => {
  try {
    run("npm", ["view", spec, "version"]);
    return true;
  } catch {
    return false;
  }
};

console.log(run("npm", ["--version"]));
const workspace = env("GITHUB_WORKSPACE");
for (const directory of packagesFromEnv()) {
  const source = path.join(workspace, directory);
  const spec = `${nameOf(source)}@${versionOf(source)}`;
  if (isPublished(spec)) {
    console.log(`${spec} is already published, skipping`);
  } else {
    console.log(
      run("npm", ["publish", tarballOf(directory), "--provenance", "--access", "public"]),
    );
  }
}
