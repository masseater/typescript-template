import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { UNSCANNED_DIRECTORY_NAMES } from "../repository-scan/worktree-files.ts";
import { assetsNameMarkersFrom } from "../spec-syntax/assets-files.ts";
import { specDirectoryNamesFrom } from "../spec-syntax/spec-directories.ts";
import { DEFAULT_SPEC_FILE_SUFFIXES } from "../spec-syntax/spec-files.ts";
import { foreignFilesIn, holdingWorkspaceOf } from "./foreign-files.ts";

const CONVENTION = {
  specDirectoryNames: specDirectoryNamesFrom([]),
  specFileSuffixes: DEFAULT_SPEC_FILE_SUFFIXES,
  assetsNameMarkers: assetsNameMarkersFrom([]),
};

const HELD_SOURCE = "export const held = true;\n";

layer(NodeServices.layer)("foreignFilesIn", (it) => {
  describe("a file under a spec directory that is neither a spec nor test data", () => {
    const fixture = Effect.gen(function* foreignPathsBesideAPackageManifest() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "spec-directory-contents-",
      });

      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "package.json"),
        '{ "name": "fixture" }\n',
      );
      yield* filesystem.makeDirectory(paths.join(root, "packages", "alpha", "test"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "alpha", "package.json"),
        HELD_SOURCE,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "alpha", "test", "helpers.ts"),
        HELD_SOURCE,
      );
      return (
        foreignFilesIn({
          repositoryRoot: root,
          convention: CONVENTION,
          unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
        }).get("packages/alpha") ?? []
      ).map((foreign) => foreign.data.foreignPath);
    });

    it.effect("is found", () =>
      Effect.gen(function* program() {
        const foreignPathsBesideAPackageManifest = yield* fixture;
        expect(foreignPathsBesideAPackageManifest).toStrictEqual([
          "packages/alpha/test/helpers.ts",
        ]);
      }),
    );
  });

  describe("a spec and its test data under a spec directory", () => {
    const fixture = Effect.gen(function* foreignPathsBesideASpecAndItsAssets() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "spec-directory-contents-",
      });

      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "package.json"),
        '{ "name": "fixture" }\n',
      );
      yield* filesystem.makeDirectory(paths.join(root, "packages", "alpha", "test"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "alpha", "package.json"),
        HELD_SOURCE,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "alpha", "test", "order.test.ts"),
        HELD_SOURCE,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "alpha", "test", "order.assets.ts"),
        HELD_SOURCE,
      );
      return (
        foreignFilesIn({
          repositoryRoot: root,
          convention: CONVENTION,
          unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
        }).get("packages/alpha") ?? []
      ).map((foreign) => foreign.data.foreignPath);
    });

    it.effect("are left alone", () =>
      Effect.gen(function* program() {
        const foreignPathsBesideASpecAndItsAssets = yield* fixture;
        expect(foreignPathsBesideASpecAndItsAssets).toStrictEqual([]);
      }),
    );
  });

  describe("a file outside every spec directory", () => {
    const fixture = Effect.gen(function* foreignPathsOutsideEverySpecDirectory() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "spec-directory-contents-",
      });

      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "package.json"),
        '{ "name": "fixture" }\n',
      );
      yield* filesystem.makeDirectory(paths.join(root, "packages", "alpha", "src"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "alpha", "package.json"),
        HELD_SOURCE,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "alpha", "src", "order.ts"),
        HELD_SOURCE,
      );
      return (
        foreignFilesIn({
          repositoryRoot: root,
          convention: CONVENTION,
          unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
        }).get("packages/alpha") ?? []
      ).map((foreign) => foreign.data.foreignPath);
    });

    it.effect("is left alone", () =>
      Effect.gen(function* program() {
        const foreignPathsOutsideEverySpecDirectory = yield* fixture;
        expect(foreignPathsOutsideEverySpecDirectory).toStrictEqual([]);
      }),
    );
  });

  describe("a file nested under a directory inside a spec directory", () => {
    const fixture = Effect.gen(function* foreignPathsNestedInsideASpecDirectory() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "spec-directory-contents-",
      });

      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "package.json"),
        '{ "name": "fixture" }\n',
      );
      yield* filesystem.makeDirectory(paths.join(root, "packages", "alpha", "test", "orders"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "alpha", "package.json"),
        HELD_SOURCE,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "alpha", "test", "orders", "held.ts"),
        HELD_SOURCE,
      );
      return (
        foreignFilesIn({
          repositoryRoot: root,
          convention: CONVENTION,
          unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
        }).get("packages/alpha") ?? []
      ).map((foreign) => foreign.data.foreignPath);
    });

    it.effect("is found as well", () =>
      Effect.gen(function* program() {
        const foreignPathsNestedInsideASpecDirectory = yield* fixture;
        expect(foreignPathsNestedInsideASpecDirectory).toStrictEqual([
          "packages/alpha/test/orders/held.ts",
        ]);
      }),
    );
  });

  describe("a spec directory outside every package", () => {
    const fixture = Effect.gen(function* foreignPathsHeldByTheRepositoryRoot() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "spec-directory-contents-",
      });

      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "package.json"),
        '{ "name": "fixture" }\n',
      );
      yield* filesystem.makeDirectory(paths.join(root, "test"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(root, "test", "setup.ts"), HELD_SOURCE);
      return (
        foreignFilesIn({
          repositoryRoot: root,
          convention: CONVENTION,
          unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
        }).get(".") ?? []
      ).map((foreign) => foreign.data.foreignPath);
    });

    it.effect("is held by the repository root", () =>
      Effect.gen(function* program() {
        const foreignPathsHeldByTheRepositoryRoot = yield* fixture;
        expect(foreignPathsHeldByTheRepositoryRoot).toStrictEqual(["test/setup.ts"]);
      }),
    );
  });

  describe("the report for a file nested under a spec directory outside every package", () => {
    const fixture = Effect.gen(function* reportsHeldByTheRepositoryRoot() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "spec-directory-contents-",
      });

      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "package.json"),
        '{ "name": "fixture" }\n',
      );
      yield* filesystem.makeDirectory(paths.join(root, "test", "orders"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(root, "test", "orders", "held.ts"), HELD_SOURCE);
      return foreignFilesIn({
        repositoryRoot: root,
        convention: CONVENTION,
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      }).get(".");
    });

    it.effect("names the spec directory the file sits in and the spellings it may carry", () =>
      Effect.gen(function* program() {
        const reportsHeldByTheRepositoryRoot = yield* fixture;
        expect(reportsHeldByTheRepositoryRoot).toStrictEqual([
          {
            workspace: ".",
            messageId: "foreignFileInSpecDirectory",
            data: {
              specDirectory: "test",
              foreignPath: "test/orders/held.ts",
              specNames: "`*.test.ts`, `*.test.tsx`",
              assetsNames: "`*.assets.*`",
            },
          },
        ]);
      }),
    );
  });

  describe("a repository asked again after a later file appeared", () => {
    const fixture = Effect.gen(function* foreignPathsWalkedAfterALaterFileAppeared() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "spec-directory-contents-",
      });

      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "package.json"),
        '{ "name": "fixture" }\n',
      );
      yield* filesystem.makeDirectory(paths.join(root, "test"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(root, "test", "setup.ts"), HELD_SOURCE);
      foreignFilesIn({
        repositoryRoot: root,
        convention: CONVENTION,
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
      yield* filesystem.writeFileString(paths.join(root, "test", "later.ts"), HELD_SOURCE);
      return (
        foreignFilesIn({
          repositoryRoot: root,
          convention: CONVENTION,
          unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
        }).get(".") ?? []
      ).map((foreign) => foreign.data.foreignPath);
    });

    it.effect("is answered from what was walked once", () =>
      Effect.gen(function* program() {
        const foreignPathsWalkedAfterALaterFileAppeared = yield* fixture;
        expect(foreignPathsWalkedAfterALaterFileAppeared).toStrictEqual(["test/setup.ts"]);
      }),
    );
  });
});

layer(NodeServices.layer)("holdingWorkspaceOf", (it) => {
  describe("a path under a tree that declares no package at all", () => {
    const fixture = Effect.gen(function* workspaceHoldingAPathUnderNoPackage() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "spec-directory-contents-",
      });

      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, "test", "setup.ts")), {
        recursive: true,
      });
      return holdingWorkspaceOf({ repositoryRoot: root, relativePath: "test/setup.ts" });
    });

    it.effect("is held by the repository root", () =>
      Effect.gen(function* program() {
        const workspaceHoldingAPathUnderNoPackage = yield* fixture;
        expect(workspaceHoldingAPathUnderNoPackage).toBe(".");
      }),
    );
  });
});
