// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";

import type { Application } from "@repo/config";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

function applicationRoot(application: Application): string {
  return path.join(repositoryRoot, "apps", application);
}

function packageRoot(name: string): string {
  return path.join(repositoryRoot, name);
}

export { applicationRoot, packageRoot, repositoryRoot };
