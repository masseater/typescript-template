import { APPLICATION } from "@repo/config";
import { Effect, Path } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { SOURCE_MAP_MANIFEST, sourceMapDirectories, sourceMapManifest } from "./source-maps.ts";

const paths = Effect.runSync(Effect.provide(Path.Path, Path.layer));

describe("source map locations", () => {
  const repositoryRoot = "/repo";
  const app = APPLICATION.user;
  const root = paths.join(repositoryRoot, ".local", "source-maps", app);
  const it = test
    .extend("mapDirectories", () => sourceMapDirectories(repositoryRoot, app))
    .extend("mapManifest", () => sourceMapManifest(repositoryRoot, app))
    .extend("manifestFileName", () => SOURCE_MAP_MANIFEST);

  it("keeps client maps and release maps under the app's local directory", ({ mapDirectories }) => {
    expect(mapDirectories).toStrictEqual({
      client: paths.join(root, "client"),
      releases: paths.join(root, "releases"),
    });
  });

  it("records emitted client maps beside the client directory", ({ mapManifest }) => {
    expect(mapManifest).toBe(paths.join(root, "client", SOURCE_MAP_MANIFEST));
  });

  it("names the emitted map manifest", ({ manifestFileName }) => {
    expect(manifestFileName).toBe("emitted-maps.json");
  });
});
