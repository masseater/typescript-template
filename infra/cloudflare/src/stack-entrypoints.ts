import { fileURLToPath } from "node:url";

import { APPLICATION } from "@repo/config";

import { path } from "./platform.ts";

import type { Application } from "@repo/config";
import type { StackName } from "./stacks.ts";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const cloudflareSrc = fileURLToPath(new URL(".", import.meta.url));

const applicationEntrypoints = {
  [APPLICATION.admin]: path.join(repositoryRoot, "apps", APPLICATION.admin, "alchemy.run.ts"),
  [APPLICATION.user]: path.join(repositoryRoot, "apps", APPLICATION.user, "alchemy.run.ts"),
  [APPLICATION.wiki]: path.join(repositoryRoot, "apps", APPLICATION.wiki, "alchemy.run.ts"),
  core: path.join(repositoryRoot, "apps", "core", "alchemy.run.ts"),
} as const satisfies Readonly<Record<Application | "core", string>>;

function stackEntrypoint(stack: StackName): string {
  return stack in applicationEntrypoints
    ? applicationEntrypoints[stack as Application | "core"]
    : path.join(cloudflareSrc, `${stack}.ts`);
}

export { stackEntrypoint };
