// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import type { Application } from "./applications.ts";

function sourceMapDirectories(
  repositoryRoot: string,
  app: Application,
): Readonly<{ client: string; releases: string }> {
  const root = path.join(repositoryRoot, ".local", "source-maps", app);
  return { client: path.join(root, "client"), releases: path.join(root, "releases") };
}

export { sourceMapDirectories };
