import { APPLICATION } from "@repo/config";
import { Effect, Path } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { SOURCE_MAP_MANIFEST, sourceMapDirectories, sourceMapManifest } from "./source-maps.ts";

const paths = Effect.runSync(Effect.provide(Path.Path, Path.layer));

describe("source map locations", () => {
  it("keeps client maps and release maps under the app's local directory", () => {
    expect.hasAssertions();
    const repositoryRoot = "/repo";
    const app = APPLICATION.user;
    const root = paths.join(repositoryRoot, ".local", "source-maps", app);
    expect(sourceMapDirectories(repositoryRoot, app)).toStrictEqual({
      client: paths.join(root, "client"),
      releases: paths.join(root, "releases"),
    });
    expect(sourceMapManifest(repositoryRoot, app)).toBe(
      paths.join(root, "client", SOURCE_MAP_MANIFEST),
    );
    expect(SOURCE_MAP_MANIFEST).toBe("emitted-maps.json");
  });
});
