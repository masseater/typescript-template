import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";
import { describe, expect } from "vite-plus/test";

import { path } from "../../../../platform/path.ts";
import { analyzeCanonicalValuesRepository } from "./builder.ts";
import { publicPackageEntries, publicPackageName } from "./export-specifier-index.ts";
import { importRouteStatus } from "./import-route.ts";

const ORDER_STATUS_OWNER =
  '/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n';

const ORDER_STATUS_RE_EXPORT = 'export { ORDER_STATUSES } from "./order-status.ts";\n';

const ORDER_STATUS_RE_EXPORT_FROM_PARENT = 'export { ORDER_STATUSES } from "../order-status.ts";\n';

const ORDER_STATUS_SHADOW = 'export const ORDER_STATUSES = ["draft", "published"] as const;\n';

const ORDER_STATUS_MODULE_VALUE =
  'import { ORDER_STATUSES } from "./order-status.ts";\nexport = ORDER_STATUSES;\n';

const ORDER_STATUS_SHADOW_MODULE_VALUE =
  'const ORDER_STATUSES = ["draft", "published"] as const;\nexport = ORDER_STATUSES;\n';

const writtenVocabularyPackage = ({
  repositoryRoot,
  malformedManifest,
  manifestPosition,
}: {
  readonly repositoryRoot: string;
  readonly malformedManifest: unknown;
  readonly manifestPosition: number;
}) =>
  Effect.gen(function* writtenVocabularyPackage() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const packageRoot = paths.join(
      repositoryRoot,
      `packages/vocabulary-${String(manifestPosition)}`,
    );
    for (const [relativePath, fileText] of Object.entries({
      "package.json": yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(
        malformedManifest,
      ),
      "src/order-status.ts": ORDER_STATUS_OWNER,
      "src/index.ts": ORDER_STATUS_RE_EXPORT,
    })) {
      const absolutePath = paths.join(packageRoot, relativePath);
      yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
      yield* filesystem.writeFileString(absolutePath, fileText);
    }
    return packageRoot;
  });

