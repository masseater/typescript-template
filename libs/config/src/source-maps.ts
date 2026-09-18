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

const SOURCE_MAP_MANIFEST = "emitted-maps.json";

function sourceMapManifest(repositoryRoot: string, app: Application): string {
  return path.join(sourceMapDirectories(repositoryRoot, app).client, SOURCE_MAP_MANIFEST);
}

export { SOURCE_MAP_MANIFEST, sourceMapDirectories, sourceMapManifest };
