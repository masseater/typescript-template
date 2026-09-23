import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";
import { range } from "es-toolkit";
import { describe, expect } from "vite-plus/test";

import { governingSurfacesOf } from "./declared-surfaces.ts";

const MODULE_SOURCE = "export const shipped = true;\n";

const WORKSPACE_MANIFEST = "packages:\n  - packages/*\n";

layer(NodeServices.layer)("governingSurfacesOf", (it) => {
  describe("a package declaring a runnable and an importable surface in one manifest", () => {
    const fixture = Effect.gen(function* surfacesOfAPackageDeclaringBoth() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.realPath(
        yield* filesystem.makeTempDirectoryScoped({ prefix: "declared-surfaces-" }),
      );

      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_MANIFEST,
      );
      yield* filesystem.makeDirectory(paths.join(root, "packages", "both"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "both", "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "@fixture/both",
          bin: { "fixture-both": "./cli.ts" },
          exports: { ".": "./src/index.ts" },
        }),
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "both", "entry.ts"),
        MODULE_SOURCE,
      );
      return governingSurfacesOf({
        cwd: root,
        filename: paths.join(root, "packages", "both", "entry.ts"),
      });
    });

    it.effect("names both surfaces the manifest declares", () =>
      Effect.gen(function* program() {
        const surfacesOfAPackageDeclaringBoth = yield* fixture;
        expect(surfacesOfAPackageDeclaringBoth).toStrictEqual({
          packageName: "@fixture/both",
          manifestPath: "packages/both/package.json",
          runnableFields: ["bin"],
          importableFields: ["exports"],
        });
      }),
    );
  });

  describe("a file nested several directories inside a package", () => {
    const fixture = Effect.gen(function* surfacesOfAFileNestedInsideAPackage() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.realPath(
        yield* filesystem.makeTempDirectoryScoped({ prefix: "declared-surfaces-" }),
      );

      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_MANIFEST,
      );
      yield* filesystem.makeDirectory(paths.join(root, "packages", "both", "src", "deep"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "both", "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "@fixture/both",
          bin: { "fixture-both": "./cli.ts" },
          exports: { ".": "./src/index.ts" },
        }),
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "both", "src", "deep", "inner.ts"),
        MODULE_SOURCE,
      );
      return governingSurfacesOf({
        cwd: root,
        filename: paths.join(root, "packages", "both", "src", "deep", "inner.ts"),
      });
    });

    it.effect("is read from the manifest of the package that file belongs to", () =>
      Effect.gen(function* program() {
        const surfacesOfAFileNestedInsideAPackage = yield* fixture;
        expect(surfacesOfAFileNestedInsideAPackage).toStrictEqual({
          packageName: "@fixture/both",
          manifestPath: "packages/both/package.json",
          runnableFields: ["bin"],
          importableFields: ["exports"],
        });
      }),
    );
  });

  describe("a package whose exports map only reaches the manifest itself", () => {
    const fixture = Effect.gen(function* surfacesOfAPackageExportingOnlyItsManifest() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.realPath(
        yield* filesystem.makeTempDirectoryScoped({ prefix: "declared-surfaces-" }),
      );

      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_MANIFEST,
      );
      yield* filesystem.makeDirectory(paths.join(root, "packages", "runnable"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "runnable", "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "@fixture/runnable",
          bin: { "fixture-runnable": "./cli.ts" },
          exports: { "./package.json": "./package.json" },
          scripts: { build: "vp pack" },
        }),
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "runnable", "entry.ts"),
        MODULE_SOURCE,
      );
      return governingSurfacesOf({
        cwd: root,
        filename: paths.join(root, "packages", "runnable", "entry.ts"),
      });
    });

    it.effect("counts that map as no import surface", () =>
      Effect.gen(function* program() {
        const surfacesOfAPackageExportingOnlyItsManifest = yield* fixture;
        expect(surfacesOfAPackageExportingOnlyItsManifest).toStrictEqual({
          packageName: "@fixture/runnable",
          manifestPath: "packages/runnable/package.json",
          runnableFields: ["bin"],
          importableFields: [],
        });
      }),
    );
  });

  describe("a package declaring blank and empty targets", () => {
    const fixture = Effect.gen(function* surfacesOfAPackageDeclaringBlankTargets() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.realPath(
        yield* filesystem.makeTempDirectoryScoped({ prefix: "declared-surfaces-" }),
      );

      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_MANIFEST,
      );
      yield* filesystem.makeDirectory(paths.join(root, "packages", "blank"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "blank", "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "@fixture/blank",
          bin: "",
          exports: {},
          main: "   ",
          types: null,
        }),
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "blank", "entry.ts"),
        MODULE_SOURCE,
      );
      return governingSurfacesOf({
        cwd: root,
        filename: paths.join(root, "packages", "blank", "entry.ts"),
      });
    });

    it.effect("counts them as no surface at all", () =>
      Effect.gen(function* program() {
        const surfacesOfAPackageDeclaringBlankTargets = yield* fixture;
        expect(surfacesOfAPackageDeclaringBlankTargets).toStrictEqual({
          packageName: "@fixture/blank",
          manifestPath: "packages/blank/package.json",
          runnableFields: [],
          importableFields: [],
        });
      }),
    );
  });

  describe("a package declaring a bundler entry beside a type entry", () => {
    const fixture = Effect.gen(function* surfacesOfAPackageDeclaringBundlerAndTypeEntries() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.realPath(
        yield* filesystem.makeTempDirectoryScoped({ prefix: "declared-surfaces-" }),
      );

      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_MANIFEST,
      );
      yield* filesystem.makeDirectory(paths.join(root, "packages", "legacy"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "legacy", "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "@fixture/legacy",
          module: "./dist/index.js",
          typings: "./dist/index.d.ts",
        }),
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "legacy", "entry.ts"),
        MODULE_SOURCE,
      );
      return governingSurfacesOf({
        cwd: root,
        filename: paths.join(root, "packages", "legacy", "entry.ts"),
      });
    });

    it.effect("counts both as the import surface", () =>
      Effect.gen(function* program() {
        const surfacesOfAPackageDeclaringBundlerAndTypeEntries = yield* fixture;
        expect(surfacesOfAPackageDeclaringBundlerAndTypeEntries).toStrictEqual({
          packageName: "@fixture/legacy",
          manifestPath: "packages/legacy/package.json",
          runnableFields: [],
          importableFields: ["module", "typings"],
        });
      }),
    );
  });

  describe("a package declaring a type entry beside a runnable entry", () => {
    const fixture = Effect.gen(function* surfacesOfAPackageDeclaringATypeEntryBesideARunnableOne() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.realPath(
        yield* filesystem.makeTempDirectoryScoped({ prefix: "declared-surfaces-" }),
      );

      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_MANIFEST,
      );
      yield* filesystem.makeDirectory(paths.join(root, "packages", "typed"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "typed", "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "@fixture/typed",
          bin: "./cli.ts",
          types: "./dist/index.d.ts",
        }),
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "typed", "entry.ts"),
        MODULE_SOURCE,
      );
      return governingSurfacesOf({
        cwd: root,
        filename: paths.join(root, "packages", "typed", "entry.ts"),
      });
    });

    it.effect("counts the type entry as the second surface", () =>
      Effect.gen(function* program() {
        const surfacesOfAPackageDeclaringATypeEntryBesideARunnableOne = yield* fixture;
        expect(surfacesOfAPackageDeclaringATypeEntryBesideARunnableOne).toStrictEqual({
          packageName: "@fixture/typed",
          manifestPath: "packages/typed/package.json",
          runnableFields: ["bin"],
          importableFields: ["types"],
        });
      }),
    );
  });

  describe("a package writing its target inside an array of alternatives", () => {
    const fixture = Effect.gen(function* surfacesOfAPackageDeclaringAnArrayOfAlternatives() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.realPath(
        yield* filesystem.makeTempDirectoryScoped({ prefix: "declared-surfaces-" }),
      );

      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_MANIFEST,
      );
      yield* filesystem.makeDirectory(paths.join(root, "packages", "arrayed"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "arrayed", "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "@fixture/arrayed",
          exports: { ".": [null, "./dist/index.js"] },
        }),
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "arrayed", "entry.ts"),
        MODULE_SOURCE,
      );
      return governingSurfacesOf({
        cwd: root,
        filename: paths.join(root, "packages", "arrayed", "entry.ts"),
      });
    });

    it.effect("reads the target out of that array", () =>
      Effect.gen(function* program() {
        const surfacesOfAPackageDeclaringAnArrayOfAlternatives = yield* fixture;
        expect(surfacesOfAPackageDeclaringAnArrayOfAlternatives).toStrictEqual({
          packageName: "@fixture/arrayed",
          manifestPath: "packages/arrayed/package.json",
          runnableFields: [],
          importableFields: ["exports"],
        });
      }),
    );
  });

  describe("a package nesting conditions past the limit", () => {
    const fixture = Effect.gen(function* surfacesOfAPackageNestingConditionsPastTheLimit() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.realPath(
        yield* filesystem.makeTempDirectoryScoped({ prefix: "declared-surfaces-" }),
      );

      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_MANIFEST,
      );
      yield* filesystem.makeDirectory(paths.join(root, "packages", "deep"), { recursive: true });
      const nested = range(0, 12).reduce<unknown>(
        (condition) => ({ default: condition }),
        "./dist/index.js",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "deep", "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "@fixture/deep",
          exports: nested,
        }),
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "deep", "entry.ts"),
        MODULE_SOURCE,
      );
      return governingSurfacesOf({
        cwd: root,
        filename: paths.join(root, "packages", "deep", "entry.ts"),
      });
    });

    it.effect("stops descending and reads no surface", () =>
      Effect.gen(function* program() {
        const surfacesOfAPackageNestingConditionsPastTheLimit = yield* fixture;
        expect(surfacesOfAPackageNestingConditionsPastTheLimit).toStrictEqual({
          packageName: "@fixture/deep",
          manifestPath: "packages/deep/package.json",
          runnableFields: [],
          importableFields: [],
        });
      }),
    );
  });

  describe("a package whose manifest declares no name", () => {
    const fixture = Effect.gen(function* surfacesOfAPackageDeclaringNoName() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.realPath(
        yield* filesystem.makeTempDirectoryScoped({ prefix: "declared-surfaces-" }),
      );

      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_MANIFEST,
      );
      yield* filesystem.makeDirectory(paths.join(root, "packages", "nameless"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "nameless", "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          bin: "./cli.ts",
          main: "./index.js",
        }),
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "nameless", "entry.ts"),
        MODULE_SOURCE,
      );
      return governingSurfacesOf({
        cwd: root,
        filename: paths.join(root, "packages", "nameless", "entry.ts"),
      });
    });

    it.effect("falls back to the directory it stands in", () =>
      Effect.gen(function* program() {
        const surfacesOfAPackageDeclaringNoName = yield* fixture;
        expect(surfacesOfAPackageDeclaringNoName).toStrictEqual({
          packageName: "packages/nameless",
          manifestPath: "packages/nameless/package.json",
          runnableFields: ["bin"],
          importableFields: ["main"],
        });
      }),
    );
  });

  describe("a package whose declared name is blank", () => {
    const fixture = Effect.gen(function* surfacesOfAPackageDeclaringABlankName() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.realPath(
        yield* filesystem.makeTempDirectoryScoped({ prefix: "declared-surfaces-" }),
      );

      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_MANIFEST,
      );
      yield* filesystem.makeDirectory(paths.join(root, "packages", "blank-name"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "blank-name", "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "   ",
          bin: "./cli.ts",
          exports: "./index.js",
        }),
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "blank-name", "entry.ts"),
        MODULE_SOURCE,
      );
      return governingSurfacesOf({
        cwd: root,
        filename: paths.join(root, "packages", "blank-name", "entry.ts"),
      });
    });

    it.effect("falls back to the directory it stands in", () =>
      Effect.gen(function* program() {
        const surfacesOfAPackageDeclaringABlankName = yield* fixture;
        expect(surfacesOfAPackageDeclaringABlankName).toStrictEqual({
          packageName: "packages/blank-name",
          manifestPath: "packages/blank-name/package.json",
          runnableFields: ["bin"],
          importableFields: ["exports"],
        });
      }),
    );
  });

  describe("the manifest standing at the repository root", () => {
    const fixture = Effect.gen(function* surfacesOfTheRepositoryRootPackage() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.realPath(
        yield* filesystem.makeTempDirectoryScoped({ prefix: "declared-surfaces-" }),
      );

      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          bin: "./cli.ts",
          main: "./index.js",
        }),
      );
      yield* filesystem.writeFileString(paths.join(root, "entry.ts"), MODULE_SOURCE);
      return governingSurfacesOf({ cwd: root, filename: paths.join(root, "entry.ts") });
    });

    it.effect("is named by the root itself", () =>
      Effect.gen(function* program() {
        const surfacesOfTheRepositoryRootPackage = yield* fixture;
        expect(surfacesOfTheRepositoryRootPackage).toStrictEqual({
          packageName: ".",
          manifestPath: "package.json",
          runnableFields: ["bin"],
          importableFields: ["main"],
        });
      }),
    );
  });

  describe("a manifest that is not an object", () => {
    const fixture = Effect.gen(function* surfacesOfAManifestThatIsNotAnObject() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.realPath(
        yield* filesystem.makeTempDirectoryScoped({ prefix: "declared-surfaces-" }),
      );

      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_MANIFEST,
      );
      yield* filesystem.makeDirectory(paths.join(root, "packages", "broken"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "broken", "package.json"),
        "[]\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "broken", "entry.ts"),
        MODULE_SOURCE,
      );
      return governingSurfacesOf({
        cwd: root,
        filename: paths.join(root, "packages", "broken", "entry.ts"),
      });
    });

    it.effect("governs no surface", () =>
      Effect.gen(function* program() {
        const surfacesOfAManifestThatIsNotAnObject = yield* fixture;
        expect(surfacesOfAManifestThatIsNotAnObject).toBe(null);
      }),
    );
  });

  describe("a file no manifest governs", () => {
    const fixture = Effect.gen(function* surfacesOfAFileNoManifestGoverns() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.realPath(
        yield* filesystem.makeTempDirectoryScoped({ prefix: "declared-surfaces-" }),
      );

      yield* filesystem.writeFileString(paths.join(root, "pnpm-workspace.yaml"), "packages: []\n");
      yield* filesystem.writeFileString(paths.join(root, "loose.ts"), MODULE_SOURCE);
      return governingSurfacesOf({ cwd: root, filename: paths.join(root, "loose.ts") });
    });

    it.effect("reads no surface for it", () =>
      Effect.gen(function* program() {
        const surfacesOfAFileNoManifestGoverns = yield* fixture;
        expect(surfacesOfAFileNoManifestGoverns).toBe(null);
      }),
    );
  });

  describe("a manifest read before any rewrite", () => {
    const fixture = Effect.gen(function* surfacesReadBeforeTheManifestWasRewritten() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.realPath(
        yield* filesystem.makeTempDirectoryScoped({ prefix: "declared-surfaces-" }),
      );

      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_MANIFEST,
      );
      yield* filesystem.makeDirectory(paths.join(root, "packages", "remembered"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "remembered", "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "@fixture/remembered",
          bin: "./cli.ts",
        }),
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "remembered", "entry.ts"),
        MODULE_SOURCE,
      );
      return governingSurfacesOf({
        cwd: root,
        filename: paths.join(root, "packages", "remembered", "entry.ts"),
      });
    });

    it.effect("carries the import surface that manifest declared", () =>
      Effect.gen(function* program() {
        const surfacesReadBeforeTheManifestWasRewritten = yield* fixture;
        expect(surfacesReadBeforeTheManifestWasRewritten).toStrictEqual({
          packageName: "@fixture/remembered",
          manifestPath: "packages/remembered/package.json",
          runnableFields: ["bin"],
          importableFields: [],
        });
      }),
    );
  });

  describe("a manifest read again after it was rewritten", () => {
    const fixture = Effect.gen(function* surfacesReadAfterTheManifestWasRewritten() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.realPath(
        yield* filesystem.makeTempDirectoryScoped({ prefix: "declared-surfaces-" }),
      );

      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_MANIFEST,
      );
      yield* filesystem.makeDirectory(paths.join(root, "packages", "remembered"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "remembered", "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "@fixture/remembered",
          bin: "./cli.ts",
        }),
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "remembered", "entry.ts"),
        MODULE_SOURCE,
      );
      governingSurfacesOf({
        cwd: root,
        filename: paths.join(root, "packages", "remembered", "entry.ts"),
      });
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "remembered", "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "@fixture/remembered",
          bin: "./cli.ts",
          exports: { ".": "./src/index.ts" },
        }),
      );
      return governingSurfacesOf({
        cwd: root,
        filename: paths.join(root, "packages", "remembered", "entry.ts"),
      });
    });

    it.effect("still carries what the first read remembered", () =>
      Effect.gen(function* program() {
        const surfacesReadAfterTheManifestWasRewritten = yield* fixture;
        expect(surfacesReadAfterTheManifestWasRewritten).toStrictEqual({
          packageName: "@fixture/remembered",
          manifestPath: "packages/remembered/package.json",
          runnableFields: ["bin"],
          importableFields: [],
        });
      }),
    );
  });
});