layer(NodeServices.layer)("export specifier index", (it) => {
  describe("a package manifest that carries no package name", () => {
    const fixture = Effect.gen(function* publicEntriesOfManifestsWithoutAName() {
      const filesystem = yield* FileSystem.FileSystem;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      return yield* Effect.forEach([null, [], {}], (malformedManifest, manifestPosition) =>
        Effect.gen(function* publicEntriesOfManifest() {
          const packageRoot = yield* writtenVocabularyPackage({
            repositoryRoot,
            malformedManifest,
            manifestPosition,
          });
          return publicPackageEntries(packageRoot);
        }),
      );
    });

    it.effect("publishes no entries", () =>
      Effect.gen(function* program() {
        const publicEntriesOfManifestsWithoutAName = yield* fixture;
        expect(publicEntriesOfManifestsWithoutAName).toStrictEqual([[], [], []]);
      }),
    );
  });

  describe("reading the package name out of a malformed manifest", () => {
    const fixture = Effect.gen(function* publicNamesOfMalformedManifests() {
      const filesystem = yield* FileSystem.FileSystem;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      return yield* Effect.forEach(
        [null, [], {}, { name: "" }, { name: 1 }],
        (malformedManifest, manifestPosition) =>
          Effect.gen(function* publicNameOfManifest() {
            const packageRoot = yield* writtenVocabularyPackage({
              repositoryRoot,
              malformedManifest,
              manifestPosition,
            });
            return publicPackageName(packageRoot);
          }),
      );
    });

    it.effect("is rejected on its own", () =>
      Effect.gen(function* program() {
        const publicNamesOfMalformedManifests = yield* fixture;
        expect(publicNamesOfMalformedManifests).toStrictEqual([null, null, null, null, null]);
      }),
    );
  });

  describe("an exports field naming package.json beside an invalid subpath", () => {
    const fixture = Effect.gen(function* publicEntriesOfInvalidSubpaths() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: {
            ".": "./src/index.ts",
            invalid: "./src/index.ts",
            "./package.json": "./package.json",
            "./blocked": null,
          },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      return publicPackageEntries(paths.join(repositoryRoot, "packages/vocabulary")).map(
        (publicEntry) => path.relative(repositoryRoot, publicEntry.sourceFile),
      );
    });

    it.effect("publishes the file behind the root export alone", () =>
      Effect.gen(function* program() {
        const publicEntriesOfInvalidSubpaths = yield* fixture;
        expect(publicEntriesOfInvalidSubpaths).toStrictEqual(["packages/vocabulary/src/index.ts"]);
      }),
    );
  });

  describe("the specifiers of an exports field naming package.json and an invalid subpath", () => {
    const fixture = Effect.gen(function* publicSpecifiersOfInvalidSubpaths() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: {
            ".": "./src/index.ts",
            invalid: "./src/index.ts",
            "./package.json": "./package.json",
            "./blocked": null,
          },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      return publicPackageEntries(paths.join(repositoryRoot, "packages/vocabulary")).map(
        (publicEntry) => publicEntry.specifier,
      );
    });

    it.effect("name the package alone", () =>
      Effect.gen(function* program() {
        const publicSpecifiersOfInvalidSubpaths = yield* fixture;
        expect(publicSpecifiersOfInvalidSubpaths).toStrictEqual(["@fixture/vocabulary"]);
      }),
    );
  });

  describe("a non-module JSON export beside a script owner route", () => {
    const fixture = Effect.gen(function* importRoutesOfAJsonExport() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: { ".": "./src/index.ts", "./config": "./config.json" },
        }),
        "packages/vocabulary/config.json": "{}\n",
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it.effect("leaves the script owner route standing", () =>
      Effect.gen(function* program() {
        const importRoutesOfAJsonExport = yield* fixture;
        expect(importRoutesOfAJsonExport).toStrictEqual([
          {
            exportName: "ORDER_STATUSES",
            resolvedSourcePaths: ["packages/vocabulary/src/index.ts"],
            specifier: "@fixture/vocabulary",
          },
        ]);
      }),
    );
  });

  describe("a fallback of non-runtime and exhausted targets", () => {
    const fixture = Effect.gen(function* publicEntriesOfAnExhaustedFallback() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: ["types-only", null, "../outside.ts"],
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      return publicPackageEntries(paths.join(repositoryRoot, "packages/vocabulary"));
    });

    it.effect("publishes no source entry", () =>
      Effect.gen(function* program() {
        const publicEntriesOfAnExhaustedFallback = yield* fixture;
        expect(publicEntriesOfAnExhaustedFallback).toStrictEqual([]);
      }),
    );
  });

  describe("an exports field holding an empty fallback", () => {
    const fixture = Effect.gen(function* publicEntriesOfAnEmptyFallback() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: [],
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      return publicPackageEntries(paths.join(repositoryRoot, "packages/vocabulary"));
    });

    it.effect("publishes no source entry", () =>
      Effect.gen(function* program() {
        const publicEntriesOfAnEmptyFallback = yield* fixture;
        expect(publicEntriesOfAnEmptyFallback).toStrictEqual([]);
      }),
    );
  });

  describe("an exports field whose conditions name no runtime target", () => {
    const fixture = Effect.gen(function* publicEntriesOfATypesOnlyCondition() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: { types: "./src/index.d.ts" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      return publicPackageEntries(paths.join(repositoryRoot, "packages/vocabulary"));
    });

    it.effect("publishes no source entry", () =>
      Effect.gen(function* program() {
        const publicEntriesOfATypesOnlyCondition = yield* fixture;
        expect(publicEntriesOfATypesOnlyCondition).toStrictEqual([]);
      }),
    );
  });

  describe("a malformed wildcard key beside a wildcard escaping the package", () => {
    const fixture = Effect.gen(function* publicEntriesOfAMalformedWildcard() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: { "invalid/*": "./src/public/*.ts", "./escape/*": "../public/*.ts" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      return publicPackageEntries(paths.join(repositoryRoot, "packages/vocabulary"));
    });

    it.effect("publishes no source entry", () =>
      Effect.gen(function* program() {
        const publicEntriesOfAMalformedWildcard = yield* fixture;
        expect(publicEntriesOfAMalformedWildcard).toStrictEqual([]);
      }),
    );
  });

  describe("a package directory that is not in the checkout", () => {
    const fixture = Effect.gen(function* publicEntriesOfAMissingPackageDirectory() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: "./src/index.ts",
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      return publicPackageEntries(paths.join(repositoryRoot, "packages/missing"));
    });

    it.effect("publishes no entries", () =>
      Effect.gen(function* program() {
        const publicEntriesOfAMissingPackageDirectory = yield* fixture;
        expect(publicEntriesOfAMissingPackageDirectory).toStrictEqual([]);
      }),
    );
  });

  describe("reading the package name of a directory that is not in the checkout", () => {
    const fixture = Effect.gen(function* publicNameOfAMissingPackageDirectory() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: "./src/index.ts",
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      return publicPackageName(paths.join(repositoryRoot, "packages/missing"));
    });

    it.effect("finds no package name", () =>
      Effect.gen(function* program() {
        const publicNameOfAMissingPackageDirectory = yield* fixture;
        expect(publicNameOfAMissingPackageDirectory).toBe(null);
      }),
    );
  });

  describe("a package manifest that is not an object", () => {
    const fixture = Effect.gen(function* importRoutesOfAnInvalidManifest() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": "null",
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
        (catalogedConcept) => catalogedConcept.importRoutes,
      );
    });

    it.effect("grants the owner no import route", () =>
      Effect.gen(function* program() {
        const importRoutesOfAnInvalidManifest = yield* fixture;
        expect(importRoutesOfAnInvalidManifest).toStrictEqual([[]]);
      }),
    );
  });

  describe("cataloguing an owner behind a manifest that is not an object", () => {
    const fixture = Effect.gen(function* packageNamesOfAnInvalidManifest() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": "null",
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
        (catalogedConcept) => catalogedConcept.packageName,
      );
    });

    it.effect("leaves the entry without a package name", () =>
      Effect.gen(function* program() {
        const packageNamesOfAnInvalidManifest = yield* fixture;
        expect(packageNamesOfAnInvalidManifest).toStrictEqual([null]);
      }),
    );
  });

  describe("a package manifest without an exports field", () => {
    const fixture = Effect.gen(function* publicEntriesOfAPackageWithoutExports() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({ name: "@fixture/vocabulary" }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      return publicPackageEntries(paths.join(repositoryRoot, "packages/vocabulary"));
    });

    it.effect("exposes no public source entry", () =>
      Effect.gen(function* program() {
        const publicEntriesOfAPackageWithoutExports = yield* fixture;
        expect(publicEntriesOfAPackageWithoutExports).toStrictEqual([]);
      }),
    );
  });

  describe("an owner standing behind an export-equals module value", () => {
    const fixture = Effect.gen(function* importRoutesOfAnExportEqualsOwner() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: { ".": "./src/module.ts", "./shadow": "./src/module-shadow.ts" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it.effect("publishes the package module value", () =>
      Effect.gen(function* program() {
        const importRoutesOfAnExportEqualsOwner = yield* fixture;
        expect(importRoutesOfAnExportEqualsOwner).toStrictEqual([
          {
            exportName: "<module>",
            resolvedSourcePaths: ["packages/vocabulary/src/module.ts"],
            specifier: "@fixture/vocabulary",
          },
        ]);
      }),
    );
  });

  describe("a single-star export pattern", () => {
    const fixture = Effect.gen(function* importRoutesOfASingleStarPattern() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: { "./*": "./src/public/*.ts" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it.effect("expands only the owner source identities", () =>
      Effect.gen(function* program() {
        const importRoutesOfASingleStarPattern = yield* fixture;
        expect(importRoutesOfASingleStarPattern).toStrictEqual([
          {
            exportName: "ORDER_STATUSES",
            resolvedSourcePaths: ["packages/vocabulary/src/public/owner.ts"],
            specifier: "@fixture/vocabulary/owner",
          },
        ]);
      }),
    );
  });

  describe("an exact null export beside a wildcard that matches it", () => {
    const fixture = Effect.gen(function* importRoutesOfAnExactNullExport() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: { "./owner": null, "./*": "./src/public/*.ts" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it.effect("overrides the wildcard route", () =>
      Effect.gen(function* program() {
        const importRoutesOfAnExactNullExport = yield* fixture;
        expect(importRoutesOfAnExactNullExport).toStrictEqual([]);
      }),
    );
  });

  describe("an exact shadow export beside a wildcard that matches it", () => {
    const fixture = Effect.gen(function* importRoutesOfAnExactShadowExport() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: { "./owner": "./src/shadow.ts", "./*": "./src/public/*.ts" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it.effect("overrides the wildcard owner route", () =>
      Effect.gen(function* program() {
        const importRoutesOfAnExactShadowExport = yield* fixture;
        expect(importRoutesOfAnExactShadowExport).toStrictEqual([]);
      }),
    );
  });

  describe("a null pattern written before the broad wildcard it narrows", () => {
    const fixture = Effect.gen(function* importRoutesOfANullPatternWrittenFirst() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: { "./private/*": null, "./*": "./src/public/*.ts" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/public/private/status.ts":
          'export { ORDER_STATUSES } from "../../order-status.ts";\n',
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it.effect("overrides the broad wildcard route", () =>
      Effect.gen(function* program() {
        const importRoutesOfANullPatternWrittenFirst = yield* fixture;
        expect(importRoutesOfANullPatternWrittenFirst).toStrictEqual([
          {
            exportName: "ORDER_STATUSES",
            resolvedSourcePaths: ["packages/vocabulary/src/public/owner.ts"],
            specifier: "@fixture/vocabulary/owner",
          },
        ]);
      }),
    );
  });

  describe("a null pattern written after the broad wildcard it narrows", () => {
    const fixture = Effect.gen(function* importRoutesOfANullPatternWrittenLast() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: { "./*": "./src/public/*.ts", "./private/*": null },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/public/private/status.ts":
          'export { ORDER_STATUSES } from "../../order-status.ts";\n',
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it.effect("overrides the broad wildcard route", () =>
      Effect.gen(function* program() {
        const importRoutesOfANullPatternWrittenLast = yield* fixture;
        expect(importRoutesOfANullPatternWrittenLast).toStrictEqual([
          {
            exportName: "ORDER_STATUSES",
            resolvedSourcePaths: ["packages/vocabulary/src/public/owner.ts"],
            specifier: "@fixture/vocabulary/owner",
          },
        ]);
      }),
    );
  });

  describe("a pattern target written without a file extension", () => {
    const fixture = Effect.gen(function* importRoutesOfAnExtensionlessPattern() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: { "./*": "./src/public/*" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it.effect("captures what the existing target path holds", () =>
      Effect.gen(function* program() {
        const importRoutesOfAnExtensionlessPattern = yield* fixture;
        expect(importRoutesOfAnExtensionlessPattern).toStrictEqual([
          {
            exportName: "ORDER_STATUSES",
            resolvedSourcePaths: ["packages/vocabulary/src/public/owner.ts"],
            specifier: "@fixture/vocabulary/owner.ts",
          },
        ]);
      }),
    );
  });

  describe("a pattern whose target has no file in the repository", () => {
    const fixture = Effect.gen(function* importRoutesOfAPatternWithoutAFile() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: { "./*": "./src/missing/*.ts" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it.effect("publishes no route", () =>
      Effect.gen(function* program() {
        const importRoutesOfAPatternWithoutAFile = yield* fixture;
        expect(importRoutesOfAPatternWithoutAFile).toStrictEqual([]);
      }),
    );
  });

  describe("a pattern holding a runtime condition that resolves to nothing", () => {
    const fixture = Effect.gen(function* importRoutesOfAnUnresolvedPatternCondition() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: {
            "./*": { browser: "./src/missing/*.ts", default: "./src/public/*.ts" },
          },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it.effect("publishes no route", () =>
      Effect.gen(function* program() {
        const importRoutesOfAnUnresolvedPatternCondition = yield* fixture;
        expect(importRoutesOfAnUnresolvedPatternCondition).toStrictEqual([]);
      }),
    );
  });

  describe("a pattern whose target names a JavaScript file", () => {
    const fixture = Effect.gen(function* importRoutesOfAJavaScriptTargetPattern() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: { "./*": "./src/public/*.js" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it.effect("resolves the TypeScript source behind it", () =>
      Effect.gen(function* program() {
        const importRoutesOfAJavaScriptTargetPattern = yield* fixture;
        expect(importRoutesOfAJavaScriptTargetPattern).toStrictEqual([
          {
            exportName: "ORDER_STATUSES",
            resolvedSourcePaths: ["packages/vocabulary/src/public/owner.ts"],
            specifier: "@fixture/vocabulary/owner",
          },
        ]);
      }),
    );
  });

  describe("a subpath carrying more than one star", () => {
    const fixture = Effect.gen(function* importRoutesOfAMultiStarSubpath() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: { "./**": "./src/public/*.ts" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it.effect("publishes no route", () =>
      Effect.gen(function* program() {
        const importRoutesOfAMultiStarSubpath = yield* fixture;
        expect(importRoutesOfAMultiStarSubpath).toStrictEqual([]);
      }),
    );
  });

  describe("a target carrying more than one star", () => {
    const fixture = Effect.gen(function* importRoutesOfAMultiStarTarget() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: { "./*": "./src/**/index.*" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it.effect("publishes no route", () =>
      Effect.gen(function* program() {
        const importRoutesOfAMultiStarTarget = yield* fixture;
        expect(importRoutesOfAMultiStarTarget).toStrictEqual([]);
      }),
    );
  });

  describe("a pattern target standing outside the package", () => {
    const fixture = Effect.gen(function* importRoutesOfAPatternTargetOutsideThePackage() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: { "./*": "../public/*.ts" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it.effect("publishes no route", () =>
      Effect.gen(function* program() {
        const importRoutesOfAPatternTargetOutsideThePackage = yield* fixture;
        expect(importRoutesOfAPatternTargetOutsideThePackage).toStrictEqual([]);
      }),
    );
  });

  describe("a package target symlinked outside the package", () => {
    const fixture = Effect.gen(function* importRoutesOfASymlinkedTarget() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: { ".": "./src/public-link.ts" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
        "shared/index.ts":
          'export { ORDER_STATUSES } from "../packages/vocabulary/src/order-status.ts";\n',
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      yield* filesystem.symlink(
        "../../../shared/index.ts",
        paths.join(repositoryRoot, "packages/vocabulary/src/public-link.ts"),
      );
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it.effect("publishes no route", () =>
      Effect.gen(function* program() {
        const importRoutesOfASymlinkedTarget = yield* fixture;
        expect(importRoutesOfASymlinkedTarget).toStrictEqual([]);
      }),
    );
  });

  describe("a pattern target that captures nothing", () => {
    const fixture = Effect.gen(function* importRoutesOfAPatternTargetWithoutACapture() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: { "./*": "./src/public/owner.ts" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it.effect("publishes no route", () =>
      Effect.gen(function* program() {
        const importRoutesOfAPatternTargetWithoutACapture = yield* fixture;
        expect(importRoutesOfAPatternTargetWithoutACapture).toStrictEqual([]);
      }),
    );
  });

  describe("a conditional route whose runtime target exports a shadow", () => {
    const fixture = Effect.gen(function* importRoutesOfAShadowedCondition() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: { ".": { import: "./src/shadow.ts", require: "./src/index.ts" } },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it.effect("is rejected", () =>
      Effect.gen(function* program() {
        const importRoutesOfAShadowedCondition = yield* fixture;
        expect(importRoutesOfAShadowedCondition).toStrictEqual([]);
      }),
    );
  });

  describe("a conditional route whose runtime targets share the owner export", () => {
    const fixture = Effect.gen(function* importRoutesOfASharedCondition() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: { ".": { import: "./src/index.ts", require: "./src/require.ts" } },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it.effect("keeps the export every runtime target carries", () =>
      Effect.gen(function* program() {
        const importRoutesOfASharedCondition = yield* fixture;
        expect(importRoutesOfASharedCondition).toStrictEqual([
          {
            exportName: "ORDER_STATUSES",
            resolvedSourcePaths: [
              "packages/vocabulary/src/index.ts",
              "packages/vocabulary/src/require.ts",
            ],
            specifier: "@fixture/vocabulary",
          },
        ]);
      }),
    );
  });

  describe("a runtime condition that resolves to nothing beside a default reaching the owner", () => {
    const fixture = Effect.gen(function* importRoutesOfAnUnresolvedRuntimeCondition() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: { ".": { browser: "./src/missing.ts", default: "./src/index.ts" } },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it.effect("fails closed", () =>
      Effect.gen(function* program() {
        const importRoutesOfAnUnresolvedRuntimeCondition = yield* fixture;
        expect(importRoutesOfAnUnresolvedRuntimeCondition).toStrictEqual([]);
      }),
    );
  });

  describe("an export fallback whose first resolvable target is a shadow", () => {
    const fixture = Effect.gen(function* importRoutesOfAFallbackReachingAShadow() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: { ".": ["./src/shadow.ts", "./src/index.ts"] },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it.effect("stops there", () =>
      Effect.gen(function* program() {
        const importRoutesOfAFallbackReachingAShadow = yield* fixture;
        expect(importRoutesOfAFallbackReachingAShadow).toStrictEqual([]);
      }),
    );
  });

  describe("an export fallback whose first target resolves to nothing", () => {
    const fixture = Effect.gen(function* importRoutesOfAFallbackReachingTheOwner() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-exports-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          exports: { ".": ["./src/missing.ts", "./src/index.ts"] },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it.effect("reaches the owner behind it", () =>
      Effect.gen(function* program() {
        const importRoutesOfAFallbackReachingTheOwner = yield* fixture;
        expect(importRoutesOfAFallbackReachingTheOwner).toStrictEqual([
          {
            exportName: "ORDER_STATUSES",
            resolvedSourcePaths: ["packages/vocabulary/src/index.ts"],
            specifier: "@fixture/vocabulary",
          },
        ]);
      }),
    );
  });

  describe("a workspace package whose exports name a types condition", () => {
    const fixture = Effect.gen(function* routeStatusBehindATypesCondition() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-public-route-types-",
      });

      for (const [relativePath, fileText] of Object.entries({
        "package.json": yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "fixture-repository",
          private: true,
          workspaces: ["packages/*"],
        }),
        "tsconfig.json": yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          compilerOptions: { module: "nodenext", moduleResolution: "nodenext" },
        }),
        "packages/vocabulary/package.json": yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown),
        )({
          name: "@fixture/vocabulary",
          type: "module",
          exports: {
            ".": {
              types: "./src/index.d.ts",
              import: "./src/index.ts",
              default: "./src/index.ts",
            },
          },
        }),
        "packages/vocabulary/src/owner.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": 'export { ORDER_STATUSES } from "./owner.ts";\n',
        "packages/vocabulary/src/index.d.ts":
          'export declare const ORDER_STATUSES: readonly ["draft", "published"];\n',
        "src/consumer.ts": "export {};\n",
      })) {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, fileText);
      }
      const packageLink = paths.join(repositoryRoot, "node_modules/@fixture/vocabulary");
      yield* filesystem.makeDirectory(paths.dirname(packageLink), { recursive: true });
      yield* filesystem.symlink("../../packages/vocabulary", packageLink);
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "@fixture/vocabulary",
          filename: paths.join(repositoryRoot, "src/consumer.ts"),
          repositoryRoot,
        },
        analyzeCanonicalValuesRepository({ repositoryRoot }).catalog,
      );
    });

    it.effect("resolves to the registered runtime route", () =>
      Effect.gen(function* program() {
        const routeStatusBehindATypesCondition = yield* fixture;
        expect(routeStatusBehindATypesCondition).toBe("registered");
      }),
    );
  });
});
