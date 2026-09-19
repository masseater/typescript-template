import path from "node:path";

import { repositoryRoot } from "@repo/config/repository-root";

import type { Application } from "@repo/config";

const applicationRoot = (application: Application): string => {
  return path.join(repositoryRoot, "apps", application);
};

const vitePlus = path.join(repositoryRoot, "node_modules/.bin/vp");

export { applicationRoot, repositoryRoot, vitePlus };
