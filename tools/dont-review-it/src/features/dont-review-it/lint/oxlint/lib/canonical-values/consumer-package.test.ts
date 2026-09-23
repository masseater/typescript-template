import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";
import { describe, expect } from "vite-plus/test";

import { ownersVisibleFrom } from "./consumer-package.ts";

import type { CanonicalValuesEntry } from "./catalog.ts";

const vocabularyOwner: CanonicalValuesEntry = {
  annotationStart: 0,
  binding: "STATUSES",
  bindingStart: 0,
  conceptId: "vocabulary.status",
  declarationEnd: 0,
  declarationPath: "packages/vocabulary/src/status.ts",
  declarationStart: 0,
  fingerprint: "",
  importRoutes: [
    {
      exportName: "STATUSES",
      resolvedSourcePaths: ["packages/vocabulary/src/index.ts"],
      specifier: "@fixture/vocabulary",
    },
  ],
  packageName: "@fixture/vocabulary",
  values: ["draft", "published"],
};

layer(NodeServices.layer)("ownersVisibleFrom", (it) => {
  describe.for([
    ["a package the consumer depends on, published", "@fixture/vocabulary", true, true],
    ["a package the consumer depends on, unpublished", "@fixture/vocabulary", false, false],
    ["the consumer's own package, unpublished", "@fixture/app", false, true],
    ["a package the consumer does not depend on", "@fixture/unrelated", true, false],
    ["no package at all", null, false, true],
  ] as const)("an owner declared in %s", ([, ownerPackage, published, visibility]) => {
    const fixture = Effect.gen(function* ownerVisible() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "consumer-package-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages/app/src"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({ name: "root" }),
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages/app/package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "@fixture/app",
          dependencies: { "@fixture/vocabulary": "workspace:*" },
        }),
      );
      return ownersVisibleFrom({
        filename: paths.join(repositoryRoot, "packages/app/src/view.ts"),
        repositoryRoot,
      })({
        ...vocabularyOwner,
        importRoutes: published ? vocabularyOwner.importRoutes : [],
        packageName: ownerPackage,
      });
    });

    it.effect("is visible only where the consumer can import it", () =>
      Effect.gen(function* program() {
        const ownerVisible = yield* fixture;
        expect(ownerVisible).toBe(visibility);
      }),
    );
  });
});
