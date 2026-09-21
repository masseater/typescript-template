// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import path from "node:path";

import type { Application } from "@repo/config";

const sourceMapDirectories = (
  repositoryRoot: string,
  app: Application,
): Readonly<{ client: string; releases: string }> => {
  const root = path.join(repositoryRoot, ".local", "source-maps", app);
  return { client: path.join(root, "client"), releases: path.join(root, "releases") };
};

const SOURCE_MAP_MANIFEST = "emitted-maps.json";

const sourceMapManifest = (repositoryRoot: string, app: Application): string =>
  path.join(sourceMapDirectories(repositoryRoot, app).client, SOURCE_MAP_MANIFEST);

export { SOURCE_MAP_MANIFEST, sourceMapDirectories, sourceMapManifest };
