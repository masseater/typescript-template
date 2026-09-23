import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { path } from "../../../../platform/path.ts";
import {
  declaresPublicSubpath,
  isInsideDirectory,
  owningPackageDirectoryOf,
  publicEntryFilesOf,
} from "./package-entries.ts";

layer(NodeServices.layer)("publicEntryFilesOf", (it) => {
  describe("a manifest that is not an object", () => {
    const fixture = Effect.gen(function* entryFilesOfAManifestThatIsNotAnObject() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "setup-modules-package-entries-",
      });

      yield* filesystem.writeFileString(pathService.join(root, "package.json"), "[]");
      return publicEntryFilesOf(root);
    });

    it.effect("declares no public entry", () =>
      Effect.gen(function* program() {
        const entryFilesOfAManifestThatIsNotAnObject = yield* fixture;
        expect(entryFilesOfAManifestThatIsNotAnObject).toBe(null);
      }),
    );
  });

  describe("a directory holding no manifest", () => {
    const fixture = Effect.gen(function* entryFilesOfADirectoryHoldingNoManifest() {
      const filesystem = yield* FileSystem.FileSystem;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "setup-modules-package-entries-",
      });

      return publicEntryFilesOf(root);
    });

    it.effect("declares no public entry", () =>
      Effect.gen(function* program() {
        const entryFilesOfADirectoryHoldingNoManifest = yield* fixture;
        expect(entryFilesOfADirectoryHoldingNoManifest).toBe(null);
      }),
    );
  });

  describe("an entry named under a condition", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const conditionedRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "setup-modules-package-entries-conditioned-",
      });
      const entryFilesOfAnEntryNamedUnderACondition = yield* Effect.gen(
        function* entryFilesOfAnEntryNamedUnderACondition() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;
          const root = conditionedRoot;

          yield* filesystem.makeDirectory(pathService.join(root, "src"), { recursive: true });
          yield* filesystem.writeFileString(
            pathService.join(root, "src/index.ts"),
            "export const entered = 1;\n",
          );
          yield* filesystem.writeFileString(
            pathService.join(root, "src/plugin.ts"),
            "export const plugged = 2;\n",
          );
          yield* filesystem.writeFileString(
            pathService.join(root, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              name: "@fixture/conditioned",
              exports: { ".": { import: "./src/index.ts" } },
            }),
          );
          return publicEntryFilesOf(root);
        },
      );
      return { conditionedRoot, entryFilesOfAnEntryNamedUnderACondition };
    });

    it.effect("is taken as the entry of its subpath", () =>
      Effect.gen(function* program() {
        const pathService = yield* Path.Path;
        const { entryFilesOfAnEntryNamedUnderACondition, conditionedRoot } = yield* fixtures;
        expect(entryFilesOfAnEntryNamedUnderACondition).toStrictEqual([
          pathService.join(conditionedRoot, "src/index.ts"),
        ]);
      }),
    );
  });

  describe("a subpath offering several entries", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const severalRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "setup-modules-package-entries-several-",
      });
      const entryFilesOfASubpathOfferingSeveralEntries = yield* Effect.gen(
        function* entryFilesOfASubpathOfferingSeveralEntries() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;
          const root = severalRoot;

          yield* filesystem.makeDirectory(pathService.join(root, "src"), { recursive: true });
          yield* filesystem.writeFileString(
            pathService.join(root, "src/index.ts"),
            "export const entered = 1;\n",
          );
          yield* filesystem.writeFileString(
            pathService.join(root, "src/plugin.ts"),
            "export const plugged = 2;\n",
          );
          yield* filesystem.writeFileString(
            pathService.join(root, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              name: "@fixture/several",
              exports: { ".": ["./src/index.ts", "./src/plugin.ts"] },
            }),
          );
          return publicEntryFilesOf(root);
        },
      );
      return { severalRoot, entryFilesOfASubpathOfferingSeveralEntries };
    });

    it.effect("takes each of them", () =>
      Effect.gen(function* program() {
        const pathService = yield* Path.Path;
        const { entryFilesOfASubpathOfferingSeveralEntries, severalRoot } = yield* fixtures;
        expect(entryFilesOfASubpathOfferingSeveralEntries).toStrictEqual([
          pathService.join(severalRoot, "src/index.ts"),
          pathService.join(severalRoot, "src/plugin.ts"),
        ]);
      }),
    );
  });

  describe("an entry written as a bare specifier", () => {
    const fixture = Effect.gen(function* entryFilesOfAnEntryWrittenAsABareSpecifier() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "setup-modules-package-entries-",
      });

      yield* filesystem.makeDirectory(pathService.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(root, "src/index.ts"),
        "export const entered = 1;\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(root, "src/plugin.ts"),
        "export const plugged = 2;\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(root, "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "@fixture/redirected",
          exports: { ".": "other-package/entry.js" },
        }),
      );
      return publicEntryFilesOf(root);
    });

    it.effect("is not a file of this package", () =>
      Effect.gen(function* program() {
        const entryFilesOfAnEntryWrittenAsABareSpecifier = yield* fixture;
        expect(entryFilesOfAnEntryWrittenAsABareSpecifier).toBe(null);
      }),
    );
  });

  describe("an entry naming a file that was never built", () => {
    const fixture = Effect.gen(function* entryFilesOfAnEntryNamingAFileThatWasNeverBuilt() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "setup-modules-package-entries-",
      });

      yield* filesystem.makeDirectory(pathService.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(root, "src/index.ts"),
        "export const entered = 1;\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(root, "src/plugin.ts"),
        "export const plugged = 2;\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(root, "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "@fixture/unbuilt",
          exports: { ".": "./dist/index.js" },
        }),
      );
      return publicEntryFilesOf(root);
    });

    it.effect("declares nothing this reading can follow", () =>
      Effect.gen(function* program() {
        const entryFilesOfAnEntryNamingAFileThatWasNeverBuilt = yield* fixture;
        expect(entryFilesOfAnEntryNamingAFileThatWasNeverBuilt).toBe(null);
      }),
    );
  });
});

