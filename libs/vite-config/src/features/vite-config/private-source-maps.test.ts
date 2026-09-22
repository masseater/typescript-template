import { repositoryRoot } from "@repo/config/repository-root";
import { Effect, Schema } from "effect";
import { build } from "vite-plus";
import { describe, expect, test } from "vite-plus/test";

import { paths } from "./host.ts";
import { failOnBrokenSourceMaps } from "./private-source-maps.ts";

class BrokenSourceMapCheck extends Schema.TaggedError<BrokenSourceMapCheck>()(
  "BrokenSourceMapCheck",
  { message: Schema.String },
) {}

const bundleEntry = paths.join(repositoryRoot, "libs/vite-config/src/features/vite-config/source-maps.ts");

describe("failOnBrokenSourceMaps", () => {
  const it = test
    .extend("brokenMapReportsSourceMapBroken", () =>
      Effect.runPromise(
        Effect.tryPromise({
          catch: (buildFailure: unknown) =>
            new BrokenSourceMapCheck({
              message: buildFailure instanceof Error ? buildFailure.message : "unknown failure",
            }),
          try: () =>
            build({
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
            }),
        }).pipe(
          Effect.match({
            onFailure: (buildFailure) => buildFailure.message.includes("SOURCEMAP_BROKEN"),
            onSuccess: () => false,
          }),
        ),
      ))
    .extend("keptMapBuild", () =>
      Effect.runPromise(
        Effect.promise(() =>
          build({
            build: {
              lib: { entry: bundleEntry, fileName: "entry", formats: ["es"] },
              sourcemap: true,
              write: false,
            },
            configFile: false,
            logLevel: "silent",
            plugins: [failOnBrokenSourceMaps()],
          }),
        ).pipe(
          Effect.map((built) => {
            const bundles = Array.isArray(built) ? built : [built];
            return bundles.some((bundle) => "output" in bundle);
          }),
        ),
      ),
    );

  it("fails the build when a transform drops the source map", ({
    brokenMapReportsSourceMapBroken,
  }) => {
    expect(brokenMapReportsSourceMapBroken).toBe(true);
  });

  it("leaves a build whose transforms keep the source map alone", ({ keptMapBuild }) => {
    expect(keptMapBuild).toBe(true);
  });
});
