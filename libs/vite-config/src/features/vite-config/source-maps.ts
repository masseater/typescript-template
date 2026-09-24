import { paths } from "./host.ts";

import type { BuildTarget } from "@repo/config";

const sourceMapDirectories = (
  repositoryRoot: string,
  app: BuildTarget,
): Readonly<{ client: string; releases: string }> => {
  const root = paths.join(repositoryRoot, ".local", "source-maps", app);
  return { client: paths.join(root, "client"), releases: paths.join(root, "releases") };
};

const SOURCE_MAP_MANIFEST = "emitted-maps.json";

const sourceMapManifest = (repositoryRoot: string, app: BuildTarget): string =>
  paths.join(sourceMapDirectories(repositoryRoot, app).client, SOURCE_MAP_MANIFEST);

export { SOURCE_MAP_MANIFEST, sourceMapDirectories, sourceMapManifest };