layer(NodeServices.layer)("declaresPublicSubpath", (it) => {
  describe("a manifest that is not an object", () => {
    const fixture = Effect.gen(function* subpathDeclaredByAManifestThatIsNotAnObject() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "setup-modules-package-entries-",
      });

      yield* filesystem.writeFileString(pathService.join(root, "package.json"), "[]");
      return declaresPublicSubpath({ packageDirectory: root, subpath: "." });
    });

    it.effect("declares no subpath", () =>
      Effect.gen(function* program() {
        const subpathDeclaredByAManifestThatIsNotAnObject = yield* fixture;
        expect(subpathDeclaredByAManifestThatIsNotAnObject).toBe(false);
      }),
    );
  });

  describe("a subpath written with a wildcard", () => {
    const fixture = Effect.gen(function* subpathSpannedByAWildcard() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "setup-modules-package-entries-",
      });

      yield* filesystem.makeDirectory(pathService.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(root, "src/index.ts"),
        "export const entered = 1;\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(root, "src/plugin.ts"),
        "export const plugged = 2;\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(root, "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "@fixture/spanned",
          exports: { ".": "./src/index.ts", "./tsconfig/*": "./tsconfig/*" },
        }),
      );
      return declaresPublicSubpath({
        packageDirectory: root,
        subpath: "./tsconfig/library.json",
      });
    });

    it.effect("covers the paths it spans", () =>
      Effect.gen(function* program() {
        const subpathSpannedByAWildcard = yield* fixture;
        expect(subpathSpannedByAWildcard).toBe(true);
      }),
    );
  });

  describe("a subpath of a different depth than the wildcard", () => {
    const fixture = Effect.gen(function* subpathOfADifferentDepthThanTheWildcard() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "setup-modules-package-entries-",
      });

      yield* filesystem.makeDirectory(pathService.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(root, "src/index.ts"),
        "export const entered = 1;\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(root, "src/plugin.ts"),
        "export const plugged = 2;\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(root, "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "@fixture/spanned",
          exports: { ".": "./src/index.ts", "./tsconfig/*": "./tsconfig/*" },
        }),
      );
      return declaresPublicSubpath({
        packageDirectory: root,
        subpath: "./tsconfig/base/app.json",
      });
    });

    it.effect("is not covered by a wildcard", () =>
      Effect.gen(function* program() {
        const subpathOfADifferentDepthThanTheWildcard = yield* fixture;
        expect(subpathOfADifferentDepthThanTheWildcard).toBe(false);
      }),
    );
  });
});

describe("owningPackageDirectoryOf", () => {
  describe("a file under no manifest at all", () => {
    const it = test.extend("owningPackageDirectoryOfAFileUnderNoManifest", () =>
      owningPackageDirectoryOf(path.join(path.parse(process.cwd()).root, "never-written-here.ts")));

    it("belongs to no package", ({ owningPackageDirectoryOfAFileUnderNoManifest }) => {
      expect(owningPackageDirectoryOfAFileUnderNoManifest).toBe(null);
    });
  });
});

layer(NodeServices.layer)("isInsideDirectory", (it) => {
  describe("a directory held against itself", () => {
    const fixture = Effect.gen(function* verdictOnADirectoryHeldAgainstItself() {
      const filesystem = yield* FileSystem.FileSystem;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "setup-modules-package-entries-",
      });

      return isInsideDirectory({ path: root, directory: root });
    });

    it.effect("is not inside itself", () =>
      Effect.gen(function* program() {
        const verdictOnADirectoryHeldAgainstItself = yield* fixture;
        expect(verdictOnADirectoryHeldAgainstItself).toBe(false);
      }),
    );
  });
});
