import { Effect, Path } from "effect";

import type { Application } from "@repo/config";

const paths = Effect.runSync(Effect.provide(Path.Path, Path.layer));

const sourceMapDirectories = (
  repositoryRoot: string,
  app: Application,
): Readonly<{ client: string; releases: string }> => {
  const root = paths.join(repositoryRoot, ".local", "source-maps", app);
  return { client: paths.join(root, "client"), releases: paths.join(root, "releases") };
};

const SOURCE_MAP_MANIFEST = "emitted-maps.json";

const sourceMapManifest = (repositoryRoot: string, app: Application): string =>
  paths.join(sourceMapDirectories(repositoryRoot, app).client, SOURCE_MAP_MANIFEST);

export { SOURCE_MAP_MANIFEST, sourceMapDirectories, sourceMapManifest };
