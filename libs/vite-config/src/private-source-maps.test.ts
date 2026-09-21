import { build, type PluginOption } from "vite-plus";
import { describe, expect, it } from "vite-plus/test";

import { failOnBrokenSourceMaps } from "./private-source-maps.ts";

const bundleEntry = new URL("./source-maps.ts", import.meta.url).pathname;

const transformWithoutMap = (): PluginOption => ({
  name: "transform-without-map",
  transform: (code: string, moduleId: string) =>
    moduleId === bundleEntry ? { code: `${code}export const added = 2;\n` } : null,
});

const bundle = (plugins: readonly PluginOption[]): Promise<unknown> =>
  build({
    build: {
      lib: { entry: bundleEntry, fileName: "entry", formats: ["es"] },
      sourcemap: true,
      write: false,
    },
    configFile: false,
    logLevel: "silent",
    plugins: [...plugins],
  });

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

  it("does not fail Elysia AOT stub transforms that replace compile sources", async () => {
    expect.hasAssertions();
    const aotStub = (): PluginOption => ({
      name: "elysia-aot",
      transform: (code: string, moduleId: string) =>
        moduleId === bundleEntry ? { code: `${code}export const added = 2;\n` } : null,
    });
    await expect(bundle([failOnBrokenSourceMaps(), aotStub()])).resolves.toBeDefined();
  });
});
