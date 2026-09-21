import path from "node:path";

import { repositoryRoot } from "@repo/config/repository-root";
import { build } from "vite-plus";
import { describe, expect, test } from "vite-plus/test";

import { failOnBrokenSourceMaps } from "./private-source-maps.ts";

const bundleEntry = path.join(repositoryRoot, "libs/vite-config/src/source-maps.ts");

describe("failOnBrokenSourceMaps", () => {
  const it = test
    .extend("brokenMapFailure", async () => {
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
        return buildFailure instanceof Error ? buildFailure.message : "unknown failure";
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
      return Array.isArray(built)
        ? built.some(
            (result) => result !== null && typeof result === "object" && "output" in result,
          )
        : "output" in built;
    });

  it("fails the build when a transform drops the source map", ({ brokenMapFailure }) => {
    expect(brokenMapFailure).toContain("SOURCEMAP_BROKEN");
  });

  it("leaves a build whose transforms keep the source map alone", ({ keptMapBuild }) => {
    expect(keptMapBuild).toBe(true);
  });
});
