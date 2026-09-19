import { build } from "vite-plus";
import { describe, expect, it } from "vite-plus/test";

import { failOnBrokenSourceMaps } from "./private-source-maps.ts";

import type { Plugin } from "vite-plus";

const entry = new URL("./applications.ts", import.meta.url).pathname;

function transformWithoutMap(): Plugin {
  return {
    name: "transform-without-map",
    transform: (code: string, id: string) =>
      id === entry ? { code: `${code}export const added = 2;\n` } : null,
  };
}

function bundle(plugins: readonly Plugin[]): Promise<unknown> {
  return build({
    build: {
      lib: { entry, fileName: "entry", formats: ["es"] },
      sourcemap: true,
      write: false,
    },
    configFile: false,
    logLevel: "silent",
    plugins: [...plugins],
  });
}

describe("failOnBrokenSourceMaps", () => {
  it("fails the build when a transform drops the source map", async () => {
    expect.hasAssertions();
    await expect(bundle([failOnBrokenSourceMaps(), transformWithoutMap()])).rejects.toThrow(
      "SOURCEMAP_BROKEN",
    );
  });

  it("leaves a build whose transforms keep the source map alone", async () => {
    expect.hasAssertions();
    await expect(bundle([failOnBrokenSourceMaps()])).resolves.toBeDefined();
  });
});
