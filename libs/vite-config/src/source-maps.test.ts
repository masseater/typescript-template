// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import path from "node:path";

import { APPLICATION } from "@repo/config";
import { describe, expect, test } from "vite-plus/test";

import { SOURCE_MAP_MANIFEST, sourceMapDirectories, sourceMapManifest } from "./source-maps.ts";

describe("source map locations", () => {
  const repositoryRoot = "/repo";
  const app = APPLICATION.user;
  const root = path.join(repositoryRoot, ".local", "source-maps", app);
  const it = test
    .extend("mapDirectories", () => sourceMapDirectories(repositoryRoot, app))
    .extend("mapManifest", () => sourceMapManifest(repositoryRoot, app))
    .extend("manifestFileName", () => SOURCE_MAP_MANIFEST);

  it("keeps client maps and release maps under the app's local directory", ({ mapDirectories }) => {
    expect(mapDirectories).toStrictEqual({
      client: path.join(root, "client"),
      releases: path.join(root, "releases"),
    });
  });

  it("records emitted client maps beside the client directory", ({ mapManifest }) => {
    expect(mapManifest).toBe(path.join(root, "client", SOURCE_MAP_MANIFEST));
  });

  it("names the emitted map manifest", ({ manifestFileName }) => {
    expect(manifestFileName).toBe("emitted-maps.json");
  });
});
