import path from "node:path";

import { repositoryRoot } from "@repo/config/repository-root";
import { build } from "vite-plus";
import { describe, expect, test } from "vite-plus/test";

import { failOnBrokenSourceMaps } from "./private-source-maps.ts";

const bundleEntry = path.join(repositoryRoot, "libs/vite-config/src/source-maps.ts");

describe("failOnBrokenSourceMaps", () => {
  const it = test
    .extend("brokenMapReportsSourceMapBroken", async () => {
      try {
        await build({
          build: {
            lib: { entry: bundleEntry, fileName: "entry", formats: ["es"] },
            sourcemap: true,
            write: false,
          },
          configFile: false,
          logLevel: "silent",
          plugins: [
            failOnBrokenSourceMaps(),
            {
              name: "transform-without-map",
              transform: (code: string, moduleId: string): { readonly code: string } | null =>
                moduleId === bundleEntry ? { code: `${code}export const added = 2;\n` } : null,
            },
          ],
        });
      } catch (buildFailure: unknown) {
        const failureText =
          buildFailure instanceof Error ? buildFailure.message : "unknown failure";
        return failureText.includes("SOURCEMAP_BROKEN");
      }
      throw new Error("build kept a transform that dropped the source map");
    })
    .extend("keptMapBuild", async () => {
      const built = await build({
        build: {
          lib: { entry: bundleEntry, fileName: "entry", formats: ["es"] },
          sourcemap: true,
          write: false,
        },
        configFile: false,
        logLevel: "silent",
        plugins: [failOnBrokenSourceMaps()],
      });
      const bundles = Array.isArray(built) ? built : [built];
      return bundles.some((bundle) => "output" in bundle);
    });

  it("fails the build when a transform drops the source map", ({
    brokenMapReportsSourceMapBroken,
  }) => {
    expect(brokenMapReportsSourceMapBroken).toBe(true);
  });

  it("leaves a build whose transforms keep the source map alone", ({ keptMapBuild }) => {
    expect(keptMapBuild).toBe(true);
  });
});
