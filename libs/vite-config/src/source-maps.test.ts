import path from "node:path";

import { APPLICATION } from "@repo/config";
import { describe, expect, it } from "vite-plus/test";

import { SOURCE_MAP_MANIFEST, sourceMapDirectories, sourceMapManifest } from "./source-maps.ts";

describe("source map locations", () => {
  it("keeps client maps and release maps under the app's local directory", () => {
    expect.hasAssertions();
    const repositoryRoot = "/repo";
    const app = APPLICATION.user;
    const root = path.join(repositoryRoot, ".local", "source-maps", app);
    expect(sourceMapDirectories(repositoryRoot, app)).toStrictEqual({
      client: path.join(root, "client"),
      releases: path.join(root, "releases"),
    });
    expect(sourceMapManifest(repositoryRoot, app)).toBe(
      path.join(root, "client", SOURCE_MAP_MANIFEST),
    );
    expect(SOURCE_MAP_MANIFEST).toBe("emitted-maps.json");
  });
});
